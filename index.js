const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
const cron = require("node-cron");
const fs = require("fs");

const {
  specialDateConfig,
  itemPrefixes,
  specialDateTheme,
  maxrotationcounter,
} = require("./config/shopconfig.js");

const app = express();
exports.app = app;

const port = process.env.PORT || 3004;

process.on("SIGINT", () => {
  // It looks like mongoose isn't actually imported here, so either import or remove this handler.
  // Leaving as is per your original code
  mongoose.connection.close(() => {
    console.log("Mongoose disconnected on app termination");
    process.exit(0);
  });
});

const uri =
  "mongodb+srv://sr-server-user:I8u8a8iOBNkunxRK@cluster0.ed4zami.mongodb.net/?retryWrites=true&w=majority";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
    socketTimeoutMS: 30000,
  },
});

async function startServer() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("Error connecting to MongoDB:", err);
  }
}

const db = client.db("Cluster0");
const shopcollection = db.collection("serverconfig");

const itemsFilePath = "./config/shopitems.txt";
const previousRotationFilePath = "./tempdata/previous-rotation.txt";
const lastUpdateTimestampFilePath = "./tempdata/last-update-timestamp.txt";
const pricefile = "./config/items.txt";
const itemsUsedInLastDaysFilePath = "./tempdata/items-used-in-last-days.json";
const shopUpdateCounterFilePath = "./tempdata/shop-update-counter.json";

let lastUpdateTimestamp = null;

function loadLastUpdateTimestamp() {
  try {
    const timestampData = fs.readFileSync(lastUpdateTimestampFilePath, "utf8");
    lastUpdateTimestamp = parseInt(timestampData);
  } catch (err) {
    console.error("Error reading last update timestamp:", err);
  }
}

function saveLastUpdateTimestamp() {
  try {
    fs.writeFileSync(lastUpdateTimestampFilePath, Date.now().toString());
  } catch (err) {
    console.error("Error saving last update timestamp:", err);
  }
}

function shouldUpdateDailyRotation() {
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);

  return now > midnight && lastUpdateTimestamp < midnight.getTime();
}

let availableItems = [];
let dailyItems = {};

function loadAvailableItems() {
  try {
    const fileData = fs.readFileSync(itemsFilePath, "utf8");
    availableItems = fileData
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    console.log("Available items updated.");
  } catch (err) {
    console.error("Error reading items from file:", err);
  }
}

function loadPreviousRotation() {
  try {
    const fileData = fs.readFileSync(previousRotationFilePath, "utf8");
    const lines = fileData.split("\n").filter((item) => item.trim() !== "");

    dailyItems = {};
    lines.forEach((line, index) => {
      dailyItems[(index + 1).toString()] = line.trim();
    });

    console.log("Previous daily rotation loaded.");
  } catch (err) {
    console.error("Error reading previous daily rotation from file:", err);
  }
}

function saveDailyRotation() {
  try {
    const lines = Object.values(dailyItems);
    fs.writeFileSync(previousRotationFilePath, lines.join("\n"));
  } catch (err) {
    console.error("Error saving daily rotation to file:", err);
  }
}

function getItemsUsedInLastDays() {
  try {
    const data = fs.readFileSync(itemsUsedInLastDaysFilePath, "utf8");
    return new Map(JSON.parse(data));
  } catch (error) {
    console.error("Error reading items used in last days file:", error.message);
    return new Map();
  }
}

function saveItemsUsedInLastDays(itemsUsedInLastDaysMap) {
  try {
    const data = JSON.stringify(Array.from(itemsUsedInLastDaysMap.entries()));
    fs.writeFileSync(itemsUsedInLastDaysFilePath, data);
  } catch (error) {
    console.error("Error saving items used in last days:", error.message);
  }
}

function getShopUpdateCounter() {
  try {
    const data = fs.readFileSync(shopUpdateCounterFilePath, "utf8");
    return parseInt(data) || 0;
  } catch (error) {
    console.error("Error reading shop update counter file:", error.message);
    return 0;
  }
}

function loadItemPrices() {
  try {
    const fileData = fs.readFileSync(pricefile, "utf8");
    const items = fileData
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    const itemPrices = new Map();
    items.forEach((item) => {
      const { itemId, price } = parseItem(item);
      itemPrices.set(itemId, parseInt(price));
    });

    return itemPrices;
  } catch (err) {
    console.error("Error reading item prices from file:", err);
    return new Map();
  }
}

function parseItem(item) {
  const [itemId, price] = item.split(":");
  return { itemId, price };
}

function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function applyDiscount(items) {
  const itemKeys = Object.keys(items);

  itemKeys.forEach((key) => {
    const item = items[key];
    item.currency = "coins";
  });

  const numDiscounts = getRandomNumber(2, 3);
  const discountRate = getRandomNumber(20, 30) / 100; // discount in percent

  const discountKeys = itemKeys.sort(() => 0.5 - Math.random()).slice(0, numDiscounts);

  discountKeys.forEach((key) => {
    const item = items[key];
    item.normalprice = item.price;
    item.price = Math.round(item.price * (1 - discountRate));
    item.offertext = "SPECIAL OFFER";
  });

  return items;
}

function processDailyItemsAndSaveToServer() {
  const itemPrices = loadItemPrices();

  const dailyItemsWithPrices = Object.keys(dailyItems).reduce((result, key) => {
    const item = dailyItems[key];
    const { itemId } = parseItem(item);
    const price = itemPrices.get(itemId);
    result[key] = { itemId, price };
    return result;
  }, {});

  const date = new Date();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dateString = `${month}-${day}`;
  const theme = specialDateTheme[dateString] || undefined;

  // Get special items for today, if any
  const specialItems = Object.keys(specialDateConfig)
    .filter((date) => date === dateString)
    .reduce((items, date) => [...items, ...createKeyedItems(specialDateConfig[date])], []);

  const discountedDailyItems = applyDiscount(dailyItemsWithPrices);

  // Re-key specialItems starting from '1'
  const rekeyedSpecialItems = specialItems.reduce((result, item, index) => {
    result[index + 1] = item;
    return result;
  }, {});

  // Next key after special items
  const nextKey = Object.keys(rekeyedSpecialItems).length + 1;

  // Re-key discountedDailyItems starting from nextKey
  const rekeyedDailyItems = Object.keys(discountedDailyItems).reduce((result, key, index) => {
    result[nextKey + index] = discountedDailyItems[key];
    return result;
  }, {});

  const finalItems = {
    ...rekeyedSpecialItems,
    ...rekeyedDailyItems,
  };

  const document = {
    _id: "dailyItems",
    items: finalItems,
    theme: theme || "default",
  };

  shopcollection.updateOne({ _id: "dailyItems" }, { $set: document }, { upsert: true });
}

function incrementShopUpdateCounter() {
  const counter = getShopUpdateCounter() + 1;
  try {
    fs.writeFileSync(shopUpdateCounterFilePath, counter.toString());
  } catch (error) {
    console.error("Error incrementing shop update counter:", error.message);
  }
}

function selectDailyItems() {
  let shuffledItems = [...availableItems];
  dailyItems = {};
  const selectedItemsSet = new Set();

  const previousRotationMap = getItemsUsedInLastDays();
  const previousRotation = Array.from(previousRotationMap.keys());

  // Filter out items used in last days from available pool
  shuffledItems = shuffledItems.filter((item) => !previousRotation.includes(item));

  const shopUpdateCounter = getShopUpdateCounter();

  if (shopUpdateCounter > maxrotationcounter) {
    saveItemsUsedInLastDays(new Map());
    fs.writeFileSync(shopUpdateCounterFilePath, "0");
  }

  const now = new Date();

  for (let i = 0; i < itemPrefixes.length; i++) {
    const prefix = itemPrefixes[i];
    const validItems = shuffledItems.filter((item) => item.startsWith(prefix) && !selectedItemsSet.has(item));

    if (validItems.length > 0) {
      const randomIndex = Math.floor(Math.random() * validItems.length);
      let selectedItem = validItems[randomIndex];
      selectedItem = cleanUpItem(selectedItem);

      dailyItems[(i + 1).toString()] = selectedItem;
      selectedItemsSet.add(selectedItem);

      // Remove selected item from shuffledItems
      const indexToRemove = shuffledItems.indexOf(selectedItem);
      if (indexToRemove !== -1) {
        shuffledItems.splice(indexToRemove, 1);
      }

      const itemsUsedInLastDaysMap = getItemsUsedInLastDays();
      itemsUsedInLastDaysMap.set(selectedItem, now.getTime());
      saveItemsUsedInLastDays(itemsUsedInLastDaysMap);
    } else {
      console.error(`Not enough available items with prefix ${prefix}.`);
      return;
    }
  }

  saveDailyRotation();
  incrementShopUpdateCounter();
  processDailyItemsAndSaveToServer();
}

function cleanUpItem(item) {
  return item.replace(/\r/g, "");
}

function setSpecialDailyItems() {
  selectDailyItems();
}

function createKeyedItems(items) {
  return items.map((item) => ({ ...item }));
}

function initializeItems() {
  loadAvailableItems();
  loadPreviousRotation();
  loadLastUpdateTimestamp();

  if (shouldUpdateDailyRotation()) {
    setSpecialDailyItems();
    saveLastUpdateTimestamp();
  }
}

startServer()
  .then(() => {
    initializeItems();
  })
  .catch((error) => {
    console.error("Failed to connect to the database:", error);
  });

cron.schedule(
  "0 0 * * *",
  () => {
    setSpecialDailyItems();
    saveLastUpdateTimestamp();
    console.log("Daily rotation updated.");
  },
  {
    scheduled: true,
    timezone: "UTC",
  }
);

const currentTimestamp = Date.now();
console.log(currentTimestamp);

app.use((err, req, res, next) => {
  console.error("An error occurred:", err);
  res.status(500).json({ error: "Unexpected server error" });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

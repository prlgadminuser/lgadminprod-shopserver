const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
const cron = require("node-cron");
const fs = require("fs").promises;
const path = require("path");

const { specialDateConfig, itemPrefixes, specialDateTheme, maxrotationcounter } = require("./config/shopconfig.js");
const { MONGO_URI } = require("./ENV.js");

const app = express();
exports.app = app;
const port = process.env.PORT || 3004;

const uri = MONGO_URI;
const client = new MongoClient(uri, { serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true, socketTimeoutMS: 30000 } });

const db = client.db("Cluster0");
const shopcollection = db.collection("serverconfig");

const paths = {
  itemsFile: "./config/shopitems.txt",
  previousRotation: "./tempdata/previous-rotation.txt",
  lastUpdateTimestamp: "./tempdata/last-update-timestamp.txt",
  priceFile: "./config/items.txt",
  itemsUsedInLastDays: "./tempdata/items-used-in-last-days.json",
  shopUpdateCounter: "./tempdata/shop-update-counter.json"
};

let lastUpdateTimestamp = 0;
let availableItems = [];
let dailyItems = {};
let itemPrices = new Map();
let itemsUsedInLastDays = new Map();

async function readJSONFile(filePath, defaultValue = {}) {
  try {
    const data = await fs.readFile(filePath, "utf8");
    return JSON.parse(data);
  } catch {
    return defaultValue;
  }
}

async function writeJSONFile(filePath, data) {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error writing file:", filePath, err);
  }
}

async function loadData() {
  availableItems = (await fs.readFile(paths.itemsFile, "utf8"))
    .split("\n")
    .map((i) => i.trim())
    .filter(Boolean);

  dailyItems = {};
  try {
    const prevRotation = await fs.readFile(paths.previousRotation, "utf8");
    prevRotation.split("\n").forEach((line, i) => {
      if (line.trim()) dailyItems[(i + 1).toString()] = line.trim();
    });
  } catch {}

  lastUpdateTimestamp = parseInt(await fs.readFile(paths.lastUpdateTimestamp, "utf8").catch(() => "0"), 10);

  itemPrices = new Map();
  const priceData = (await fs.readFile(paths.priceFile, "utf8")).split("\n").filter(Boolean);
  priceData.forEach((line) => {
    const [itemId, price] = line.split(":");
    itemPrices.set(itemId, parseInt(price));
  });

  itemsUsedInLastDays = new Map(await readJSONFile(paths.itemsUsedInLastDays, []));
}

function shouldUpdateDailyRotation() {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  return Date.now() > midnight.getTime() && lastUpdateTimestamp < midnight.getTime();
}

function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function applyDiscount(items) {
  const keys = Object.keys(items);
  const numDiscounts = Math.floor(Math.random() * 2) + 2; // 2 or 3
  const discountRate = (Math.floor(Math.random() * 11) + 20) / 100;

  const shuffledKeys = [...keys].sort(() => 0.5 - Math.random());
  shuffledKeys.slice(0, numDiscounts).forEach((key) => {
    const item = items[key];
    item.normalprice = item.price;
    item.price = Math.round(item.price * (1 - discountRate));
    item.offertext = "SPECIAL OFFER";
  });

  return items;
}

async function saveDailyRotation() {
  await fs.writeFile(paths.previousRotation, Object.values(dailyItems).join("\n"));
  await fs.writeFile(paths.lastUpdateTimestamp, Date.now().toString());
  await writeJSONFile(paths.itemsUsedInLastDays, Array.from(itemsUsedInLastDays.entries()));
}

async function selectDailyItems() {
  const selectedItems = new Set();
  const availableSet = new Set(availableItems);

  const counter = parseInt(await fs.readFile(paths.shopUpdateCounter, "utf8").catch(() => "0"), 10);
  if (counter > maxrotationcounter) {
    itemsUsedInLastDays.clear();
    await fs.writeFile(paths.shopUpdateCounter, "0");
  }

  for (let i = 0; i < itemPrefixes.length; i++) {
    const prefix = itemPrefixes[i];
    const validItems = [...availableSet].filter((item) => item.startsWith(prefix) && !selectedItems.has(item) && !itemsUsedInLastDays.has(item));

    if (!validItems.length) return console.error(`Not enough items with prefix ${prefix}`);

    const selected = getRandomItem(validItems);
    dailyItems[(i + 1).toString()] = selected;
    selectedItems.add(selected);
    itemsUsedInLastDays.set(selected, Date.now());
    availableSet.delete(selected);
  }

  await saveDailyRotation();
  await processDailyItemsAndSaveToServer();
}

function processDailyItemsAndSaveToServer() {
  // Load prices from file
  let itemPrices = new Map();
  try {
    const fileData = fs.readFileSync(pricefile, "utf8");
    fileData.split("\n").filter(Boolean).forEach((line) => {
      const [itemId, price] = line.split(":");
      itemPrices.set(itemId, parseInt(price, 10));
    });
  } catch (err) {
    console.error("Error reading item prices from file:", err);
  }

  // Combine dailyItems with prices and default currency
  const dailyWithPrices = Object.fromEntries(
    Object.entries(dailyItems).map(([key, item]) => {
      const { itemId } = { itemId: item }; // here item itself is the id
      return [key, { itemId, price: itemPrices.get(itemId), currency: "coins" }];
    })
  );

  const date = new Date();
  const dateString = `${date.getMonth() + 1}-${date.getDate()}`;
  const theme = specialDateTheme[dateString] || "default";

  // Special items for today
  const specialItems = (specialDateConfig[dateString] || []).map((item) => ({
    ...item,
    currency: "coins",
  }));

  // Apply discounts to daily items
  const discountedDailyItems = applyDiscount(dailyWithPrices);

  // Re-key special items starting from 1
  const rekeyedSpecialItems = Object.fromEntries(
    specialItems.map((item, index) => [index + 1, item])
  );

  // Re-key discounted daily items starting after special items
  const nextKey = Object.keys(rekeyedSpecialItems).length + 1;
  const rekeyedDailyItems = Object.fromEntries(
    Object.entries(discountedDailyItems).map(([key, item], index) => [nextKey + index, item])
  );

  const finalItems = {
    ...rekeyedSpecialItems,
    ...rekeyedDailyItems,
  };

  // Save to MongoDB
  shopcollection.updateOne(
    { _id: "dailyItems" },
    { $set: { _id: "dailyItems", items: finalItems, theme } },
    { upsert: true }
  );
}



async function init() {
  await client.connect();
  await loadData();
  if (shouldUpdateDailyRotation()) await selectDailyItems();

  cron.schedule("0 0 * * *", async () => {
    await selectDailyItems();
    console.log("Daily rotation updated.");
  }, { scheduled: true, timezone: "UTC" });
}

app.use((err, req, res, next) => {
  console.error("An error occurred:", err);
  res.status(500).json({ error: "Unexpected server error" });
});

app.listen(port, () => console.log(`Server running on port ${port}`));

init().catch(console.error);

const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
const cron = require("node-cron");
const fs = require("fs").promises;

const { specialDateConfig, itemPrefixes, specialDateTheme, UpdateShopOnServerStart, discountCounts, discountRates } = require("./config/shopconfig.js");
const { MONGO_URI } = require("./ENV.js");

const app = express();
exports.app = app;
const port = process.env.PORT || 3000;

const uri = MONGO_URI;
const client = new MongoClient(uri, { serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true, socketTimeoutMS: 30000 } });

const db = client.db("Cluster0");
const shopcollection = db.collection("serverconfig");

const paths = {
  itemsFile: "./config/shopitems.txt",
  lastUpdateTimestamp: "./tempdata/last-update-timestamp.txt",
  priceFile: "./config/items.txt",
  itemsUsedInLastDays: "./tempdata/items-used-in-last-days.json",
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
  const numDiscounts = Math.floor(Math.random() * (discountCounts[1] - discountCounts[0] + 1)) + discountCounts[0];
  const discountRate = (Math.floor(Math.random() * (discountRates[1] - discountRates[0] + 1)) + discountRates[0]) / 100;

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
  await fs.writeFile(paths.lastUpdateTimestamp, Date.now().toString());
  await writeJSONFile(paths.itemsUsedInLastDays, Array.from(itemsUsedInLastDays.entries()));
}

async function selectDailyItems() {
  const selectedItems = new Set();
  const availableSet = new Set(availableItems);

  // Group available items by prefix to understand distribution
  const itemsByPrefix = {};
  const uniquePrefixes = [...new Set(itemPrefixes)]; // Get unique prefixes only
  
  // Initialize prefix groups
  uniquePrefixes.forEach(prefix => {
    itemsByPrefix[prefix] = [...availableSet].filter(item => 
      item.startsWith(prefix) && 
      !selectedItems.has(item) && 
      !itemsUsedInLastDays.has(item)
    );
  });

  // Calculate how many items we need from each prefix type
  const prefixCounts = {};
  itemPrefixes.forEach(prefix => {
    prefixCounts[prefix] = (prefixCounts[prefix] || 0) + 1;
  });

  // Smart selection with fallback logic
  const selectedByPrefix = {};
  let position = 1;

  // First pass: try to fulfill each prefix requirement
  for (const [prefix, requiredCount] of Object.entries(prefixCounts)) {
    selectedByPrefix[prefix] = [];
    const availableForPrefix = itemsByPrefix[prefix] || [];
    
    for (let i = 0; i < requiredCount && availableForPrefix.length > 0; i++) {
      // Select item that hasn't been used recently
      const validItems = availableForPrefix.filter(item => 
        !selectedItems.has(item) && 
        !itemsUsedInLastDays.has(item)
      );
      
      if (validItems.length > 0) {
        const selected = getRandomItem(validItems);
        selectedByPrefix[prefix].push(selected);
        selectedItems.add(selected);
        itemsUsedInLastDays.set(selected, Date.now());
        
        // Remove from available pools
        availableForPrefix.splice(availableForPrefix.indexOf(selected), 1);
        availableSet.delete(selected);
      }
    }
  }

  // Second pass: fill remaining slots with fallback logic
  const totalNeeded = itemPrefixes.length;
  let totalSelected = Object.values(selectedByPrefix).flat().length;
  
  if (totalSelected < totalNeeded) {
    console.log(`Only selected ${totalSelected}/${totalNeeded} items in first pass. Using fallback logic.`);
    
    // Get all remaining available items (ignoring prefix requirements)
    const remainingItems = [...availableSet].filter(item => 
      !selectedItems.has(item) && 
      !itemsUsedInLastDays.has(item)
    );
    
    // If we still don't have enough, allow reuse of recently used items
    let fallbackItems = remainingItems;
    if (fallbackItems.length < (totalNeeded - totalSelected)) {
      console.log("Not enough unused items, allowing reuse of recent items...");
      fallbackItems = [...availableSet].filter(item => !selectedItems.has(item));
      itemsUsedInLastDays.clear();
    }
    
    // Fill remaining slots randomly
    while (totalSelected < totalNeeded && fallbackItems.length > 0) {
      const selected = getRandomItem(fallbackItems);
      
      // Add to any prefix category that needs more items
      let addedToPrefix = false;
      for (const [prefix, requiredCount] of Object.entries(prefixCounts)) {
        if (selectedByPrefix[prefix].length < requiredCount) {
          selectedByPrefix[prefix].push(selected);
          addedToPrefix = true;
          break;
        }
      }
      
      // If all prefixes are full, add to the first prefix category
      if (!addedToPrefix) {
        const firstPrefix = Object.keys(selectedByPrefix)[0];
        selectedByPrefix[firstPrefix].push(selected);
      }
      
      selectedItems.add(selected);
      if (!itemsUsedInLastDays.has(selected)) {
        itemsUsedInLastDays.set(selected, Date.now());
      }
      
      fallbackItems.splice(fallbackItems.indexOf(selected), 1);
      totalSelected++;
    }
  }

  // Final assignment to dailyItems based on original prefix order
  dailyItems = {};
  let currentPos = 1;
  
  for (const prefix of itemPrefixes) {
    if (selectedByPrefix[prefix] && selectedByPrefix[prefix].length > 0) {
      const item = selectedByPrefix[prefix].shift(); // Take first item for this prefix
      dailyItems[currentPos.toString()] = item;
      currentPos++;
    }
  }
  
  
  // Clean up old entries from itemsUsedInLastDays (keep last 7 days)
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  for (const [item, timestamp] of itemsUsedInLastDays.entries()) {
    if (timestamp < sevenDaysAgo) {
      itemsUsedInLastDays.delete(item);
    }
  }
  
  const selectedCount = Object.keys(dailyItems).length;
  console.log(`Successfully selected ${selectedCount} daily items`);
  
  if (selectedCount < itemPrefixes.length) {
    console.warn(`Warning: Only selected ${selectedCount}/${itemPrefixes.length} items. Some shop slots may be empty.`);
  }
  
  await saveDailyRotation();
  await processDailyItemsAndSaveToServer();
}

async function processDailyItemsAndSaveToServer() {
  const dailyWithPrices = Object.fromEntries(
    Object.entries(dailyItems).map(([key, item]) => {
      const { itemId } = { itemId: item };
      const price = itemPrices.get(itemId) || 0; // Default to 0 if price not found
      if (!itemPrices.has(itemId)) {
        console.warn(`Warning: No price found for item ${itemId}, defaulting to 0`);
      }
      return [key, { itemId, price, currency: "coins" }];
    })
  );

  const dateStr = `${new Date().getMonth() + 1}-${new Date().getDate()}`;
  const theme = specialDateTheme[dateStr] || "default";

  const specialItems = (specialDateConfig[dateStr] || []).map((item, i) => ({ ...item }));

  const finalItems = {
    ...Object.fromEntries(specialItems.map((i, idx) => [idx + 1, i])),
    ...Object.fromEntries(Object.entries(applyDiscount(dailyWithPrices)).map(([k, v], i) => [specialItems.length + i + 1, v]))
  };

  await shopcollection.updateOne({ _id: "dailyItems" }, { $set: { _id: "dailyItems", items: finalItems, theme } }, { upsert: true });
}



async function init() {
  await client.connect();
  await loadData();
  if (UpdateShopOnServerStart) if (shouldUpdateDailyRotation()) await selectDailyItems();

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

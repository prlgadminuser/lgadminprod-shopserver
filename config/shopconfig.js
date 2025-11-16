const fs = require('fs');
// Original price loading logic
const priceFilePath = "./config/items.txt";

const UpdateShopOnServerStart = false
const discountCounts = [1, 2];     // min = 2, max = 3
const discountRates = [20, 30];    

function countLines(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const lines = data.split('\n');
    // Filter out empty or whitespace-only lines
    const nonEmptyLines = lines.filter(line => line.trim() !== '');
    return nonEmptyLines.length;
  } catch (err) {
    console.error('Error reading file:', err);
    return 0;
  }
}
// Example usage
const lineCount = countLines('./config/shopitems.txt');
const itemPrefixes = ["A", "B", "A", "B", "A", "B", "I", "P"];



function loadItemPrices() {
  try {
    const fileData = fs.readFileSync(priceFilePath, "utf8");
    const items = fileData.split("\n").map(item => item.trim()).filter(Boolean);

    const itemPrices = new Map();
    items.forEach(item => {
      const [itemId, price] = item.split(":");
      if (itemId && price) {
        itemPrices.set(itemId, parseInt(price, 10));
      }
    });

    return itemPrices;
  } catch (err) {
    console.error("Error reading item prices from file:", err);
    return new Map();
  }
}

const itemPrices = loadItemPrices();

function getItemPrice(itemId) {
  return itemPrices.get(itemId) || null;
}



// ------------------ DATE PARSER ------------------
const monthMap = {
  january: 1, february: 2, march: 3, april: 4,
  may: 5, june: 6, july: 7, august: 8,
  september: 9, october: 10, november: 11, december: 12
};

function parseUserDate(input) {
  // Normalize string (lowercase, trim, collapse spaces)
  input = input.toLowerCase().trim().replace(/\s+/g, " ");

  // Range like "4 december - 6 december"
  if (input.includes("-")) {
    const [start, end] = input.split("-").map(s => s.trim());

    const { month: startMonth, day: startDay } = parseDayMonth(start);
    const { month: endMonth, day: endDay } = parseDayMonth(end);

    return {
      startDate: `${startMonth}-${startDay}`,
      endDate: `${endMonth}-${endDay}`
    };
  }

  // Single date like "25 december"
  const { month, day } = parseDayMonth(input);
  return { startDate: `${month}-${day}`, endDate: `${month}-${day}` };
}

function parseDayMonth(str) {
  const parts = str.split(" ");
  if (parts.length !== 2) throw new Error(`Invalid date format: ${str}`);
  const day = parseInt(parts[0], 10);
  const monthName = parts[1].toLowerCase();
  const month = monthMap[monthName];
  if (!month) throw new Error(`Unknown month: ${monthName}`);
  return { month, day };
}

// ------------------ HELPERS ------------------
function generateDateRange(startDate, endDate) {
  const start = new Date(`2025-${startDate}`);
  const end = new Date(`2025-${endDate}`);
  const dates = [];
  while (start <= end) {
    dates.push(formatDate(start));
    start.setDate(start.getDate() + 1);
  }
  return dates;
}

function formatDate(date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}-${day}`;
}

function getExpirationTimestamp(endDate) {
  const [month, day] = endDate.split("-").map(Number);
  const year = new Date().getFullYear();
  const expirationDate = new Date(year, month - 1, day, 23, 59, 59);
  return expirationDate.getTime();
}

// ------------------ CONFIG ------------------
const userFriendlyDateConfig = [
  {
    dates: "1 january - 31 december", // <- easy to read
    items: [
      { id: ["A001", "A002"], price: "0", currency: "coins", offertext: "STARTER PACK", normalprice: "350", theme: "2" },
    ],
    theme: "default"
  },

  {
    dates: "14 february - 15 february",
    items: [
      { id: ["I007", "P003"], price: "1", offertext: "VALENTINE OFFER ❤️", theme: "4" },
    ],
    theme: "default"
  },
  
  {
    dates:  "28 october - 1 november",
    items: [
      { id: "I006", price: "250", offertext: "TRICK OR TREAT BANNER!", theme: "3" },
      { id: ["A038", "B029"], price: "300", offertext: "SKILLEDWEEN OFFER", normalprice: "350", theme: "3" },
    ],
    theme: "default"
  },
  
  {
    dates: "22 december - 27 december",
    items: [
      { id: "A024", price: "90", offertext: "CHRISTMAS SPECIAL!", theme: "2" },
    ],
    theme: "default"
  },

  {
    dates: "1 january",
    items: [
       { id: "A027", price: "90", offertext: "2026 NEW YEAR OFFER!", theme: "2" },
    ],
    theme: "default"
  },
  
];

// ------------------ CONVERSION ------------------
const specialDateConfig = userFriendlyDateConfig.reduce((acc, { dates, items }) => {
  const { startDate, endDate } = parseUserDate(dates);
  const dateRange = generateDateRange(startDate, endDate);
  const expirationTimestamp = getExpirationTimestamp(endDate);

  dateRange.forEach(date => {
    if (!acc[date]) acc[date] = [];

    items.forEach(({ id, price, currency, normalprice, offertext, theme, quantity}) => {
      const itemIds = Array.isArray(id) ? id : [id];
      const item = {
        itemId: id,
        price,
        quantity: quantity || 1,
        currency: currency || "coins",
        offertext: offertext || "NEW ITEM",
        expires_in: expirationTimestamp || 0,
        ...(theme != null && { theme }),
      };

      if (normalprice) {
        item.normalprice = normalprice;
      }

      acc[date].push(item);
    });
  });

  return acc;
}, {});

const specialDateTheme = userFriendlyDateConfig.reduce((acc, { dates, theme }) => {
  const { startDate, endDate } = parseUserDate(dates);
  const dateRange = generateDateRange(startDate, endDate);
  dateRange.forEach(date => {
    acc[date] = theme;
  });
  return acc;
}, {});

// Export
module.exports = {
  itemPrefixes,
  specialDateConfig,
  specialDateTheme,
  UpdateShopOnServerStart,
  discountCounts,
  discountRates
};

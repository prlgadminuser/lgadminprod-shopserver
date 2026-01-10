

const { getItemPrice, IsItemValid, IsItemTypeValid, newOffer } = require("./items");



const globalConfig = {
  UpdateShopOnServerStart: true,
  discountCounts: [1, 2], // number (min, max) of offers which receive a discount
  discountRates: [20, 30], // number (min, max) how much % discount each discounted offer gets
  itemPrefixes: ["HAT", "TOP", "HAT", "TOP", "HAT", "TOP", "BANNER", "POSE"]
}


 for (const itemType of globalConfig.itemPrefixes) {
  if (!IsItemTypeValid(itemType)) throw new Error(`itemtype ${itemType} is not existing/ not valid`);
 }

// ------------------ ITEM PRICE ------------------


// ------------------ DATE PARSER ------------------
const monthMap = {
  january: 1, february: 2, march: 3, april: 4,
  may: 5, june: 6, july: 7, august: 8,
  september: 9, october: 10, november: 11, december: 12
};

function parseDayMonth(str) {
  const [day, monthName] = str.trim().toLowerCase().split(" ");
  const month = monthMap[monthName];
  if (!month) throw new Error(`Unknown month: ${monthName}`);
  return { month, day: Number(day) };
}

function parseUserDateRange(input) {
  input = input.toLowerCase().trim();

  if (!input.includes("-")) {
    const d = parseDayMonth(input);
    return { start: d, end: d };
  }

  const [start, end] = input.split("-").map(s => parseDayMonth(s));
  return { start, end };
}

function toComparable({ month, day }) {
  return month * 100 + day;
}

function getExpirationTimestamp({ month, day }) {
  const year = new Date().getUTCFullYear();
  return Date.UTC(year, month - 1, day, 23, 59, 59)
}

// ------------------ CONFIG ------------------
const rawConfig = [
  {
    dates: "1 january - 31 december",
    offers: [
      { items: ["HAT:explorer", "HAT:weird_mask"], price: 0, offertext: "STARTER PACK", theme: "special" }
    ],
    theme: "default"
  },
  {
    dates: "14 february - 15 february",
    offers: [
      { items: ["BANNER:ninja", "BANNER:dark"], price: 1, offertext: "VALENTINE OFFER ❤️", theme: "4" }
    ],
    theme: "default"
  },
  {
    dates: "19 december - 24 december",
    offers: [
      { items: ["BANNER:storm", "BANNER:pinball"], price: 400, offertext: "VAULTED BANNERS OFFER", theme: "5" }
    ],
    theme: "default"
  },
  {
    dates: "22 december - 27 december",
    offers: [
      { items: ["HAT:santa"], offertext: "WINTER FEST!", theme: "special" }
    ],
    theme: "default"
  },
  {
    dates: "1 january",
    offers: [
      { items: ["HAT:new_year"], price: 90, offertext: "2026 NEW YEAR OFFER!", theme: "special" }
    ],
    theme: "default"
  }
];

// ------------------ PREPROCESS ------------------
const specialDateRanges = rawConfig.map(({ dates, offers, theme }) => {
  const range = parseUserDateRange(dates);

  return {
    start: toComparable(range.start),
    end: toComparable(range.end),
    expires_at: getExpirationTimestamp(range.end),
    theme,
    offers
  };
});

for (const dateData of specialDateRanges) {
  for (const offer of dateData.offers) {
    for (const item of offer.items) {
      if (!IsItemValid(item)) {
        throw new Error(`itemid ${item} is not existing`);
      }
    }
  }
}



// ------------------ LOOKUP FUNCTION ------------------
function getOffersForDate(dateStr) {
  // dateStr = "12-24"
  const [month, day] = dateStr.split("-").map(Number);
  const value = month * 100 + day;

  const specialoffers = [];
  let theme = "default";

  for (const range of specialDateRanges) {
    if (value >= range.start && value <= range.end) {
      theme = range.theme;

      for (const entry of range.offers) {

        const items = Array.isArray(entry.items) ? entry.items : [entry.items]

        const normalprice = items.reduce((t, items) => t + getItemPrice(items), 0);

        entry.expires_at = range.expires_at
        entry.normalprice = normalprice

        const offerdata = entry

        specialoffers.push(
         newOffer(offerdata)
        );
      }
    }
  }

  return { theme, specialoffers };
}

// ------------------ EXPORT ------------------
module.exports = {
  getOffersForDate,
  globalConfig,
};

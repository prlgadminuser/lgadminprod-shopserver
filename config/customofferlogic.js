

const { globalConfig } = require("./config");
const { customOffers } = require("./custom-offers");
const { getItemPrice, IsItemValid, IsItemTypeValid, newOffer } = require("./items");


 for (const itemType of globalConfig.dailyRotationitemPrefixesSelection) {
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


// ------------------ PREPROCESS ------------------
const specialDateRanges = customOffers.map(({ dates, offers, theme }) => {
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

        if (!entry.price) entry.price = normalprice
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
};

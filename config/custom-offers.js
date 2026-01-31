

const customOffers = [
  {
    dates: "1 january - 31 december",
    offers: [
      { items: ["HAT:explorer", "HAT:weird_mask"], price: 0, offertext: "STARTER PACK", theme: "special" }
    ],
    theme: "default"
  },
  {
    dates: "22 december - 11 january",
    offers: [
      { items: ["HAT:santa"], offertext: "WINTER FEST!", theme: "special" }
    ],
    theme: "default"
  },

  {
    dates: "29 january - 20 february",
    offers: [
      { items: ["HAT:astro", "TOP:astro"], offertext: "ASTRONOMICAL OFFER", theme: "special", price: 200 }
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

module.exports = {
    customOffers

}





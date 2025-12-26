//const { shopcollection } = require("..");




const validItemTypes = ["hat", "top", "banner", "pose"];

const not_allowed_specialitems = { // special items either exclusive or paid
  hat_santa: { rarity: "legendary" },
  top_santa: { rarity: "legendary" },
  hat_new_year: { rarity: "rare" },
  hat_explorer: { rarity: "common" },
  hat_weird_mask: { rarity: "uncommon" },
  hat_chrono: { rarity: "legendary" },
  hat_netjump: { rarity: "uncommon" },
  top_netjump: { rarity: "uncommon" },
  banner_pinball: { rarity: "uncommon" },
  banner_music: { rarity: "rare" },
  banner_og: { rarity: "epic" },
  banner_storm: { rarity: "legendary" },
  banner_chrono: { rarity: "epic" },
  pose_enchanted: { rarity: "legendary" },
  hat_pumpkin: { rarity: "epic" },
  top_pumpkin: { rarity: "epic" },
  banner_halloween1: { rarity: "rare" },
};

const valid_shopitems = { // items that are allowed to be in the shop rotation system
  // ================= HATS =================
  hat_gang_mask: { rarity: "uncommon" },
  hat_hot_angel: { rarity: "epic" },
  hat_gang_mask_glow: { rarity: "rare" },
  hat_factory: { rarity: "common" },
  hat_star_grey: { rarity: "common" },
  hat_star_purple: { rarity: "uncommon" },
  hat_star_bw: { rarity: "uncommon" },
  hat_star_multi: { rarity: "rare" },
  hat_twists: { rarity: "common" },
  hat_sunny_fire: { rarity: "rare" },
  hat_hot_cheeto: { rarity: "rare" },
  hat_fuzzy_heart: { rarity: "uncommon" },
  hat_cyber: { rarity: "epic" },
  hat_clown: { rarity: "common" },
  hat_dirtypixels: { rarity: "rare" },
  hat_magic: { rarity: "epic" },
  hat_glow_hero: { rarity: "epic" },
  hat_chiller: { rarity: "rare" },
  hat_tropical: { rarity: "epic" },
  hat_dream_guard: { rarity: "legendary" },
  hat_pixel_glasses: { rarity: "uncommon" },
  hat_wizard: { rarity: "epic" },
  hat_lucky_plucky: { rarity: "rare" },
  hat_astro: { rarity: "epic" },
  hat_diver: { rarity: "uncommon" },
  hat_mod_cut: { rarity: "common" },
  hat_arcade: { rarity: "rare" },
  hat_chef: { rarity: "rare" },
  hat_robot: { rarity: "legendary" },
  hat_cracker: { rarity: "uncommon" },
  hat_magicstone: { rarity: "epic" },

  // ================= TOPS =================
  top_gang: { rarity: "uncommon" },
  top_hot_angel: { rarity: "epic" },
  top_factory: { rarity: "common" },
  top_star_grey: { rarity: "common" },
  top_star_purple: { rarity: "uncommon" },
  top_star_bw: { rarity: "uncommon" },
  top_star_multi: { rarity: "rare" },
  top_basic: { rarity: "common" },
  top_sunny_fire: { rarity: "rare" },
  top_hot_cheeto: { rarity: "rare" },
  top_fuzzy_heart: { rarity: "uncommon" },
  top_cyber: { rarity: "epic" },
  top_clown: { rarity: "common" },
  top_pixel_nthing: { rarity: "rare" },
  top_magic: { rarity: "epic" },
  top_glow_hero: { rarity: "epic" },
  top_chiller: { rarity: "rare" },
  top_tropical: { rarity: "epic" },
  top_dream_guard: { rarity: "legendary" },
  top_wizard: { rarity: "epic" },
  top_astro: { rarity: "epic" },
  top_random: { rarity: "common" },
  top_chef: { rarity: "rare" },
  top_robot: { rarity: "legendary" },
  top_cracker: { rarity: "uncommon" },
  top_magicstone: { rarity: "epic" },

  // ================= BANNERS =================
  banner_broken_dream: { rarity: "common" },
  banner_beam: { rarity: "uncommon" },
  banner_dark: { rarity: "uncommon" },
  banner_fire: { rarity: "rare" },
  banner_gears: { rarity: "common" },
  banner_ninja: { rarity: "rare" },
  banner_island: { rarity: "common" },
  banner_spectra: { rarity: "rare" },
  banner_chemical: { rarity: "rare" },
  banner_sea: { rarity: "common" },

  // ================= POSES =================
  pose_rush: { rarity: "common" },
  pose_mind: { rarity: "common" },
  pose_ninja: { rarity: "rare" },
  pose_itch: { rarity: "common" },
  pose_jump: { rarity: "common" },
  pose_rocket: { rarity: "epic" },
  pose_space: { rarity: "rare" },
  pose_losingIt: { rarity: "rare" },
};

const rarityPrices = {
  common: 50,
  uncommon: 90,
  rare: 120,
  epic: 150,
  legendary: 200,
};



// Assign prices automatically based on rarity and validate items before start of server
for (const itemId in valid_shopitems) {
  const item = valid_shopitems[itemId];
  const itemType = itemId.split("_")[0]; // get the prefix before the underscore
  if (!validItemTypes.includes(itemType))
    throw new Error(`Item type for ${itemId} is not valid`);

  if (not_allowed_specialitems[itemId])
    throw new Error(
      `critical error: special itemid ${itemId} is present in valid shopitems `
    );

  if (!item.rarity) throw new Error(`Item ${itemId} has no rarity set`);

  item.price = rarityPrices[item.rarity]; // default undefined if rarity unknown
  if (!item.price)
    throw new Error(`Item rarity of ${itemId} not set or not valid`);
}

for (const itemId in not_allowed_specialitems) {
  const item = not_allowed_specialitems[itemId];
  const itemType = itemId.split("_")[0]; // get the prefix before the underscore
  if (!validItemTypes.includes(itemType))
    throw new Error(`Item type for ${itemId} is not valid`);

  if (!item.rarity) throw new Error(`Item ${itemId} has no rarity set`);

  item.price = rarityPrices[item.rarity]; // default undefined if rarity unknown
  if (!item.price)
    throw new Error(`Item rarity of ${itemId} not set or not valid`);
}

function IsItemValid(itemId) {

  return valid_shopitems[itemId]  || not_allowed_specialitems[itemId]

}

function getItemPrice(itemId) {
  const item = valid_shopitems[itemId] || not_allowed_specialitems[itemId];
  if (!item?.price) throw new Error(`Price not found for ${itemId}`);
  return item.price;
}

function newOffer(entry, range, normalprice) {

 const offer = {
          items: entry.id,
          price: entry.price ?? normalprice,
          normalprice: entry.price ? entry.price : normalprice,
          quantity: entry.quantity ?? 1,
          currency: entry.currency ?? "coins",
          offertext: entry.offertext ?? "NEW ITEM",
          expires_in: range.expires_in,
          ...(entry.theme && { theme: entry.theme })
        }

}

module.exports = {
  valid_shopitems,
  not_allowed_specialitems,
  IsItemValid,
  getItemPrice,
};

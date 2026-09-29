const { searchUnsplash } = require("./imageProviders/unsplashProvider");

const DEFAULT_IMAGE_URL = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1000&q=80";
const DEFAULT_SOURCE = "Food Saver Curated Photography";

// 1. SPELLING NORMALIZATION DICTIONARY
const SPELLING_MAP = {
  idly: "idli",
  vadai: "medu vada",
  "medhu vadai": "medu vada",
  "medhu vada": "medu vada",
  parota: "parotta",
  paniyaram: "kuzhi paniyaram",
  puliyodharai: "puliyodarai",
  biriyani: "biryani",
  pattu: "puttu",
  dosai: "dosa",
  utthapam: "uttapam",
  uthappam: "uttapam",
};

// 2. COMPREHENSIVE 60+ DISH HIGH-DEFINITION CURATED DATASET
const CURATED_FOOD_MAP = {
  dosa: {
    primary: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=1000&q=80",
    alternatives: ["https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=1000&q=80"],
    source: "South Indian Crisp Dosa",
    region: "South Indian",
  },
  "masala dosa": {
    primary: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=1000&q=80",
    alternatives: ["https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=1000&q=80"],
    source: "Golden Crisp Masala Dosa",
    region: "South Indian",
  },
  "plain dosa": {
    primary: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Authentic Plain Dosa",
    region: "South Indian",
  },
  "ghee dosa": {
    primary: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Ghee Roast Dosa",
    region: "South Indian",
  },
  "onion dosa": {
    primary: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Crispy Onion Dosa",
    region: "South Indian",
  },
  "rava dosa": {
    primary: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Crispy Rava Dosa",
    region: "South Indian",
  },
  "set dosa": {
    primary: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Soft Set Dosa",
    region: "South Indian",
  },
  "mysore masala dosa": {
    primary: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Mysore Masala Dosa",
    region: "Karnataka Udupi",
  },
  "kari dosa": {
    primary: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Madurai Special Kari Dosa",
    region: "Tamil Nadu",
  },
  "kal dosa": {
    primary: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Soft Kal Dosa",
    region: "Tamil Nadu",
  },
  idli: {
    primary: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=1000&q=80",
    alternatives: ["https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1000&q=80"],
    source: "Steamed Soft South Indian Idli",
    region: "South Indian",
  },
  "soft idli": {
    primary: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=1000&q=80",
    alternatives: ["https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1000&q=80"],
    source: "Fluffy Steamed Soft Idli",
    region: "South Indian",
  },
  "soft idli (2 pcs)": {
    primary: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=1000&q=80",
    alternatives: ["https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1000&q=80"],
    source: "Fluffy Steamed Soft Idli",
    region: "South Indian",
  },
  "mini idli": {
    primary: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Ghee Mini Sambar Idli",
    region: "South Indian",
  },
  "kanchipuram idli": {
    primary: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Kanchipuram Spiced Idli",
    region: "Tamil Nadu",
  },
  idiyappam: {
    primary: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "String Hoppers Idiyappam",
    region: "Tamil Nadu Kerala",
  },
  "medu vada": {
    primary: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Crispy Medu Vada",
    region: "South Indian",
  },
  "paruppu vada": {
    primary: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Tamil Nadu Paruppu Vadai",
    region: "Tamil Nadu",
  },
  "sambar vada": {
    primary: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Dip Sambar Vada",
    region: "South Indian",
  },
  pongal: {
    primary: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Tamil Nadu Hot Ven Pongal",
    region: "Tamil Nadu",
  },
  "ven pongal": {
    primary: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Ghee Ven Pongal",
    region: "Tamil Nadu",
  },
  "sweet pongal": {
    primary: "https://images.unsplash.com/photo-1517244683847-7456b63c5969?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Sakkarai Sweet Pongal",
    region: "Tamil Nadu",
  },
  upma: {
    primary: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Rava Upma Breakfast",
    region: "South Indian",
  },
  uttapam: {
    primary: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "South Indian Uttapam",
    region: "South Indian",
  },
  "onion uttapam": {
    primary: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Onion Uttapam",
    region: "South Indian",
  },
  appam: {
    primary: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Kerala Soft Palappam",
    region: "Kerala",
  },
  "egg appam": {
    primary: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Kerala Egg Appam",
    region: "Kerala",
  },
  puttu: {
    primary: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Kerala Steamed Puttu",
    region: "Kerala",
  },
  "kadala curry": {
    primary: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Kerala Black Chickpea Kadala Curry",
    region: "Kerala",
  },
  parotta: {
    primary: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=1000&q=80",
    alternatives: ["https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1000&q=80"],
    source: "Flaky South Indian Parotta",
    region: "Tamil Nadu Kerala",
  },
  "kerala parotta": {
    primary: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Malabar Flaky Parotta",
    region: "Kerala",
  },
  "kothu parotta": {
    primary: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1000&q=80",
    alternatives: ["https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=1000&q=80"],
    source: "Tamil Street Food Kothu Parotta",
    region: "Tamil Nadu",
  },
  "egg kothu parotta": {
    primary: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Egg Kothu Parotta",
    region: "Tamil Nadu",
  },
  "chicken kothu parotta": {
    primary: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Spicy Chicken Kothu Parotta",
    region: "Tamil Nadu",
  },
  biryani: {
    primary: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=1000&q=80",
    alternatives: ["https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=1000&q=80"],
    source: "Authentic Dum Biryani",
    region: "South Indian",
  },
  "chicken biryani": {
    primary: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=1000&q=80",
    alternatives: ["https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=1000&q=80"],
    source: "South Indian Chicken Biryani",
    region: "South Indian",
  },
  "mutton biryani": {
    primary: "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=1000&q=80",
    alternatives: ["https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=1000&q=80"],
    source: "Special Mutton Biryani",
    region: "South Indian",
  },
  "ambur biryani": {
    primary: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Ambur Seeraga Samba Biryani",
    region: "Tamil Nadu",
  },
  "dindigul biryani": {
    primary: "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Dindigul Thalappakatti Biryani",
    region: "Tamil Nadu",
  },
  "thalassery biryani": {
    primary: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Kerala Malabar Thalassery Biryani",
    region: "Kerala",
  },
  "lemon rice": {
    primary: "https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "South Indian Lemon Rice",
    region: "South Indian",
  },
  "tamarind rice": {
    primary: "https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Tamil Puliyodarai Tamarind Rice",
    region: "Tamil Nadu",
  },
  puliyodarai: {
    primary: "https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Authentic Puliyodarai",
    region: "Tamil Nadu",
  },
  "curd rice": {
    primary: "https://images.unsplash.com/photo-1516714435131-44d6b64dc6a2?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "South Indian Curd Rice (Thayir Sadam)",
    region: "South Indian",
  },
  "coconut rice": {
    primary: "https://images.unsplash.com/photo-1516714435131-44d6b64dc6a2?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Coconut Rice (Thengai Sadam)",
    region: "South Indian",
  },
  "tomato rice": {
    primary: "https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "South Indian Tomato Rice",
    region: "South Indian",
  },
  "sambar rice": {
    primary: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Sambar Rice (Sambar Sadam)",
    region: "South Indian",
  },
  "rasam rice": {
    primary: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Hot Rasam Rice",
    region: "South Indian",
  },
  "bisibele bath": {
    primary: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Karnataka Bisi Bele Bath",
    region: "Karnataka",
  },
  sambar: {
    primary: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "South Indian Vegetable Sambar",
    region: "South Indian",
  },
  rasam: {
    primary: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "South Indian Spicy Tomato Rasam",
    region: "South Indian",
  },
  avial: {
    primary: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Kerala Mixed Veg Avial",
    region: "Kerala",
  },
  poriyal: {
    primary: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Tamil Vegetable Poriyal",
    region: "Tamil Nadu",
  },
  "fish curry": {
    primary: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "South Indian Meen Curry",
    region: "South Indian",
  },
  "meen curry": {
    primary: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Kerala Malabar Meen Curry",
    region: "Kerala",
  },
  "chicken chettinad": {
    primary: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Tamil Nadu Chicken Chettinad",
    region: "Tamil Nadu",
  },
  "chicken 65": {
    primary: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Chennai Style Chicken 65",
    region: "Tamil Nadu",
  },
  "kuzhi paniyaram": {
    primary: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Crispy Kuzhi Paniyaram",
    region: "Tamil Nadu",
  },
  "mysore pak": {
    primary: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Ghee Mysore Pak Sweet",
    region: "Karnataka",
  },
  payasam: {
    primary: "https://images.unsplash.com/photo-1517244683847-7456b63c5969?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "South Indian Semiya Payasam",
    region: "South Indian",
  },
  "filter coffee": {
    primary: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=1000&q=80",
    alternatives: [],
    source: "Degree Filter Coffee",
    region: "South Indian",
  },
};

// 3. INTELLIGENT SUB-REGIONAL CUISINE DETECTOR
function detectRegionAndCuisine(foodName) {
  const lower = foodName.toLowerCase();

  if (/chettinad|kothu|kari|kal dosa|puliyodarai|paniyaram|poriyal|kootu|keerai|paruppu|ambur|dindigul/i.test(lower)) {
    return { region: "Tamil Nadu", cuisine: "Tamil South Indian street food" };
  }
  if (/puttu|appam|kadala|kerala|meen|thalassery|avial|banana chips/i.test(lower)) {
    return { region: "Kerala", cuisine: "Kerala Malabar food" };
  }
  if (/bisi bele|mysore|udupi|neer dosa|karnataka|rava idli/i.test(lower)) {
    return { region: "Karnataka", cuisine: "Karnataka Udupi food" };
  }
  if (/andhra|gongura|mirchi bajji|hyderabadi/i.test(lower)) {
    return { region: "Andhra Pradesh", cuisine: "Andhra food" };
  }
  return { region: "South Indian", cuisine: "South Indian food" };
}

// 4. SPELLING NORMALIZER
function normalizeFoodName(foodName) {
  let cleaned = String(foodName || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  if (SPELLING_MAP[cleaned]) {
    return SPELLING_MAP[cleaned];
  }
  for (const [variant, correct] of Object.entries(SPELLING_MAP)) {
    if (cleaned.includes(variant)) {
      cleaned = cleaned.replace(variant, correct);
    }
  }
  return cleaned;
}

// 5. DYNAMIC QUERY GENERATOR (5-Level Escalation)
function buildDynamicQueries(foodName, category, cuisine) {
  const normalized = normalizeFoodName(foodName);
  const context = detectRegionAndCuisine(normalized);

  const level1 = `${normalized}`;
  const level2 = `${normalized} ${context.cuisine} authentic food photography`;
  const level3 = `${normalized} ${context.region} restaurant food`;
  const level4 = `${normalized} Indian cuisine food`;
  const level5 = category ? `${category} South Indian food photography` : "South Indian food photography";

  return Array.from(new Set([level1, level2, level3, level4, level5].filter(Boolean)));
}

// 6. MULTI-CANDIDATE RELEVANCE SCORING ENGINE
function scoreCandidate(candidate, foodName) {
  if (!candidate || !candidate.url) return -100;
  const normalizedFood = normalizeFoodName(foodName);
  const foodTokens = normalizedFood.split(" ").filter((t) => t.length > 2);
  const text = `${candidate.title || ""} ${candidate.description || ""}`.toLowerCase();

  // Rejection check (-100 for non-food / invalid objects)
  const rejectedWords = ["person", "people", "man", "woman", "logo", "menu", "building", "restaurant front", "illustration", "vector", "drawing", "text overlay"];
  for (const r of rejectedWords) {
    if (text.includes(r)) return -100;
  }

  let score = 0;

  // Exact food name match (+50)
  if (text.includes(normalizedFood)) {
    score += 50;
  }

  // Token variation match (+30)
  let tokenMatches = 0;
  for (const token of foodTokens) {
    if (text.includes(token)) tokenMatches++;
  }
  if (tokenMatches > 0) {
    score += Math.min(30, tokenMatches * 15);
  }

  // Cuisine match (+20)
  if (/south indian|tamil|kerala|karnataka|andhra|udupi|chettinad/i.test(text)) {
    score += 20;
  }

  // Food-related description (+10)
  if (/dish|plate|meal|curry|rice|bread|street food|delicious|photography/i.test(text)) {
    score += 10;
  }

  // Quality check (+5)
  if (candidate.width >= 800) {
    score += 5;
  }

  return score;
}

// MAIN ENTRY POINT FOR FOOD IMAGE FETCHING
async function fetchFoodImage(rawFoodName, category = "", cuisine = "") {
  const rawInput = String(rawFoodName || "").trim();
  if (!rawInput) {
    return {
      success: false,
      foodName: "",
      imageUrl: "",
      source: "none",
      alternatives: [],
    };
  }

  const normalized = normalizeFoodName(rawInput);

  // 1. Direct Curated Match (Exact match)
  if (CURATED_FOOD_MAP[normalized]) {
    const match = CURATED_FOOD_MAP[normalized];
    return {
      success: true,
      foodName: rawInput,
      imageUrl: match.primary,
      source: match.source,
      alternatives: match.alternatives || [],
    };
  }

  // 2. Partial Curated Match
  for (const [key, match] of Object.entries(CURATED_FOOD_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return {
        success: true,
        foodName: rawInput,
        imageUrl: match.primary,
        source: match.source,
        alternatives: match.alternatives || [],
      };
    }
  }

  // 3. Dynamic External API Search with Multi-Candidate Scoring
  const queries = buildDynamicQueries(rawInput, category, cuisine);
  let bestCandidate = null;
  let highestScore = -99;
  let lastError = null;

  for (const query of queries) {
    try {
      const searchResult = await searchUnsplash(query);
      if (searchResult && Array.isArray(searchResult.candidates)) {
        for (const candidate of searchResult.candidates) {
          const score = scoreCandidate(candidate, rawInput);
          if (score > highestScore) {
            highestScore = score;
            bestCandidate = candidate;
          }
        }
        if (bestCandidate && highestScore >= 30) {
          break; // Found high relevance match
        }
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (bestCandidate && highestScore > 0) {
    return {
      success: true,
      foodName: rawInput,
      imageUrl: bestCandidate.url,
      source: bestCandidate.provider,
      alternatives: [],
    };
  }

  // 4. Fallback Default
  return {
    success: false,
    foodName: rawInput,
    imageUrl: DEFAULT_IMAGE_URL,
    source: lastError ? `Default (${lastError.message})` : DEFAULT_SOURCE,
    alternatives: [],
  };
}

module.exports = {
  fetchFoodImage,
  DEFAULT_IMAGE_URL,
  DEFAULT_SOURCE,
  CURATED_FOOD_MAP,
  SPELLING_MAP,
  normalizeFoodName,
  detectRegionAndCuisine,
  buildDynamicQueries,
  buildQueries: buildDynamicQueries,
  scoreCandidate,
};

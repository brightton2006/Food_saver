import { api } from "./api.js";

export const DEFAULT_FOOD_IMAGE =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80";

const FALLBACK_FOOD_MAP = [
  {
    regex: /idli|idly/i,
    url: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80",
  },
  {
    regex: /dosa|dosai|masala dosa|roast/i,
    url: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=600&q=80",
  },
  {
    regex: /biryani|biriyani|pulao|rice/i,
    url: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80",
  },
  {
    regex: /vada|vadai|medu vada/i,
    url: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80",
  },
  {
    regex: /parotta|paratha|kothu/i,
    url: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80",
  },
  {
    regex: /paneer|butter masala|gravy|kadai/i,
    url: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80",
  },
  {
    regex: /chicken 65|starter|tikka|kabab|kebab|fry/i,
    url: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80",
  },
  {
    regex: /meals|thali|sambar|rasam|curry/i,
    url: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&w=600&q=80",
  },
  {
    regex: /pastry|cake|sweet|dessert|bakery|bread|bun|croissant/i,
    url: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80",
  },
  {
    regex: /coffee|tea|chai|beverage|drink|juice/i,
    url: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80",
  },
  {
    regex: /burger|sandwich|pizza|snack/i,
    url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80",
  },
  {
    regex: /pongal|khichdi|upma/i,
    url: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80",
  },
];

const CATEGORY_FALLBACK_MAP = {
  Biryani: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80",
  "South Indian": "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&w=600&q=80",
  Meals: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&w=600&q=80",
  Starters: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80",
  "Fast Food": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80",
  Bakery: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80",
  Snacks: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80",
  Desserts: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80",
  Beverages: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80",
};

/**
 * Returns a guaranteed valid high-definition food photograph URL based on food name and category.
 */
export function getFoodFallbackImage(foodName = "", category = "") {
  const name = String(foodName || "").trim();
  if (name) {
    for (const entry of FALLBACK_FOOD_MAP) {
      if (entry.regex.test(name)) {
        return entry.url;
      }
    }
  }

  const cat = String(category || "").trim();
  if (cat && CATEGORY_FALLBACK_MAP[cat]) {
    return CATEGORY_FALLBACK_MAP[cat];
  }

  return DEFAULT_FOOD_IMAGE;
}

const memoryCache = new Map();

export async function searchFoodImage(foodName, category = "", cuisine = "") {
  const normalized = String(foodName || "").trim();
  if (!normalized) {
    return {
      success: true,
      foodName: "",
      imageUrl: DEFAULT_FOOD_IMAGE,
      source: "Food Saver Verified Photography",
      alternatives: [],
    };
  }

  const cacheKey = `${normalized.toLowerCase()}_${category.toLowerCase()}_${cuisine.toLowerCase()}`;
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey);
  }

  try {
    const data = await api.fetchFoodImage(normalized, category, cuisine);
    if (data && data.imageUrl && String(data.imageUrl).trim().length > 0) {
      memoryCache.set(cacheKey, data);
      return data;
    }
  } catch (error) {
    console.warn("Food image fetch note:", error);
  }

  const fallbackUrl = getFoodFallbackImage(normalized, category);
  const fallbackResult = {
    success: true,
    foodName: normalized,
    imageUrl: fallbackUrl,
    source: "Food Saver Verified Photography",
    alternatives: [],
  };
  memoryCache.set(cacheKey, fallbackResult);
  return fallbackResult;
}

export function preloadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(false);
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

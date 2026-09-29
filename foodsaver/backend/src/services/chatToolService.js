const foodTools = require("../tools/foodTools");
const merchantTools = require("../tools/merchantTools");
const orderTools = require("../tools/orderTools");

/**
 * Standard Tool Declarations for LLM Function Calling.
 */
const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "getNearbyFood",
      description: "Find active surplus food deals near the customer's current GPS location. Use this when the customer asks for food near them, deals within a distance, or general local surplus discovery.",
      parameters: {
        type: "object",
        properties: {
          radiusKm: { type: "number", description: "Search radius in km (e.g. 0.5, 1, 2, 5, 10). Default is 5." },
          category: { type: "string", description: "Food category (e.g. Biryani, South Indian, Fast Food, Bakery, Beverages, Starters)" },
          maxPrice: { type: "number", description: "Maximum budget or price in INR (e.g. 100)" },
          isVeg: { type: "boolean", description: "Filter for pure vegetarian food only" },
          sortBy: { type: "string", enum: ["distance", "discount", "price_asc", "closing_soon"], description: "Sort order" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "searchFood",
      description: "Search surplus food by dish name, keyword, or cuisine (e.g., 'biryani', 'pizza', 'dosa', 'dessert') across the database.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Dish name or search keyword" },
          category: { type: "string", description: "Optional category filter" },
          maxPrice: { type: "number", description: "Maximum price filter in INR" },
          isVeg: { type: "boolean", description: "Pure vegetarian filter" },
          sortBy: { type: "string", enum: ["discount", "price_asc", "closing_soon"], description: "Sort preference" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getClosingSoonFood",
      description: "Find surplus meals with pickup windows closing soonest today to rescue before expiry.",
      parameters: {
        type: "object",
        properties: {
          radiusKm: { type: "number", description: "Search radius in km" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "searchMerchants",
      description: "Search for nearby verified FoodSaver restaurants, bakeries, or kitchen partners by name or city.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Restaurant or store name, or city" },
          radiusKm: { type: "number", description: "Radius in km" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getOrderStatus",
      description: "Check the live status, pickup window, token code, or tracking details of an active order for the authenticated customer.",
      parameters: {
        type: "object",
        properties: {
          orderId: { type: "string", description: "Optional specific Order ID or Claim Token" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getUserOrders",
      description: "List recent orders placed by the currently logged-in customer.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Number of orders to retrieve (default 5)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancelOrder",
      description: "Cancel an active order for the authenticated customer if it is still in placed/pending status.",
      parameters: {
        type: "object",
        properties: {
          orderId: { type: "string", description: "Order ID or Claim Token to cancel" },
          reason: { type: "string", description: "Reason for cancellation" },
        },
        required: ["orderId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getFoodCategories",
      description: "Get all food categories available on FoodSaver with active deal counts.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getFoodSaverHelp",
      description: "Get authoritative explanations of FoodSaver operations: how it works, pickup process, payment options, merchant onboarding, NGO food rescue, safety standards.",
      parameters: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            enum: ["general", "how_it_works", "pickup", "payment", "merchant", "ngo", "safety"],
            description: "Topic for FoodSaver guidance",
          },
        },
      },
    },
  },
];

/**
 * Executes a tool function against the real SQL database.
 * @param {string} toolName
 * @param {Object} args
 * @param {Object} context { user, latitude, longitude }
 */
async function executeTool(toolName, args = {}, context = {}) {
  const { user, latitude, longitude } = context;
  const userId = user?.userId || user?.id || null;

  try {
    switch (toolName) {
      case "getNearbyFood": {
        if (!latitude || !longitude) {
          return {
            needsLocation: true,
            message: "I need your location to find nearby FoodSaver deals. Please enable location access or search for a city/location.",
            items: [],
          };
        }
        return await foodTools.getNearbyFood({
          latitude,
          longitude,
          radiusKm: args.radiusKm,
          category: args.category,
          maxPrice: args.maxPrice,
          isVeg: args.isVeg,
          sortBy: args.sortBy,
        });
      }

      case "searchFood": {
        return await foodTools.searchFood({
          query: args.query,
          category: args.category,
          maxPrice: args.maxPrice,
          isVeg: args.isVeg,
          sortBy: args.sortBy,
        });
      }

      case "getClosingSoonFood": {
        return await foodTools.getClosingSoonFood({
          latitude,
          longitude,
          radiusKm: args.radiusKm,
        });
      }

      case "searchMerchants": {
        return await merchantTools.searchMerchants({
          query: args.query,
          latitude,
          longitude,
          radiusKm: args.radiusKm,
        });
      }

      case "getOrderStatus": {
        return await orderTools.getOrderStatus({
          userId,
          orderId: args.orderId,
        });
      }

      case "getUserOrders": {
        return await orderTools.getUserOrders({
          userId,
          limit: args.limit,
        });
      }

      case "cancelOrder": {
        return await orderTools.cancelOrder({
          userId,
          orderId: args.orderId,
          reason: args.reason,
        });
      }

      case "getFoodCategories": {
        return await foodTools.getFoodCategories();
      }

      case "getFoodSaverHelp": {
        return {
          topic: args.topic || "general",
          explanation: orderTools.getFoodSaverHelp(args.topic),
        };
      }

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    console.error(`Error executing tool ${toolName}:`, err);
    return { error: "DATABASE_ERROR", message: "Failed to query live SQL data." };
  }
}

module.exports = {
  TOOL_DEFINITIONS,
  executeTool,
};

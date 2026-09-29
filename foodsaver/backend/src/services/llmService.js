const { TOOL_DEFINITIONS, executeTool } = require("./chatToolService");

/**
 * System prompt following FoodSaver specifications.
 */
const SYSTEM_PROMPT = `You are FoodSaver AI, the official assistant for the FoodSaver surplus-food marketplace.

Your job is to help customers discover available surplus food, understand FoodSaver, find nearby merchants, understand orders, and use application features.

IMPORTANT RULES:
1. Never invent food items.
2. Never invent merchant names.
3. Never invent prices.
4. Never invent discounts.
5. Never invent availability.
6. Never invent order status.
7. Never invent distances.
8. Never invent locations.
9. Use application tools when real database information is required.
10. Use the authenticated user's data only when authorized.
11. Never reveal another customer's private information.
12. Never expose database credentials.
13. Never expose API keys.
14. Never generate unrestricted SQL.
15. Keep responses concise and helpful.
16. If required data is unavailable or zero results are returned, clearly state that no matching deals are available right now.
17. FoodSaver's primary purpose is surplus-food discovery and self-pickup.
18. Do not change the application's core concept.`;

/**
 * Intelligent intent classifier & parameter extractor for fallback synthesis
 */
function classifyIntent(text) {
  const t = text.toLowerCase();

  if (t.includes("order") && (t.includes("status") || t.includes("where") || t.includes("track") || t.includes("my order") || t.includes("active"))) {
    return { intent: "ORDER_STATUS" };
  }
  if (t.includes("cancel") && t.includes("order")) {
    return { intent: "CANCEL_ORDER" };
  }
  if (t.includes("my order") || t.includes("recent order") || t.includes("order history")) {
    return { intent: "ORDER_DETAILS" };
  }
  if (t.includes("closing") || t.includes("expire") || t.includes("ending soon") || t.includes("urgent")) {
    return { intent: "CLOSING_SOON" };
  }
  if (t.includes("store") || t.includes("restaurant") || t.includes("bakery") || t.includes("merchant") || t.includes("places")) {
    return { intent: "SEARCH_MERCHANT" };
  }
  if (t.includes("near me") || t.includes("nearby") || t.includes("around me") || t.includes("2 km") || t.includes("5 km") || t.includes("1 km") || t.includes("500m") || t.includes("within")) {
    return { intent: "FIND_NEARBY_FOOD" };
  }
  if (t.includes("under") || t.includes("cheap") || t.includes("₹") || t.includes("rs") || t.includes("rupee") || t.includes("budget") || t.includes("price")) {
    return { intent: "FOOD_PRICE" };
  }
  if (t.includes("discount") || t.includes("deal") || t.includes("offer") || t.includes("save") || t.includes("max discount")) {
    return { intent: "DISCOUNT_FOOD" };
  }
  if (t.includes("veg") || t.includes("vegetarian")) {
    return { intent: "VEGETARIAN_FOOD" };
  }
  if (t.includes("category") || t.includes("categories") || t.includes("types of food")) {
    return { intent: "FOOD_CATEGORY" };
  }
  if (t.includes("claim") && (t.includes("how") || t.includes("process") || t.includes("what is") || t.includes("work") || t.includes("token"))) {
    return { intent: "FOODSAVER_HELP" };
  }
  if (t.includes("how it works") || t.includes("what is foodsaver") || t.includes("how does") || t.includes("help") || t.includes("pickup") || t.includes("payment") || t.includes("how do") || t.includes("how can i")) {
    return { intent: "FOODSAVER_HELP" };
  }
  if (t.includes("biryani") || t.includes("rice") || t.includes("dosa") || t.includes("pizza") || t.includes("burger") || t.includes("cake") || t.includes("sweet") || t.includes("chicken") || t.includes("find") || t.includes("search")) {
    return { intent: "SEARCH_FOOD" };
  }

  return { intent: "GENERAL_CONVERSATION" };
}

/**
 * Calls remote LLM (OpenAI / Groq / Gemini compatible)
 */
async function callRemoteLlm({ messages, tools, apiKey, baseUrl, model }) {
  const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

  const payload = {
    model: model || "gpt-4o-mini",
    messages,
    temperature: 0.2,
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
    payload.tool_choice = "auto";
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`LLM API returned status ${response.status}: ${errorBody}`);
  }

  return await response.json();
}

/**
 * Main Chat Processing Function with Tool Execution & Context
 */
async function processChatMessage({
  message,
  latitude = null,
  longitude = null,
  user = null,
  history = [],
}) {
  const apiKey =
    process.env.OPENAI_API_KEY ||
    process.env.LLM_API_KEY ||
    process.env.GROQ_API_KEY ||
    process.env.GEMINI_API_KEY ||
    null;

  const baseUrl =
    process.env.LLM_BASE_URL ||
    (process.env.GROQ_API_KEY
      ? "https://api.groq.com/openai/v1"
      : "https://api.openai.com/v1");

  const model =
    process.env.LLM_MODEL ||
    (process.env.GROQ_API_KEY ? "llama-3.3-70b-versatile" : "gpt-4o-mini");

  const context = {
    user,
    latitude: latitude ? Number(latitude) : null,
    longitude: longitude ? Number(longitude) : null,
  };

  // 1. If remote LLM is available, execute via LLM function calling
  if (apiKey && !apiKey.includes("YOUR_") && !apiKey.includes("your_")) {
    try {
      const messages = [
        { role: "system", content: SYSTEM_PROMPT },
        ...history.slice(-6).map((h) => ({
          role: h.sender === "user" ? "user" : "assistant",
          content: h.text || h.message || "",
        })),
        { role: "user", content: message },
      ];

      const llmRes = await callRemoteLlm({
        messages,
        tools: TOOL_DEFINITIONS,
        apiKey,
        baseUrl,
        model,
      });

      const choice = llmRes.choices?.[0];
      const assistantMessage = choice?.message;

      // Check if LLM requested tool execution
      if (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
        const toolResults = [];
        let primaryResultItems = [];

        messages.push(assistantMessage);

        for (const call of assistantMessage.tool_calls) {
          const fnName = call.function.name;
          let fnArgs = {};
          try {
            fnArgs = JSON.parse(call.function.arguments || "{}");
          } catch (e) {
            fnArgs = {};
          }

          const result = await executeTool(fnName, fnArgs, context);
          toolResults.push({ tool: fnName, args: fnArgs, result });

          if (result?.items && Array.isArray(result.items)) {
            primaryResultItems = result.items;
          } else if (Array.isArray(result)) {
            primaryResultItems = result;
          }

          messages.push({
            role: "tool",
            tool_call_id: call.id,
            name: fnName,
            content: JSON.stringify(result),
          });
        }

        // Get final answer from LLM with real SQL data
        const finalLlmRes = await callRemoteLlm({
          messages,
          apiKey,
          baseUrl,
          model,
        });

        const finalReply =
          finalLlmRes.choices?.[0]?.message?.content ||
          "I retrieved the latest FoodSaver data for you.";

        return {
          success: true,
          message: finalReply,
          results: primaryResultItems,
          toolCalls: toolResults,
          provider: "remote-llm",
        };
      }

      // No tool calls needed (e.g. general conversational greeting)
      return {
        success: true,
        message: assistantMessage?.content || "How can I assist you with FoodSaver today?",
        results: [],
        provider: "remote-llm",
      };
    } catch (remoteError) {
      console.warn("Remote LLM note (falling back to intelligent local synthesis):", remoteError.message);
    }
  }

  // 2. Intelligent, Deterministic SQL-Driven Synthesis
  // Ensures 100% adherence to FoodSaver database rules without external key requirement
  const { intent } = classifyIntent(message);
  let toolName = "searchFood";
  let toolArgs = {};
  let structuredResults = [];

  const lower = message.toLowerCase();

  // Extract explicit budget if mentioned e.g. "under 100", "under ₹50"
  const priceMatch = lower.match(/(?:under|below|less than|within)\s*(?:₹|rs\.?|inr)?\s*(\d+)/i) ||
                     lower.match(/(\d+)\s*(?:rupees|rs|inr)/i);
  const maxPrice = priceMatch ? Number(priceMatch[1]) : null;

  // Extract distance if mentioned e.g. "within 2 km", "5km"
  const radiusMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:km|k\.m\.|kilometers)/i);
  const radiusKm = radiusMatch ? Number(radiusMatch[1]) : 5.0;

  const isVeg = lower.includes("veg") && !lower.includes("non-veg") && !lower.includes("nonveg");

  if (intent === "ORDER_STATUS") {
    toolName = "getOrderStatus";
    toolArgs = {};
  } else if (intent === "ORDER_DETAILS") {
    toolName = "getUserOrders";
    toolArgs = { limit: 5 };
  } else if (intent === "CANCEL_ORDER") {
    const orderMatch = lower.match(/#?([a-z0-9_-]{6,})/i);
    toolName = "cancelOrder";
    toolArgs = { orderId: orderMatch ? orderMatch[1] : "" };
  } else if (intent === "CLOSING_SOON") {
    toolName = "getClosingSoonFood";
    toolArgs = { radiusKm };
  } else if (intent === "SEARCH_MERCHANT") {
    toolName = "searchMerchants";
    const cleaned = lower.replace(/find|search|show|nearby|restaurants?|bakeries|stores?|merchants?|near me/g, "").trim();
    toolArgs = { query: cleaned, radiusKm };
  } else if (intent === "FIND_NEARBY_FOOD" || (intent === "FOOD_PRICE" && context.latitude)) {
    toolName = "getNearbyFood";
    toolArgs = { radiusKm, maxPrice, isVeg: isVeg ? true : null };
  } else if (intent === "FOOD_CATEGORY") {
    toolName = "getFoodCategories";
    toolArgs = {};
  } else if (intent === "FOODSAVER_HELP") {
    toolName = "getFoodSaverHelp";
    let topic = "general";
    if (lower.includes("pickup")) topic = "pickup";
    else if (lower.includes("pay") || lower.includes("upi")) topic = "payment";
    else if (lower.includes("claim")) topic = "claim";
    else if (lower.includes("merchant") || lower.includes("partner")) topic = "merchant";
    else if (lower.includes("ngo") || lower.includes("donate")) topic = "ngo";
    else if (lower.includes("safe") || lower.includes("hygiene")) topic = "safety";
    else if (lower.includes("how it works")) topic = "how_it_works";
    toolArgs = { topic };
  } else if (intent === "GENERAL_CONVERSATION") {
    if (lower.includes("hi") || lower.includes("hello") || lower.includes("hey")) {
      return {
        success: true,
        message: "Hello! 👋 I'm FoodSaver AI, your assistant for rescuing delicious surplus food at 30% to 70% off. You can ask me to find food near you, check budget deals under ₹100, or track an active order!",
        results: [],
        suggestions: [
          "🍱 Find food near me",
          "💰 Deals under ₹100",
          "🔥 Closing soon",
          "📦 Track my order",
        ],
      };
    }
  } else {
    // Default search food
    toolName = "searchFood";
    const cleaned = lower.replace(/find|search|show|available|any|dishes|deals|food/g, "").trim();
    toolArgs = { query: cleaned, maxPrice, isVeg: isVeg ? true : null };
  }

  // Execute Tool on MySQL
  const toolData = await executeTool(toolName, toolArgs, context);

  // Format Natural Response from real data
  let naturalResponse = "";

  if (toolName === "getNearbyFood") {
    if (toolData.needsLocation) {
      naturalResponse = "I need your location to find nearby FoodSaver deals. Please enable location access or search for a city/location.";
    } else if (!toolData.items || toolData.items.length === 0) {
      naturalResponse = `I couldn't find any available FoodSaver surplus food deals within ${toolData.radiusKm || radiusKm} km right now. Try expanding your search radius to 5 km or 10 km!`;
    } else {
      structuredResults = toolData.items;
      naturalResponse = `I found ${toolData.items.length} available FoodSaver deal${toolData.items.length > 1 ? "s" : ""} within ${toolData.radiusKm} km:\n\n` +
        toolData.items.map((i) => `• 🍱 **${i.foodName}** (₹${i.price} • ~~₹${i.originalPrice}~~, ${i.discountPercentage}% OFF) at ${i.merchantName} (${i.distanceText || i.distance + " km"}) — Pickup: ${i.pickupWindow}`).join("\n");
    }
  } else if (toolName === "searchFood") {
    if (!toolData.items || toolData.items.length === 0) {
      naturalResponse = `I couldn't find any available surplus deals matching "${toolArgs.query || "your search"}" right now.`;
    } else {
      structuredResults = toolData.items;
      naturalResponse = `I found ${toolData.items.length} available deal${toolData.items.length > 1 ? "s" : ""}:\n\n` +
        toolData.items.map((i) => `• 🍱 **${i.foodName}** (₹${i.price} • ~~₹${i.originalPrice}~~, ${i.discountPercentage}% OFF) by ${i.merchantName} — Pickup till ${i.pickupWindowEnd}`).join("\n");
    }
  } else if (toolName === "getClosingSoonFood") {
    if (!toolData || toolData.length === 0) {
      naturalResponse = "No surplus deals are currently expiring in the next few hours. Check back closer to restaurant closing hours!";
    } else {
      structuredResults = toolData;
      naturalResponse = `🔥 **Closing Soon Deals** — Pick up before restaurant closing:\n\n` +
        toolData.map((i) => `• **${i.foodName}** (₹${i.price} • ${i.discountPercentage}% OFF) at ${i.merchantName} — Pickup ends at ${i.pickupWindowEnd}`).join("\n");
    }
  } else if (toolName === "searchMerchants") {
    if (!toolData || toolData.length === 0) {
      naturalResponse = `I couldn't find any verified FoodSaver partner stores matching "${toolArgs.query || ""}".`;
    } else {
      structuredResults = toolData;
      naturalResponse = `I found ${toolData.length} FoodSaver partner store${toolData.length > 1 ? "s" : ""}:\n\n` +
        toolData.map((m) => `• 🏪 **${m.businessName}** (${m.cuisine}) — ${m.address?.split(",")[0] || m.city} ${m.distanceText ? `• ${m.distanceText}` : ""} (${m.availableFoodCount} deals available)`).join("\n");
    }
  } else if (toolName === "getOrderStatus") {
    if (!toolData.authenticated) {
      naturalResponse = toolData.message;
    } else if (!toolData.found) {
      naturalResponse = toolData.message;
    } else {
      naturalResponse = `Your order **#${toolData.orderId}** (${toolData.item} x${toolData.quantity}) is currently:\n\n` +
        `${toolData.statusEmoji} **${toolData.humanStatus}**\n` +
        `🏪 **Merchant:** ${toolData.merchant}\n` +
        `📍 **Pickup Location:** ${toolData.pickupAddress}\n` +
        `⏰ **Pickup Window:** ${toolData.pickupWindow}\n` +
        `🎟️ **Claim Token:** \`${toolData.claimToken}\`\n\n` +
        `${toolData.nextAction}`;
      structuredResults = [toolData];
    }
  } else if (toolName === "getUserOrders") {
    if (!toolData.authenticated) {
      naturalResponse = toolData.message;
    } else if (!toolData.orders || toolData.orders.length === 0) {
      naturalResponse = "You haven't placed any orders yet on FoodSaver. Discover fresh surplus food deals near you!";
    } else {
      naturalResponse = `Here are your recent FoodSaver orders:\n\n` +
        toolData.orders.map((o) => `• **#${o.orderId}** — ${o.itemName} (x${o.quantity}, ₹${o.pricePaid}) at ${o.merchantName} • Status: **${o.status}** (Token: #${o.claimToken})`).join("\n");
      structuredResults = toolData.orders;
    }
  } else if (toolName === "cancelOrder") {
    naturalResponse = toolData.message;
  } else if (toolName === "getFoodCategories") {
    naturalResponse = `FoodSaver categories currently available:\n\n` +
      toolData.map((c) => `• 🍽️ **${c.name}** (${c.activeDeals} deals active)`).join("\n");
  } else if (toolName === "getFoodSaverHelp") {
    naturalResponse = toolData.explanation;
  }

  return {
    success: true,
    message: naturalResponse,
    intent,
    results: structuredResults,
    toolCalls: [{ tool: toolName, args: toolArgs, result: toolData }],
    provider: "local-sql-synthesis",
  };
}

module.exports = {
  processChatMessage,
  SYSTEM_PROMPT,
};

const { processChatMessage } = require("../services/llmService");
const { verifyToken } = require("../routes/auth");

/**
 * Handle incoming chat message
 * POST /api/chat
 */
async function handleChat(req, res) {
  try {
    const {
      message = "",
      latitude = null,
      longitude = null,
      conversationId = null,
      history = [],
    } = req.body || {};

    const cleanMessage = String(message).trim();

    if (!cleanMessage) {
      return res.status(400).json({
        success: false,
        error: "Message is required.",
      });
    }

    // Security check: Protect against prompt injection attempts to reveal secrets
    const lower = cleanMessage.toLowerCase();
    if (
      lower.includes("password") ||
      lower.includes("jwt_secret") ||
      lower.includes("db_password") ||
      lower.includes("api_key") ||
      lower.includes("process.env")
    ) {
      return res.json({
        success: true,
        message: "For security and privacy, FoodSaver AI cannot disclose authentication credentials, passwords, or system secrets. How else can I assist you with finding surplus meals or checking orders?",
        results: [],
        suggestions: ["🍱 Find food near me", "💰 Deals under ₹100", "📦 Track my order"],
      });
    }

    // Extract authenticated user if available
    let authenticatedUser = null;
    const authHeader = req.headers.authorization || "";
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const payload = verifyToken(token);
      if (payload && (payload.userId || payload.id)) {
        authenticatedUser = {
          userId: payload.userId || payload.id,
          email: payload.email,
          role: payload.role,
        };
      }
    }

    // Process with LLM & SQL Tools
    const result = await processChatMessage({
      message: cleanMessage,
      latitude,
      longitude,
      user: authenticatedUser,
      history,
    });

    return res.json({
      success: true,
      message: result.message,
      results: result.results || [],
      toolCalls: result.toolCalls || [],
      intent: result.intent,
      conversationId: conversationId || `conv_${Date.now()}`,
      suggestions: result.suggestions || [
        "🍱 Find food near me",
        "💰 Deals under ₹100",
        "🔥 Closing soon",
        "📦 Track my order",
        "🏪 Find nearby stores",
      ],
    });
  } catch (err) {
    console.error("Chat controller error:", err);
    return res.status(500).json({
      success: false,
      message: "Sorry, I'm having trouble retrieving the latest FoodSaver data right now. Please try again.",
      results: [],
    });
  }
}

module.exports = {
  handleChat,
};

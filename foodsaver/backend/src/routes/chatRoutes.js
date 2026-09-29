const express = require("express");
const { handleChat } = require("../controllers/chatController");

const router = express.Router();

// Primary chat endpoint: POST /api/chat
router.post("/", handleChat);

// Backwards compatibility endpoint: POST /api/chatbot/message
router.post("/message", handleChat);

module.exports = router;

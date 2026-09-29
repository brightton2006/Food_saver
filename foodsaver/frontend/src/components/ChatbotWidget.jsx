import React from "react";
import FoodSaverChatbot from "./FoodSaverChatbot.jsx";

/**
 * ChatbotWidget wrapper around FoodSaverChatbot for uniform integration.
 */
export default function ChatbotWidget(props) {
  return <FoodSaverChatbot {...props} />;
}

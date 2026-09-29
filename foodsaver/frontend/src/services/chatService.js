import { API_BASE } from "../lib/api.js";

/**
 * FoodSaver Chat Service
 * Real-time communication with the backend LLM and SQL discovery engine.
 */
export async function sendChatMessage({
  message,
  latitude = null,
  longitude = null,
  conversationId = null,
  history = [],
}) {
  const token = localStorage.getItem("foodsaver_token") || sessionStorage.getItem("foodsaver_token");

  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const payload = {
    message,
    latitude: latitude !== null ? Number(latitude) : null,
    longitude: longitude !== null ? Number(longitude) : null,
    conversationId,
    history: history.slice(-6).map((h) => ({
      sender: h.sender,
      text: h.text,
    })),
  };

  const response = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Chat API error (${response.status}): ${errorText}`);
  }

  return await response.json();
}

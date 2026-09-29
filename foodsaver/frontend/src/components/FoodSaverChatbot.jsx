import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  MessageSquare,
  X,
  Send,
  Bot,
  Sparkles,
  MapPin,
  ExternalLink,
  Navigation,
  Trash2,
  AlertCircle,
  Clock,
  Tag,
  Store,
} from "lucide-react";
import { sendChatMessage } from "../services/chatService.js";
import { getCurrentLocation, openDirections } from "../services/locationService.js";

const DEFAULT_SUGGESTIONS = [
  "🍱 Find food near me",
  "💰 Deals under ₹100",
  "🔥 Closing soon",
  "📦 Track my order",
  "🏪 Find nearby stores",
];

export default function FoodSaverChatbot() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState(null);
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      sender: "bot",
      text: "👋 Hi! I'm **FoodSaver AI**, your assistant for discovering freshly prepared surplus food at 30% to 70% off. How can I help you today?",
      suggestions: DEFAULT_SUGGESTIONS,
      timestamp: Date.now(),
    },
  ]);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll on new messages or open
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [messages, isOpen]);

  // Silently obtain current GPS coordinates for location-aware queries
  useEffect(() => {
    getCurrentLocation({ timeout: 6000 })
      .then((pos) => {
        setCoords({ latitude: pos.latitude, longitude: pos.longitude });
      })
      .catch(() => {
        // Location permission not yet granted; will prompt when nearby queries are triggered
      });
  }, []);

  const handleClearChat = () => {
    setMessages([
      {
        id: `welcome_${Date.now()}`,
        sender: "bot",
        text: "👋 Chat cleared. How can I help you discover surplus food or track an order?",
        suggestions: DEFAULT_SUGGESTIONS,
        timestamp: Date.now(),
      },
    ]);
  };

  const handleSend = async (textToSend) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || loading) return;

    // Check if user is asking for nearby food and coords aren't available yet
    let currentCoords = coords;
    const lower = text.toLowerCase();
    if (
      !currentCoords &&
      (lower.includes("near me") || lower.includes("nearby") || lower.includes("around me"))
    ) {
      try {
        const fresh = await getCurrentLocation({ timeout: 8000 });
        currentCoords = { latitude: fresh.latitude, longitude: fresh.longitude };
        setCoords(currentCoords);
      } catch (e) {
        // Continue; backend will inform user location is needed
      }
    }

    const userMsgId = `user_${Date.now()}`;
    const userMessage = {
      id: userMsgId,
      sender: "user",
      text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setLoading(true);

    try {
      const response = await sendChatMessage({
        message: text,
        latitude: currentCoords?.latitude,
        longitude: currentCoords?.longitude,
        conversationId: "foodsaver_session",
        history: messages,
      });

      if (response && response.success) {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot_${Date.now()}`,
            sender: "bot",
            text: response.message,
            results: response.results || [],
            suggestions: response.suggestions || DEFAULT_SUGGESTIONS,
            timestamp: Date.now(),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot_err_${Date.now()}`,
            sender: "bot",
            text: response?.message || "Sorry, I couldn't retrieve the latest FoodSaver data. Please try again.",
            suggestions: DEFAULT_SUGGESTIONS,
            timestamp: Date.now(),
          },
        ]);
      }
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `bot_err_${Date.now()}`,
          sender: "bot",
          text: "I'm having trouble connecting to FoodSaver services right now. Please ensure the backend server is running and try again.",
          suggestions: DEFAULT_SUGGESTIONS,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleViewOnMap = (item) => {
    setIsOpen(false);
    navigate("/customer/nearby-food");
  };

  return (
    <div className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end">
      {/* Floating Chat Drawer Window */}
      {isOpen && (
        <div
          className="bg-white border border-[#DCE6E3] rounded-3xl shadow-2xl flex flex-col overflow-hidden mb-3 animate-in fade-in slide-in-from-bottom-5 duration-200 text-[#102A2A]"
          style={{ width: "min(400px, 94vw)", height: "580px", maxHeight: "82vh", fontFamily: "'Poppins', 'Inter', system-ui, -apple-system, sans-serif" }}
        >
          {/* Header */}
          <div className="bg-[#145C52] text-white px-4 py-3.5 flex items-center justify-between border-b border-[#16796B]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-[#E8F4F1]/20 backdrop-blur-md flex items-center justify-center text-lg border border-white/20">
                🤖
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="font-extrabold text-sm tracking-tight text-white">FoodSaver AI</h4>
                  <span className="text-[10px] font-black bg-[#E8F4F1] text-[#145C52] px-1.5 py-0.5 rounded-md">
                    LIVE
                  </span>
                </div>
                <p className="text-[11px] text-[#E8F4F1] flex items-center gap-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F5C451] animate-pulse"></span>
                  Surplus Discovery & Order Assistant
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleClearChat}
                title="Clear conversation"
                className="p-1.5 hover:bg-white/20 text-[#E8F4F1] hover:text-white rounded-xl transition-colors text-xs"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close chat"
                className="p-1.5 hover:bg-white/20 text-white rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#F7F9F8]">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
              >
                {/* Message Bubble: User is Light Teal #E8F4F1, Bot is #F3F9F7 */}
                <div
                  className={`max-w-[88%] rounded-2xl p-3.5 text-xs sm:text-[13px] leading-relaxed shadow-xs ${
                    msg.sender === "user"
                      ? "bg-[#E8F4F1] text-[#102A2A] font-semibold border border-[#16796B]/30 rounded-tr-xs"
                      : "bg-[#F3F9F7] text-[#102A2A] border border-[#DCE6E3] rounded-tl-xs"
                  }`}
                >
                  <div className="whitespace-pre-line break-words">{msg.text}</div>

                  {/* Structured Result Cards (Food or Stores) */}
                  {msg.results && msg.results.length > 0 && (
                    <div className="mt-3 space-y-2 pt-2 border-t border-[#DCE6E3]">
                      {msg.results.slice(0, 3).map((item, idx) => (
                        <div
                          key={`${item.listingId || item.merchantId || idx}`}
                          className="bg-[#FFFFFF] border border-[#DCE6E3] rounded-xl p-2.5 flex flex-col gap-1.5 shadow-xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <strong className="text-xs text-[#102A2A] font-extrabold truncate">
                              {item.foodName || item.businessName || item.itemName}
                            </strong>
                            {item.discountPercentage > 0 && (
                              <span className="text-[10px] font-black bg-[#FF9F43]/15 text-[#FF9F43] border border-[#FF9F43]/40 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                                🔥 {item.discountPercentage}% OFF
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-[#687674]">
                            <span>
                              {item.price ? `₹${item.price}` : item.cuisine || "Surplus"}
                              {item.originalPrice ? ` (₹${item.originalPrice})` : ""}
                            </span>
                            <span className="text-[#145C52] font-bold">
                              {item.distanceText || (item.distance ? `${item.distance} km` : item.address?.split(",")[0])}
                            </span>
                          </div>

                          {/* Quick Card Actions */}
                          <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-[#DCE6E3]/60">
                            <button
                              type="button"
                              onClick={() => handleViewOnMap(item)}
                              className="flex-1 py-1 px-2 bg-[#145C52] hover:bg-[#16796B] text-white font-bold rounded-lg text-[10px] text-center transition-all flex items-center justify-center gap-1 shadow-xs"
                            >
                              <span>🗺️</span> View on Map
                            </button>

                            {(item.latitude || item.lat) && (
                              <button
                                type="button"
                                onClick={() => openDirections(item.latitude || item.lat, item.longitude || item.lng)}
                                className="py-1 px-2 bg-white hover:bg-[#E8F4F1] text-[#145C52] font-bold rounded-lg text-[10px] flex items-center gap-1 border border-[#DCE6E3]"
                                title="Directions"
                              >
                                <span>🧭</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Suggestions Chips underneath bot reply */}
                {msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 max-w-[95%]">
                    {msg.suggestions.map((sug, sIdx) => (
                      <button
                        key={`${msg.id}_sug_${sIdx}`}
                        type="button"
                        onClick={() => handleSend(sug)}
                        className="text-[11px] font-semibold bg-white hover:bg-[#E8F4F1] text-[#145C52] border border-[#DCE6E3] px-2.5 py-1 rounded-xl transition-all shadow-xs"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Typing Indicator */}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-[#687674] bg-white border border-[#DCE6E3] rounded-2xl px-3 py-2 w-fit shadow-xs">
                <span className="w-2 h-2 rounded-full bg-[#16796B] animate-ping"></span>
                <span className="font-semibold">FoodSaver AI is querying live data...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Box Footer */}
          <div className="p-3 bg-white border-t border-[#DCE6E3]">
            <div className="flex items-center gap-2 bg-[#FFFFFF] border border-[#DCE6E3] rounded-2xl px-3 py-1.5 focus-within:border-[#16796B] focus-within:ring-2 focus-within:ring-[#16796B]/15 transition-all">
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask FoodSaver AI (e.g., 'Find biryani under ₹100')..."
                className="flex-1 bg-transparent text-xs sm:text-[13px] text-[#102A2A] placeholder-[#8A9693] focus:outline-none py-1"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!inputMessage.trim() || loading}
                className="w-8 h-8 rounded-xl bg-[#145C52] hover:bg-[#16796B] disabled:opacity-40 text-white flex items-center justify-center font-bold transition-all shrink-0 shadow-xs"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between mt-2 px-1 text-[10px] text-[#687674]">
              <span className="flex items-center gap-1 font-medium">
                <span>📍</span>
                <span>{coords ? "GPS Location Active" : "Click suggestions or ask near me"}</span>
              </span>
              <span className="font-medium text-[#145C52]">SQL Real-Time Sync</span>
            </div>
          </div>
        </div>
      )}

      {/* Floating Trigger Button 💬 */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center justify-center w-14 h-14 bg-[#145C52] hover:bg-[#16796B] text-white rounded-full shadow-xl shadow-[#145C52]/30 border-2 border-[#E8F4F1]/60 transition-all duration-300 hover:scale-105 active:scale-95"
          title="Open FoodSaver AI Assistant"
        >
          {/* Subtle pulse radar ring */}
          <span className="absolute -inset-1 rounded-full bg-[#145C52]/20 animate-ping pointer-events-none" />

          <div className="flex items-center justify-center text-2xl">
            💬
          </div>

          {/* Hover Tooltip */}
          <span className="absolute right-full mr-3 bg-[#102A2A] text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            FoodSaver AI 🤖
          </span>
        </button>
      )}
    </div>
  );
}

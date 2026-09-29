import { io } from "socket.io-client";
import { API_BASE } from "./api.js";

// One shared socket for the whole app (customer feed, merchant console,
// and NGO dashboard all listen on it) so state stays in sync across tabs
// and across web/mobile without extra polling.
function getAuthToken() {
  if (typeof window === "undefined") return null;
  const keys = ["foodsaver_session", "foodsaver.session", "token"];
  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      if (raw.startsWith("{") || raw.startsWith("[")) {
        const parsed = JSON.parse(raw);
        if (parsed?.token && parsed.token !== "null" && parsed.token !== "undefined") return parsed.token;
      } else if (raw && raw !== "null" && raw !== "undefined") {
        return raw;
      }
    } catch {}
  }
  return null;
}

export const socket = io(API_BASE, {
  autoConnect: true,
  transports: ["websocket", "polling"],
  auth: (cb) => {
    cb({ token: getAuthToken() });
  },
});

export function getSocket() {
  if (socket && !socket.connected) {
    socket.auth = { token: getAuthToken() };
    socket.connect();
  }
  return socket;
}


import React, { createContext, useContext, useEffect, useState } from "react";

const SessionContext = createContext(null);
const STORAGE_KEY_UNDERSCORE = "foodsaver_session";
const STORAGE_KEY_DOT = "foodsaver.session";

export function SessionProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_UNDERSCORE) || localStorage.getItem(STORAGE_KEY_DOT);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (session) {
      const str = JSON.stringify(session);
      localStorage.setItem(STORAGE_KEY_UNDERSCORE, str);
      localStorage.setItem(STORAGE_KEY_DOT, str);
      if (session.token) {
        localStorage.setItem("token", session.token);
      }
    } else {
      localStorage.removeItem(STORAGE_KEY_UNDERSCORE);
      localStorage.removeItem(STORAGE_KEY_DOT);
      localStorage.removeItem("token");
    }
  }, [session]);

  return (
    <SessionContext.Provider value={{ session, setSession }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}

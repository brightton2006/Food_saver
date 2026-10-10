import React, { useState, useEffect } from "react";
import { Smartphone, Monitor, ShieldCheck, Sparkles, Wifi, Battery, Volume2 } from "lucide-react";

export default function MobileFrameShell({ children, onExit }) {
  const [viewMode, setViewMode] = useState("frame"); // "frame" | "expanded"
  const [timeStr, setTimeStr] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`mobile-experience-root mode-${viewMode}`}>
      {/* Desktop Mobile View Control Bar (Visible on desktop/tablets) */}
      <header className="mobile-top-control-bar" aria-label="Mobile View Controls">
        <div className="bar-brand">
          <div className="mobile-app-badge">
            <Smartphone className="icon-pulse" size={16} />
            <span>Mobile App View</span>
          </div>
          <span className="bar-divider">•</span>
          <span className="bar-subtitle">FoodSaver Mobile Platform</span>
        </div>

        <div className="bar-actions">
          <div className="view-toggle-group">
            <button
              type="button"
              className={`toggle-btn ${viewMode === "frame" ? "active" : ""}`}
              onClick={() => setViewMode("frame")}
              title="Smartphone Device Frame Mode"
            >
              <Smartphone size={15} />
              <span>Mobile Frame</span>
            </button>
            <button
              type="button"
              className={`toggle-btn ${viewMode === "expanded" ? "active" : ""}`}
              onClick={() => setViewMode("expanded")}
              title="Edge-to-Edge Mobile View Mode"
            >
              <Monitor size={15} />
              <span>Full Mobile View</span>
            </button>
          </div>

          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="toggle-btn"
              style={{ background: "rgba(239, 68, 68, 0.2)", color: "#f87171", border: "1px solid rgba(239, 68, 68, 0.4)", fontWeight: 800 }}
              title="Return to standard view"
            >
              ✕ Exit Mobile View
            </button>
          )}
        </div>
      </header>

      {/* Main View Container */}
      <div className="mobile-viewport-stage">
        {viewMode === "frame" ? (
          <div className="smartphone-device-frame">
            {/* Physical Side Buttons Mock */}
            <div className="phone-btn phone-vol-up" />
            <div className="phone-btn phone-vol-down" />
            <div className="phone-btn phone-power" />

            {/* Phone Screen Canvas */}
            <div className="smartphone-screen">
              {/* Dynamic Island / Camera Notch */}
              <div className="smartphone-notch">
                <div className="notch-camera" />
                <div className="notch-speaker" />
              </div>

              {/* Status Bar */}
              <div className="smartphone-status-bar">
                <span className="status-time">{timeStr || "9:41 AM"}</span>
                <div className="status-icons">
                  <span className="status-badge-5g">5G</span>
                  <Wifi size={13} />
                  <Battery size={15} className="battery-icon" />
                </div>
              </div>

              {/* App Viewport Content */}
              <div className="smartphone-scroll-body">
                {children}
              </div>

              {/* iOS Home Indicator Bar */}
              <div className="smartphone-home-bar" />
            </div>
          </div>
        ) : (
          <div className="mobile-expanded-container">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

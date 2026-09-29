import { useState, useEffect, useCallback } from "react";
import { api } from "./api.js";

export function useDeviceLocation(options = {}) {
  const { autoFetch = true, syncBackend = true, userId = null } = options;

  const [location, setLocation] = useState(() => {
    const saved = localStorage.getItem("foodsaver_user_location");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      lat: 9.1724,
      lng: 77.8694,
      accuracy: null,
      address: "Kovilpatti, Tamil Nadu",
      source: "default",
      permissionState: "prompt", // 'prompt' | 'granted' | 'denied' | 'unavailable' | 'timeout'
    };
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const requestLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      const errText = "Geolocation is not supported by your browser.";
      setError(errText);
      setLocation((prev) => ({ ...prev, permissionState: "unavailable" }));
      return null;
    }

    setLoading(true);
    setError(null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          setLoading(false);
          const { latitude, longitude, accuracy } = pos.coords;

          const locData = {
            lat: latitude,
            lng: longitude,
            latitude,
            longitude,
            accuracy,
            source: "gps",
            permissionState: "granted",
            timestamp: Date.now(),
          };

          setLocation(locData);
          localStorage.setItem("foodsaver_user_location", JSON.stringify(locData));

          if (syncBackend) {
            try {
              await api.updateUserLocation({
                userId: userId || "guest",
                latitude,
                longitude,
                lat: latitude,
                lng: longitude,
                accuracy,
              });
            } catch (err) {
              console.warn("Failed syncing user location to backend:", err.message);
            }
          }

          resolve(locData);
        },
        (err) => {
          setLoading(false);
          let errorType = "unavailable";
          let message = "Unable to retrieve position.";

          if (err.code === 1) { // PERMISSION_DENIED
            errorType = "denied";
            message = "Location access was denied. Please allow location access to discover food nearby.";
          } else if (err.code === 2) { // POSITION_UNAVAILABLE
            errorType = "unavailable";
            message = "Position unavailable. Please check your device GPS / location settings.";
          } else if (err.code === 3) { // TIMEOUT
            errorType = "timeout";
            message = "GPS request timed out. Please try again.";
          }

          setError(message);
          setLocation((prev) => ({ ...prev, permissionState: errorType }));
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
      );
    });
  }, [syncBackend, userId]);

  useEffect(() => {
    if (autoFetch && location.source === "default") {
      requestLocation();
    }
  }, [autoFetch, location.source, requestLocation]);

  return {
    location,
    loading,
    error,
    requestLocation,
    setLocation,
  };
}

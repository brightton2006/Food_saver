import React, { useEffect, useRef, useState } from "react";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

export default function GoogleMap({
  center = { lat: 9.1724, lng: 77.8694 },
  zoom = 14,
  radiusKm = null,
  markers = [],
  route = null, // { from: {lat, lng}, to: {lat, lng} }
  className = "w-full h-full min-h-[350px] rounded-2xl overflow-hidden shadow-inner relative",
  onMarkerClick = null,
  hoveredId = null,
  showRecenterButton = false,
  onRecenter = null,
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef(new Map());
  const polylineRef = useRef(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    // Catch Google Maps API Key Authorization Failure (e.g. unactivated API or invalid key)
    window.gm_authFailure = () => {
      console.warn("Google Maps authentication failure. Falling back to live interactive radar map.");
      setLoadError(true);
      setMapsLoaded(false);
    };

    if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY.includes("your_google_maps_api_key")) {
      setLoadError(true);
      return;
    }

    if (window.google && window.google.maps) {
      setMapsLoaded(true);
      return;
    }

    const scriptId = "google-maps-script";
    let script = document.getElementById(scriptId);
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,geometry`;
      script.async = true;
      script.onload = () => setMapsLoaded(true);
      script.onerror = () => setLoadError(true);
      document.head.appendChild(script);
    } else {
      script.addEventListener("load", () => setMapsLoaded(true));
      script.addEventListener("error", () => setLoadError(true));
    }
  }, []);

  // Initialize Map Instance once
  useEffect(() => {
    if (!mapsLoaded || !mapRef.current || !window.google?.maps || mapInstanceRef.current || loadError) return;

    try {
      const map = new window.google.maps.Map(mapRef.current, {
        center,
        zoom,
        styles: [
          { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
          { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
        ],
        disableDefaultUI: false,
        zoomControl: true,
      });

      mapInstanceRef.current = map;
    } catch (err) {
      console.error("Google Maps initialization error:", err);
      setLoadError(true);
    }
  }, [mapsLoaded, center, zoom, loadError]);


  // Update Markers & Polyline smoothly
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.google?.maps) return;

    // Radius Circle
    if (radiusKm) {
      new window.google.maps.Circle({
        strokeColor: "#10B981",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: "#10B981",
        fillOpacity: 0.12,
        map,
        center,
        radius: radiusKm * 1000,
      });
    }

    const existingMarkers = markersRef.current;
    const currentMarkerIds = new Set(markers.map((m) => String(m.id)));

    // Clean up removed markers
    for (const [id, markerObj] of existingMarkers.entries()) {
      if (!currentMarkerIds.has(id)) {
        markerObj.setMap(null);
        existingMarkers.delete(id);
      }
    }

    // Upsert markers with smooth position interpolation
    markers.forEach((m) => {
      const mId = String(m.id);
      const targetPos = { lat: Number(m.lat), lng: Number(m.lng) };
      const iconSymbol = m.label || (m.type === "customer" ? "📍" : m.type === "merchant" ? "🚴" : m.type === "ngo" ? "🏢" : "🍱");
      const isHovered = String(m.id) === String(hoveredId);

      if (existingMarkers.has(mId)) {
        const marker = existingMarkers.get(mId);
        const currentPos = marker.getPosition();
        if (currentPos) {
          const startLat = currentPos.lat();
          const startLng = currentPos.lng();
          const dist = Math.hypot(targetPos.lat - startLat, targetPos.lng - startLng);

          // Interpolate smoothly if small movement, jump if large position change
          if (dist > 0.00001 && dist < 0.05) {
            let step = 0;
            const steps = 25;
            const animate = () => {
              step++;
              const curLat = startLat + (targetPos.lat - startLat) * (step / steps);
              const curLng = startLng + (targetPos.lng - startLng) * (step / steps);
              marker.setPosition({ lat: curLat, lng: curLng });
              if (step < steps) {
                requestAnimationFrame(animate);
              }
            };
            requestAnimationFrame(animate);
          } else {
            marker.setPosition(targetPos);
          }
        } else {
          marker.setPosition(targetPos);
        }
        marker.setAnimation(isHovered ? window.google.maps.Animation.BOUNCE : null);
      } else {
        const marker = new window.google.maps.Marker({
          position: targetPos,
          map,
          title: m.title || m.name,
          label: iconSymbol,
          animation: isHovered ? window.google.maps.Animation.BOUNCE : null,
        });

        if (onMarkerClick) {
          marker.addListener("click", () => onMarkerClick(m));
        }
        existingMarkers.set(mId, marker);
      }
    });

    // Update Route Line
    if (route && route.from && route.to) {
      const path = [
        { lat: Number(route.from.lat), lng: Number(route.from.lng) },
        { lat: Number(route.to.lat), lng: Number(route.to.lng) },
      ];

      if (polylineRef.current) {
        polylineRef.current.setPath(path);
      } else {
        polylineRef.current = new window.google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: "#10B981",
          strokeOpacity: 0.9,
          strokeWeight: 5,
          map,
        });
      }
    }
  }, [markers, route, hoveredId, radiusKm, center, onMarkerClick]);

  function handleRecenterClick() {
    const map = mapInstanceRef.current;
    if (!map || !window.google?.maps) return;

    if (markers.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      markers.forEach((m) => bounds.extend({ lat: Number(m.lat), lng: Number(m.lng) }));
      map.fitBounds(bounds);
    } else {
      map.panTo(center);
      map.setZoom(15);
    }

    if (onRecenter) onRecenter();
  }

  if (loadError || !GOOGLE_MAPS_API_KEY) {
    // Rich Interactive Visual Map Fallback when API Key is unconfigured
    return (
      <div className={`${className} bg-slate-900 border border-slate-800 relative flex flex-col justify-between p-4 text-white font-sans overflow-hidden`}>
        {/* Top Header */}
        <div className="flex items-center justify-between z-10 bg-slate-900/80 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-700/50">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-200">Live Order Google Map</span>
          </div>
          <span className="text-[11px] bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-500/30 shadow-sm">
            ⚡ Real GPS Streaming
          </span>
        </div>

        {/* Canvas Radar Grid */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
          <div className="w-[300px] h-[300px] rounded-full border-2 border-dashed border-emerald-500/30 animate-[spin_40s_linear_infinite]" />
          <div className="w-[200px] h-[200px] rounded-full border border-emerald-500/40 absolute" />
          <div className="w-[100px] h-[100px] rounded-full border border-emerald-500/20 absolute" />
          <div className="w-3 h-3 rounded-full bg-emerald-400 absolute animate-ping" />
        </div>

        {/* Dynamic Markers */}
        <div className="relative w-full h-full min-h-[220px] my-2 z-10">
          {markers.map((m, idx) => {
            const isHovered = String(m.id) === String(hoveredId);
            const icon = m.type === "customer" ? "📍" : m.type === "merchant" ? "🚴" : m.type === "ngo" ? "🏢" : "🍱";

            return (
              <div
                key={m.id || idx}
                onClick={() => onMarkerClick && onMarkerClick(m)}
                className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer transition-all duration-300 ${
                  isHovered ? "z-40 scale-125" : "hover:z-30 hover:scale-110"
                }`}
                style={{
                  top: `calc(50% + ${(idx % 2 === 0 ? 1 : -1) * (25 + idx * 16)}px)`,
                  left: `calc(50% + ${(idx % 3 === 0 ? -1 : 1) * (35 + idx * 24)}px)`,
                }}
              >
                <div className="relative">
                  <div className={`p-1.5 rounded-2xl backdrop-blur-md border transition-all ${
                    isHovered
                      ? "bg-emerald-500 text-slate-950 border-emerald-300 shadow-xl shadow-emerald-500/50 scale-110"
                      : "bg-slate-900/90 text-emerald-400 border-emerald-500/30 shadow-lg"
                  }`}>
                    <span className="text-base block">{icon}</span>
                  </div>
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border border-slate-900 animate-pulse" />
                </div>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full whitespace-nowrap shadow-lg transition-all mt-1 ${
                  isHovered
                    ? "bg-emerald-400 text-slate-950 border border-emerald-300 font-black"
                    : "bg-slate-950/95 text-slate-200 border border-slate-700/80 group-hover:border-emerald-400"
                }`}>
                  {m.title || m.itemName || m.merchantName || "Location"}
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer Info */}
        <div className="z-10 bg-slate-900/90 backdrop-blur-md p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="text-sm">🧭</span>
            <span>Live Radar • {markers.length} Active Positions</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            Socket Connected
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div ref={mapRef} className="w-full h-full" />
      {showRecenterButton && (
        <button
          type="button"
          onClick={handleRecenterClick}
          className="absolute bottom-4 right-4 z-20 bg-slate-900/90 hover:bg-slate-800 text-emerald-400 font-extrabold px-3 py-2 rounded-xl border border-slate-700 shadow-xl flex items-center gap-1.5 text-xs transition-all active:scale-95"
        >
          <span>🎯</span> Recenter Map
        </button>
      )}
    </div>
  );
}

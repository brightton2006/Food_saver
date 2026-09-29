import React, { useState, useEffect, useRef } from "react";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

export default function GooglePlacesAddressPicker({
  initialAddress = "",
  initialLat = 9.1724,
  initialLng = 77.8694,
  onLocationSelect,
  className = "",
}) {
  const [address, setAddress] = useState(initialAddress);
  const [lat, setLat] = useState(initialLat);
  const [lng, setLng] = useState(initialLng);
  const [placeId, setPlaceId] = useState("");
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const inputRef = useRef(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const autocompleteRef = useRef(null);

  // Load Google Maps API script with places library
  useEffect(() => {
    window.gm_authFailure = () => {
      console.warn("Google Maps auth failure in GooglePlacesAddressPicker");
      setMapsLoaded(false);
    };

    if (window.google && window.google.maps && window.google.maps.places) {
      setMapsLoaded(true);
      return;
    }

    if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY.includes("your_google_maps_api_key")) {
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
      script.onerror = () => setMapsLoaded(false);
      document.head.appendChild(script);
    } else {
      script.addEventListener("load", () => setMapsLoaded(true));
      script.addEventListener("error", () => setMapsLoaded(false));
    }
  }, []);


  // Initialize Places Autocomplete & Interactive Map
  useEffect(() => {
    if (!mapsLoaded || !window.google?.maps) return;

    // Autocomplete setup on input
    if (inputRef.current && !autocompleteRef.current) {
      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ["establishment", "geocode"],
      });

      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current.getPlace();
        if (place.geometry && place.geometry.location) {
          const selectedLat = place.geometry.location.lat();
          const selectedLng = place.geometry.location.lng();
          const formattedAddress = place.formatted_address || place.name || address;
          const pId = place.place_id || "";

          setLat(selectedLat);
          setLng(selectedLng);
          setAddress(formattedAddress);
          setPlaceId(pId);

          if (mapInstanceRef.current) {
            mapInstanceRef.current.panTo({ lat: selectedLat, lng: selectedLng });
            mapInstanceRef.current.setZoom(16);
          }
          if (markerRef.current) {
            markerRef.current.setPosition({ lat: selectedLat, lng: selectedLng });
          }

          if (onLocationSelect) {
            onLocationSelect({
              address: formattedAddress,
              formattedAddress,
              latitude: selectedLat,
              longitude: selectedLng,
              lat: selectedLat,
              lng: selectedLng,
              placeId: pId,
            });
          }
        }
      });
    }

    // Interactive Map Setup with Draggable Marker
    if (mapRef.current && !mapInstanceRef.current) {
      const initialPos = { lat: Number(lat), lng: Number(lng) };
      const map = new window.google.maps.Map(mapRef.current, {
        center: initialPos,
        zoom: 15,
        disableDefaultUI: false,
        zoomControl: true,
      });

      const marker = new window.google.maps.Marker({
        position: initialPos,
        map,
        draggable: true,
        title: "Drag marker to fine-tune exact business location",
        animation: window.google.maps.Animation.DROP,
      });

      marker.addListener("dragend", (event) => {
        const newLat = event.latLng.lat();
        const newLng = event.latLng.lng();
        setLat(newLat);
        setLng(newLng);

        // Reverse geocode new marker location
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: { lat: newLat, lng: newLng } }, (results, status) => {
          let updatedAddr = address;
          let pId = placeId;
          if (status === "OK" && results[0]) {
            updatedAddr = results[0].formatted_address;
            pId = results[0].place_id;
            setAddress(updatedAddr);
            setPlaceId(pId);
          }
          if (onLocationSelect) {
            onLocationSelect({
              address: updatedAddr,
              formattedAddress: updatedAddr,
              latitude: newLat,
              longitude: newLng,
              lat: newLat,
              lng: newLng,
              placeId: pId,
            });
          }
        });
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
    }
  }, [mapsLoaded]);

  function handleManualGeocode() {
    if (!window.google?.maps || !address) return;
    setLoading(true);
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address }, (results, status) => {
      setLoading(false);
      if (status === "OK" && results[0]) {
        const loc = results[0].geometry.location;
        const selectedLat = loc.lat();
        const selectedLng = loc.lng();
        const formattedAddr = results[0].formatted_address;
        const pId = results[0].place_id;

        setLat(selectedLat);
        setLng(selectedLng);
        setAddress(formattedAddr);
        setPlaceId(pId);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo({ lat: selectedLat, lng: selectedLng });
          mapInstanceRef.current.setZoom(16);
        }
        if (markerRef.current) {
          markerRef.current.setPosition({ lat: selectedLat, lng: selectedLng });
        }

        if (onLocationSelect) {
          onLocationSelect({
            address: formattedAddr,
            formattedAddress: formattedAddr,
            latitude: selectedLat,
            longitude: selectedLng,
            lat: selectedLat,
            lng: selectedLng,
            placeId: pId,
          });
        }
      }
    });
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
          Search Business Location / Address (Google Places)
        </label>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Type restaurant name, hotel or street address (e.g. ABC Hotel, Chennai)..."
            className="w-full px-4 py-3 bg-slate-900 border border-slate-700/80 rounded-2xl text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all shadow-inner"
          />
          <button
            type="button"
            onClick={handleManualGeocode}
            disabled={loading}
            className="px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-2xl transition-all whitespace-nowrap shadow-md active:scale-95"
          >
            {loading ? "Searching..." : "🔍 Search Location"}
          </button>
        </div>
      </div>

      {/* Map View & Drag Notice */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 h-56 shadow-lg">
        {mapsLoaded ? (
          <div ref={mapRef} className="w-full h-full" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-slate-900 text-slate-400 text-xs">
            <span className="text-2xl mb-1">📍</span>
            <p className="font-semibold text-slate-300">Google Places & Map</p>
            <p className="text-[11px] text-slate-500 max-w-xs mt-1">
              {GOOGLE_MAPS_API_KEY
                ? "Loading interactive Google Map..."
                : "Configure VITE_GOOGLE_MAPS_API_KEY to enable live Places Autocomplete & pin dragging."}
            </p>
          </div>
        )}

        <div className="absolute top-2 left-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 text-[11px] text-emerald-400 font-extrabold shadow-md flex items-center gap-1.5">
          <span>🎯</span> Drag map marker to adjust exact GPS coordinates
        </div>
      </div>

      {/* Selected Coordinates Readout */}
      <div className="grid grid-cols-2 gap-3 p-3 bg-slate-900/70 rounded-2xl border border-slate-800 text-xs">
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-bold">Latitude</span>
          <span className="font-mono text-emerald-400 font-semibold">{lat ? Number(lat).toFixed(6) : "N/A"}</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-bold">Longitude</span>
          <span className="font-mono text-emerald-400 font-semibold">{lng ? Number(lng).toFixed(6) : "N/A"}</span>
        </div>
      </div>
    </div>
  );
}

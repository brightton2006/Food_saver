import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../lib/session.jsx";
import { api } from "../lib/api.js";
import {
  searchFoodImage,
  DEFAULT_FOOD_IMAGE,
  preloadImage,
} from "../lib/foodImageService.js";
import { FOOD_CATALOG, ALL_FOOD_ITEMS } from "../lib/foodCatalog.js";
import PageTransition from "../components/animations/PageTransition.jsx";
import SuccessAnimation from "../components/animations/SuccessAnimation.jsx";

const CATEGORIES = ["Bakery", "Meals", "Snacks", "Desserts", "Beverages", "Fast Food", "Homemade", "Grocery"];

const initialForm = {
  itemName: "",
  description: "",
  category: "Meals",
  quantityTotal: 5,
  originalPrice: "",
  discountPrice: "",
  durationMinutes: 60,
  address: "",
  pickupWindowStart: "20:00",
  pickupWindowEnd: "22:00",
  imageUrl: "",
};

export default function MerchantPost() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [publishedSuccess, setPublishedSuccess] = useState(false);

  const isProfileComplete = Boolean(
    (session?.hotelName || session?.name) &&
    session?.address &&
    (session?.mobile || session?.email) &&
    session?.regDetails
  );
  const isApproved = session?.verificationStatus === "approved";

  if (!isApproved || !isProfileComplete) {
    return (
      <div className="app-main" style={{ maxWidth: 580, margin: "60px auto", textAlign: "center" }}>
        <div className="card" style={{ padding: 36, border: "1.5px solid #FF9F68", borderRadius: 16, boxShadow: "0 8px 32px rgba(245, 158, 11, 0.15)" }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>🔒</div>
          <h2 style={{ color: "#FF9F68", margin: "0 0 10px", fontSize: 22, fontWeight: 800 }}>
            {!isProfileComplete ? "Initial Profile Completion Required" : "Admin Verification Required"}
          </h2>
          <p style={{ fontSize: 14.5, color: "var(--dusk-soft)", lineHeight: 1.6, marginBottom: 24 }}>
            {!isProfileComplete
              ? "Before posting food listings, you must complete your initial merchant profile details (Business Name, Address, Contact Mobile, and FSSAI License Registration)."
              : "Your merchant account is currently pending Admin verification. You will be able to post food surplus once approved by Admin."}
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            {!isProfileComplete && (
              <button type="button" className="btn btn-amber" onClick={() => navigate("/profile")}>
                ✏️ Complete Profile Now
              </button>
            )}
            <button type="button" className="btn btn-outline" onClick={() => navigate("/merchant")}>
              ← Back to Merchant Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Auto-fetch image state
  const [imageState, setImageState] = useState({
    searching: false,
    fetched: false,
    failed: false,
    source: "",
    imageUrl: "",
    alternatives: [],
    altIndex: 0,
  });

  const debounceTimerRef = useRef(null);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleCatalogSelect(e) {
    const selectedName = e.target.value;
    if (!selectedName) return;

    if (selectedName === "__custom__") {
      setForm((f) => ({ ...f, itemName: "" }));
      return;
    }

    const match = ALL_FOOD_ITEMS.find((item) => item.name === selectedName);
    if (match) {
      setForm((f) => ({
        ...f,
        itemName: match.name,
        category: match.category || f.category,
        originalPrice: match.originalPrice || f.originalPrice,
        discountPrice: match.discountPrice || f.discountPrice,
        description: match.description || f.description,
      }));
    } else {
      setForm((f) => ({ ...f, itemName: selectedName }));
    }
  }

  // Trigger automatic image search when food name or category changes
  useEffect(() => {
    const foodName = form.itemName.trim();
    if (!foodName) {
      setImageState({
        searching: false,
        fetched: false,
        failed: false,
        source: "",
        imageUrl: "",
        alternatives: [],
        altIndex: 0,
      });
      update("imageUrl", "");
      return;
    }

    // Set searching status immediately
    setImageState((prev) => ({
      ...prev,
      searching: true,
      failed: false,
    }));

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const result = await searchFoodImage(foodName, form.category, "South Indian");
        if (result && result.imageUrl) {
          await preloadImage(result.imageUrl);
          const allOptions = [result.imageUrl, ...(result.alternatives || [])];
          setImageState({
            searching: false,
            fetched: true,
            failed: false,
            source: result.source || "Auto Fetched",
            imageUrl: result.imageUrl,
            alternatives: allOptions,
            altIndex: 0,
          });
          update("imageUrl", result.imageUrl);
        } else {
          setImageState({
            searching: false,
            fetched: false,
            failed: true,
            source: "Search Failed",
            imageUrl: DEFAULT_FOOD_IMAGE,
            alternatives: [DEFAULT_FOOD_IMAGE],
            altIndex: 0,
          });
          update("imageUrl", DEFAULT_FOOD_IMAGE);
        }
      } catch (err) {
        setImageState({
          searching: false,
          fetched: false,
          failed: true,
          source: "Search Failed",
          imageUrl: DEFAULT_FOOD_IMAGE,
          alternatives: [DEFAULT_FOOD_IMAGE],
          altIndex: 0,
        });
        update("imageUrl", DEFAULT_FOOD_IMAGE);
      }
    }, 700);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [form.itemName, form.category]);

  // Handler for "Change Image" button (cycles candidate images)
  function handleChangeImage() {
    if (!imageState.alternatives || imageState.alternatives.length <= 1) {
      // Re-trigger search with broader query
      const foodName = form.itemName.trim();
      if (foodName) {
        setImageState((prev) => ({ ...prev, searching: true }));
        searchFoodImage(`${foodName} south indian food`, form.category).then(
          (result) => {
            const newOptions = [result.imageUrl, ...(result.alternatives || [])];
            setImageState({
              searching: false,
              fetched: true,
              failed: false,
              source: result.source || "Auto Fetched",
              imageUrl: result.imageUrl,
              alternatives: newOptions,
              altIndex: 0,
            });
            update("imageUrl", result.imageUrl);
          }
        );
      }
      return;
    }

    const nextIndex = (imageState.altIndex + 1) % imageState.alternatives.length;
    const nextUrl = imageState.alternatives[nextIndex];
    setImageState((prev) => ({
      ...prev,
      altIndex: nextIndex,
      imageUrl: nextUrl,
    }));
    update("imageUrl", nextUrl);
  }

  // Handler for "Use Default Image" button
  function handleUseDefaultImage() {
    setImageState((prev) => ({
      ...prev,
      searching: false,
      fetched: true,
      failed: false,
      source: "Default Food Placeholder",
      imageUrl: DEFAULT_FOOD_IMAGE,
    }));
    update("imageUrl", DEFAULT_FOOD_IMAGE);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createListing({
        ...form,
        imageUrl: form.imageUrl || DEFAULT_FOOD_IMAGE,
        merchantId: session?.merchantId || session?.username || session?.hotelName,
        hotelId: session?.merchantId || session?.username || session?.hotelName,
        hotelName: session?.hotelName || session?.name || "Sunrise Cafe",
        merchantName: session?.hotelName || session?.name || "Sunrise Cafe",
        merchantUsername: session?.username,
        quantityTotal: Number(form.quantityTotal),
        originalPrice: Number(form.originalPrice),
        discountPrice: Number(form.discountPrice),
        durationMinutes: Number(form.durationMinutes),
      });
      setPublishedSuccess(true);
      window.setTimeout(() => {
        navigate("/merchant");
      }, 1900);
    } catch (e2) {
      setError(e2.message);
    } finally {
      setBusy(false);
    }
  }

  if (publishedSuccess) {
    return (
      <PageTransition className="app-main" style={{ maxWidth: 580, margin: "60px auto", textAlign: "center" }}>
        <div
          className="card"
          style={{
            padding: "48px 24px",
            border: "1.5px solid rgba(34, 197, 94, 0.4)",
            borderRadius: 24,
            background: "rgba(24, 36, 33, 0.96)",
            boxShadow: "0 16px 40px rgba(0, 0, 0, 0.5)",
          }}
        >
          <SuccessAnimation
            type="food_listed"
            title="Food Published ✓"
            subtitle="Your food is now visible to nearby customers."
          />
          <p style={{ marginTop: 14, fontSize: 13, color: "#86efac" }}>
            Updating live surplus food radar...
          </p>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="app-main">
      <div className="section-head" style={{ marginTop: 0 }}>
        <h2>Post surplus stock</h2>
      </div>

      <form
        className="card"
        style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}
        onSubmit={handleSubmit}
      >
        {/* Food Item Drop Arrow Select Menu */}
        <div className="field" style={{ background: "rgba(245, 158, 11, 0.08)", padding: 16, borderRadius: 12, border: "1.5px solid rgba(245, 158, 11, 0.3)" }}>
          <label htmlFor="foodSelectDropdown" style={{ fontWeight: 700, color: "var(--amber, #FF9F68)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>▼ Select Food Item (Dropdown Menu)</span>
            <span className="badge badge-amber" style={{ fontSize: 11, padding: "2px 8px" }}>
              {ALL_FOOD_ITEMS.length} Dishes
            </span>
          </label>
          <select
            id="foodSelectDropdown"
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 8,
              border: "1.5px solid var(--amber, #FF9F68)",
              fontSize: 15,
              fontWeight: 600,
              background: "var(--card-bg, #18181b)",
              color: "var(--text-main, #ffffff)",
              marginTop: 8,
              cursor: "pointer",
            }}
            onChange={handleCatalogSelect}
            value={ALL_FOOD_ITEMS.some((i) => i.name === form.itemName) ? form.itemName : ""}
          >
            <option value="">-- Click Drop Arrow to Choose Food Item --</option>
            {FOOD_CATALOG.map((group) => (
              <optgroup key={group.group} label={`── ${group.group} ──`}>
                {group.items.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name} ({item.category} • ₹{item.discountPrice})
                  </option>
                ))}
              </optgroup>
            ))}
            <option value="__custom__">✍️ Custom Food Item (Type Below)</option>
          </select>
          
          {/* Quick Popular Food Chips */}
          <div style={{ marginTop: 12 }}>
            <span style={{ fontSize: 12, color: "#66736F", fontWeight: 700, display: "block", marginBottom: 6 }}>
              Quick Select Dishes:
            </span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["Chicken Biryani", "Masala Dosa", "Flaky Parotta (2 Pcs)", "Chicken Kothu Parotta", "Soft Idli (2 Pcs)", "Degree Filter Coffee"].map((quickName) => {
                const isSelected = form.itemName === quickName;
                return (
                  <button
                    key={quickName}
                    type="button"
                    className={`btn ${isSelected ? "btn-amber" : "btn-outline"}`}
                    style={{ fontSize: 12, padding: "4px 10px", borderRadius: 16 }}
                    onClick={() => {
                      const event = { target: { value: quickName } };
                      handleCatalogSelect(event);
                    }}
                  >
                    {quickName}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Food Name Field */}
        <div className="field">
          <label htmlFor="itemName" style={{ fontWeight: 600 }}>
            Food Name <span style={{ color: "var(--ember)" }}>*</span>
          </label>
          <input
            id="itemName"
            required
            placeholder="e.g. Parotta, Kothu Parotta, Chicken Biryani, Masala Dosa, Filter Coffee"
            value={form.itemName}
            onChange={(e) => update("itemName", e.target.value)}
          />
          <span style={{ fontSize: 12, color: "#66736F", fontWeight: 600, marginTop: 4 }}>
            Dish selected above or typed here will automatically fetch high-res food images.
          </span>
        </div>

        {/* Category & Quantity */}
        <div className="grid-row cols-2">
          <div className="field">
            <label htmlFor="category">Category</label>
            <select
              id="category"
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="quantityTotal">Quantity available</label>
            <input
              id="quantityTotal"
              type="number"
              min={1}
              value={form.quantityTotal}
              onChange={(e) => update("quantityTotal", e.target.value)}
            />
          </div>
        </div>

        {/* Price Fields */}
        <div className="grid-row cols-2">
          <div className="field">
            <label htmlFor="originalPrice">Original price (₹)</label>
            <input
              id="originalPrice"
              type="number"
              min={0}
              step="1"
              value={form.originalPrice}
              onChange={(e) => update("originalPrice", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="discountPrice">Flash sale price (₹)</label>
            <input
              id="discountPrice"
              type="number"
              min={0}
              step="1"
              value={form.discountPrice}
              onChange={(e) => update("discountPrice", e.target.value)}
            />
          </div>
        </div>

        {/* Merchant Food Image Upload Section */}
        <div className="field" style={{ background: "rgba(36, 51, 47, 0.04)", padding: 16, borderRadius: 12, border: "1px solid rgba(203, 213, 225, 0.8)" }}>
          <label style={{ fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between", color: "#24332F" }}>
            <span>📸 Merchant Product Image Upload (Optional)</span>
            {form.imageUrl ? (
              <span className="badge badge-rescue" style={{ fontSize: 12, padding: "2px 8px" }}>
                ✓ Image Attached
              </span>
            ) : (
              <span className="badge badge-amber" style={{ fontSize: 12, padding: "2px 8px" }}>
                No Image (Placeholder Will Show)
              </span>
            )}
          </label>

          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 12 }}>
            {/* File Upload Input */}
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                type="file"
                id="merchant-image-file"
                accept="image/png, image/jpeg, image/webp, image/gif, image/jpg"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (!file.type.startsWith("image/")) {
                    alert("Please select a valid image file (PNG, JPG, WEBP).");
                    return;
                  }
                  if (file.size > 5 * 1024 * 1024) {
                    alert("Image file size should be less than 5MB.");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = (evt) => {
                    update("imageUrl", evt.target.result);
                  };
                  reader.readAsDataURL(file);
                }}
              />
              <button
                type="button"
                className="btn btn-amber"
                style={{ fontSize: 13, padding: "8px 16px" }}
                onClick={() => document.getElementById("merchant-image-file")?.click()}
              >
                📁 Choose Image File
              </button>

              <span style={{ fontSize: 12, color: "#66736F", fontWeight: 600 }}>
                {form.imageUrl ? "Image attached via file/URL" : "PNG, JPG, WEBP up to 5MB"}
              </span>
            </div>

            {/* Custom Image URL Input */}
            <div className="field">
              <label style={{ fontSize: 12, color: "#66736F", fontWeight: 600 }}>Or Enter Image URL:</label>
              <input
                type="url"
                placeholder="https://example.com/my-dish-photo.jpg"
                value={form.imageUrl}
                onChange={(e) => update("imageUrl", e.target.value)}
                style={{ fontSize: 13, padding: "8px 12px" }}
              />
            </div>

            {/* Image Preview Container */}
            {form.imageUrl ? (
              <div style={{ marginTop: 4, position: "relative", width: "100%", height: 180, borderRadius: 10, overflow: "hidden", border: "1.5px solid #69C7A8" }}>
                <img
                  src={form.imageUrl}
                  alt={form.itemName || "Preview"}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={() => {
                    alert("The specified image URL failed to load. Please check the URL or upload a file.");
                  }}
                />
                <button
                  type="button"
                  onClick={() => update("imageUrl", "")}
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    background: "rgba(20, 92, 82, 0.9)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 20,
                    padding: "4px 10px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  ✕ Remove Image
                </button>
              </div>
            ) : (
              <div style={{ padding: "14px 16px", background: "rgba(36, 51, 47, 0.03)", border: "1px dashed #cbd5e1", borderRadius: 8, textAlign: "center" }}>
                <span style={{ fontSize: 24, display: "block", marginBottom: 2 }}>🍱</span>
                <span style={{ fontSize: 12.5, color: "#66736F", fontWeight: 700 }}>No Image Uploaded</span>
                <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "#64748b" }}>
                  A clean "No Image Available" badge will be rendered on the customer side.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Additional Form Fields */}
        <div className="field">
          <label htmlFor="description">Description (optional)</label>
          <textarea
            id="description"
            rows={2}
            placeholder="What's in the bundle, side dishes, etc."
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
          />
        </div>

        <div className="grid-row cols-2">
          <div className="field">
            <label htmlFor="pickupWindowStart">Pickup window start</label>
            <input
              id="pickupWindowStart"
              type="time"
              value={form.pickupWindowStart}
              onChange={(e) => update("pickupWindowStart", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="pickupWindowEnd">Pickup window end</label>
            <input
              id="pickupWindowEnd"
              type="time"
              value={form.pickupWindowEnd}
              onChange={(e) => update("pickupWindowEnd", e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="durationMinutes">Claim window (minutes from now)</label>
          <input
            id="durationMinutes"
            type="number"
            min={1}
            value={form.durationMinutes}
            onChange={(e) => update("durationMinutes", e.target.value)}
          />
          <span style={{ fontSize: 12, color: "#66736F", fontWeight: 600 }}>
            When this hits zero, any unclaimed stock is offered to nearby rescue NGOs automatically.
          </span>
        </div>

        <div className="field">
          <label htmlFor="address">Counter / pickup address</label>
          <input
            id="address"
            placeholder="123 Main St (counter pickup)"
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
          />
        </div>

        {error && <p style={{ color: "var(--ember)", fontSize: 13.5 }}>{error}</p>}

        <button className="btn btn-amber" type="submit" disabled={busy || imageState.searching} style={{ fontSize: 15, fontWeight: 800, padding: 14 }}>
          {busy ? "Publishing Deal..." : "✓ Publish Surplus Deal to Live Feed"}
        </button>
      </form>
    </PageTransition>
  );
}

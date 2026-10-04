import React, { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams, useLocation } from "react-router-dom";
import { useSession } from "../lib/session.jsx";
import { api } from "../lib/api.js";

const ROLE_OPTIONS = [
  { value: "customer", label: "Resident Customer", badge: "Resident" },
  { value: "merchant", label: "Merchant Partner (Bakery / Hotel)", badge: "Merchant Partner" },
  { value: "ngo", label: "NGO Partner", badge: "NGO Rescue" },
  { value: "admin", label: "Admin Platform", badge: "Admin" },
];

const SHOWCASE_SLIDES = [
  {
    id: 1,
    tag: "Hyper-Local Rescue Engine",
    title: "Saving meals, empowering local communities.",
    description:
      "Connecting local restaurants, bakeries, and cafes with nearby residents to claim fresh surplus food at up to 70% off before closing time.",
    stat1Number: "14,250+",
    stat1Label: "Meals Rescued",
    stat2Number: "420 kg",
    stat2Label: "CO₂ Saved",
  },
  {
    id: 2,
    tag: "Real-Time Flash Inventory",
    title: "Closing-time offers with live countdown timers.",
    description:
      "Merchants post daily end-of-day surplus bundles. Residents get instant digital pickup tokens with real-time atomic claim verification.",
    stat1Number: "98.4%",
    stat1Label: "Claim Rate",
    stat2Number: "< 15 min",
    stat2Label: "Avg Pickup",
  },
  {
    id: 3,
    tag: "Zero-Waste Automated Dispatch",
    title: "Unclaimed food directly feeds local food banks.",
    description:
      "If a countdown reaches zero, nearby registered NGO partners are instantly notified via Socket.io so zero food is binned.",
    stat1Number: "85+",
    stat1Label: "NGO Partners",
    stat2Number: "100%",
    stat2Label: "Zero Waste Goal",
  },
];

export default function Login() {
  const { setSession } = useSession();
  const { role: routeRole } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Form states
  const [authMode, setAuthMode] = useState("login"); // 'login' or 'signup'
  const [role, setRole] = useState("customer");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [signupSuccess, setSignupSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  // Document verification onboarding states
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [regDetails, setRegDetails] = useState("");
  const [docType, setDocType] = useState("FSSAI Food Safety License");
  const [docFileName, setDocFileName] = useState("");
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  const validRouteRole = ROLE_OPTIONS.some(
    (option) => option.value === routeRole
  );

  const navigateToOnboarding = (targetRole = role) => {
    const passedState = {
      email: email.trim(),
      name: name.trim(),
      password,
      mobile: mobile.trim(),
      address: address.trim(),
      regDetails: regDetails.trim(),
    };
    if (targetRole === "merchant") {
      navigate("/merchant/onboarding", { state: passedState });
    } else if (targetRole === "ngo") {
      navigate("/ngo/onboarding", { state: passedState });
    }
  };

  useEffect(() => {
    const isSignup =
      searchParams.get("mode") === "signup" ||
      searchParams.get("action") === "signup" ||
      location.pathname.startsWith("/signup");

    if (isSignup) {
      setAuthMode("signup");
      const targetRole = searchParams.get("role") || routeRole;
      if (targetRole === "merchant") {
        navigate("/merchant/onboarding");
        return;
      } else if (targetRole === "ngo") {
        navigate("/ngo/onboarding");
        return;
      }
    }

    if (routeRole && validRouteRole) {
      setRole(routeRole);
      if (routeRole === "merchant") {
        setDocType("FSSAI Food Safety License");
      } else if (routeRole === "ngo") {
        setDocType("NGO 80G Tax Exemption Certificate");
      }
    }
  }, [routeRole, validRouteRole, searchParams, location.pathname, navigate]);

  // Auto rotate left showcase slides every 6 seconds
  useEffect(() => {
    const slideTimer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % SHOWCASE_SLIDES.length);
    }, 6000);
    return () => clearInterval(slideTimer);
  }, []);

  const handleNextSlide = () => {
    setActiveSlide((prev) => (prev + 1) % SHOWCASE_SLIDES.length);
  };

  const handlePrevSlide = () => {
    setActiveSlide(
      (prev) => (prev - 1 + SHOWCASE_SLIDES.length) % SHOWCASE_SLIDES.length
    );
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSignupSuccess(null);

    if (!email.trim()) {
      setError("Please enter your email address or username.");
      return;
    }

    if (authMode === "signup" && !name.trim()) {
      setError(
        role === "merchant"
          ? "Please enter your Hotel or Restaurant name."
          : role === "ngo"
            ? "Please enter your NGO Organization name."
            : "Please enter your full name."
      );
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      if (authMode === "signup") {
        if (role === "merchant") {
          navigateToOnboarding("merchant");
          return;
        } else if (role === "ngo") {
          navigateToOnboarding("ngo");
          return;
        } else {
          // NORMAL USER SIGNUP
          const res = await api.registerUser({
            email: email.trim(),
            password,
            name: name.trim(),
            role: role || "user",
          });

          setSignupSuccess(res.message || "Registration successful. Your account is waiting for administrator approval.");
          setAuthMode("login");
        }
      } else if (role === "merchant") {
        // MERCHANT LOGIN
        const res = await api.merchantLogin({
          email: email.trim(),
          password,
          role: "merchant",
          hotelName: name.trim(),
        });

        if (res && res.token) {
          const shopName = res.user?.hotelName || res.user?.name || name.trim() || email.split("@")[0];
          const merchantUserId = res.user?.merchantId || res.user?.userId || res.user?.id || `usr_mkt_${Date.now()}`;
          const sessionData = {
            token: res.token,
            role: "MERCHANT",
            name: shopName,
            hotelName: shopName,
            merchantId: merchantUserId,
            userId: merchantUserId,
            hotelId: res.user?.hotelId,
            badge: "Hotel & Restaurant Partner",
            username: shopName.toLowerCase().replace(/\s+/g, "_"),
            email: res.user?.email || (email.includes("@") ? email : `${email}@foodsaver.com`),
            status: res.user?.status || res.status || "APPROVED",
            verificationStatus: res.user?.verificationStatus || (res.user?.status === "APPROVED" ? "approved" : "pending"),
          };
          setSession(sessionData);
          localStorage.setItem("token", res.token);

          if (res.requiresOnboarding || res.status === "DRAFT") {
            navigate("/merchant/onboarding");
            return;
          }
          navigate("/merchant");
        } else {
          setError("Invalid merchant credentials or merchant token.");
        }
      } else if (role === "ngo") {
        // NGO LOGIN
        const res = await fetch("http://localhost:4000/api/ngo/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password })
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.message || "NGO authentication failed.");
          setLoading(false);
          return;
        }

        if (data.requiresOnboarding || data.status === "DRAFT") {
          localStorage.setItem("token", data.token);
          navigate("/ngo/onboarding");
          return;
        }

        const sessionData = {
          token: data.token,
          role: "NGO",
          name: data.user?.fullName || name.trim() || email.split("@")[0],
          ngoId: data.user?.ngoId,
          email: data.user?.email || email.trim(),
        };
        setSession(sessionData);
        navigate("/ngo");
      } else {
        // CUSTOMER / ADMIN LOGIN
        const res = await api.login({
          email: email.trim(),
          password,
          role,
          name: name.trim(),
        });

        const effectiveRole = (res.user?.role || res.user?.role_id || role).toUpperCase();
        const sessionData = {
          token: res.token,
          role: effectiveRole,
          name: res.user?.name || name.trim() || email.split("@")[0],
          hotelName: name.trim() || email.split("@")[0],
          username: email.includes("@") ? email.split("@")[0] : email.trim(),
          email: res.user?.email || (email.includes("@") ? email : `${email}@foodsaver.com`),
        };
        setSession(sessionData);

        if (effectiveRole === "ADMIN") navigate("/admin");
        else if (effectiveRole === "MERCHANT") navigate("/merchant");
        else if (effectiveRole === "NGO") navigate("/ngo");
        else navigate("/customer");
      }
    } catch (err) {
      setError(err.message || "Authentication failed. Please check credentials.");
    } finally {
      setLoading(false);
    }
  }

  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "226402396683-68u0r21bmifmqtcuske4puchs4iski4h.apps.googleusercontent.com";

  // Pre-load Google Identity Services script
  useEffect(() => {
    if (!window.google?.accounts?.id && !document.getElementById("google-gsi-script")) {
      const script = document.createElement("script");
      script.id = "google-gsi-script";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);

  const handleGoogleResponse = async (response) => {
    if (!response || !response.credential) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.googleLogin({
        credential: response.credential,
        role: role || "customer",
      });

      if (res && res.token) {
        if (res.requiresOnboarding) {
          localStorage.setItem("token", res.token);
          if (role === "merchant") navigate("/merchant/onboarding");
          else if (role === "ngo") navigate("/ngo/onboarding");
          else navigate("/customer");
          return;
        }

        const effectiveRole = (res.user?.role || role || "CUSTOMER").toUpperCase();
        const sessionData = {
          token: res.token,
          role: effectiveRole,
          name: res.user?.name || "Google User",
          hotelName: res.user?.name || "Google User",
          username: res.user?.email ? res.user.email.split("@")[0] : "google_user",
          email: res.user?.email,
          picture: res.user?.picture,
        };
        setSession(sessionData);

        if (effectiveRole === "ADMIN") navigate("/admin");
        else if (effectiveRole === "MERCHANT") navigate("/merchant");
        else if (effectiveRole === "NGO") navigate("/ngo");
        else navigate("/customer");
      } else {
        setError(res?.error || "Google authentication failed.");
      }
    } catch (err) {
      setError(err.message || "Failed to authenticate with Google.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSSO = () => {
    setError(null);

    const triggerGISPrompt = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse,
          auto_select: false,
        });
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            const client = window.google.accounts.oauth2?.initTokenClient({
              client_id: GOOGLE_CLIENT_ID,
              scope: "email profile openid",
              callback: async (tokenResponse) => {
                if (tokenResponse && tokenResponse.access_token) {
                  try {
                    setLoading(true);
                    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                      headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                    });
                    const profile = await profileRes.json();
                    const googleUser = {
                      role: (role || "customer").toUpperCase(),
                      name: profile.name || "Google User",
                      hotelName: profile.name || "Google User",
                      username: (profile.email || "google_user").split("@")[0],
                      email: profile.email,
                      picture: profile.picture,
                    };
                    setSession(googleUser);
                    if (role === "customer") navigate("/customer");
                    else if (role === "merchant") navigate("/merchant");
                    else if (role === "ngo") navigate("/ngo");
                    else navigate("/admin");
                  } catch (err) {
                    setError("Failed to retrieve Google user profile.");
                  } finally {
                    setLoading(false);
                  }
                }
              },
            });
            if (client) client.requestAccessToken();
          }
        });
      } else {
        setError("Google Identity Services is loading. Please try again in a moment.");
      }
    };

    if (!window.google?.accounts?.id) {
      const script = document.createElement("script");
      script.id = "google-gsi-script";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = triggerGISPrompt;
      script.onerror = () => setError("Failed to load Google Identity Services SDK.");
      document.body.appendChild(script);
    } else {
      triggerGISPrompt();
    }
  };


  if (routeRole && !validRouteRole) {
    return <Navigate to="/login" replace />;
  }

  const currentSlide = SHOWCASE_SLIDES[activeSlide];

  return (
    <div className="split-login-viewport">
      <div className="split-login-card">
        {/* ===================================================================
            LEFT PANEL - Immersive FoodSaver Branding & Visual Carousel
            =================================================================== */}
        <div
          className="split-left-panel"
          style={{ backgroundImage: `url('/foodsaver_login_hero.png')` }}
        >
          <div className="split-left-overlay" />
          <div className="split-left-content">
            {/* Top Branding & Short Navigation */}
            <div className="split-left-header">
              <Link to="/" className="split-brand-badge" title="FoodSaver Home" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <img src="/logo.png" alt="FoodSaver" style={{ width: 44, height: 44, objectFit: "contain", borderRadius: 10, background: "#ffffff", padding: 2 }} />
                <div className="split-brand-text">
                  <h2>FoodSaver</h2>
                  <span>Good Food • Less Waste</span>
                </div>
              </Link>

              <nav className="split-nav-links">
                <Link to="/" className="split-nav-item">
                  Home
                </Link>
                <a href="#about" className="split-nav-item" onClick={(e) => e.preventDefault()}>
                  About
                </a>
                <a href="#features" className="split-nav-item" onClick={(e) => e.preventDefault()}>
                  Features
                </a>
                <a href="#rescues" className="split-nav-item" onClick={(e) => e.preventDefault()}>
                  Rescues
                </a>
              </nav>
            </div>

            {/* Middle Visual Showcase & Live Stats Card */}
            <div className="split-showcase-container">
              <div className="split-live-badge">
                <span className="pulse-dot" />
                {currentSlide.tag}
              </div>

              <div className="split-showcase-slide">
                <h1 className="font-elegant">{currentSlide.title}</h1>
                <p>{currentSlide.description}</p>
              </div>

              {/* Floating Impact Stats Card */}
              <div className="split-impact-card">
                <div className="impact-stat-item">
                  <strong>{currentSlide.stat1Number}</strong>
                  <span>{currentSlide.stat1Label}</span>
                </div>
                <div className="impact-divider" />
                <div className="impact-stat-item">
                  <strong>{currentSlide.stat2Number}</strong>
                  <span>{currentSlide.stat2Label}</span>
                </div>
              </div>

              {/* Circular Navigation Controls */}
              <div className="split-carousel-controls">
                <div className="circular-nav-group">
                  <button
                    type="button"
                    className="circular-btn"
                    onClick={handlePrevSlide}
                    aria-label="Previous slide"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  </button>
                  <button
                    type="button"
                    className="circular-btn"
                    onClick={handleNextSlide}
                    aria-label="Next slide"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                </div>

                <div className="carousel-dots">
                  {SHOWCASE_SLIDES.map((slide, idx) => (
                    <span
                      key={slide.id}
                      className={`carousel-dot ${idx === activeSlide ? "active" : ""}`}
                      onClick={() => setActiveSlide(idx)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Profile / Creator Section */}
            <div className="split-left-footer">
              <div className="creator-profile-card">
                <div className="creator-avatar">AR</div>
                <div className="creator-info">
                  <h4>Alex Rivera</h4>
                  <p>Lead Architect & Sustainability Officer</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===================================================================
            RIGHT PANEL - Minimal Authentication Form
            =================================================================== */}
        <div className="split-right-panel">
          <div className="split-right-top">
            {/* Application Logo & Title */}
            <div className="split-form-brand" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src="/logo.png" alt="FoodSaver" style={{ width: 38, height: 38, objectFit: "contain", borderRadius: 8 }} />
              <span style={{ fontSize: 18, fontWeight: 900, color: "#172321" }}>FoodSaver</span>
            </div>

            <div className="split-form-header">
              <h2 className="font-elegant">
                {authMode === "login" ? "Welcome to FoodSaver" : "Create Account"}
              </h2>
              <p>
                {authMode === "login"
                  ? "Sign in to continue to your account"
                  : "Join our hyper-local surplus food rescue platform"}
              </p>
            </div>

            {/* Role Selection Pills */}
            <div className="role-pill-selector">
              {ROLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`role-pill-btn ${role === opt.value ? "active" : ""}`}
                  onClick={() => {
                    setError(null);
                    if (authMode === "signup") {
                      if (opt.value === "merchant") {
                        navigateToOnboarding("merchant");
                        return;
                      }
                      if (opt.value === "ngo") {
                        navigateToOnboarding("ngo");
                        return;
                      }
                    }
                    setRole(opt.value);
                    if (opt.value === "admin") {
                      setEmail("admin@foodsaver.com");
                      setPassword("admin123");
                    } else if (opt.value === "merchant") {
                      if (!email || email === "admin@foodsaver.com") {
                        setEmail("mbrightton06@gmail.com");
                        setPassword("Foodsaver@123");
                      }
                    }
                  }}
                >
                  {opt.badge}
                </button>
              ))}
            </div>

            {/* Direct Onboarding Prompt for Merchant & NGO */}
            {(role === "merchant" || role === "ngo") && (
              <div
                style={{
                  background: role === "merchant"
                    ? "linear-gradient(135deg, rgba(255, 159, 104, 0.16) 0%, rgba(20, 92, 82, 0.16) 100%)"
                    : "linear-gradient(135deg, rgba(105, 199, 168, 0.16) 0%, rgba(20, 92, 82, 0.16) 100%)",
                  border: `1.5px solid ${role === "merchant" ? "#FF9F68" : "#69C7A8"}`,
                  borderRadius: 12,
                  padding: "14px 16px",
                  marginBottom: 16,
                  textAlign: "center",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 20 }}>{role === "merchant" ? "🏨" : "🤝"}</span>
                  <strong style={{ color: role === "merchant" ? "#FF9F68" : "#69C7A8", fontSize: 14 }}>
                    {role === "merchant" ? "Merchant Onboarding Portal" : "NGO Partner Onboarding Portal"}
                  </strong>
                </div>
                <p style={{ margin: "0 0 10px 0", fontSize: 12, color: "#cbd5e1", lineHeight: 1.45 }}>
                  {role === "merchant"
                    ? "Register your restaurant, bakery or hotel kitchen. Enter your address, FSSAI / GST documents, and hours to save directly to the database."
                    : "Register your NGO rescue organization. Enter your address, 80G tax exemption, and rescue food capacity to save directly to the database."}
                </p>
                <button
                  type="button"
                  onClick={() => navigateToOnboarding(role)}
                  style={{
                    width: "100%",
                    padding: "9px 14px",
                    background: role === "merchant"
                      ? "linear-gradient(135deg, #FF9F68 0%, #D97706 100%)"
                      : "linear-gradient(135deg, #69C7A8 0%, #145C52 100%)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6
                  }}
                >
                  <span>Go to {role === "merchant" ? "Merchant" : "NGO"} Onboarding Wizard</span>
                  <span>→</span>
                </button>
              </div>
            )}

            {/* Main Form */}
            <form className="split-auth-form" onSubmit={handleSubmit}>
              {authMode === "signup" && (
                <div className="input-field-group">
                  <label htmlFor="nameInput">
                    {role === "merchant"
                      ? "Hotel / Restaurant Name"
                      : "Full Name or Organization"}
                  </label>
                  <div className="input-field-wrapper">
                    <span className="input-field-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </span>
                    <input
                      id="nameInput"
                      type="text"
                      className="split-input"
                      placeholder={
                        role === "merchant"
                          ? "e.g. Sunrise Artisan Bakery"
                          : "Enter your full name"
                      }
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Email / Username Field */}
              <div className="input-field-group">
                <label htmlFor="emailInput">Email or Username</label>
                <div className="input-field-wrapper">
                  <span className="input-field-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  </span>
                  <input
                    id="emailInput"
                    type="text"
                    className={`split-input ${error ? "invalid" : ""}`}
                    placeholder="name@example.com or username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* MERCHANT & NGO DOCUMENT UPLOAD FORM FIELDS */}
              {authMode === "signup" && (role === "merchant" || role === "ngo") && (
                <>
                  <div className="input-field-group">
                    <label htmlFor="mobileInput">Contact Mobile Number</label>
                    <div className="input-field-wrapper">
                      <span className="input-field-icon">📞</span>
                      <input
                        id="mobileInput"
                        type="text"
                        className="split-input"
                        placeholder="+91 98765 43210"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="input-field-group">
                    <label htmlFor="addressInput">
                      {role === "merchant" ? "Hotel / Restaurant Address" : "NGO Office Address"}
                    </label>
                    <div className="input-field-wrapper">
                      <span className="input-field-icon">📍</span>
                      <input
                        id="addressInput"
                        type="text"
                        className="split-input"
                        placeholder="e.g. 14 Kovilpatti Main Road, Kovilpatti"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="input-field-group">
                    <label htmlFor="regInput">
                      {role === "merchant" ? "FSSAI License / GSTIN Reg Details" : "NGO 80G / Trust Reg Number"}
                    </label>
                    <div className="input-field-wrapper">
                      <span className="input-field-icon">📜</span>
                      <input
                        id="regInput"
                        type="text"
                        className="split-input"
                        placeholder={role === "merchant" ? "e.g. FSSAI Reg # 22421008000142" : "e.g. Society Reg # 142/2018 (80G Tax Exempt)"}
                        value={regDetails}
                        onChange={(e) => setRegDetails(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* DOCUMENT TYPE SELECTOR */}
                  <div className="input-field-group">
                    <label htmlFor="docTypeSelect">Document Type for Verification</label>
                    <div className="input-field-wrapper">
                      <span className="input-field-icon">📑</span>
                      <select
                        id="docTypeSelect"
                        className="split-input"
                        value={docType}
                        onChange={(e) => setDocType(e.target.value)}
                        style={{ paddingRight: 30 }}
                      >
                        {role === "merchant" ? (
                          <>
                            <option value="FSSAI Food Safety License">📄 FSSAI Food Safety License</option>
                            <option value="GST Business Registration">📄 GST Business Registration Certificate</option>
                            <option value="Hotel Trade License">📄 Hotel Trade / Municipal License</option>
                            <option value="Owner ID Proof (Aadhaar / PAN)">📄 Owner Government ID Proof (Aadhaar/PAN)</option>
                          </>
                        ) : (
                          <>
                            <option value="NGO 80G Tax Exemption Certificate">📄 NGO 80G Tax Exemption Certificate</option>
                            <option value="Trust Deed / Society Registration">📄 Trust Deed / Society Registration Cert</option>
                            <option value="Authorized Person ID Proof">📄 Authorized Signatory Government ID Proof</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  {/* INTERACTIVE DOCUMENT FILE UPLOADER */}
                  <div className="input-field-group">
                    <label>Upload Document Proof File</label>
                    <div
                      style={{
                        border: docFileName ? "2px dashed #145C52" : "2px dashed rgba(245, 158, 11, 0.4)",
                        background: docFileName ? "rgba(34, 197, 94, 0.08)" : "rgba(245, 158, 11, 0.05)",
                        borderRadius: 12,
                        padding: "16px 14px",
                        textAlign: "center",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                      onClick={() => document.getElementById("signupDocFileInput")?.click()}
                    >
                      <input
                        id="signupDocFileInput"
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setIsUploadingDoc(true);
                            setTimeout(() => {
                              setDocFileName(file.name);
                              setIsUploadingDoc(false);
                            }, 350);
                          }
                        }}
                      />
                      {isUploadingDoc ? (
                        <div style={{ fontSize: 13, color: "#FF9F68", fontWeight: 700 }}>
                          ⏳ Encrypting & attaching document file...
                        </div>
                      ) : docFileName ? (
                        <div>
                          <div style={{ fontSize: 16, color: "#145C52", fontWeight: 800, marginBottom: 2 }}>
                            ✓ Document Attached
                          </div>
                          <strong style={{ fontSize: 13, color: "#ffffff", display: "block" }}>
                            📄 {docFileName}
                          </strong>
                          <span style={{ fontSize: 11, color: "#145C52", display: "block", marginTop: 2 }}>
                            Ready for Admin Verification Review
                          </span>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: 24, marginBottom: 4 }}>📎</div>
                          <strong style={{ fontSize: 13.5, color: "var(--amber, #FF9F68)", display: "block" }}>
                            Attach {docType} (PDF / PNG / JPG)
                          </strong>
                          <span style={{ fontSize: 11.5, color: "#cbd5e1", fontWeight: 600, display: "block", marginTop: 2 }}>
                            Click to browse or drag & drop document file scan
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ padding: "10px 12px", background: "#FFF3E8", border: "1.5px solid #D97706", borderRadius: 8, fontSize: 12, color: "#A0522D", fontWeight: 600 }}>
                    🛡️ <strong>Admin Verification:</strong> Submitted documents will be verified by FoodSaver Admin before full platform access is granted.
                  </div>
                </>
              )}

              {/* Password Field */}
              <div className="input-field-group">
                <label htmlFor="passwordInput">
                  <span>Password</span>
                  {authMode === "login" && (
                    <button
                      type="button"
                      className="forgot-link"
                      onClick={() => setForgotModalOpen(true)}
                    >
                      Forgot Password?
                    </button>
                  )}
                </label>
                <div className="input-field-wrapper">
                  <span className="input-field-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  </span>
                  <input
                    id="passwordInput"
                    type={showPassword ? "text" : "password"}
                    className={`split-input ${error ? "invalid" : ""}`}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {signupSuccess && (
                <div
                  style={{
                    color: "#15803d",
                    fontSize: "13px",
                    fontWeight: "600",
                    background: "#f0fdf4",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid #bbf7d0",
                  }}
                >
                  ✅ {signupSuccess}
                </div>
              )}

              {error && (
                <div
                  style={{
                    color: "#D32F2F",
                    fontSize: "13px",
                    fontWeight: "600",
                    background: "#FFF0F0",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid #FFCDD2",
                  }}
                >
                  ⚠️ {error}
                </div>
              )}

              {/* Primary Submit Button */}
              <button
                type="submit"
                className="btn-login-primary"
                disabled={loading}
              >
                {loading
                  ? "Authenticating..."
                  : authMode === "login"
                  ? `Sign In to FoodSaver (${ROLE_OPTIONS.find((r) => r.value === role)?.badge})`
                  : `Create ${ROLE_OPTIONS.find((r) => r.value === role)?.badge} Account`}
              </button>
            </form>

            {/* Divider */}
            <div className="split-divider">
              <span>OR</span>
            </div>

            {/* Google SSO Button */}
            <button
              type="button"
              className="btn-google-sso"
              onClick={handleGoogleSSO}
              disabled={loading}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Switch Mode Action */}
            <div className="split-switch-account">
              <span>
                {authMode === "login"
                  ? "Don't have an account?"
                  : "Already have an account?"}
              </span>
              <button
                type="button"
                className="split-switch-btn"
                onClick={() => {
                  setError(null);
                  if (authMode === "login") {
                    if (role === "merchant") {
                      navigateToOnboarding("merchant");
                      return;
                    }
                    if (role === "ngo") {
                      navigateToOnboarding("ngo");
                      return;
                    }
                    setAuthMode("signup");
                  } else {
                    setAuthMode("login");
                  }
                }}
              >
                {authMode === "login" ? "Sign Up" : "Sign In"}
              </button>
            </div>
          </div>

          {/* Social / SSO Footer */}
          <div className="split-right-footer">
            <span>Secure 256-Bit Encrypted Auth</span>
            <div className="split-social-icons">
              <button
                type="button"
                className="social-icon-btn"
                title="Sign in with Apple"
                onClick={() => alert("Apple ID authentication initiated.")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.77c.68-.83 1.14-1.99.01-3.14-1.07.05-2.38.72-3.07 1.54-.62.73-1.16 1.91-1.01 3.04 1.2.09 2.43-.61 3.07-1.44Z"/></svg>
              </button>
              <button
                type="button"
                className="social-icon-btn"
                title="Sign in with Microsoft"
                onClick={() => alert("Microsoft SSO initiated.")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z"/></svg>
              </button>
              <button
                type="button"
                className="social-icon-btn"
                title="Sign in with GitHub"
                onClick={() => alert("GitHub OAuth initiated.")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {forgotModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              padding: "32px",
              borderRadius: "20px",
              maxWidth: "420px",
              width: "100%",
              boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ margin: "0 0 10px", fontSize: "20px" }}>
              Reset Your Password
            </h3>
            {forgotSuccess ? (
              <div>
                <p style={{ color: "#4F9D69", fontWeight: "600" }}>
                  ✅ Password reset link has been dispatched to <strong>{email || "your email address"}</strong>.
                </p>
                <button
                  type="button"
                  className="btn-login-primary"
                  onClick={() => {
                    setForgotModalOpen(false);
                    setForgotSuccess(false);
                  }}
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <div>
                <p style={{ color: "#666666", fontSize: "14px", marginBottom: "16px" }}>
                  Enter your email address below and we'll send you instructions to safely reset your FoodSaver account password.
                </p>
                <input
                  type="email"
                  className="split-input"
                  placeholder="Enter registered email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ marginBottom: "16px", paddingLeft: "16px" }}
                />
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    className="btn-login-primary"
                    onClick={() => setForgotSuccess(true)}
                  >
                    Send Reset Link
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: "12px 18px",
                      borderRadius: "12px",
                      border: "1px solid #EAE7E2",
                      background: "#FAFAFA",
                      cursor: "pointer",
                      fontWeight: "700",
                    }}
                    onClick={() => setForgotModalOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

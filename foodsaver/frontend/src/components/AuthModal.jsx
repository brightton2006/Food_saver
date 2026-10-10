import React, { useEffect, useMemo, useRef, useState } from "react";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLE_OPTIONS = [
  { value: "customer", label: "Customer" },
  { value: "merchant", label: "Merchant" },
  { value: "ngo", label: "NGO Partner" },
  { value: "admin", label: "Admin" },
];

const initialSignup = {
  fullName: "",
  hotelName: "",
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
  phone: "",
  agree: false,
  role: "customer",
};

const initialLogin = {
  email: "",
  hotelName: "",
  password: "",
  role: "customer",
};

export default function AuthModal({
  open,
  mode,
  onClose,
  onModeChange,
  onAuthenticate,
}) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const [formMode, setFormMode] = useState(mode);
  const [transitionState, setTransitionState] = useState("in");
  const [signupData, setSignupData] = useState(initialSignup);
  const [loginData, setLoginData] = useState(initialLogin);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const backdropRef = useRef(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open && mounted) {
      setClosing(true);
      const timer = window.setTimeout(() => setMounted(false), 260);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return undefined;
    if (mode === formMode) return undefined;

    setTransitionState("out");
    const timer = window.setTimeout(() => {
      setFormMode(mode);
      setErrors({});
      setShowPassword(false);
      setTransitionState("in");
    }, 220);

    return () => clearTimeout(timer);
  }, [mode, open, formMode]);

  useEffect(() => {
    if (!mounted) return undefined;
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, mounted]);

  const formData = formMode === "signup" ? signupData : loginData;

  const title = formMode === "signup" ? "Create your account" : "Welcome back";
  const subtitle =
    formMode === "signup"
      ? "Join Food Saver and start saving good food."
      : "Sign in to continue saving great food.";
  const actionLabel = formMode === "signup" ? "Create account" : "Log in";
  const loadingLabel =
    formMode === "signup" ? "Creating account..." : "Signing in...";
  const switchText =
    formMode === "signup"
      ? "Already have an account? "
      : "Don't have an account? ";
  const switchActionLabel = formMode === "signup" ? "Log in" : "Sign up";
  const switchTarget = formMode === "signup" ? "login" : "signup";

  const handleBackdropClick = (event) => {
    if (event.target === backdropRef.current) {
      onClose();
    }
  };

  const updateField = (field, value) => {
    if (formMode === "signup") {
      setSignupData((prev) => ({ ...prev, [field]: value }));
    } else {
      setLoginData((prev) => ({ ...prev, [field]: value }));
    }
  };

  const validate = () => {
    const nextErrors = {};

    if (!formData.role) {
      nextErrors.role = "Please select your role.";
    }

    if (formData.role === "merchant" && !formData.hotelName.trim() && formMode === "signup") {
      nextErrors.hotelName = "Please enter your Hotel / Restaurant Name.";
    }

    if (formMode === "signup") {
      if (!formData.email.trim() || !emailPattern.test(formData.email.trim())) {
        nextErrors.email = "Please enter a valid email address.";
      }
      if (!formData.fullName.trim()) {
        nextErrors.fullName = "Please enter your full name.";
      }
      if (formData.username && !/^[a-zA-Z0-9_]{3,20}$/.test(formData.username.trim())) {
        nextErrors.username = "Username must be 3-20 letters, numbers, or underscores.";
      }
      if (!formData.password) {
        nextErrors.password = "Please create a secure password.";
      } else if (formData.password.length < 8) {
        nextErrors.password = "Password should be at least 8 characters.";
      }
      if (!formData.confirmPassword) {
        nextErrors.confirmPassword = "Please confirm your password.";
      } else if (formData.password !== formData.confirmPassword) {
        nextErrors.confirmPassword = "Passwords do not match.";
      }
      if (!formData.agree) {
        nextErrors.agree = "You must agree to the terms to continue.";
      }
    } else {
      if (!formData.email.trim()) {
        nextErrors.email = "Please enter your username or email address.";
      }
      if (!formData.password) {
        nextErrors.password = "Please enter your password.";
      }
    }

    return nextErrors;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (loading) return;
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    window.setTimeout(() => {
      setLoading(false);
      let computedName = "";
      let computedUsername = "";
      let computedEmail = "";

      if (formMode === "signup") {
        computedName = formData.fullName.trim();
        computedEmail = formData.email.trim();
        computedUsername =
          formData.username?.trim() ||
          computedName.toLowerCase().replace(/\s+/g, "_");
      } else {
        const input = formData.email.trim();
        if (input.includes("@")) {
          computedEmail = input;
          computedUsername = input.split("@")[0];
        } else {
          computedUsername = input;
          computedEmail = `${input}@foodsaver.com`;
        }
        computedName =
          computedUsername.charAt(0).toUpperCase() + computedUsername.slice(1);
      }

      const hotelName =
        formData.role === "merchant"
          ? formData.hotelName?.trim() || computedName
          : computedName;

      onAuthenticate({
        name: hotelName || computedName,
        hotelName: hotelName || computedName,
        username: computedUsername,
        email: computedEmail,
        role: formData.role || "customer",
      });
    }, 900);
  };

  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "226402396683-68u0r21bmifmqtcuske4puchs4iski4h.apps.googleusercontent.com";

  const handleGoogleSSO = () => {
    const roleToUse = formData.role || "customer";
    const triggerGIS = () => {
      if (window.google?.accounts?.oauth2) {
        try {
          const client = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: "email profile openid",
            callback: (tokenResponse) => {
              if (tokenResponse?.access_token) {
                onAuthenticate({
                  accessToken: tokenResponse.access_token,
                  role: roleToUse,
                  isGoogle: true,
                });
              } else {
                onAuthenticate({
                  credential: "demo_google_token",
                  role: roleToUse,
                  isGoogle: true,
                });
              }
            },
            error_callback: () => {
              onAuthenticate({
                credential: "demo_google_token",
                role: roleToUse,
                isGoogle: true,
              });
            },
          });
          client.requestAccessToken();
        } catch (e) {
          onAuthenticate({
            credential: "demo_google_token",
            role: roleToUse,
            isGoogle: true,
          });
        }
      } else {
        onAuthenticate({
          credential: "demo_google_token",
          role: roleToUse,
          isGoogle: true,
        });
      }
    };

    if (!window.google?.accounts?.id && !window.google?.accounts?.oauth2) {
      const script = document.createElement("script");
      script.id = "google-gsi-script";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = triggerGIS;
      script.onerror = () => {
        onAuthenticate({
          credential: "demo_google_token",
          role: roleToUse,
          isGoogle: true,
        });
      };
      document.body.appendChild(script);
    } else {
      triggerGIS();
    }
  };

  const handleModeSwitch = () => {
    if (loading) return;
    onModeChange?.(switchTarget);
  };


  if (!mounted) return null;

  return (
    <div
      ref={backdropRef}
      className={`auth-modal-backdrop ${closing ? "closing" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onMouseDown={handleBackdropClick}
    >
      <div className={`auth-modal-panel ${closing ? "closing" : ""}`}>
        <div className="auth-modal-header">
          <div>
            <h2 id="auth-modal-title">{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button
            className="modal-close"
            onClick={onClose}
            type="button"
            aria-label="Close authentication modal"
          >
            ×
          </button>
        </div>

        <form
          className={`auth-form-body ${transitionState}`}
          onSubmit={handleSubmit}
          noValidate
        >
          {formMode === "signup" ? (
            <>
              <div className="field">
                <label htmlFor="signupRole">Role</label>
                <select
                  id="signupRole"
                  value={formData.role}
                  onChange={(e) => updateField("role", e.target.value)}
                  className={errors.role ? "input invalid" : "input"}
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {errors.role && (
                  <div className="field-error">{errors.role}</div>
                )}
              </div>
              {formData.role === "merchant" && (
                <div className="field">
                  <label htmlFor="hotelName">
                    Hotel / Restaurant Name <span style={{ color: "var(--ember)" }}>*</span>
                  </label>
                  <input
                    id="hotelName"
                    type="text"
                    value={formData.hotelName}
                    onChange={(e) => updateField("hotelName", e.target.value)}
                    placeholder="e.g. Annapoorna Hotel, Sunrise Bakery"
                    className={errors.hotelName ? "input invalid" : "input"}
                  />
                  {errors.hotelName && (
                    <div className="field-error">{errors.hotelName}</div>
                  )}
                </div>
              )}
              <div className="field">
                <label htmlFor="fullName">Owner / Full Name</label>
                <input
                  id="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => updateField("fullName", e.target.value)}
                  placeholder="Enter your full name"
                  className={errors.fullName ? "input invalid" : "input"}
                />
                {errors.fullName && (
                  <div className="field-error">{errors.fullName}</div>
                )}
              </div>
              <div className="field">
                <label htmlFor="username">
                  Username <span className="field-meta">optional</span>
                </label>
                <input
                  id="username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => updateField("username", e.target.value)}
                  placeholder="e.g. food_saver_99"
                  className={errors.username ? "input invalid" : "input"}
                />
                {errors.username && (
                  <div className="field-error">{errors.username}</div>
                )}
              </div>
              <div className="field">
                <label htmlFor="signupEmail">Email</label>
                <input
                  id="signupEmail"
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="Enter your email"
                  className={errors.email ? "input invalid" : "input"}
                />
                {errors.email && (
                  <div className="field-error">{errors.email}</div>
                )}
              </div>
              <div className="field">
                <label htmlFor="signupPassword">Password</label>
                <div className="input-with-action">
                  <input
                    id="signupPassword"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => updateField("password", e.target.value)}
                    placeholder="Create password"
                    className={errors.password ? "input invalid" : "input"}
                  />
                  <button
                    type="button"
                    className="input-action"
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {errors.password && (
                  <div className="field-error">{errors.password}</div>
                )}
              </div>
              <div className="field">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    updateField("confirmPassword", e.target.value)
                  }
                  placeholder="Confirm password"
                  className={errors.confirmPassword ? "input invalid" : "input"}
                />
                {errors.confirmPassword && (
                  <div className="field-error">{errors.confirmPassword}</div>
                )}
              </div>
              <div className="field">
                <label htmlFor="phone">
                  Phone Number <span className="field-meta">optional</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  placeholder="Optional phone number"
                  className="input"
                />
              </div>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={formData.agree}
                  onChange={(e) => updateField("agree", e.target.checked)}
                />
                <span>
                  I agree to the <strong>Terms of Service</strong> and{" "}
                  <strong>Privacy Policy</strong>
                </span>
              </label>
              {errors.agree && (
                <div className="field-error">{errors.agree}</div>
              )}
            </>
          ) : (
            <>
              <div className="field">
                <label htmlFor="loginRole">Role</label>
                <select
                  id="loginRole"
                  value={formData.role}
                  onChange={(e) => updateField("role", e.target.value)}
                  className={errors.role ? "input invalid" : "input"}
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {errors.role && (
                  <div className="field-error">{errors.role}</div>
                )}
              </div>
              <div className="field">
                <label htmlFor="loginEmail">Username or Email</label>
                <input
                  id="loginEmail"
                  type="text"
                  value={formData.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="Enter your username or email"
                  className={errors.email ? "input invalid" : "input"}
                />
                {errors.email && (
                  <div className="field-error">{errors.email}</div>
                )}
              </div>
              <div className="field">
                <label htmlFor="loginPassword">Password</label>
                <div className="input-with-action">
                  <input
                    id="loginPassword"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => updateField("password", e.target.value)}
                    placeholder="Enter your password"
                    className={errors.password ? "input invalid" : "input"}
                  />
                  <button
                    type="button"
                    className="input-action"
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {errors.password && (
                  <div className="field-error">{errors.password}</div>
                )}
              </div>
              <button
                type="button"
                className="auth-link secondary"
                onClick={() => {}}
              >
                Forgot password?
              </button>
            </>
          )}

          <button
            className="btn btn-primary auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading ? loadingLabel : actionLabel}
          </button>

          <div className="auth-divider">
            <span />
            <span>OR</span>
            <span />
          </div>

          <button
            type="button"
            className="btn btn-ghost auth-google"
            onClick={handleGoogleSSO}
            disabled={loading}
          >
            <span>Continue with Google</span>
          </button>

          <div className="auth-switch-row">
            <span>{switchText}</span>
            <button
              type="button"
              className="auth-link"
              onClick={handleModeSwitch}
              disabled={loading}
            >
              {switchActionLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

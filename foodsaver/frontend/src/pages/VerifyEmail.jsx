import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useSession } from "../lib/session.jsx";
import { api } from "../lib/api.js";

/**
 * Mask an email address for privacy (e.g., "j***n@domain.com")
 */
function maskEmail(email) {
  if (!email || typeof email !== "string") return "*****@*****";
  const trimmed = email.trim();
  if (!trimmed.includes("@")) {
    return trimmed.length > 3 ? `${trimmed.slice(0, 2)}***` : "*****";
  }
  const [local, domain] = trimmed.split("@");
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export default function VerifyEmail() {
  const { setSession } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Retrieve email and userId from URL search params, navigation state, or sessionStorage
  const paramEmail = searchParams.get("email") || location.state?.email || sessionStorage.getItem("foodsaver_pending_verify_email") || "";
  const paramUserId = searchParams.get("userId") || location.state?.userId || sessionStorage.getItem("foodsaver_pending_verify_userid") || "";
  const initialDevOtp = location.state?.devOtp || searchParams.get("devOtp") || null;
  const initialPreviewUrl = location.state?.previewUrl || null;

  const [email, setEmail] = useState(paramEmail);
  const [userId, setUserId] = useState(paramUserId);
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [cooldown, setCooldown] = useState(60);
  const [devOtp, setDevOtp] = useState(initialDevOtp);
  const [previewUrl, setPreviewUrl] = useState(initialPreviewUrl);

  const inputRefs = [
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
  ];

  // Save email to sessionStorage so page refreshes don't lose context
  useEffect(() => {
    if (email) {
      sessionStorage.setItem("foodsaver_pending_verify_email", email);
    }
    if (userId) {
      sessionStorage.setItem("foodsaver_pending_verify_userid", userId);
    }
  }, [email, userId]);

  // Focus first input on mount
  useEffect(() => {
    setTimeout(() => {
      inputRefs[0].current?.focus();
    }, 150);
  }, []);

  // 60-second Resend Cooldown Countdown Timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const verifyOtpCode = async (codeToVerify) => {
    const otpToUse = codeToVerify || digits.join("");
    if (otpToUse.length !== 6 || !/^\d{6}$/.test(otpToUse)) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    if (!email) {
      setError("No email address provided. Please return to the registration or login page.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await api.verifyEmailOtp({
        email: email.trim(),
        otp: otpToUse,
        userId: userId || null,
      });

      if (res && (res.ok || res.success)) {
        setSuccessMsg("✓ Email verified successfully! Redirecting...");
        sessionStorage.removeItem("foodsaver_pending_verify_email");
        sessionStorage.removeItem("foodsaver_pending_verify_userid");

        setTimeout(() => {
          if (res.token) {
            const effRole = (res.user?.role || location.state?.role || "CUSTOMER").toUpperCase();
            const sessionData = {
              token: res.token,
              role: effRole,
              name: res.user?.name || res.user?.full_name || email.split("@")[0],
              email: res.user?.email || email.trim(),
              emailVerified: true,
            };
            setSession(sessionData);
            localStorage.setItem("token", res.token);

            if (effRole === "ADMIN") navigate("/admin");
            else if (effRole === "MERCHANT") navigate("/merchant");
            else if (effRole === "NGO") navigate("/ngo");
            else navigate("/customer");
          } else {
            navigate("/login?verified=true");
          }
        }, 1200);
      } else {
        setError(res.error || "Verification failed. Please try again.");
      }
    } catch (err) {
      setError(err.message || err.data?.error || "Invalid or expired OTP code.");
    } finally {
      setLoading(false);
    }
  };

  const handleDigitChange = (index, rawValue) => {
    const clean = rawValue.replace(/\D/g, "");
    if (!clean && rawValue !== "") {
      const newDigits = [...digits];
      newDigits[index] = "";
      setDigits(newDigits);
      return;
    }

    // Handle paste or multi-digit input
    if (clean.length > 1) {
      const pastedDigits = clean.slice(0, 6).split("");
      const newDigits = ["", "", "", "", "", ""];
      pastedDigits.forEach((d, i) => {
        if (i < 6) newDigits[i] = d;
      });
      setDigits(newDigits);
      setError(null);
      const nextIndex = Math.min(pastedDigits.length, 5);
      inputRefs[nextIndex].current?.focus();
      if (pastedDigits.length === 6) {
        verifyOtpCode(pastedDigits.join(""));
      }
      return;
    }

    const singleDigit = clean.slice(-1);
    const newDigits = [...digits];
    newDigits[index] = singleDigit;
    setDigits(newDigits);
    setError(null);

    // Auto-advance to next input field
    if (singleDigit && index < 5) {
      inputRefs[index + 1].current?.focus();
    }

    // Auto-verify when 6th digit is typed
    const currentOtp = newDigits.join("");
    if (currentOtp.length === 6) {
      verifyOtpCode(currentOtp);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        inputRefs[index - 1].current?.focus();
      } else {
        const newDigits = [...digits];
        newDigits[index] = "";
        setDigits(newDigits);
        setError(null);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs[index - 1].current?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pastedData) {
      const newDigits = ["", "", "", "", "", ""];
      pastedData.split("").forEach((char, i) => {
        if (i < 6) newDigits[i] = char;
      });
      setDigits(newDigits);
      setError(null);
      const targetIndex = Math.min(pastedData.length, 5);
      inputRefs[targetIndex].current?.focus();
      if (pastedData.length === 6) {
        verifyOtpCode(pastedData);
      }
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending || !email) return;

    setResending(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await api.resendEmailOtp({
        email: email.trim(),
        userId: userId || null,
      });

      if (res && res.success !== false) {
        if (res.devOtp || res._debugOtp) setDevOtp(res.devOtp || res._debugOtp);
        if (res.previewUrl) setPreviewUrl(res.previewUrl);
        setSuccessMsg(`✓ A fresh 6-digit verification code has been sent to ${maskEmail(email)}.`);
        setCooldown(res.cooldownSeconds || 60);
        setDigits(["", "", "", "", "", ""]);
        inputRefs[0].current?.focus();
      } else {
        setError(res.error || "Failed to resend verification code.");
      }
    } catch (err) {
      setError(err.message || err.data?.error || "Failed to resend verification code.");
    } finally {
      setResending(false);
    }
  };

  const fullOtp = digits.join("");

  return (
    <div style={{
      minHeight: "85vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 16px",
      background: "var(--color-background, #F7F9F8)"
    }}>
      <div style={{
        maxWidth: "460px",
        width: "100%",
        backgroundColor: "#FFFFFF",
        borderRadius: "20px",
        padding: "36px 30px",
        boxShadow: "0 10px 40px rgba(20, 92, 82, 0.08)",
        border: "1px solid #DCE6E3",
        textAlign: "center"
      }}>
        {/* Brand Icon & Heading */}
        <div style={{
          width: "64px",
          height: "64px",
          borderRadius: "50%",
          backgroundColor: "#E8F4F1",
          color: "#145C52",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "28px",
          margin: "0 auto 16px"
        }}>
          ✉️
        </div>

        <h1 style={{
          fontSize: "22px",
          fontWeight: "800",
          color: "#102A2A",
          margin: "0 0 8px",
          letterSpacing: "-0.5px"
        }}>
          Verify Your Email Address
        </h1>

        <p style={{
          fontSize: "14px",
          color: "#687674",
          margin: "0 0 24px",
          lineHeight: "1.5"
        }}>
          We sent a 6-digit verification code to
          <br />
          <strong style={{ color: "#145C52", fontFamily: "monospace", fontSize: "15px" }}>
            {email ? maskEmail(email) : "your email address"}
          </strong>
        </p>

        {/* Development Helper Preview */}
        {devOtp && (
          <div style={{
            padding: "10px 14px",
            fontSize: "12px",
            fontWeight: "600",
            backgroundColor: "#E8F4F1",
            color: "#145C52",
            border: "1px dashed #145C52",
            borderRadius: "10px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <span>🔑 Demo OTP: <strong style={{ fontFamily: "monospace", fontSize: "14px" }}>{devOtp}</strong></span>
            <button
              type="button"
              onClick={() => {
                const arr = String(devOtp).split("");
                setDigits(arr);
                verifyOtpCode(devOtp);
              }}
              style={{
                background: "#145C52",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "6px",
                padding: "4px 8px",
                fontSize: "11px",
                cursor: "pointer",
                fontWeight: "700"
              }}
            >
              Auto Fill
            </button>
          </div>
        )}

        {previewUrl && (
          <div style={{
            padding: "8px 12px",
            fontSize: "12px",
            backgroundColor: "#F3F9F7",
            color: "#145C52",
            borderRadius: "8px",
            marginBottom: "16px"
          }}>
            📩 <a href={previewUrl} target="_blank" rel="noreferrer" style={{ color: "#145C52", fontWeight: "700", textDecoration: "underline" }}>
              View rendered email preview in test inbox ↗
            </a>
          </div>
        )}

        {/* 6-Digit OTP Inputs */}
        <form onSubmit={(e) => { e.preventDefault(); verifyOtpCode(fullOtp); }}>
          <div
            onPaste={handlePaste}
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "8px",
              margin: "20px 0"
            }}
          >
            {digits.map((digit, idx) => (
              <input
                key={idx}
                ref={inputRefs[idx]}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                style={{
                  width: "48px",
                  height: "56px",
                  fontSize: "24px",
                  fontWeight: "800",
                  fontFamily: "monospace",
                  textAlign: "center",
                  borderRadius: "12px",
                  border: digit ? "2px solid #145C52" : "1.5px solid #DCE6E3",
                  backgroundColor: digit ? "#F3F9F7" : "#FFFFFF",
                  color: "#145C52",
                  outline: "none",
                  transition: "all 0.2s ease"
                }}
              />
            ))}
          </div>

          {/* Expiration Note */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "12px",
            color: "#8A9693",
            marginBottom: "16px",
            padding: "0 4px"
          }}>
            <span style={{ color: "#C2410C", fontWeight: "600" }}>⏱️ Valid for 5 minutes</span>
            <span>Max 5 attempts</span>
          </div>

          {/* Error & Success Messages */}
          {error && (
            <div style={{
              padding: "10px 14px",
              backgroundColor: "#FFF5F5",
              color: "#C53030",
              border: "1px solid #FEB2B2",
              borderRadius: "10px",
              fontSize: "13px",
              fontWeight: "600",
              marginBottom: "16px",
              textAlign: "left"
            }}>
              ⚠️ {error}
            </div>
          )}

          {successMsg && (
            <div style={{
              padding: "10px 14px",
              backgroundColor: "#E8F4F1",
              color: "#145C52",
              border: "1px solid #145C52",
              borderRadius: "10px",
              fontSize: "13px",
              fontWeight: "600",
              marginBottom: "16px"
            }}>
              {successMsg}
            </div>
          )}

          {/* Verify Button */}
          <button
            type="submit"
            disabled={loading || fullOtp.length !== 6}
            style={{
              width: "100%",
              padding: "14px",
              backgroundColor: fullOtp.length === 6 && !loading ? "#145C52" : "#9CA3AF",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "12px",
              fontSize: "15px",
              fontWeight: "700",
              cursor: fullOtp.length === 6 && !loading ? "pointer" : "not-allowed",
              boxShadow: fullOtp.length === 6 && !loading ? "0 4px 14px rgba(20, 92, 82, 0.3)" : "none",
              transition: "all 0.2s ease",
              marginBottom: "16px"
            }}
          >
            {loading ? "Verifying OTP..." : "Verify Email"}
          </button>

          {/* Resend OTP */}
          <div style={{ fontSize: "13px", color: "#687674" }}>
            <span>Didn't receive the code? </span>
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || resending}
              style={{
                background: "none",
                border: "none",
                color: cooldown > 0 || resending ? "#9CA3AF" : "#145C52",
                fontWeight: "700",
                cursor: cooldown > 0 || resending ? "not-allowed" : "pointer",
                textDecoration: cooldown > 0 ? "none" : "underline"
              }}
            >
              {resending
                ? "Sending..."
                : cooldown > 0
                ? `Resend in ${cooldown}s`
                : "Resend Code"}
            </button>
          </div>
        </form>

        {/* Back Link */}
        <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #EAE7E2", fontSize: "13px" }}>
          <Link to="/login" style={{ color: "#687674", textDecoration: "none" }}>
            ← Back to Login / Change Email
          </Link>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from "react";
import { api } from "../lib/api.js";

/**
 * Helper to mask email address for privacy
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

export default function EmailOtpModal({
  isOpen,
  email,
  userId = null,
  onSuccess,
  onClose,
  title = "Verify Your Email Address",
}) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [cooldown, setCooldown] = useState(60);

  const inputRefs = [
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
  ];

  // Reset modal state when opened
  useEffect(() => {
    if (isOpen) {
      setDigits(["", "", "", "", "", ""]);
      setError(null);
      setSuccessMsg(null);
      setCooldown(60);
      setTimeout(() => inputRefs[0].current?.focus(), 150);
    }
  }, [isOpen, email]);

  // 60-second Countdown Timer
  useEffect(() => {
    if (!isOpen || cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, cooldown]);

  if (!isOpen) return null;

  const verifyOtpCode = async (codeToVerify) => {
    const otpToUse = codeToVerify || digits.join("");
    if (otpToUse.length !== 6 || !/^\d{6}$/.test(otpToUse)) {
      setError("Please enter the complete 6-digit OTP code.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await api.verifyEmailOtp({
        email: email || "",
        otp: otpToUse,
        userId: userId || null,
      });

      if (res && (res.ok || res.success)) {
        setSuccessMsg("✓ Email verified successfully!");
        setTimeout(() => {
          if (onSuccess) onSuccess(res);
          if (onClose) onClose();
        }, 800);
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

    // Handle paste or multi-digit entry
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

    // Auto-verify when 6th digit is entered
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

  const fullOtp = digits.join("");

  const handleVerifySubmit = (e) => {
    if (e) e.preventDefault();
    verifyOtpCode(fullOtp);
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;

    setResending(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await api.resendEmailOtp({
        email: email || "",
        userId: userId || null,
      });

      if (res && res.success !== false) {
        setSuccessMsg(`✓ A new 6-digit code has been sent to ${maskEmail(email)}.`);
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

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md p-6 overflow-hidden text-white bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-2xl shadow-emerald-950/50">
        {/* Decorative Top Accent Gradient */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />

        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            type="button"
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors text-xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-800"
          >
            ✕
          </button>
        )}

        {/* Header Badge & Title */}
        <div className="text-center mb-6 pt-2">
          <div className="inline-flex items-center justify-center w-14 h-14 mb-3 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-2xl shadow-inner">
            ✉️
          </div>
          <h3 className="text-xl font-extrabold text-white tracking-tight">
            {title}
          </h3>
          <p className="mt-1.5 text-xs text-slate-300">
            Enter the 6-digit security code sent to{" "}
            <span className="font-semibold text-emerald-400 font-mono">
              {maskEmail(email)}
            </span>
          </p>
        </div>

        {/* Form Container */}
        <form onSubmit={handleVerifySubmit} className="space-y-5">
          {/* 6 Digit Input Boxes */}
          <div className="flex justify-center gap-2.5 my-4" onPaste={handlePaste}>
            {digits.map((digit, idx) => (
              <input
                key={idx}
                ref={inputRefs[idx]}
                type="text"
                inputMode="numeric"
                value={digit}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                className={`w-11 h-13 text-center text-2xl font-black font-mono rounded-xl border transition-all duration-200 outline-none ${
                  digit
                    ? "border-emerald-500 bg-emerald-950/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                    : "border-slate-700 bg-slate-800/80 text-white hover:border-slate-500 focus:border-emerald-400 focus:bg-slate-800"
                }`}
              />
            ))}
          </div>

          {/* Expiration Note */}
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span className="flex items-center gap-1 text-amber-400 font-medium">
              ⏱️ Expires in 5 minutes
            </span>
            <span className="text-slate-400">
              Never share your OTP
            </span>
          </div>

          {/* Feedback Banners */}
          {error && (
            <div className="p-3 text-xs font-semibold text-red-300 bg-red-950/60 border border-red-500/40 rounded-xl animate-shake">
              ⚠️ {error}
            </div>
          )}

          {successMsg && (
            <div className="p-3 text-xs font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-500/40 rounded-xl">
              {successMsg}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <button
              type="submit"
              disabled={loading || fullOtp.length !== 6}
              className={`w-full py-3 px-4 font-bold text-sm text-slate-900 rounded-xl transition-all duration-200 shadow-lg ${
                fullOtp.length === 6 && !loading
                  ? "bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 active:scale-[0.99] cursor-pointer shadow-emerald-500/25"
                  : "bg-slate-700 text-slate-400 cursor-not-allowed"
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Verifying OTP...
                </span>
              ) : (
                "Verify Email"
              )}
            </button>

            {/* Resend OTP button */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={handleResend}
                disabled={cooldown > 0 || resending}
                className={`text-xs font-semibold transition-colors ${
                  cooldown > 0 || resending
                    ? "text-slate-500 cursor-not-allowed"
                    : "text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                }`}
              >
                {resending
                  ? "Sending new code..."
                  : cooldown > 0
                  ? `Resend OTP Code in ${cooldown}s`
                  : "Didn't receive code? Resend OTP"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}


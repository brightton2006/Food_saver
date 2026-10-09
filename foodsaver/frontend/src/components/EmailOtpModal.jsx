import React, { useState, useEffect, useRef } from "react";
import { api } from "../lib/api.js";

/**
 * Helper to mask email address for privacy
 */
function maskEmail(email) {
  if (!email || !email.includes("@")) return "*****@*****";
  const [local, domain] = email.split("@");
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

  const handleDigitChange = (index, value) => {
    // Only accept numeric input
    if (value && !/^\d+$/.test(value)) return;

    // Handle paste of 6-digit code
    if (value.length > 1) {
      const pastedDigits = value.slice(0, 6).split("");
      const newDigits = [...digits];
      pastedDigits.forEach((d, i) => {
        if (i < 6) newDigits[i] = d;
      });
      setDigits(newDigits);
      const nextIndex = Math.min(pastedDigits.length, 5);
      inputRefs[nextIndex].current?.focus();
      return;
    }

    const newDigits = [...digits];
    newDigits[index] = value;
    setDigits(newDigits);
    setError(null);

    // Auto-advance to next input field
    if (value && index < 5) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    if (/^\d{6}$/.test(pastedData)) {
      const newDigits = pastedData.split("");
      setDigits(newDigits);
      setError(null);
      inputRefs[5].current?.focus();
    }
  };

  const fullOtp = digits.join("");

  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    if (fullOtp.length !== 6) {
      setError("Please enter the complete 6-digit OTP code.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await api.verifyEmailOtp({
        email,
        otp: fullOtp,
        userId,
      });

      if (res && (res.ok || res.success)) {
        setSuccessMsg("✓ Email verified successfully!");
        setTimeout(() => {
          if (onSuccess) onSuccess(res);
          if (onClose) onClose();
        }, 1000);
      } else {
        setError(res.error || "Verification failed. Please try again.");
      }
    } catch (err) {
      setError(err.message || "Invalid or expired OTP code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;

    setResending(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await api.resendEmailOtp({
        email,
        userId,
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
      setError(err.message || "Failed to resend verification code.");
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
        <form onSubmit={handleVerify} className="space-y-5">
          {/* 6 Digit Input Boxes */}
          <div className="flex justify-center gap-2.5 my-4" onPaste={handlePaste}>
            {digits.map((digit, idx) => (
              <input
                key={idx}
                ref={inputRefs[idx]}
                type="text"
                inputMode="numeric"
                maxLength={1}
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

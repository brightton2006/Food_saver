import React, { useState } from "react";
import { Lock, CheckCircle, AlertTriangle, Key } from "lucide-react";
import { api } from "../lib/api";

export default function ForcePasswordResetModal({ isOpen, user, onPasswordChanged }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!newPassword || newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await api.changePassword({
        userId: user?.id || user?.user_id,
        email: user?.email,
        newPassword,
      });

      setSuccess(true);
      setTimeout(() => {
        if (onPasswordChanged) onPasswordChanged();
      }, 1200);
    } catch (err) {
      setError(err.message || "Failed to update password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-amber-500/30 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Key className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Security Update Required</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            For security reasons, demo accounts are required to change their password on first login. Please choose a new secure password.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 text-sm bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-500/20">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 text-sm bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>Password updated successfully! Redirecting...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-2.5 pl-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-2.5 pl-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-emerald-600 text-white font-semibold text-sm rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
          >
            {loading ? "Updating Password..." : "Set New Password & Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

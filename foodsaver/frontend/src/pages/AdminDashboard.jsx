import React, { useState, useEffect } from "react";
import { useSession } from "../lib/session.jsx";
import { api } from "../lib/api.js";
import { useTranslation } from "../lib/i18n.jsx";
import RecentlyAccessed from "../components/RecentlyAccessed.jsx";
import RescueIntelligenceWidget from "../components/RescueIntelligenceWidget.jsx";
import {
  Users,
  Store,
  Heart,
  Package,
  FileCheck,
  Settings,
  Activity,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  ShoppingBag,
  TrendingUp,
  Leaf
} from "lucide-react";

export default function AdminDashboard() {
  const { session } = useSession();
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState("overview"); // "overview" | "merchants" | "ngos" | "users" | "orders" | "listings" | "audit" | "intelligence" | "settings"
  
  // Dashboard Metrics State
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // User Management States
  const [users, setUsers] = useState([]);
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [userStatusFilter, setUserStatusFilter] = useState("all");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [confirmModal, setConfirmModal] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Verification & Merchant States
  const [merchants, setMerchants] = useState([]);
  const [merchantStatusFilter, setMerchantStatusFilter] = useState("all");
  const [inspectMerchantModal, setInspectMerchantModal] = useState(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [ngos, setNgos] = useState([]);
  const [ngoStatusFilter, setNgoStatusFilter] = useState("all");

  // Live Orders & Listings Monitoring
  const [orders, setOrders] = useState([]);
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [listings, setListings] = useState([]);
  const [listingStatusFilter, setListingStatusFilter] = useState("all");

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditActionFilter, setAuditActionFilter] = useState("all");

  // System Settings
  const [systemSettings, setSystemSettings] = useState({
    nearby_food_radius_km: "2.0",
    ngo_donation_radius_km: "5.0",
    tracking_interval_sec: "5",
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionSuccess, setActionSuccess] = useState("");
  const [rejectModal, setRejectModal] = useState(null); // { type: 'merchant'|'ngo'|'user', id: string, name: string }
  const [rejectionReason, setRejectionReason] = useState("");

  const isAdmin = (session?.role || "").toUpperCase() === "ADMIN";

  useEffect(() => {
    if (!isAdmin) return;
    loadDashboardStats();
    recordAdminActivity();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;

    if (activeSection === "overview") {
      loadDashboardStats();
    } else if (activeSection === "merchants") {
      loadMerchants();
    } else if (activeSection === "ngos") {
      loadNgos();
    } else if (activeSection === "users") {
      loadUsers();
    } else if (activeSection === "orders") {
      loadOrders();
    } else if (activeSection === "listings") {
      loadListings();
    } else if (activeSection === "audit") {
      loadAuditLogs();
    } else if (activeSection === "settings") {
      loadSettings();
    }
  }, [activeSection, userRoleFilter, userStatusFilter, merchantStatusFilter, ngoStatusFilter, orderStatusFilter, listingStatusFilter, auditActionFilter, isAdmin]);

  async function recordAdminActivity() {
    try {
      await api.addRecentlyAccessed({
        entityType: "admin_tool",
        entityId: "admin_dashboard",
        title: "Admin Portal",
        subtitle: "System Dashboard & Verification Center",
        url: "/admin",
      });
    } catch {}
  }

  async function loadDashboardStats() {
    try {
      setStatsLoading(true);
      const res = await api.getAdminDashboardStats();
      if (res && res.stats) {
        setStats(res.stats);
      }
    } catch (err) {
      console.error("Failed loading stats", err);
    } finally {
      setStatsLoading(false);
    }
  }

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await api.getAdminUsers(userRoleFilter, userStatusFilter, userSearchQuery);
      if (res && res.users) {
        setUsers(res.users);
      }
    } catch (err) {
      console.error("Failed loading admin users", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadMerchants() {
    setLoading(true);
    try {
      const res = await api.getAdminMerchants(merchantStatusFilter);
      if (res && res.merchants) {
        setMerchants(res.merchants);
      }
    } catch (err) {
      console.error("Failed loading merchants", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadNgos() {
    setLoading(true);
    try {
      const res = await api.getAdminNgos(ngoStatusFilter);
      if (res && res.ngos) {
        setNgos(res.ngos);
      }
    } catch (err) {
      console.error("Failed loading NGOs", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadOrders() {
    setLoading(true);
    try {
      const res = await api.getAdminOrders(orderStatusFilter);
      if (res && res.orders) {
        setOrders(res.orders);
      }
    } catch (err) {
      console.error("Failed loading orders", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadListings() {
    setLoading(true);
    try {
      const res = await api.getAdminListings(listingStatusFilter);
      if (res && res.listings) {
        setListings(res.listings);
      }
    } catch (err) {
      console.error("Failed loading listings", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadAuditLogs() {
    setLoading(true);
    try {
      const res = await api.getAdminAuditLogs({ action: auditActionFilter, limit: 100 });
      if (res && res.logs) {
        setAuditLogs(res.logs);
      }
    } catch (err) {
      console.error("Failed loading audit logs", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadSettings() {
    setLoading(true);
    try {
      const res = await api.getAdminSettings();
      if (res && res.settings) {
        setSystemSettings(res.settings);
      }
    } catch (err) {
      console.error("Failed loading settings", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleInspectMerchant(merchantId) {
    setInspectLoading(true);
    try {
      const res = await api.getAdminMerchantDetails(merchantId);
      if (res && res.merchant) {
        setInspectMerchantModal(res.merchant);
      }
    } catch (err) {
      alert(err.message || "Failed to load merchant profile details.");
    } finally {
      setInspectLoading(false);
    }
  }

  async function handleApproveMerchant(merchantId) {
    setActionLoading(true);
    try {
      await api.approveAdminMerchant(merchantId);
      setActionSuccess("Merchant approved successfully.");
      if (inspectMerchantModal && (inspectMerchantModal.id === merchantId || inspectMerchantModal.hotelId === merchantId)) {
        setInspectMerchantModal((prev) => (prev ? { ...prev, status: "APPROVED", verificationStatus: "approved" } : null));
      }
      setTimeout(() => setActionSuccess(""), 4000);
      await loadMerchants();
      loadDashboardStats();
    } catch (err) {
      alert(err.message || "Failed to approve merchant.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApproveNgo(ngoId) {
    setActionLoading(true);
    try {
      await api.approveAdminNgo(ngoId);
      setActionSuccess("NGO approved successfully.");
      setTimeout(() => setActionSuccess(""), 4000);
      await loadNgos();
      loadDashboardStats();
    } catch (err) {
      alert(err.message || "Failed to approve NGO.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApproveUser(userId) {
    setActionLoading(true);
    try {
      await api.approveAdminUser(userId);
      setActionSuccess("User approved successfully.");
      setConfirmModal(null);
      setTimeout(() => setActionSuccess(""), 4000);
      await loadUsers();
      loadDashboardStats();
    } catch (err) {
      alert(err.message || "Failed to approve user.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRejectSubmit() {
    if (!rejectModal) return;
    setActionLoading(true);
    try {
      if (rejectModal.type === "merchant") {
        await api.rejectAdminMerchant(rejectModal.id, rejectionReason || "Incomplete documentation");
        if (inspectMerchantModal && (inspectMerchantModal.id === rejectModal.id || inspectMerchantModal.hotelId === rejectModal.id)) {
          setInspectMerchantModal((prev) => (prev ? { ...prev, status: "REJECTED", verificationStatus: "rejected", rejectionReason: rejectionReason } : null));
        }
      } else if (rejectModal.type === "ngo") {
        await api.rejectAdminNgo(rejectModal.id, rejectionReason || "Tax exemption documents unverified");
      } else if (rejectModal.type === "user") {
        await api.rejectAdminUser(rejectModal.id);
      }
      setActionSuccess(`${rejectModal.name} rejected.`);
      setRejectModal(null);
      setRejectionReason("");
      setTimeout(() => setActionSuccess(""), 4000);
      if (activeSection === "merchants") loadMerchants();
      if (activeSection === "ngos") loadNgos();
      if (activeSection === "users") loadUsers();
      loadDashboardStats();
    } catch (err) {
      alert(err.message || "Failed to reject.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api.updateAdminSettings({ settings: systemSettings });
      setActionSuccess("Platform settings updated successfully.");
      setTimeout(() => setActionSuccess(""), 4000);
    } catch (err) {
      alert(err.message || "Failed to save settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl">
          <div className="w-12 h-12 bg-rose-500/15 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">403 Forbidden</h2>
          <p className="text-sm text-slate-500 mb-6">Administrator credentials are required to access this portal.</p>
          <a href="/login/admin" className="btn btn-primary w-full inline-block py-2.5 rounded-xl font-semibold">
            Admin Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 pb-20 pt-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                FoodSaver Admin Portal
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Live Database Verification, Partner Onboarding, Real-time Order Monitoring & Analytics
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
              🟢 MySQL Connected
            </span>
          </div>
        </div>

        {/* Recently Accessed Feature Bar */}
        <RecentlyAccessed />

        {/* Toast Alert */}
        {actionSuccess && (
          <div className="bg-emerald-500 text-white font-semibold text-xs py-3 px-4 rounded-xl shadow-md my-4 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" /> {actionSuccess}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 my-5 no-scrollbar">
          {[
            { id: "overview", label: "System Overview", icon: Activity },
            { id: "merchants", label: `Merchants (${stats?.pendingMerchantApprovals ? `${stats.pendingMerchantApprovals} pending` : "All"})`, icon: Store },
            { id: "ngos", label: `NGOs (${stats?.pendingNgoApprovals ? `${stats.pendingNgoApprovals} pending` : "All"})`, icon: Heart },
            { id: "users", label: "Users", icon: Users },
            { id: "orders", label: "Live Orders", icon: ShoppingBag },
            { id: "listings", label: "Food Listings", icon: Layers },
            { id: "intelligence", label: "Food Rescue Analytics", icon: Sparkles },
            { id: "audit", label: "Audit Logs", icon: FileCheck },
            { id: "settings", label: "Config", icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* TAB 1: SYSTEM OVERVIEW (REAL DB STATS) */}
        {activeSection === "overview" && (
          <div className="space-y-6 animate-in fade-in">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Total Users</p>
                <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{stats?.totalUsers || 0}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{stats?.totalCustomers || 0} customers</p>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Merchants</p>
                <p className="text-2xl font-black text-amber-500 mt-1">{stats?.totalMerchants || 0}</p>
                <p className="text-[10px] text-amber-600 font-semibold mt-0.5">{stats?.pendingMerchantApprovals || 0} pending review</p>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">NGO Partners</p>
                <p className="text-2xl font-black text-rose-500 mt-1">{stats?.totalNgos || 0}</p>
                <p className="text-[10px] text-rose-600 font-semibold mt-0.5">{stats?.pendingNgoApprovals || 0} pending review</p>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Active Food Deals</p>
                <p className="text-2xl font-black text-emerald-500 mt-1">{stats?.activeListings || 0}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{stats?.totalListings || 0} lifetime listings</p>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Orders Placed</p>
                <p className="text-2xl font-black text-blue-500 mt-1">{stats?.totalOrders || 0}</p>
                <p className="text-[10px] text-blue-600 font-semibold mt-0.5">{stats?.activeOrders || 0} in progress</p>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-emerald-500/30 dark:border-emerald-500/30 rounded-2xl p-4 shadow-2xs bg-emerald-500/5">
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">Food Saved</p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{stats?.foodSavedKg || 0} kg</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{stats?.foodSavedPortions || 0} portions rescued</p>
              </div>
            </div>

            {/* Platform Environmental Rescue Impact Widget */}
            <RescueIntelligenceWidget isAdmin={true} />

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-3">
                  <Store className="w-4 h-4 text-amber-500" /> Pending Merchant Approvals ({stats?.pendingMerchantApprovals || 0})
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Review submitted business licenses, address proofs, and FSSAI registrations before approving restaurants.
                </p>
                <button
                  onClick={() => {
                    setMerchantStatusFilter("PENDING");
                    setActiveSection("merchants");
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                >
                  Review Pending Merchants →
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-3">
                  <Heart className="w-4 h-4 text-rose-500" /> Pending NGO Verifications ({stats?.pendingNgoApprovals || 0})
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Verify trust deeds, 12A/80G documents, and daily meal capacity for food rescue partners.
                </p>
                <button
                  onClick={() => {
                    setNgoStatusFilter("PENDING");
                    setActiveSection("ngos");
                  }}
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                >
                  Review Pending NGOs →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MERCHANTS REVIEW & ONBOARDING */}
        {activeSection === "merchants" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Merchant Restaurant Partners</h3>
                <p className="text-xs text-slate-500">Inspect business profiles, locations, and approve seller access</p>
              </div>

              <div className="flex gap-2">
                {["all", "PENDING", "APPROVED", "REJECTED"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setMerchantStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-colors ${
                      merchantStatusFilter === st
                        ? "bg-slate-800 text-white dark:bg-white dark:text-slate-900"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {st.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <p className="text-xs text-slate-400 py-8 text-center">Loading merchants...</p>
            ) : merchants.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">No merchants found matching the filter.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {merchants.map((m) => (
                  <div key={m.id || m.hotelId} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-sm">
                        {(m.hotelName || m.merchantName || "M").slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{m.hotelName || m.merchantName}</h4>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              (m.status || m.verificationStatus) === "APPROVED" || (m.status || m.verificationStatus) === "approved"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                : (m.status || m.verificationStatus) === "REJECTED" || (m.status || m.verificationStatus) === "rejected"
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                          >
                            {m.status || m.verificationStatus}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {m.ownerName ? <span className="font-semibold text-slate-700 dark:text-slate-300">{m.ownerName} • </span> : null}
                          {m.address || "Kovilpatti, Tamil Nadu"} • {m.cuisine || "Restaurant"} • {m.email || m.phone || m.contactNumber}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleInspectMerchant(m.id || m.hotelId)}
                        disabled={inspectLoading}
                        className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors"
                      >
                        Review Profile
                      </button>
                      {((m.status || m.verificationStatus) || "").toUpperCase() !== "APPROVED" && (
                        <button
                          disabled={actionLoading}
                          onClick={() => handleApproveMerchant(m.id || m.hotelId)}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors"
                        >
                          Approve Partner
                        </button>
                      )}
                      {((m.status || m.verificationStatus) || "").toUpperCase() !== "REJECTED" && (
                        <button
                          disabled={actionLoading}
                          onClick={() => setRejectModal({ type: "merchant", id: m.id || m.hotelId, name: m.hotelName || m.merchantName })}
                          className="px-3.5 py-1.5 bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 hover:bg-rose-100 rounded-xl text-xs font-bold transition-colors"
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: NGO APPROVALS */}
        {activeSection === "ngos" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">NGO Food Rescue Organizations</h3>
                <p className="text-xs text-slate-500">Verify non-profit credentials, service radius, and food distribution capacity</p>
              </div>

              <div className="flex gap-2">
                {["all", "PENDING", "APPROVED", "REJECTED"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setNgoStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-colors ${
                      ngoStatusFilter === st
                        ? "bg-slate-800 text-white dark:bg-white dark:text-slate-900"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {st.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <p className="text-xs text-slate-400 py-8 text-center">Loading NGOs...</p>
            ) : ngos.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">No NGO records found.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {ngos.map((ngo) => (
                  <div key={ngo.id || ngo.ngoId} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold text-sm">
                        {(ngo.name || ngo.ngoName || "N").slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{ngo.name || ngo.ngoName}</h4>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              (ngo.status || ngo.verificationStatus) === "APPROVED" || (ngo.status || ngo.verificationStatus) === "approved"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                : (ngo.status || ngo.verificationStatus) === "REJECTED" || (ngo.status || ngo.verificationStatus) === "rejected"
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                          >
                            {ngo.status || ngo.verificationStatus}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{ngo.address || "Community Center, Kovilpatti"} • Radius: {ngo.radius || ngo.serviceRadiusKm || 5.0} km • {ngo.contactNumber || "+91 91234 56789"}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {((ngo.status || ngo.verificationStatus) || "").toUpperCase() !== "APPROVED" && (
                        <button
                          disabled={actionLoading}
                          onClick={() => handleApproveNgo(ngo.id || ngo.ngoId)}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors"
                        >
                          Approve NGO
                        </button>
                      )}
                      {((ngo.status || ngo.verificationStatus) || "").toUpperCase() !== "REJECTED" && (
                        <button
                          disabled={actionLoading}
                          onClick={() => setRejectModal({ type: "ngo", id: ngo.id || ngo.ngoId, name: ngo.name || ngo.ngoName })}
                          className="px-3.5 py-1.5 bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 hover:bg-rose-100 rounded-xl text-xs font-bold transition-colors"
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: USER ACCOUNTS */}
        {activeSection === "users" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">User Account Management</h3>
                <p className="text-xs text-slate-500">Inspect real database registered users, roles, and status</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 font-semibold"
                >
                  <option value="all">All Roles</option>
                  <option value="customer">Customer</option>
                  <option value="merchant">Merchant</option>
                  <option value="ngo">NGO</option>
                  <option value="admin">Admin</option>
                </select>

                <select
                  value={userStatusFilter}
                  onChange={(e) => setUserStatusFilter(e.target.value)}
                  className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 font-semibold"
                >
                  <option value="all">All Statuses</option>
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            {loading ? (
              <p className="text-xs text-slate-400 py-8 text-center">Loading users...</p>
            ) : users.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">No users found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                      <th className="py-3 px-2">Name & Email</th>
                      <th className="py-3 px-2">Role</th>
                      <th className="py-3 px-2">Status</th>
                      <th className="py-3 px-2">Joined</th>
                      <th className="py-3 px-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {users.map((u) => (
                      <tr key={u.id || u.user_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-3 px-2">
                          <p className="font-bold text-slate-800 dark:text-slate-100">{u.name || u.full_name}</p>
                          <p className="text-[11px] text-slate-400">{u.email}</p>
                        </td>
                        <td className="py-3 px-2">
                          <span className="font-bold uppercase text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                            {u.role || u.role_id}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              (u.status || "").toUpperCase() === "APPROVED"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                : (u.status || "").toUpperCase() === "REJECTED"
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                          >
                            {u.status || "APPROVED"}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-slate-400">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "Active"}
                        </td>
                        <td className="py-3 px-2 text-right space-x-2">
                          {(u.status || "").toUpperCase() !== "APPROVED" && (
                            <button
                              onClick={() => handleApproveUser(u.id || u.user_id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold"
                            >
                              Approve
                            </button>
                          )}
                          {(u.status || "").toUpperCase() !== "REJECTED" && (
                            <button
                              onClick={() => setRejectModal({ type: "user", id: u.id || u.user_id, name: u.name || u.full_name })}
                              className="px-2.5 py-1 bg-rose-50 text-rose-600 dark:bg-rose-950/40 rounded-lg text-[11px] font-bold"
                            >
                              Reject
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: LIVE ORDERS MONITORING */}
        {activeSection === "orders" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Live Orders & Pickup Monitoring</h3>
                <p className="text-xs text-slate-500">Real-time claim status, tracking sessions, and customer fulfillment</p>
              </div>

              <div className="flex gap-2">
                {["all", "ORDER_PLACED", "CONFIRMED", "OUT_FOR_DELIVERY", "COMPLETED", "CANCELLED"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setOrderStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                      orderStatusFilter === st
                        ? "bg-slate-800 text-white dark:bg-white dark:text-slate-900"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {st.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <p className="text-xs text-slate-400 py-8 text-center">Loading orders...</p>
            ) : orders.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">No orders found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                      <th className="py-3 px-2">Order Token</th>
                      <th className="py-3 px-2">Item & Hotel</th>
                      <th className="py-3 px-2">Customer</th>
                      <th className="py-3 px-2">Paid Amount</th>
                      <th className="py-3 px-2">Live Status</th>
                      <th className="py-3 px-2">Tracking</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {orders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-3 px-2 font-mono font-black text-emerald-600 dark:text-emerald-400">
                          {o.claimToken}
                        </td>
                        <td className="py-3 px-2">
                          <p className="font-bold text-slate-800 dark:text-slate-100">{o.itemName}</p>
                          <p className="text-[11px] text-slate-400">{o.hotelName}</p>
                        </td>
                        <td className="py-3 px-2">
                          <p className="font-semibold text-slate-700 dark:text-slate-300">{o.customerName}</p>
                          <p className="text-[11px] text-slate-400">{o.customerEmail}</p>
                        </td>
                        <td className="py-3 px-2 font-bold text-slate-800 dark:text-slate-100">
                          ₹{o.pricePaid} ({o.quantity} qty)
                        </td>
                        <td className="py-3 px-2">
                          <span className="font-bold uppercase text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-2.5 py-1 rounded-full">
                            {o.status}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          {o.trackingActive ? (
                            <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> Live GPS
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Ended</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 6: FOOD LISTINGS */}
        {activeSection === "listings" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Merchant Food Listings</h3>
                <p className="text-xs text-slate-500">Live and historical surplus meal bundles across verified restaurants</p>
              </div>

              <div className="flex gap-2">
                {["all", "active", "soldout", "expired_donatable", "rescued"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setListingStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                      listingStatusFilter === st
                        ? "bg-slate-800 text-white dark:bg-white dark:text-slate-900"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {st.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <p className="text-xs text-slate-400 py-8 text-center">Loading listings...</p>
            ) : listings.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">No listings found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                      <th className="py-3 px-2">Food Item</th>
                      <th className="py-3 px-2">Restaurant</th>
                      <th className="py-3 px-2">Price & Discount</th>
                      <th className="py-3 px-2">Remaining Stock</th>
                      <th className="py-3 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {listings.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-3 px-2 font-bold text-slate-800 dark:text-slate-100">
                          {l.itemName} {l.isVeg ? "🟢" : "🔴"}
                        </td>
                        <td className="py-3 px-2 text-slate-600 dark:text-slate-300 font-medium">
                          {l.hotelName}
                        </td>
                        <td className="py-3 px-2">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{l.discountPrice}</span>{" "}
                          <span className="text-slate-400 line-through text-[11px]">₹{l.originalPrice}</span>
                        </td>
                        <td className="py-3 px-2 font-bold text-slate-700 dark:text-slate-200">
                          {l.quantityAvailable} / {l.quantityTotal} units
                        </td>
                        <td className="py-3 px-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              l.status === "active"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                            }`}
                          >
                            {l.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 7: FOOD RESCUE INTELLIGENCE */}
        {activeSection === "intelligence" && (
          <div className="space-y-6 animate-in fade-in">
            <RescueIntelligenceWidget isAdmin={true} />
          </div>
        )}

        {/* TAB 8: AUDIT LOGS */}
        {activeSection === "audit" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Security & Audit Event Trail</h3>
                <p className="text-xs text-slate-500">Immutable database log of user logins, role actions, and admin approvals</p>
              </div>

              <div className="flex gap-2">
                {["all", "USER_LOGIN", "USER_LOGOUT", "MERCHANT_APPROVAL", "ORDER_CREATED"].map((act) => (
                  <button
                    key={act}
                    onClick={() => setAuditActionFilter(act)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                      auditActionFilter === act
                        ? "bg-slate-800 text-white dark:bg-white dark:text-slate-900"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {act.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <p className="text-xs text-slate-400 py-8 text-center">Loading audit logs...</p>
            ) : auditLogs.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">No audit logs recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                      <th className="py-3 px-2">Timestamp</th>
                      <th className="py-3 px-2">Action</th>
                      <th className="py-3 px-2">User / Actor</th>
                      <th className="py-3 px-2">Entity Target</th>
                      <th className="py-3 px-2">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-[11px]">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-3 px-2 text-slate-400">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-2">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-slate-700 dark:text-slate-300 font-sans">
                          {log.userName} ({log.userRole || "Guest"})
                        </td>
                        <td className="py-3 px-2 text-slate-500">
                          {log.entityType} #{log.entityId || "N/A"}
                        </td>
                        <td className="py-3 px-2 text-slate-400 truncate max-w-xs font-sans">
                          {log.metadata ? JSON.stringify(log.metadata) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 9: PLATFORM SETTINGS */}
        {activeSection === "settings" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm max-w-2xl animate-in fade-in">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">Platform Geolocation & Sweeper Settings</h3>
            <p className="text-xs text-slate-500 mb-6">Configure hyper-local 2 km discovery threshold, NGO donation radius, and live tracking intervals.</p>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Customer Nearby Discovery Radius (km)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={systemSettings.nearby_food_radius_km || "2.0"}
                  onChange={(e) => setSystemSettings({ ...systemSettings, nearby_food_radius_km: e.target.value })}
                  className="w-full text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  NGO Surplus Food Rescue Radius (km)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={systemSettings.ngo_donation_radius_km || "5.0"}
                  onChange={(e) => setSystemSettings({ ...systemSettings, ngo_donation_radius_km: e.target.value })}
                  className="w-full text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Live Order Location Update Interval (seconds)
                </label>
                <input
                  type="number"
                  value={systemSettings.tracking_interval_sec || "5"}
                  onChange={(e) => setSystemSettings({ ...systemSettings, tracking_interval_sec: e.target.value })}
                  className="w-full text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 font-bold"
                />
              </div>

              <button
                type="submit"
                disabled={savingSettings}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
              >
                {savingSettings ? "Saving Settings..." : "Save System Configuration"}
              </button>
            </form>
          </div>
        )}

        {/* Rejection Modal */}
        {rejectModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95">
              <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 mb-1">Reject {rejectModal.name}?</h3>
              <p className="text-xs text-slate-500 mb-4">Provide reason for rejection (this will be sent to the partner):</p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. FSSAI registration invalid or expired..."
                rows={3}
                className="w-full text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 mb-4 outline-none focus:border-rose-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setRejectModal(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  disabled={actionLoading}
                  onClick={handleRejectSubmit}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Merchant Review & Document Inspection Modal */}
        {inspectMerchantModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto space-y-6">
              
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {inspectMerchantModal.hotelName || inspectMerchantModal.businessName}
                    </h3>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                        inspectMerchantModal.status === "APPROVED" || inspectMerchantModal.verificationStatus === "approved"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : inspectMerchantModal.status === "REJECTED" || inspectMerchantModal.verificationStatus === "rejected"
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      }`}
                    >
                      {inspectMerchantModal.status || inspectMerchantModal.verificationStatus || "PENDING"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {inspectMerchantModal.businessType || "Restaurant"} • Cuisine: {inspectMerchantModal.cuisine || "General"} • Hours: {inspectMerchantModal.openingHours || "10:00 - 22:30"}
                  </p>
                </div>

                <button
                  onClick={() => setInspectMerchantModal(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800"
                >
                  ✕
                </button>
              </div>

              {/* Owner Information */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/60 dark:border-slate-800 text-xs space-y-2">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[10px]">
                  Legal Owner / Contact Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-600 dark:text-slate-300">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Full Name:</span>
                    <span className="font-semibold">{inspectMerchantModal.owner?.name || inspectMerchantModal.ownerName || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Email:</span>
                    <span className="font-semibold">{inspectMerchantModal.owner?.email || inspectMerchantModal.email || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Phone Number:</span>
                    <span className="font-semibold">{inspectMerchantModal.owner?.phone || inspectMerchantModal.contactNumber || inspectMerchantModal.phone || "N/A"}</span>
                  </div>
                </div>
              </div>

              {/* Address Details */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/60 dark:border-slate-800 text-xs space-y-2">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[10px]">
                  Store Location & Notification Radius
                </h4>
                <p className="text-slate-700 dark:text-slate-300 font-medium">
                  {inspectMerchantModal.addressDetails?.buildingNumber ? `${inspectMerchantModal.addressDetails.buildingNumber}, ` : ""}
                  {inspectMerchantModal.addressDetails?.street ? `${inspectMerchantModal.addressDetails.street}, ` : ""}
                  {inspectMerchantModal.addressDetails?.area ? `${inspectMerchantModal.addressDetails.area}, ` : ""}
                  {inspectMerchantModal.addressDetails?.city || inspectMerchantModal.city || "Kovilpatti"}, {inspectMerchantModal.addressDetails?.state || "Tamil Nadu"} - {inspectMerchantModal.addressDetails?.pincode || "628501"}
                </p>
                {inspectMerchantModal.addressDetails?.landmark && (
                  <p className="text-slate-500 text-[11px]">Landmark: {inspectMerchantModal.addressDetails.landmark}</p>
                )}
                <p className="text-slate-400 text-[11px]">
                  GPS Coordinates: Lat {inspectMerchantModal.addressDetails?.latitude || inspectMerchantModal.latitude || 9.1724}, Lng {inspectMerchantModal.addressDetails?.longitude || inspectMerchantModal.longitude || 77.8694}
                </p>
              </div>

              {/* Verification Documents */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/60 dark:border-slate-800 text-xs space-y-3">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[10px]">
                  Verification Documents & Food Safety Licenses
                </h4>
                {inspectMerchantModal.documents && inspectMerchantModal.documents.length > 0 ? (
                  <div className="space-y-2">
                    {inspectMerchantModal.documents.map((doc, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-200">{doc.type || "Document"}</p>
                          <p className="text-[11px] text-slate-400 font-mono">Reg #: {doc.number || "Submitted"}</p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          {doc.file || "doc.pdf"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-xs">Standard FSSAI registration submitted during onboarding.</p>
                )}
              </div>

              {/* Bank & Settlement Details */}
              {inspectMerchantModal.settlement && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/60 dark:border-slate-800 text-xs space-y-2">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[10px]">
                    Payout Bank Account Details
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-600 dark:text-slate-300">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Account Holder:</span>
                      <span className="font-semibold">{inspectMerchantModal.settlement.accountHolderName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Bank / Account:</span>
                      <span className="font-semibold">{inspectMerchantModal.settlement.bankReference}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">IFSC Code:</span>
                      <span className="font-semibold">{inspectMerchantModal.settlement.ifsc}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Menu Catalog Sample */}
              {inspectMerchantModal.menu && inspectMerchantModal.menu.length > 0 && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/60 dark:border-slate-800 text-xs space-y-2">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[10px]">
                    Menu Items Configured ({inspectMerchantModal.menu.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {inspectMerchantModal.menu.map((item, idx) => (
                      <div key={idx} className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <span>{item.isVeg ? "🟢" : "🔴"}</span>
                            <span>{item.itemName}</span>
                          </p>
                          <p className="text-[11px] text-slate-400">Discounted: ₹{item.discountPrice} (Orig: ₹{item.originalPrice})</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rejection notice if previously rejected */}
              {inspectMerchantModal.rejectionReason && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300 text-xs">
                  <span className="font-bold">Rejection Reason:</span> {inspectMerchantModal.rejectionReason}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setInspectMerchantModal(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-200"
                >
                  Close
                </button>

                {(inspectMerchantModal.status || inspectMerchantModal.verificationStatus || "").toUpperCase() !== "REJECTED" && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => {
                      setRejectModal({
                        type: "merchant",
                        id: inspectMerchantModal.id || inspectMerchantModal.hotelId,
                        name: inspectMerchantModal.hotelName || inspectMerchantModal.businessName
                      });
                    }}
                    className="px-4 py-2 bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 hover:bg-rose-100 rounded-xl text-xs font-bold"
                  >
                    Reject Application
                  </button>
                )}

                {(inspectMerchantModal.status || inspectMerchantModal.verificationStatus || "").toUpperCase() !== "APPROVED" && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleApproveMerchant(inspectMerchantModal.id || inspectMerchantModal.hotelId)}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm"
                  >
                    Approve Partner & Enable Sales
                  </button>
                )}
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}

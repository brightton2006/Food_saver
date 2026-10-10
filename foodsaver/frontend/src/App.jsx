import React, { useState } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { SessionProvider, useSession } from "./lib/session.jsx";
import { CartProvider } from "./lib/cart.jsx";
import { LanguageProvider } from "./lib/i18n.jsx";
import { ThemeProvider } from "./lib/theme.jsx";
import Header from "./components/Header.jsx";
import AuthModal from "./components/AuthModal.jsx";
import BottomNav from "./components/BottomNav.jsx";
import CartDrawer from "./components/CartDrawer.jsx";
import ChatbotWidget from "./components/ChatbotWidget.jsx";
import PreLoginHome from "./pages/PreLoginHome.jsx";
import CustomerFeed from "./pages/CustomerFeed.jsx";
import CustomerPickups from "./pages/CustomerPickups.jsx";
import MerchantDashboard from "./pages/MerchantDashboard.jsx";
import MerchantPost from "./pages/MerchantPost.jsx";
import MerchantCounter from "./pages/MerchantCounter.jsx";
import NgoDashboard from "./pages/NgoDashboard.jsx";
import Profile from "./pages/Profile.jsx";
import Login from "./pages/Login.jsx";
import CheckoutPage from "./pages/CheckoutPage.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import RestaurantPage from "./pages/RestaurantPage.jsx";

// New Location-Aware & Donation Pages
import NearbyFood from "./pages/customer/NearbyFood.jsx";
import MerchantDonationPage from "./pages/merchant/DonationPage.jsx";
import NgoDonations from "./pages/ngo/NgoDonations.jsx";
import MerchantOnboardingWizard from "./pages/merchant/MerchantOnboardingWizard.jsx";
import NgoOnboardingWizard from "./pages/ngo/NgoOnboardingWizard.jsx";
import MobileFrameShell from "./components/MobileFrameShell.jsx";

function RequireRole({ role, children }) {
  const { session } = useSession();
  if (!session) return <Navigate to="/" replace />;
  const userRole = (session.role || "").toLowerCase();
  const targetRole = (role || "").toLowerCase();
  if (role && userRole !== targetRole) return <Navigate to="/" replace />;
  return children;
}

function IndexRoute({ searchQuery, city, openAuth }) {
  const { session } = useSession();

  if (session) {
    const role = (session.role || "").toLowerCase();
    if (role === "merchant") return <Navigate to="/merchant" replace />;
    if (role === "ngo") return <Navigate to="/ngo" replace />;
    if (role === "admin") return <Navigate to="/admin" replace />;
    return <Navigate to="/customer" replace />;
  }

  return <PreLoginHome onOpenAuth={openAuth} searchQuery={searchQuery} city={city} />;
}

import ForcePasswordResetModal from "./components/ForcePasswordResetModal.jsx";
import { ToastProvider, useToast } from "./components/ToastProvider.jsx";

function Shell() {
  const { session, setSession } = useSession();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [searchQuery, setSearchQuery] = useState("");
  const [city, setCity] = useState("Kovilpatti");
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [isMobileView, setIsMobileView] = useState(() => {
    return new URLSearchParams(window.location.search).get("view") === "mobile";
  });

  const handlePasswordChanged = () => {
    if (session) {
      setSession({ ...session, mustChangePassword: false, must_change_password: false });
    }
    toast.success("Password Updated Successfully! 🔐", "Your password has been changed.");
  };

  const openAuth = (mode) => {
    navigate(mode === "signup" ? "/login?mode=signup" : "/login");
  };

  const closeAuth = () => setAuthOpen(false);

  const handleAuthenticate = (user) => {
    const role = user.role || "customer";
    setSession({ ...user, role });
    toast.success("Welcome to Food Saver! 🎉", `Logged in as ${user.name || user.username || role}`);
    setAuthOpen(false);

    const destination =
      role === "merchant"
        ? "/merchant"
        : role === "ngo"
          ? "/ngo"
          : role === "admin"
            ? "/admin"
            : "/customer";

    navigate(destination);
  };

  const mainContent = (
    <div className="app-shell">
      <Header
        onOpenAuth={openAuth}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        city={city}
        onCityChange={setCity}
        onToggleMobileView={() => setIsMobileView((prev) => !prev)}
      />
      <CartDrawer />
      <AnimatePresence mode="wait" initial={false}>
        <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={
            <IndexRoute
              searchQuery={searchQuery}
              city={city}
              openAuth={openAuth}
            />
          }
        />
        <Route
          path="/explore"
          element={
            <PreLoginHome
              onOpenAuth={openAuth}
              searchQuery={searchQuery}
              city={city}
            />
          }
        />
        <Route
          path="/customer"
          element={
            <RequireRole role="customer">
              <CustomerFeed searchQuery={searchQuery} city={city} />
            </RequireRole>
          }
        />
        <Route
          path="/customer/nearby-food"
          element={<NearbyFood />}
        />
        <Route
          path="/customer/pickups"
          element={
            <RequireRole role="customer">
              <CustomerPickups />
            </RequireRole>
          }
        />
        <Route path="/restaurant/:hotelId" element={<RestaurantPage />} />
        <Route path="/hotels/:hotelId" element={<RestaurantPage />} />
        <Route path="/hotels" element={<Navigate to="/customer/nearby-food" replace />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/track-order" element={<Navigate to="/customer/pickups" replace />} />
        <Route path="/track-order/:orderId" element={<Navigate to="/customer/pickups" replace />} />
        <Route path="/customer/orders/:orderId/track" element={<Navigate to="/customer/pickups" replace />} />
        <Route path="/customer/orders/:orderId/tracking" element={<Navigate to="/customer/pickups" replace />} />
        <Route
          path="/merchant"
          element={
            <RequireRole role="merchant">
              <MerchantDashboard />
            </RequireRole>
          }
        />
        <Route
          path="/merchant/post"
          element={
            <RequireRole role="merchant">
              <MerchantPost />
            </RequireRole>
          }
        />
        <Route
          path="/merchant/counter"
          element={
            <RequireRole role="merchant">
              <MerchantCounter />
            </RequireRole>
          }
        />
        <Route
          path="/merchant/orders/:orderId"
          element={<Navigate to="/merchant/counter" replace />}
        />
        <Route
          path="/merchant/orders/:orderId/track"
          element={<Navigate to="/merchant/counter" replace />}
        />
        <Route
          path="/merchant/donations"
          element={
            <RequireRole role="merchant">
              <MerchantDonationPage />
            </RequireRole>
          }
        />
        <Route
          path="/ngo"
          element={
            <RequireRole role="ngo">
              <NgoDashboard />
            </RequireRole>
          }
        />
        <Route
          path="/ngo/donations"
          element={
            <RequireRole role="ngo">
              <NgoDonations />
            </RequireRole>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireRole role="admin">
              <AdminDashboard />
            </RequireRole>
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            <RequireRole role="admin">
              <AdminDashboard />
            </RequireRole>
          }
        />
        <Route path="/admin/login" element={<Login />} />
        <Route
          path="/profile"
          element={
            <RequireRole>
              <Profile />
            </RequireRole>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/login/:role" element={<Login />} />
        <Route path="/signup" element={<Login />} />
        <Route path="/signup/:role" element={<Login />} />
        <Route path="/merchant/login" element={<Login />} />
        <Route path="/merchant/register" element={<Login />} />
        <Route path="/merchant/onboarding" element={<MerchantOnboardingWizard />} />
        <Route path="/ngo/onboarding" element={<NgoOnboardingWizard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </AnimatePresence>
      <BottomNav />
      <ChatbotWidget />
      {authOpen && (
        <AuthModal
          open={authOpen}
          mode={authMode}
          onClose={closeAuth}
          onModeChange={setAuthMode}
          onAuthenticate={handleAuthenticate}
        />
      )}
      <ForcePasswordResetModal
        isOpen={Boolean(session?.mustChangePassword || session?.must_change_password)}
        user={session}
        onPasswordChanged={handlePasswordChanged}
      />
    </div>
  );

  if (isMobileView) {
    return (
      <MobileFrameShell onExit={() => setIsMobileView(false)}>
        {mainContent}
      </MobileFrameShell>
    );
  }

  return mainContent;
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <SessionProvider>
          <CartProvider>
            <ToastProvider>
              <Shell />
            </ToastProvider>
          </CartProvider>
        </SessionProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}


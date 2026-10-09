export const API_BASE = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "http://localhost:4000";

async function request(path, options = {}) {
  try {
    let token = null;
    if (typeof window !== "undefined") {
      const keys = ["foodsaver_session", "foodsaver.session", "token"];
      for (const k of keys) {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        if (raw.startsWith("{") || raw.startsWith("[")) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed?.token && parsed.token !== "null" && parsed.token !== "undefined") {
              token = parsed.token;
              break;
            }
          } catch {}
        } else if (raw && raw !== "null" && raw !== "undefined") {
          token = raw;
          break;
        }
      }
    }

    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || data.message || `Request failed (${res.status})`);
      err.status = res.status;
      err.code = data.code;
      err.data = data;
      throw err;
    }
    return data;
  } catch (err) {
    if (err.name === "TypeError" || err.message?.includes("fetch") || err.message?.includes("NetworkError")) {
      throw new Error(
        "Unable to connect to the backend server (http://localhost:4000). Please ensure the backend server is running."
      );
    }
    throw err;
  }
}

export const api = {
  fetchFoodImage: (foodName, category = "", cuisine = "") =>
    request(
      `/api/food-image?query=${encodeURIComponent(foodName)}&category=${encodeURIComponent(category)}&cuisine=${encodeURIComponent(cuisine)}`
    ),
  getListings: () => request("/api/listings"),
  getNearbyFood: (lat, lng, radius = 2.0, category = "All") =>
    request(`/api/food/nearby?latitude=${lat}&longitude=${lng}&radius=${radius}&category=${encodeURIComponent(category)}`),
  updateUserLocation: (payload) =>
    request("/api/users/location", { method: "POST", body: JSON.stringify(payload) }),
  getHotels: () => request("/api/hotels"),
  getHotel: (hotelId, lat = null, lng = null) =>
    request(`/api/hotels/${encodeURIComponent(hotelId)}${lat && lng ? `?lat=${lat}&lng=${lng}` : ""}`),
  getHotelFood: (hotelId) => request(`/api/hotels/${encodeURIComponent(hotelId)}/food`),
  getHotelDetails: (hotelId) => request(`/api/hotels/${encodeURIComponent(hotelId)}`),
  claimHotelDirectoryListing: (hotelId, payload) =>
    request(`/api/merchant/hotels/${encodeURIComponent(hotelId)}/claim`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getMerchantHotels: () => request("/api/merchant/hotels"),
  createMerchantHotel: (payload) =>
    request("/api/merchant/hotels", { method: "POST", body: JSON.stringify(payload) }),
  createMerchantFood: (payload) =>
    request("/api/merchant/food", { method: "POST", body: JSON.stringify(payload) }),
  updateMerchantFood: (id, payload) =>
    request(`/api/merchant/food/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteMerchantFood: (id) =>
    request(`/api/merchant/food/${encodeURIComponent(id)}`, { method: "DELETE" }),
  updateHotelProfile: (payload) =>
    request("/api/listings/hotel-profile", { method: "PUT", body: JSON.stringify(payload) }),
  getMerchantListings: (merchantName) =>
    request(`/api/listings/merchant/${encodeURIComponent(merchantName)}`),
  createListing: (payload) =>
    request("/api/listings", { method: "POST", body: JSON.stringify(payload) }),
  updateListing: (id, payload) =>
    request(`/api/listings/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteListing: (id, merchantName) =>
    request(`/api/listings/${id}`, { method: "DELETE", body: JSON.stringify({ merchantName }) }),
  claimListing: (id, payload) =>
    request(`/api/listings/${id}/claim`, { method: "POST", body: JSON.stringify(payload) }),
  getMerchantClaims: (merchantName) =>
    request(`/api/claims/merchant/${encodeURIComponent(merchantName)}`),
  getCustomerClaims: (customerId) =>
    request(`/api/claims/customer/${encodeURIComponent(customerId)}`),
  lookupToken: (token) => request(`/api/claims/${token}`),
  collectToken: (token) => request(`/api/claims/${token}/collect`, { method: "POST" }),
  rerouteToNgo: (token) => request(`/api/claims/${token}/reroute-ngo`, { method: "POST" }),
  getNotifications: (userId, type = "all") =>
    request(`/api/notifications?userId=${encodeURIComponent(userId || "guest")}&type=${encodeURIComponent(type)}`),
  markNotificationRead: (id, userId) =>
    request(`/api/notifications/${id}/read`, { method: "PATCH", body: JSON.stringify({ userId }) }),
  markAllNotificationsRead: (userId) =>
    request("/api/notifications/mark-all-read", { method: "POST", body: JSON.stringify({ userId }) }),
  deleteNotification: (id, userId) =>
    request(`/api/notifications/${id}`, { method: "DELETE", body: JSON.stringify({ userId }) }),

  // Email OTP Verification
  sendEmailOtp: (payload) =>
    request("/api/auth/send-otp", { method: "POST", body: JSON.stringify(payload) }),
  resendEmailOtp: (payload) =>
    request("/api/auth/resend-otp", { method: "POST", body: JSON.stringify(payload) }),
  verifyEmailOtp: (payload) =>
    request("/api/auth/verify-email-otp", { method: "POST", body: JSON.stringify(payload) }),

  // SMS OTP Verification & Preferences
  sendOtp: (payload) =>
    request("/api/auth/send-otp", { method: "POST", body: JSON.stringify(payload) }),
  verifyOtp: (payload) =>
    request("/api/auth/verify-otp", { method: "POST", body: JSON.stringify(payload) }),
  changePassword: (payload) =>
    request("/api/auth/change-password", { method: "POST", body: JSON.stringify(payload) }),
  updatePreferences: (payload) =>
    request("/api/auth/preferences", { method: "PUT", body: JSON.stringify(payload) }),

  // Payments & User Addresses & Reviews
  createPaymentOrder: (amount, receipt) =>
    request("/api/payments/create-order", { method: "POST", body: JSON.stringify({ amount, receipt }) }),
  verifyPayment: (payload) =>
    request("/api/payments/verify", { method: "POST", body: JSON.stringify(payload) }),
  getUserAddresses: () => request("/api/user/addresses"),
  createUserAddress: (payload) =>
    request("/api/user/addresses", { method: "POST", body: JSON.stringify(payload) }),
  deleteUserAddress: (id) =>
    request(`/api/user/addresses/${id}`, { method: "DELETE" }),
  submitReview: (payload) =>
    request("/api/reviews", { method: "POST", body: JSON.stringify(payload) }),
  getHotelReviews: (hotelId) => request(`/api/reviews/hotel/${encodeURIComponent(hotelId)}`),
  subscribePushNotification: (subscription) =>
    request("/api/push/subscribe", { method: "POST", body: JSON.stringify({ subscription }) }),
  createDonation: (payload) =>
    request("/api/donations", { method: "POST", body: JSON.stringify(payload) }),
  getNearbyDonations: (lat = 9.1724, lng = 77.8694, radius = 5.0) =>
    request(`/api/donations/nearby?latitude=${lat}&longitude=${lng}&radius=${radius}`),
  getDonationDetails: (id) => request(`/api/donations/${id}`),
  claimDonation: (id, ngoUserId) =>
    request(`/api/donations/${id}/claim`, { method: "POST", body: JSON.stringify({ ngoUserId }) }),
  updateDonationStatus: (id, status) =>
    request(`/api/donations/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  getNgoNotifications: () => request("/api/ngo/notifications"),
  acknowledgeNotification: (id, ngoName) =>
    request(`/api/ngo/notifications/${id}/acknowledge`, { method: "POST", body: JSON.stringify({ ngoName }) }),
  ngoRescueListing: (payload) =>
    request("/api/ngo/rescue", { method: "POST", body: JSON.stringify(payload) }),
  merchantLogin: (payload) =>
    request("/api/auth/merchant-login", { method: "POST", body: JSON.stringify(payload) }),
  verifyMerchant: (token) =>
    request("/api/auth/verify-merchant", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    }),
  login: (payload) =>
    request("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  registerUser: (payload) =>
    request("/api/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  registerPartner: (payload) =>
    request("/api/auth/register-partner", { method: "POST", body: JSON.stringify(payload) }),
  googleLogin: (payload) =>
    request("/api/auth/google", { method: "POST", body: JSON.stringify(payload) }),
  updateProfile: (payload) =>
    request("/api/auth/profile", { method: "PUT", body: JSON.stringify(payload) }),
  resubmitDocuments: (payload) =>
    request("/api/auth/resubmit-documents", { method: "POST", body: JSON.stringify(payload) }),
  getAdminUsers: (role = "all", status = "all", search = "") =>
    request(`/api/admin/users?role=${encodeURIComponent(role)}&status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`),
  approveAdminUser: (id) =>
    request(`/api/admin/users/${encodeURIComponent(id)}/approve`, { method: "POST" }),
  rejectAdminUser: (id) =>
    request(`/api/admin/users/${encodeURIComponent(id)}/reject`, { method: "POST" }),
  getVerifications: (role = "all", status = "all") =>
    request(`/api/admin/verifications?role=${encodeURIComponent(role)}&status=${encodeURIComponent(status)}`),
  approveVerification: (id) =>
    request(`/api/admin/verifications/${id}/approve`, { method: "POST" }),
  rejectVerification: (id, reason) =>
    request(`/api/admin/verifications/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
  requestResubmission: (id, reason) =>
    request(`/api/admin/verifications/${id}/request-resubmission`, { method: "POST", body: JSON.stringify({ reason }) }),
  createHotel: (payload) =>
    request("/api/listings/hotels", { method: "POST", body: JSON.stringify(payload) }),
  getMerchantHotel: (merchantId) =>
    request(`/api/listings/hotels/merchant/${encodeURIComponent(merchantId)}`),
  getAdminNotifications: () => request("/api/admin/notifications"),
  markAdminNotificationRead: (id) =>
    request(`/api/admin/notifications/${id}/read`, { method: "POST" }),
  markAllAdminNotificationsRead: () =>
    request("/api/admin/notifications/mark-all-read", { method: "POST" }),
  getAdminHotels: () => request("/api/admin/hotels"),
  approveAdminHotel: (id) =>
    request(`/api/admin/hotels/${id}/approve`, { method: "POST" }),
  rejectAdminHotel: (id, reason) =>
    request(`/api/admin/hotels/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
  getMerchantTodaySales: (merchantName) =>
    request(`/api/claims/sales/today/${encodeURIComponent(merchantName)}`),
  getAdminMetrics: () => request("/api/claims/admin/metrics"),
  getAdminSettings: () => request("/api/admin/settings"),
  updateAdminSettings: (payload) =>
    request("/api/admin/settings", { method: "POST", body: JSON.stringify(payload) }),

  // Admin Merchant & NGO Onboarding Inspection API methods
  getAdminMerchants: (status = "all", type = "all", search = "") =>
    request(`/api/admin/merchants?status=${encodeURIComponent(status)}&type=${encodeURIComponent(type)}&search=${encodeURIComponent(search)}`),
  getAdminMerchantDetails: (id) =>
    request(`/api/admin/merchants/${encodeURIComponent(id)}`),
  approveAdminMerchant: (id) =>
    request(`/api/admin/merchants/${encodeURIComponent(id)}/approve`, { method: "POST" }),
  rejectAdminMerchant: (id, reason) =>
    request(`/api/admin/merchants/${encodeURIComponent(id)}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
  requestChangesAdminMerchant: (id, reason) =>
    request(`/api/admin/merchants/${encodeURIComponent(id)}/request-changes`, { method: "POST", body: JSON.stringify({ reason }) }),

  getAdminNgos: (status = "all", search = "") =>
    request(`/api/admin/ngos?status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`),
  getAdminNgoDetails: (id) =>
    request(`/api/admin/ngos/${encodeURIComponent(id)}`),
  approveAdminNgo: (id) =>
    request(`/api/admin/ngos/${encodeURIComponent(id)}/approve`, { method: "POST" }),
  rejectAdminNgo: (id, reason) =>
    request(`/api/admin/ngos/${encodeURIComponent(id)}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
  requestChangesAdminNgo: (id, reason) =>
    request(`/api/admin/ngos/${encodeURIComponent(id)}/request-changes`, { method: "POST", body: JSON.stringify({ reason }) }),

  // Admin Hotel Directory & Map Pin Verification API methods
  getAdminDirectoryHotels: (status = "all", locationStatus = "all", search = "") =>
    request(`/api/admin/directory-hotels?status=${encodeURIComponent(status)}&locationStatus=${encodeURIComponent(locationStatus)}&search=${encodeURIComponent(search)}`),
  updateAdminHotelLocation: (id, payload) =>
    request(`/api/admin/hotels/${encodeURIComponent(id)}/location`, { method: "PUT", body: JSON.stringify(payload) }),
  getAdminHotelClaims: () =>
    request("/api/admin/hotel-claims"),
  approveAdminHotelClaim: (id) =>
    request(`/api/admin/hotel-claims/${encodeURIComponent(id)}/approve`, { method: "POST" }),
  rejectAdminHotelClaim: (id, reason) =>
    request(`/api/admin/hotel-claims/${encodeURIComponent(id)}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
  updateAdminHotelStatus: (id, payload) =>
    request(`/api/admin/hotels/${encodeURIComponent(id)}/status`, { method: "PUT", body: JSON.stringify(payload) }),

  // Hotel Directory & Nearby Discovery API methods
  getHotels: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(q ? `/api/hotels?${q}` : "/api/hotels");
  },
  getNearbyHotels: (lat, lng, radiusKm = 5.0, category = "All") =>
    request(`/api/hotels/nearby?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}&category=${encodeURIComponent(category)}`),
  getHotelById: (id, lat, lng) => {
    let url = `/api/hotels/${encodeURIComponent(id)}`;
    if (lat && lng) url += `?lat=${lat}&lng=${lng}`;
    return request(url);
  },
  getHotelFood: (id) =>
    request(`/api/hotels/${encodeURIComponent(id)}/food`),
  searchHotels: (query, category = "All") =>
    request(`/api/hotels/search?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}`),

  // Token Verification & Order Completion API methods
  verifyPickupToken: (token, orderId, method = "TOKEN") =>
    request("/api/orders/verify-pickup", {
      method: "POST",
      body: JSON.stringify({ token, orderId, method }),
    }),
  completeOrderHandover: (orderId) =>
    request(`/api/orders/${encodeURIComponent(orderId)}/handover`, { method: "POST" }),
  verifyClaimToken: (token, orderId, method = "TOKEN", merchantUserId) =>
    request("/api/claims/verify-token", {
      method: "POST",
      body: JSON.stringify({ token, orderId, method, merchantUserId }),
    }),

  // Live Order Tracking API methods
  confirmOrder: (orderId) =>
    request(`/api/orders/${encodeURIComponent(orderId)}/confirm`, { method: "POST" }),
  startOrderDelivery: (orderId) =>
    request(`/api/orders/${encodeURIComponent(orderId)}/start-delivery`, { method: "POST" }),
  markOrderDelivered: (orderId) =>
    request(`/api/orders/${encodeURIComponent(orderId)}/delivered`, { method: "POST" }),
  cancelOrder: (orderId) =>
    request(`/api/orders/${encodeURIComponent(orderId)}/cancel`, { method: "POST" }),
  getOrderDetails: (orderId) =>
    request(`/api/orders/${encodeURIComponent(orderId)}`),

  // Recently Accessed API methods
  getRecentlyAccessed: (limit = 10) =>
    request(`/api/recently-accessed?limit=${limit}`),
  addRecentlyAccessed: (payload) =>
    request("/api/recently-accessed", { method: "POST", body: JSON.stringify(payload) }),
  deleteRecentlyAccessed: (id) =>
    request(`/api/recently-accessed/${id}`, { method: "DELETE" }),
  clearRecentlyAccessed: () =>
    request("/api/recently-accessed", { method: "DELETE" }),

  // Food Rescue Intelligence API methods
  getMerchantIntelligence: (merchantId) =>
    request(merchantId ? `/api/intelligence/merchant/${encodeURIComponent(merchantId)}` : "/api/intelligence/merchant"),
  getPlatformIntelligence: () =>
    request("/api/intelligence/platform"),

  // Chatbot Assistant API methods
  sendChatMessage: (message) =>
    request("/api/chatbot/message", { method: "POST", body: JSON.stringify({ message }) }),

  // Admin Monitoring & Stats API methods
  getAdminDashboardStats: () =>
    request("/api/admin/dashboard-stats"),
  getAdminAuditLogs: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/admin/audit-logs?${q}`);
  },
  getAdminOrders: (status = "all", search = "") =>
    request(`/api/admin/orders?status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`),
  getAdminListings: (status = "all", search = "") =>
    request(`/api/admin/listings?status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`),
  getAdminDonations: () =>
    request("/api/admin/donations"),

  // Auth additions
  getAuthMe: () =>
    request("/api/auth/me"),
  refreshToken: (token) =>
    request("/api/auth/refresh", { method: "POST", body: JSON.stringify({ token }) }),
  logout: () =>
    request("/api/auth/logout", { method: "POST" }),

  // Night-Time Surplus Food Flash Sales API methods
  getNightSales: ({ lat, lng, radius = 2.0, category = "All", searchQuery = "", city = "Kovilpatti" } = {}) => {
    const params = new URLSearchParams();
    if (lat) params.append("lat", lat);
    if (lng) params.append("lng", lng);
    if (radius) params.append("radius", radius);
    if (category) params.append("category", category);
    if (searchQuery) params.append("searchQuery", searchQuery);
    if (city) params.append("city", city);
    return request(`/api/listings/night-sales?${params.toString()}`);
  },
  createNightSale: (payload) =>
    request("/api/listings/night-sale", { method: "POST", body: JSON.stringify(payload) }),
  getMerchantNightSales: (merchantId) =>
    request(`/api/listings/merchant-summary/${encodeURIComponent(merchantId)}`),
  pauseListing: (id, merchantName) =>
    request(`/api/listings/${encodeURIComponent(id)}/pause`, { method: "POST", body: JSON.stringify({ merchantName }) }),
  resumeListing: (id, merchantName) =>
    request(`/api/listings/${encodeURIComponent(id)}/resume`, { method: "POST", body: JSON.stringify({ merchantName }) }),
  markListingSoldOut: (id, merchantName) =>
    request(`/api/listings/${encodeURIComponent(id)}/sold-out`, { method: "POST", body: JSON.stringify({ merchantName }) }),
  removeUnsafeListing: (id, merchantName, reason) =>
    request(`/api/listings/${encodeURIComponent(id)}/remove-unsafe`, { method: "POST", body: JSON.stringify({ merchantName, reason }) }),
  donateListingToNgo: (id, merchantName) =>
    request(`/api/listings/${encodeURIComponent(id)}/donate-to-ngo`, { method: "POST", body: JSON.stringify({ merchantName }) }),
};


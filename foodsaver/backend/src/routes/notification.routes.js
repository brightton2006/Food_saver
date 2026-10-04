const express = require("express");
const {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} = require("../services/notificationService");
const router = express.Router();

// GET /api/notifications — get notifications for authenticated user
router.get("/", async (req, res) => {
  try {
    const userId = req.query.userId || req.user?.userId || "admin-1";
    const type = req.query.type || "all";
    const notifications = await getUserNotifications(userId, { type });
    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return res.json({
      success: true,
      unreadCount,
      notifications,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/notifications/:id/read — mark notification as read
router.patch("/:id/read", async (req, res) => {
  try {
    const userId = req.body?.userId || req.user?.userId || "admin-1";
    await markNotificationRead(req.params.id, userId);
    return res.json({ success: true, message: "Notification marked as read." });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/notifications/mark-all-read — mark all notifications as read
router.post("/mark-all-read", async (req, res) => {
  try {
    const userId = req.body?.userId || req.user?.userId || "admin-1";
    await markAllNotificationsRead(userId);
    return res.json({ success: true, message: "All notifications marked as read." });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/notifications/:id — delete notification
router.delete("/:id", async (req, res) => {
  try {
    const userId = req.body?.userId || req.query?.userId || req.user?.userId || "admin-1";
    await deleteNotification(req.params.id, userId);
    return res.json({ success: true, message: "Notification deleted." });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

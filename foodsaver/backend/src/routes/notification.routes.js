const express = require("express");
const { getUserNotifications, markNotificationRead } = require("../services/notificationService");
const router = express.Router();

// GET /api/notifications — get notifications for authenticated user
router.get("/", async (req, res) => {
  try {
    const userId = req.query.userId || req.user?.userId || "admin-1";
    const notifications = await getUserNotifications(userId);
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

module.exports = router;

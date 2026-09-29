const { pool } = require("../config/database");

/**
 * Log an audit event to the database
 * @param {Object} params
 * @param {string} [params.userId]
 * @param {string} params.action - e.g. 'USER_LOGIN', 'MERCHANT_APPROVAL', 'ORDER_CREATED'
 * @param {string} params.entityType - e.g. 'USER', 'MERCHANT', 'ORDER', 'LISTING', 'DONATION'
 * @param {string} [params.entityId]
 * @param {Object} [params.metadata]
 * @param {string} [params.ipAddress]
 */
async function logAuditEvent({ userId = null, action, entityType, entityId = null, metadata = null, ipAddress = null }) {
  try {
    const metaJson = metadata ? JSON.stringify(metadata) : null;
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [userId, action, entityType, entityId, metaJson, ipAddress]
    );
  } catch (err) {
    console.error("Failed to write audit log:", err.message);
  }
}

/**
 * Fetch paginated audit logs for Admin inspection
 */
async function getAuditLogs({ limit = 50, offset = 0, action = null, entityType = null, userId = null } = {}) {
  try {
    let sql = `
      SELECT a.*, u.full_name as user_name, u.email as user_email, u.role_id as user_role
      FROM audit_logs a
      LEFT JOIN dim_users u ON a.user_id = u.user_id
      WHERE 1=1
    `;
    const params = [];

    if (action && action !== "all") {
      sql += " AND a.action = ?";
      params.push(action);
    }
    if (entityType && entityType !== "all") {
      sql += " AND a.entity_type = ?";
      params.push(entityType);
    }
    if (userId) {
      sql += " AND a.user_id = ?";
      params.push(userId);
    }

    sql += " ORDER BY a.created_at DESC LIMIT ? OFFSET ?";
    params.push(Number(limit) || 50, Number(offset) || 0);

    const [rows] = await pool.query(sql, params);
    const [countRows] = await pool.query("SELECT COUNT(*) as total FROM audit_logs");

    return {
      total: countRows[0]?.total || rows.length,
      logs: rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        userName: r.user_name || "System/Guest",
        userEmail: r.user_email || "",
        userRole: r.user_role || "",
        action: r.action,
        entityType: r.entity_type,
        entityId: r.entity_id,
        metadata: r.metadata ? (typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata) : null,
        ipAddress: r.ip_address,
        createdAt: r.created_at,
      })),
    };
  } catch (err) {
    console.error("Error fetching audit logs:", err);
    throw err;
  }
}

module.exports = {
  logAuditEvent,
  getAuditLogs,
};

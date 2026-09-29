const jwt = require("jsonwebtoken");
const { pool } = require("../config/database");

const JWT_SECRET = process.env.JWT_SECRET || "foodsaver_merchant_secret_key_2026";

/**
 * Middleware: Verify JWT from Authorization Header (Bearer <token>)
 */
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : req.body?.token || req.query?.token;

  if (!token) {
    return res.status(401).json({
      error: "Authentication token required.",
      code: "NO_TOKEN",
    });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      userId: payload.userId || payload.id,
      email: payload.email,
      role: (payload.role || "customer").toUpperCase(),
      name: payload.name,
      status: payload.status || "APPROVED",
    };
    next();
  } catch (err) {
    return res.status(401).json({
      error: "Invalid or expired authorization token.",
      code: "INVALID_TOKEN",
    });
  }
}

/**
 * Middleware: Check if authenticated user has one of allowed roles
 * @param {string|string[]} allowedRoles
 */
function authorizeRole(allowedRoles) {
  const rolesArray = (Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]).map((r) =>
    r.toUpperCase()
  );

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required.",
        code: "UNAUTHENTICATED",
      });
    }

    const userRole = (req.user.role || "").toUpperCase();
    if (!rolesArray.includes(userRole) && userRole !== "ADMIN") {
      return res.status(403).json({
        error: `Access forbidden. Required role: ${rolesArray.join(" or ")}.`,
        code: "FORBIDDEN_ROLE",
      });
    }

    next();
  };
}

module.exports = {
  authenticateJWT,
  authorizeRole,
  JWT_SECRET,
};

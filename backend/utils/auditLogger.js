const { db, db3 } = require("../routes/database/database");

const DEFAULT_ACTION = "AUTH";

const formatAuditTimestamp = (date = new Date()) => {
  const month = date.toLocaleString("en-US", {
    month: "long",
    timeZone: "Asia/Manila",
  });
  const day = date.toLocaleString("en-US", {
    day: "numeric",
    timeZone: "Asia/Manila",
  });
  const year = date.toLocaleString("en-US", {
    year: "numeric",
    timeZone: "Asia/Manila",
  });
  const time = date.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Manila",
  });

  return `${month} ${day}, ${year} ${time}`;
};

const formatRole = (role) => {
  const safeRole = String(role || "unknown").trim();
  if (!safeRole) return "Unknown";

  return safeRole
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const getAuthSeverity = ({ outcome }) => {
  if (outcome === "LOCKED") return "CRITICAL";
  if (outcome === "FAILED") return "WARN";
  if (outcome === "SUCCESS_AFTER_FAILURES") return "WARN";
  return "INFO";
};

const buildAuthAuditMessage = ({
  actorId,
  role,
  outcome,
  reason,
  timestamp = new Date(),
}) => {
  const safeActor = actorId || "unknown";
  const roleLabel = formatRole(role);
  const timeLabel = formatAuditTimestamp(timestamp);
  const reasonText = reason ? ` Reason: ${reason}.` : "";

  if (outcome === "LOCKED") {
    return `${roleLabel} (${safeActor}) was locked from login at ${timeLabel}.${reasonText}`;
  }

  if (outcome === "FAILED") {
    return `${roleLabel} (${safeActor}) failed to login at ${timeLabel}.${reasonText}`;
  }

  if (outcome === "SUCCESS_AFTER_FAILURES") {
    return `${roleLabel} (${safeActor}) successfully login after previous failed attempts at ${timeLabel}.${reasonText}`;
  }

  return `${roleLabel} (${safeActor}) successfully login at ${timeLabel}.${reasonText}`;
};

const insertAuditLog = async ({
  auditDb,
  actorId,
  role,
  action = DEFAULT_ACTION,
  outcome = "SUCCESS",
  reason,
  message,
  severity,
}) => {
  try {
    const finalMessage =
      message ||
      buildAuthAuditMessage({
        actorId,
        role,
        outcome,
        reason,
      });

    await auditDb.query(
      `INSERT INTO audit_logs
        (actor_id, role, action, message, severity)
       VALUES (?, ?, ?, ?, ?)`,
      [
        actorId || "unknown",
        role || "unknown",
        action,
        finalMessage,
        severity || getAuthSeverity({ outcome }),
      ],
    );
  } catch (err) {
    console.error("Audit log insert failed:", err);
  }
};

const insertAuditLogAdmission = (payload) =>
  insertAuditLog({
    ...payload,
    auditDb: db,
  });

const insertAuditLogEnrollment = (payload) =>
  insertAuditLog({
    ...payload,
    auditDb: db3,
  });

module.exports = {
  buildAuthAuditMessage,
  formatAuditTimestamp,
  insertAuditLogAdmission,
  insertAuditLogEnrollment,
};

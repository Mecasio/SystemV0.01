const express = require("express");
const path = require("path");
const fs = require("fs");
const { db, db3 } = require("../database/database");
const { insertAuditLogEnrollment } = require("../../utils/auditLogger");

const router = express.Router();

const formatAuditActorRole = (role) => {
  const safeRole = String(role || "registrar").trim();
  if (!safeRole) return "Registrar";

  return safeRole
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const getAuditActor = (req) => ({
  actorId:
    req.body?.audit_actor_id ||
    req.headers["x-audit-actor-id"] ||
    req.headers["x-employee-id"] ||
    "unknown",
  actorRole:
    req.body?.audit_actor_role ||
    req.headers["x-audit-actor-role"] ||
    "registrar",
});

const insertAccountManagementAuditLog = async ({
  req,
  action,
  message,
  severity = "INFO",
}) => {
  const { actorId, actorRole } = getAuditActor(req);

  await insertAuditLogEnrollment({
    actorId,
    role: actorRole,
    action,
    severity,
    message,
  });
};

const getPageLabel = async (pageId) => {
  try {
    const [rows] = await db3.query(
      "SELECT id, page_description FROM page_table WHERE id = ? LIMIT 1",
      [pageId],
    );
    const page = rows?.[0];
    if (!page) return `Page ${pageId}`;
    return `${page.id} - ${page.page_description}`;
  } catch (err) {
    console.error("Page audit label lookup failed:", err);
    return `Page ${pageId}`;
  }
};

router.post("/api/pages", async (req, res) => {
  const { id, page_description, page_group } = req.body;

  try {
    // Check duplicate ID
    const [exists] = await db3.query("SELECT id FROM page_table WHERE id = ?", [
      id,
    ]);

    if (exists.length > 0) {
      return res.status(400).json({ error: "ID already exists" });
    }

    // Insert page
    await db3.query(
      "INSERT INTO page_table (id, page_description, page_group) VALUES (?, ?, ?)",
      [id, page_description, page_group],
    );

    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);
    await insertAccountManagementAuditLog({
      req,
      action: "PAGE_CREATE",
      message: `${roleLabel} (${actorId}) created page ${id} - ${page_description}.`,
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error adding page:", error);
    res.status(500).json({ error: "Database error" });
  }
});

router.get("/api/pages", async (req, res) => {
  try {
    const [rows] = await db3.query(
      `SELECT * FROM page_table ORDER BY created_at DESC`,
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching pages:", err);
    res.status(500).json({ error: "Database error" });
  }
});

router.put("/api/pages/:id", async (req, res) => {
  const { id } = req.params;
  const { page_description, page_group } = req.body;

  try {
    const [result] = await db3.query(
      `UPDATE page_table SET page_description = ?, page_group = ? WHERE id = ?`,
      [page_description, page_group, id],
    );

    if (result.affectedRows > 0) {
      const { actorId, actorRole } = getAuditActor(req);
      const roleLabel = formatAuditActorRole(actorRole);
      await insertAccountManagementAuditLog({
        req,
        action: "PAGE_UPDATE",
        message: `${roleLabel} (${actorId}) updated page ${id} - ${page_description}.`,
      });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Error updating page:", err);
    res.status(500).json({ error: "Database error" });
  }
});

router.delete("/api/pages/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const pageLabel = await getPageLabel(id);
    const [result] = await db3.query(`DELETE FROM page_table WHERE id = ?`, [id]);
    if (result.affectedRows > 0) {
      const { actorId, actorRole } = getAuditActor(req);
      const roleLabel = formatAuditActorRole(actorRole);
      await insertAccountManagementAuditLog({
        req,
        action: "PAGE_DELETE",
        severity: "WARN",
        message: `${roleLabel} (${actorId}) deleted page ${pageLabel}.`,
      });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting page:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// ✅ Get all access for one user
router.get("/api/page_access/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const [rows] = await db3.query(
      "SELECT * FROM page_access WHERE user_id = ?",
      [userId],
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching access:", err);
    res.status(500).json({ error: "Database error" });
  }
});

router.post("/api/page_access/:userId/:pageId", async (req, res) => {
  const { userId, pageId } = req.params;

  try {
    const [existing] = await db3.query(
      "SELECT id FROM page_access WHERE user_id = ? AND page_id = ? LIMIT 1",
      [userId, pageId],
    );

    if (existing.length > 0) {
      await db3.query(
        `UPDATE page_access
         SET page_privilege = 1, can_create = 1, can_edit = 1, can_delete = 1
         WHERE user_id = ? AND page_id = ?`,
        [userId, pageId],
      );
      const { actorId, actorRole } = getAuditActor(req);
      const roleLabel = formatAuditActorRole(actorRole);
      const pageLabel = await getPageLabel(pageId);
      await insertAccountManagementAuditLog({
        req,
        action: "USER_PAGE_ACCESS_GRANT",
        message: `${roleLabel} (${actorId}) granted page access ${pageLabel} to User (${userId}).`,
      });
      return res.json({ success: true, action: "updated" });
    }

    await db3.query(
      `INSERT INTO page_access (user_id, page_id, page_privilege, can_create, can_edit, can_delete)
       VALUES (?, ?, 1, 1, 1, 1)`,
      [userId, pageId],
    );

    // ✅ If query succeeded (affected rows > 0)
    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);
    const pageLabel = await getPageLabel(pageId);
    await insertAccountManagementAuditLog({
      req,
      action: "USER_PAGE_ACCESS_GRANT",
      message: `${roleLabel} (${actorId}) granted page access ${pageLabel} to User (${userId}).`,
    });

    res.json({ success: true, action: "inserted" });
  } catch (err) {
    console.error("Error inserting access:", err);
    res.status(500).json({ error: "Database error" });
  }
});

router.put("/api/page_access/:userId/:pageId", async (req, res) => {
  const { userId, pageId } = req.params;
  const {
    page_privilege = 0,
    can_create = 0,
    can_edit = 0,
    can_delete = 0,
  } = req.body;

  try {
    const [existing] = await db3.query(
      "SELECT id FROM page_access WHERE user_id = ? AND page_id = ? LIMIT 1",
      [userId, pageId],
    );

    if (existing.length > 0) {
      await db3.query(
        `UPDATE page_access
         SET page_privilege = ?, can_create = ?, can_edit = ?, can_delete = ?
         WHERE user_id = ? AND page_id = ?`,
        [
          Number(page_privilege),
          Number(can_create),
          Number(can_edit),
          Number(can_delete),
          userId,
          pageId,
        ],
      );

      const { actorId, actorRole } = getAuditActor(req);
      const roleLabel = formatAuditActorRole(actorRole);
      const pageLabel = await getPageLabel(pageId);
      await insertAccountManagementAuditLog({
        req,
        action: "USER_PAGE_PERMISSION_UPDATE",
        message: `${roleLabel} (${actorId}) updated page permissions ${pageLabel} for User (${userId}).`,
      });

      return res.json({ success: true, action: "updated" });
    }

    await db3.query(
      `INSERT INTO page_access
       (user_id, page_id, page_privilege, can_create, can_edit, can_delete)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId,
        pageId,
        Number(page_privilege),
        Number(can_create),
        Number(can_edit),
        Number(can_delete),
      ],
    );

    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);
    const pageLabel = await getPageLabel(pageId);
    await insertAccountManagementAuditLog({
      req,
      action: "USER_PAGE_PERMISSION_UPDATE",
      message: `${roleLabel} (${actorId}) updated page permissions ${pageLabel} for User (${userId}).`,
    });

    res.json({ success: true, action: "inserted" });
  } catch (err) {
    console.error("Error updating access:", err);
    res.status(500).json({ error: "Database error" });
  }
});

router.delete("/api/page_access/:userId/:pageId", async (req, res) => {
  const { userId, pageId } = req.params;
  try {
    const pageLabel = await getPageLabel(pageId);
    const [result] = await db3.query(
      "DELETE FROM page_access WHERE user_id = ? AND page_id = ?",
      [userId, pageId],
    );
    if (result.affectedRows > 0) {
      const { actorId, actorRole } = getAuditActor(req);
      const roleLabel = formatAuditActorRole(actorRole);
      await insertAccountManagementAuditLog({
        req,
        action: "USER_PAGE_ACCESS_REVOKE",
        severity: "WARN",
        message: `${roleLabel} (${actorId}) revoked page access ${pageLabel} from User (${userId}).`,
      });
    }
    res.json({ success: true, action: "deleted" });
  } catch (err) {
    console.error("Error deleting access:", err);
    res.status(500).json({ error: "Database error" });
  }
});

router.get("/api/page_access/:userId/:pageId", async (req, res) => {
  const { userId, pageId } = req.params;
  try {
    const [rows] = await db3.query(
      `SELECT
          pa.page_privilege,
          pa.can_create,
          pa.can_edit,
          pa.can_delete,
          at.access_description
       FROM page_access pa
       LEFT JOIN user_accounts ua ON ua.employee_id = pa.user_id
       LEFT JOIN access_table at ON at.access_id = ua.access_level
       WHERE pa.user_id = ? AND pa.page_id = ?`,
      [userId, pageId],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "The user has not been given a privilege to access this page.",
        hasAccess: false,
      });
    }

    res.json(rows[0]);
    console.log(rows[0]);
  } catch (err) {
    console.error("Error checking access:", err);
    res.status(500).json({ error: "Database error" });
  }
});

router.post("/api/page_access/grant-all", async (req, res) => {
  const { userId } = req.body;

  try {
    // get all pages
    const [pages] = await db3.query("SELECT id FROM page_table");

    if (!pages.length) {
      return res.json({ success: true });
    }

    for (const page of pages) {
      const [existing] = await db3.query(
        "SELECT id FROM page_access WHERE user_id = ? AND page_id = ? LIMIT 1",
        [userId, page.id],
      );

      if (existing.length > 0) {
        await db3.query(
          `UPDATE page_access
           SET page_privilege = 1, can_create = 1, can_edit = 1, can_delete = 1
           WHERE user_id = ? AND page_id = ?`,
          [userId, page.id],
        );
      } else {
        await db3.query(
          `INSERT INTO page_access
           (user_id, page_id, page_privilege, can_create, can_edit, can_delete)
           VALUES (?, ?, 1, 1, 1, 1)`,
          [userId, page.id],
        );
      }
    }

    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);
    await insertAccountManagementAuditLog({
      req,
      action: "USER_PAGE_ACCESS_GRANT_ALL",
      message: `${roleLabel} (${actorId}) granted all page access to User (${userId}).`,
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

router.post("/api/page_access/revoke-all", async (req, res) => {
  const { userId } = req.body;

  try {
    await db3.query("DELETE FROM page_access WHERE user_id = ?", [userId]);

    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);
    await insertAccountManagementAuditLog({
      req,
      action: "USER_PAGE_ACCESS_REVOKE_ALL",
      severity: "WARN",
      message: `${roleLabel} (${actorId}) revoked all page access from User (${userId}).`,
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});



router.get("/api/registrars", async (req, res) => {
  try {
    const sql = `
      SELECT
        ua.id,
        ua.employee_id,
        ua.profile_picture,
        ua.first_name,
        ua.middle_name,
        ua.last_name,
        ua.email,
        ua.access_level,
        at.access_description,
        ua.role,
        ua.status,
        d.dprtmnt_name,
        d.dprtmnt_code
      FROM user_accounts ua
      LEFT JOIN access_table at ON ua.access_level = at.access_id
      LEFT JOIN dprtmnt_table d ON ua.dprtmnt_id = d.dprtmnt_id
      WHERE ua.role IN ('registrar', 'admission', 'enrollment', 'clinic', 'superadmin')
      ORDER BY ua.id DESC;
    `;

    const [results] = await db3.query(sql);
    res.json(results);
  } catch (error) {
    console.error(" Server error:", error);
    res.status(500).json({ error: "Server error" });
  }
});


router.put("/update_registrar_status/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const [registrarRows] = await db3.query(
      "SELECT id, employee_id, first_name, middle_name, last_name, email FROM user_accounts WHERE id = ? LIMIT 1",
      [id],
    );
    const [result] = await db3.query("UPDATE user_accounts SET status=? WHERE id=?", [
      Number(status),
      id,
    ]);
    if (result.affectedRows > 0) {
      const { actorId, actorRole } = getAuditActor(req);
      const roleLabel = formatAuditActorRole(actorRole);
      const registrar = registrarRows?.[0] || {};
      const registrarLabel =
        registrar.employee_id ||
        [registrar.last_name, registrar.first_name, registrar.middle_name]
          .filter(Boolean)
          .join(", ") ||
        registrar.email ||
        `id ${id}`;
      await insertAccountManagementAuditLog({
        req,
        action: "REGISTRAR_ACCOUNT_STATUS_UPDATE",
        message: `${roleLabel} (${actorId}) set registrar account ${registrarLabel} to ${Number(status) === 1 ? "Active" : "Inactive"}.`,
      });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

module.exports = router;

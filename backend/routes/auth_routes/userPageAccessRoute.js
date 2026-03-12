const express = require("express");
const path = require("path");
const fs = require("fs");
const { db, db3 } = require("../database/database");

const router = express.Router();

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
    await db3.query(
      `UPDATE page_table SET page_description = ?, page_group = ? WHERE id = ?`,
      [page_description, page_group, id],
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Error updating page:", err);
    res.status(500).json({ error: "Database error" });
  }
});

router.delete("/api/pages/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await db3.query(`DELETE FROM page_table WHERE id = ?`, [id]);
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
      "SELECT * FROM page_access WHERE user_id = ? AND page_id = ?",
      [userId, pageId],
    );

    if (existing.length > 0) {
      // If record already exists, don't insert again
      return res
        .status(400)
        .json({ success: false, message: "Access already exists" });
    }

    const [result] = await db3.query(
      `INSERT INTO page_access (user_id, page_id, page_privilege)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE page_privilege = VALUES(page_privilege)`,
      [userId, pageId],
    );

    // ✅ If query succeeded (affected rows > 0)
    if (result.affectedRows > 0) {
      res.json({ success: true, action: "added" });
    } else {
      res.json({ success: false, action: "no changes" });
    }
  } catch (err) {
    console.error("Error inserting access:", err);
    res.status(500).json({ error: "Database error" });
  }
});

router.delete("/api/page_access/:userId/:pageId", async (req, res) => {
  const { userId, pageId } = req.params;
  try {
    await db3.query(
      "DELETE FROM page_access WHERE user_id = ? AND page_id = ?",
      [userId, pageId],
    );
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
      "SELECT page_privilege FROM page_access WHERE user_id = ? AND page_id = ?",
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

module.exports = router;



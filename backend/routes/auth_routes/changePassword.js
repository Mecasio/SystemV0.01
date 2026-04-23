const express = require("express");
const { db, db3 } = require("../database/database");
const bcrypt = require("bcryptjs");
const router = express.Router();

// Applicant Change Password
router.post("/applicant-change-password", async (req, res) => {
  const { person_id, currentPassword, newPassword } = req.body;

  if (!person_id || !currentPassword || !newPassword) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    // Get user by person_id
    const [rows] = await db.query(
      "SELECT * FROM user_accounts WHERE person_id = ?",
      [person_id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = rows[0];

    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // Password strength validation
    const strong =
      newPassword.length >= 8 &&
      /[a-z]/.test(newPassword) &&
      /[A-Z]/.test(newPassword) &&
      /\d/.test(newPassword) &&
      /[!#$^*@]/.test(newPassword);

    if (!strong) {
      return res.status(400).json({
        message: "New password does not meet complexity requirements",
      });
    }

    // Hash new password
    const hashed = await bcrypt.hash(newPassword, 10);

    // Debug log (optional)
    console.log("Updating password for person_id:", person_id);
    console.log("New password hash:", hashed);

    // Update password in DB
    await db.query(
      "UPDATE user_accounts SET password = ? WHERE person_id = ?",
      [hashed, person_id],
    );

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Password update error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Registrar Change Password
router.post("/registrar-change-password", async (req, res) => {
  const { person_id, currentPassword, newPassword } = req.body;

  if (!person_id || !currentPassword || !newPassword) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    // Get user by person_id
    const [rows] = await db3.query(
      "SELECT * FROM user_accounts WHERE person_id = ?",
      [person_id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = rows[0];

    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // Password strength validation
    const strong =
      newPassword.length >= 8 &&
      /[a-z]/.test(newPassword) &&
      /[A-Z]/.test(newPassword) &&
      /\d/.test(newPassword) &&
      /[!#$^*@]/.test(newPassword);

    if (!strong) {
      return res.status(400).json({
        message: "New password does not meet complexity requirements",
      });
    }

    // Hash new password
    const hashed = await bcrypt.hash(newPassword, 10);

    // Debug log (optional)
    console.log("Updating password for person_id:", person_id);
    console.log("New password hash:", hashed);

    // Update password in DB
    await db3.query(
      "UPDATE user_accounts SET password = ? WHERE person_id = ?",
      [hashed, person_id],
    );

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Password update error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Student Change Password
router.post("/student-change-password", async (req, res) => {
  const { person_id, currentPassword, newPassword } = req.body;

  if (!person_id || !currentPassword || !newPassword) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    // Get user by person_id
    const [rows] = await db3.query(
      "SELECT * FROM user_accounts WHERE person_id = ?",
      [person_id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = rows[0];

    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // Password strength validation
    const strong =
      newPassword.length >= 8 &&
      /[a-z]/.test(newPassword) &&
      /[A-Z]/.test(newPassword) &&
      /\d/.test(newPassword) &&
      /[!#$^*@]/.test(newPassword);

    if (!strong) {
      return res.status(400).json({
        message: "New password does not meet complexity requirements",
      });
    }

    // Hash new password
    const hashed = await bcrypt.hash(newPassword, 10);

    // Debug log (optional)
    console.log("Updating password for person_id:", person_id);
    console.log("New password hash:", hashed);

    // Update password in DB
    await db3.query(
      "UPDATE user_accounts SET password = ? WHERE person_id = ?",
      [hashed, person_id],
    );

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Password update error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Faculty Change Password
router.post("/faculty-change-password", async (req, res) => {
  const { person_id, currentPassword, newPassword } = req.body;

  if (!person_id || !currentPassword || !newPassword) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    // Get user by person_id
    const [rows] = await db3.query(
      "SELECT * FROM prof_table WHERE person_id = ?",
      [person_id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = rows[0];

    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // Password strength validation
    const strong =
      newPassword.length >= 8 &&
      /[a-z]/.test(newPassword) &&
      /[A-Z]/.test(newPassword) &&
      /\d/.test(newPassword) &&
      /[!#$^*@]/.test(newPassword);

    if (!strong) {
      return res.status(400).json({
        message: "New password does not meet complexity requirements",
      });
    }

    // Hash new password
    const hashed = await bcrypt.hash(newPassword, 10);

    // Debug log (optional)
    console.log("Updating password for person_id:", person_id);
    console.log("New password hash:", hashed);

    // Update password in DB
    await db3.query("UPDATE prof_table SET password = ? WHERE person_id = ?", [
      hashed,
      person_id,
    ]);

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Password update error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router
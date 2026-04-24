const express = require("express");
const { db, db3 } = require("../database/database");
const {
  CanCreate,
  CanDelete,
  CanEdit,
} = require("../../middleware/pagePermissions");

const router = express.Router();

// YEAR TABLE (UPDATED!)
router.post("/years", async (req, res) => {
  const { year_description } = req.body;

  if (!year_description) {
    return res.status(400).json({ error: "year_description is required" });
  }

  const query =
    "INSERT INTO year_table (year_description, status) VALUES (?, 0)";

  try {
    const [result] = await db3.query(query, [year_description]);
    res.status(201).json({
      year_id: result.insertId,
      year_description,
      status: 0,
    });
  } catch (err) {
    console.error("Insert error:", err);
    res.status(500).json({
      error: "Insert failed",
      details: err.message,
    });
  }
});

// YEAR LIST (UPDATED!)
router.get("/year_table", async (req, res) => {
  const query = "SELECT * FROM year_table";

  try {
    const [result] = await db3.query(query);
    res.status(200).json(result);
  } catch (err) {
    console.error("Query error:", err);
    res.status(500).json({
      error: "Query failed",
      details: err.message,
    });
  }
});

router.put("/year_table/:id", async (req, res) => {
  const { status } = req.body;
  const { id } = req.params;

  try {
    if (status === 1) {
      // Deactivate all other years first
      const deactivateQuery = "UPDATE year_table SET status = 0";
      await db3.query(deactivateQuery);

      // Activate the selected year
      const activateQuery =
        "UPDATE year_table SET status = 1 WHERE year_id = ?";
      await db3.query(activateQuery, [id]);

      // Activate the selected year's 1st semester school year only
      await db3.query("UPDATE active_school_year_table SET astatus = 0");
      await db3.query(
        "UPDATE active_school_year_table SET astatus = 1 WHERE year_id = ? AND semester_id = 1",
        [id],
      );

      res.status(200).json({ message: "Year status updated successfully" });
    } else {
      // Deactivate the selected year
      const updateQuery = "UPDATE year_table SET status = 0 WHERE year_id = ?";
      await db3.query(updateQuery, [id]);

      // Deactivate all school years for this year
      await db3.query(
        "UPDATE active_school_year_table SET astatus = 0 WHERE year_id = ?",
        [id],
      );

      res.status(200).json({ message: "Year deactivated successfully" });
    }
  } catch (err) {
    console.error("Error updating year status:", err);
    res.status(500).json({
      error: "Failed to update year status",
      details: err.message,
    });
  }
});

router.post("/semesters", async (req, res) => {
  const { semester_description, semester_code } = req.body;

  if (!semester_description || !semester_code) {
    return res.status(400).json({ error: "missing fields is required" });
  }

  const query = "INSERT INTO semester_table (semester_description, semester_code) VALUES (?, ?)";

  try {
    const [result] = await db3.query(query, [semester_description, semester_code]);
    res.status(201).json({
      semester_id: result.insertId,
      semester_description,
      semester_code,
    });
  } catch (err) {
    console.error("Insert error:", err);
    res.status(500).json({ error: "Insert failed", details: err.message });
  }
});

router.put("/semesters/:id", async (req, res) => {
  const { semester_description, semester_code } = req.body;
  const { id } = req.params;

  if (!semester_description || !semester_code) {
    return res.status(400).json({ error: "missing fields is required" });
  }

  const query = `
    UPDATE semester_table
    SET semester_description = ?, semester_code = ?
    WHERE semester_id = ?
  `;

  try {
    const [result] = await db3.query(query, [
      semester_description,
      semester_code,
      id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Semester not found" });
    }

    res.status(200).json({
      message: "Semester updated successfully",
      semester_id: Number(id),
      semester_description,
      semester_code,
    });
  } catch (err) {
    console.error("Update semester error:", err);
    res.status(500).json({ error: "Update failed", details: err.message });
  }
});

router.get("/get_semester", async (req, res) => {
  const query = "SELECT * FROM semester_table";

  try {
    const [result] = await db3.query(query);
    res.status(200).json(result);
  } catch (err) {
    console.error("Query error:", err);
    res.status(500).json({ error: "Query failed", details: err.message });
  }
});

router.delete("/semesters/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db3.query(
      "DELETE FROM semester_table WHERE semester_id = ?",
      [id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Semester not found" });
    }

    res.status(200).json({ message: "Semester deleted successfully" });
  } catch (err) {
    console.error("Delete semester error:", err);
    res.status(500).json({ error: "Delete failed", details: err.message });
  }
});

router.get("/school_years", async (req, res) => {
  const query = `
    SELECT sy.*, yt.year_description, s.semester_description
    FROM active_school_year_table sy
    JOIN year_table yt ON sy.year_id = yt.year_id
    JOIN semester_table s ON sy.semester_id = s.semester_id
    ORDER BY yt.year_description
  `;

  try {
    const [result] = await db3.query(query);
    res.status(200).json(result);
  } catch (err) {
    console.error("Fetch error:", err);
    res
      .status(500)
      .json({ error: "Failed to fetch school years", details: err.message });
  }
});

router.post("/school_years", CanCreate, async (req, res) => {
  const { year_id, semester_id, activator } = req.body;

  if (!year_id || !semester_id) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    // Check if the school year already exists
    const checkQuery = `
      SELECT * FROM active_school_year_table
      WHERE year_id = ? AND semester_id = ?
    `;
    const [existing] = await db3.query(checkQuery, [year_id, semester_id]);

    if (existing.length > 0) {
      return res.status(400).json({ error: "This school year already exists" });
    }

    // Insert if not exists
    const insertQuery = `
      INSERT INTO active_school_year_table (year_id, semester_id, astatus, active)
      VALUES (?, ?, ?, 0)
    `;
    const [result] = await db3.query(insertQuery, [
      year_id,
      semester_id,
      activator,
    ]);

    res.status(201).json({ school_year_id: result.insertId });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({
      error: "Failed to process the school year",
      details: err.message,
    });
  }
});

router.put("/school_years/:id", async (req, res) => {
  const { id } = req.params;
  const { activator } = req.body;

  try {
    const [yearRows] = await db3.query(
      "SELECT year_id FROM active_school_year_table WHERE id = ? LIMIT 1",
      [id],
    );
    const yearId = yearRows[0]?.year_id;

    if (parseInt(activator) === 1) {
      await db3.query("UPDATE active_school_year_table SET astatus = 0");

      // Activate selected
      await db3.query(
        "UPDATE active_school_year_table SET astatus = 1 WHERE id = ?",
        [id],
      );

      if (yearId) {
        await db3.query("UPDATE year_table SET status = 0");
        await db3.query("UPDATE year_table SET status = 1 WHERE year_id = ?", [
          yearId,
        ]);
      }

      return res.status(200).json({ message: "School year activated" });
    } else {
      // Deactivate selected
      await db3.query(
        "UPDATE active_school_year_table SET astatus = 0 WHERE id = ?",
        [id],
      );

      // Unenroll all students tied to the deactivated school year
      await db3.query(
        "UPDATE student_status_table SET enrolled_status = 0 WHERE active_school_year_id = ?",
        [id],
      );

      if (yearId) {
        await db3.query("UPDATE year_table SET status = 0 WHERE year_id = ?", [
          yearId,
        ]);
      }

      return res.status(200).json({ message: "School year deactivated" });
    }
  } catch (err) {
    console.error("Error:", err);
    res
      .status(500)
      .json({ error: "Failed to update school year", details: err.message });
  }
});

router.put("/edit_school_years/:id", CanEdit, async (req, res) => {
  const { id } = req.params;
  const { year_id, semester_id } = req.body;

  if (!year_id || !semester_id) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    const [currentRows] = await db3.query(
      "SELECT * FROM active_school_year_table WHERE id = ? LIMIT 1",
      [id],
    );

    if (currentRows.length === 0) {
      return res.status(404).json({ error: "School year not found" });
    }

    const [existing] = await db3.query(
      `
        SELECT id
        FROM active_school_year_table
        WHERE year_id = ? AND semester_id = ? AND id != ?
      `,
      [year_id, semester_id, id],
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: "This school year already exists" });
    }

    await db3.query(
      `
        UPDATE active_school_year_table
        SET year_id = ?, semester_id = ?
        WHERE id = ?
      `,
      [year_id, semester_id, id],
    );

    res.status(200).json({ message: "School year updated successfully" });
  } catch (err) {
    console.error("Error:", err);
    res
      .status(500)
      .json({ error: "Failed to update school year", details: err.message });
  }
});

router.delete("/school_years/:id", CanDelete, async (req, res) => {
  const { id } = req.params;

  try {
    const deleteQuery = "DELETE FROM active_school_year_table WHERE id = ?";
    const [result] = await db3.query(deleteQuery, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "School year not found" });
    }

    res.status(200).json({ message: "School year deleted successfully" });
  } catch (err) {
    console.error("Error deleting school year:", err);
    res
      .status(500)
      .json({ error: "Failed to delete school year", details: err.message });
  }
});

router.get("/get_school_year", async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT
        year_id,
        year_description AS current_year,
        year_description + 1 AS next_year
      FROM year_table ORDER BY current_year;
    `;
    const [result] = await db3.query(query);
    res.json(result);
  } catch (err) {
    console.error("Server Error: ", err);
    res.status(500).send({ message: "Internal Error", err });
  }
});

router.get("/get_school_semester", async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT
        semester_id,semester_description, semester_code
      FROM semester_table ORDER BY semester_code;
    `;
    const [result] = await db3.query(query);
    res.json(result);
  } catch (err) {
    console.error("Server Error: ", err);
    res.status(500).send({ message: "Internal Error", err });
  }
});

router.get("/active_school_year", async (req, res) => {
  try {
    const query = `
    SELECT
    asyt.id AS school_year_id,
    yt.year_id,
    st.semester_id,
    yt.year_description AS current_year,
    yt.year_description + 1 AS next_year,
    st.semester_description
  FROM active_school_year_table AS asyt
    INNER JOIN year_table AS yt ON asyt.year_id = yt.year_id
    INNER JOIN semester_table AS st ON asyt.semester_id = st.semester_id
  WHERE asyt.astatus = 1
    `;
    const [result] = await db3.query(query);
    res.json(result);
    console.log(result);
  } catch (err) {
    console.error("Server Error: ", err);
    res.status(500).send({ message: "Internal Error", err });
  }
});

router.get("/get_selecterd_year/:selectedSchoolYear/:selectedSchoolSemester", async (req, res) => {
    const { selectedSchoolYear, selectedSchoolSemester } = req.params;
    try {
      const query = `
    SELECT
    asyt.id AS school_year_id
  FROM active_school_year_table AS asyt
    INNER JOIN year_table AS yt ON asyt.year_id = yt.year_id
    INNER JOIN semester_table AS st ON asyt.semester_id = st.semester_id
  WHERE yt.year_id = ? AND st.semester_id = ?
    `;
      const [result] = await db3.query(query, [
        selectedSchoolYear,
        selectedSchoolSemester,
      ]);
      console.log(result);
      res.json(result);
    } catch (err) {
      console.error("Server Error: ", err);
      res.status(500).send({ message: "Internal Error", err });
    }
  },
);

router.get("/get_active_school_years", async (req, res) => {
  const query = `
    SELECT sy.*, yt.year_description, s.semester_description
    FROM active_school_year_table sy
    JOIN year_table yt ON sy.year_id = yt.year_id
    JOIN semester_table s ON sy.semester_id = s.semester_id
    WHERE sy.astatus = 1
  `;

  try {
    const [result] = await db3.query(query);
    res.status(200).json(result);
  } catch (err) {
    console.error("Fetch error:", err);
    res
      .status(500)
      .json({ error: "Failed to fetch school years", details: err.message });
  }
});

// GET all school years
router.get("/api/school-years", async (req, res) => {
  try {
    const [rows] = await db3.query(`
      SELECT year_id, year_description, status
      FROM year_table
      ORDER BY year_description DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error("Error fetching school years:", err);
    res.status(500).json({ message: "Failed to fetch school years" });
  }
});



router.get("/api/school_years", async (req, res) => {
  try {
    const [rows] = await db3.query(`
      SELECT
        yt.year_description,
        st.semester_description,
        sy.astatus
      FROM school_year_table sy
      JOIN year_table yt ON sy.year_id = yt.year_id
      JOIN semester_table st ON sy.semester_id = st.semester_id
      ORDER BY yt.year_description DESC, st.semester_id ASC
    `);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching school years:", error);
    res.status(500).json({ message: "Database error" });
  }
});


router.get("/api/year_table", async (req, res) => {
  try {
    const [rows] = await db3.query(
      `SELECT * FROM year_table ORDER BY year_description DESC`,
    );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching year_table:", error);
    res.status(500).json({ message: "Database error" });
  }
});


router.get("/api/semester_table", async (req, res) => {
  try {
    const [rows] = await db3.query(`SELECT * FROM semester_table`);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching semester_table:", error);
    res.status(500).json({ message: "Database error" });
  }
});

module.exports = router

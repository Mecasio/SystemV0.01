const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { db } = require("../database/database");

const router = express.Router();

/* ===================== FILE UPLOAD ===================== */

const allowedExtensions = [".png", ".jpg", ".jpeg", ".pdf"];
const uploadsRoot = path.join(__dirname, "..", "..", "uploads");

const settingsStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadsRoot)) {
      fs.mkdirSync(uploadsRoot, { recursive: true });
    }
    cb(null, uploadsRoot);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (!allowedExtensions.includes(ext)) {
      return cb(
        new Error("Invalid file type. Only PNG, JPG, JPEG, or PDF allowed."),
      );
    }

    if (file.fieldname === "logo") cb(null, "Logo" + ext);
    else if (file.fieldname === "bg_image") cb(null, "Background" + ext);
    else cb(null, Date.now() + ext);
  },
});

const settingsUpload = multer({ storage: settingsStorage });

/* ===================== DELETE OLD FILE ===================== */

const deleteOldFile = (fileUrl) => {
  if (!fileUrl) return;

  const filePath = path.join(__dirname, "..", "..", fileUrl.replace(/^\//, ""));
  fs.unlink(filePath, (err) => {
    if (err) console.error(`Error deleting old file: ${err.message}`);
    else console.log(`Deleted old file: ${filePath}`);
  });
};

/* ===================== GET SETTINGS ===================== */

router.get("/settings", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM company_settings WHERE id = 1",
    );

    if (rows.length === 0) {
      return res.json({
        company_name: "",
        short_term: "",
        address: "",
        header_color: "#ffffff",
        footer_text: "",
        footer_color: "#ffffff",
        logo_url: null,
        bg_image: null,
        main_button_color: "#ffffff",
        sub_button_color: "#ffffff",
        border_color: "#000000",
        stepper_color: "#000000",
        sidebar_button_color: "#000000",
        title_color: "#000000",
        subtitle_color: "#555555",
        branches: [],
      });
    }

    const settings = rows[0];

    if (settings.branches) {
      try {
        settings.branches = JSON.parse(settings.branches);
      } catch (err) {
        settings.branches = [];
      }
    } else {
      settings.branches = [];
    }

    res.json(settings);
  } catch (err) {
    console.error("❌ Error fetching settings:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ===================== SAVE SETTINGS ===================== */

router.post(
  "/settings",
  settingsUpload.fields([
    { name: "logo", maxCount: 1 },
    { name: "bg_image", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const {
        company_name,
        short_term,
        address,
        header_color,
        footer_text,
        footer_color,
        main_button_color,
        sub_button_color,
        border_color,
        stepper_color,
        sidebar_button_color,
        title_color,
        subtitle_color,
        branches,
      } = req.body;

      const logoUrl = req.files?.logo
        ? `/uploads/${req.files.logo[0].filename}`
        : null;

      const bgImageUrl = req.files?.bg_image
        ? `/uploads/${req.files.bg_image[0].filename}`
        : null;

      const [rows] = await db.query(
        "SELECT * FROM company_settings WHERE id = 1",
      );

      let parsedBranches = "[]";
      if (typeof branches !== "undefined") {
        try {
          parsedBranches = Array.isArray(branches)
            ? JSON.stringify(branches)
            : JSON.stringify(JSON.parse(branches));
        } catch (err) {
          parsedBranches = "[]";
        }
      }

      if (rows.length > 0) {
        const currentSettings = rows[0];
        const oldLogo = currentSettings.logo_url;
        const oldBg = currentSettings.bg_image;

        if (typeof branches === "undefined") {
          parsedBranches = currentSettings.branches || "[]";
        }

        let query = `
          UPDATE company_settings
          SET
            company_name=?,
            short_term=?,
            address=?,
            header_color=?,
            footer_text=?,
            footer_color=?,
            main_button_color=?,
            sub_button_color=?,
            border_color=?,
            stepper_color=?,
            sidebar_button_color=?,
            title_color=?,
            subtitle_color=?,
            branches=?`;

        const params = [
          company_name ?? currentSettings.company_name ?? "",
          short_term ?? currentSettings.short_term ?? "",
          address ?? currentSettings.address ?? "",
          header_color ?? currentSettings.header_color ?? "#ffffff",
          footer_text ?? currentSettings.footer_text ?? "",
          footer_color ?? currentSettings.footer_color ?? "#ffffff",
          main_button_color ?? currentSettings.main_button_color ?? "#ffffff",
          sub_button_color ?? currentSettings.sub_button_color ?? "#ffffff",
          border_color ?? currentSettings.border_color ?? "#000000",
          stepper_color ?? currentSettings.stepper_color ?? "#000000",
          sidebar_button_color ??
          currentSettings.sidebar_button_color ??
          "#000000",
          title_color ?? currentSettings.title_color ?? "#000000",
          subtitle_color ?? currentSettings.subtitle_color ?? "#555555",
          parsedBranches,
        ];

        if (logoUrl) {
          query += ", logo_url=?";
          params.push(logoUrl);
        }

        if (bgImageUrl) {
          query += ", bg_image=?";
          params.push(bgImageUrl);
        }

        query += " WHERE id = 1";

        await db.query(query, params);

        if (logoUrl && oldLogo && oldLogo !== logoUrl) deleteOldFile(oldLogo);
        if (bgImageUrl && oldBg && oldBg !== bgImageUrl) deleteOldFile(oldBg);

        return res.json({
          success: true,
          message: "Settings updated successfully.",
        });
      }

      const insertQuery = `
        INSERT INTO company_settings
        (
          company_name, short_term, address, header_color, footer_text, footer_color,
          logo_url, bg_image,
          main_button_color, sub_button_color, border_color, stepper_color, sidebar_button_color,
          title_color, subtitle_color,
          branches
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      await db.query(insertQuery, [
        company_name || "",
        short_term || "",
        address || "",
        header_color || "#ffffff",
        footer_text || "",
        footer_color || "#ffffff",
        logoUrl,
        bgImageUrl,
        main_button_color || "#ffffff",
        sub_button_color || "#ffffff",
        border_color || "#000000",
        stepper_color || "#000000",
        sidebar_button_color || "#000000",
        title_color || "#000000",
        subtitle_color || "#555555",
        parsedBranches,
      ]);

      res.json({ success: true, message: "Settings created successfully." });
    } catch (err) {
      console.error("❌ Error in /api/settings:", err);
      res.status(500).json({ error: err.message });
    }
  },
);

router.get("/branches", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT branches FROM company_settings WHERE id = 1",
    );

    if (rows.length === 0) {
      return res.json([]);
    }

    let branches = [];

    try {
      branches = rows[0].branches ? JSON.parse(rows[0].branches) : [];
    } catch (err) {
      console.error("JSON PARSE ERROR:", err);
      branches = [];
    }

    // ✅ ensure ALL branches have academicPrograms
    branches = branches.map((b) => ({
      ...b,
      academicPrograms: b.academicPrograms || [
        { id: 0, name: "Undergraduate", open: 1 },
        { id: 1, name: "Graduate", open: 0 },
        { id: 2, name: "Techvoc", open: 0 },
      ],
    }));

    res.json(branches);
  } catch (err) {
    console.error("GET ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

router.post("/branches", async (req, res) => {
  const { branch, address } = req.body;

  if (!branch || !address) {
    return res.status(400).json({ message: "Branch and address required" });
  }

  try {
    const [rows] = await db.query(
      "SELECT branches FROM company_settings WHERE id = 1",
    );

    let branches = [];

    if (rows.length > 0 && rows[0].branches) {
      branches = JSON.parse(rows[0].branches);
    }

    const maxId =
      branches.length > 0 ? Math.max(...branches.map((b) => Number(b.id))) : 0;

    const newBranch = {
      id: maxId + 1,
      branch,
      address,
      registration_open: 0,
      start_date: null,
      end_date: null,

      start_time: null,
      end_time: null,


      // ✅ INCLUDED
      academicPrograms: [
        { id: 0, name: "Undergraduate", open: 1 },
        { id: 1, name: "Graduate", open: 0 },
        { id: 2, name: "Techvoc", open: 0 },
      ]
    };

    branches.push(newBranch);

    if (rows.length === 0) {
      await db.query(
        "INSERT INTO company_settings (id, branches) VALUES (1, ?)",
        [JSON.stringify(branches)],
      );
    } else {
      await db.query("UPDATE company_settings SET branches = ? WHERE id = 1", [
        JSON.stringify(branches),
      ]);
    }

    res.json({ success: true, message: "Branch added", data: newBranch });
  } catch (err) {
    console.error("ADD ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

router.put("/branches/:id", async (req, res) => {
  const { id } = req.params;
  const {
    branch,
    address,
    registration_open,
    start_date,
    end_date,
    start_time,
    end_time,
    academicPrograms
  } = req.body;

  try {
    const [rows] = await db.query(
      "SELECT branches FROM company_settings WHERE id = 1",
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "No settings found" });
    }

    let branches = JSON.parse(rows[0].branches || "[]");

    let found = false;

    if (start_date && end_date) {
      const start = new Date(start_date);
      const end = new Date(end_date);

      if (start > end) {
        return res.status(400).json({
          message: "Start date cannot be later than end date",
        });
      }
    }

    branches = branches.map((b) => {
      if (b.id == id) {
        found = true;

        return {
          ...b,

          branch:
            typeof branch !== "undefined"
              ? branch
              : b.branch,

          address:
            typeof address !== "undefined"
              ? address
              : b.address,

          registration_open:
            typeof registration_open !== "undefined"
              ? registration_open
              : b.registration_open,

          start_date:
            typeof start_date !== "undefined"
              ? start_date || null
              : b.start_date,

          end_date:
            typeof end_date !== "undefined"
              ? end_date || null
              : b.end_date,

          start_time:
            typeof start_time !== "undefined"
              ? start_time || null
              : b.start_time,

          end_time:
            typeof end_time !== "undefined"
              ? end_time || null
              : b.end_time,

          academicPrograms:
            academicPrograms ?? b.academicPrograms
        };
      }

      return b;
    });


    if (!found) {
      return res.status(404).json({ message: "Branch not found" });
    }

    await db.query("UPDATE company_settings SET branches = ? WHERE id = 1", [
      JSON.stringify(branches),
    ]);

    res.json({ success: true, message: "Updated successfully" });
  } catch (err) {
    console.error("UPDATE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

router.delete("/branches/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.query(
      "SELECT branches FROM company_settings WHERE id = 1",
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "No settings found" });
    }

    let branches = JSON.parse(rows[0].branches || "[]");

    branches = branches.filter((b) => b.id != id);

    await db.query("UPDATE company_settings SET branches = ? WHERE id = 1", [
      JSON.stringify(branches),
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

router.get("/registration-status/:branch_id", async (req, res) => {
  const { branch_id } = req.params;

  try {
    const [rows] = await db.query(
      "SELECT branches FROM company_settings WHERE id = 1"
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "No settings found"
      });
    }

    let branches = JSON.parse(rows[0].branches || "[]");

    const now = new Date(
      new Date().toLocaleString("en-US", {
        timeZone: "Asia/Manila"
      })
    );

    let updated = false;

    const combineDateTime = (dateStr, timeStr) => {
      if (!dateStr || !timeStr) return null;

      return new Date(
        `${dateStr}T${timeStr}:00`
      );
    };

    const updatedBranches = branches.map((b) => {

      if (b.id == branch_id) {

        const start = combineDateTime(
          b.start_date,
          b.start_time
        );

        const end = combineDateTime(
          b.end_date,
          b.end_time
        );

        let isOpen = false;

        if (start && end) {

          if (now >= start && now <= end) {
            isOpen = true;
          }

          if (now > end) {
            updated = true;
            isOpen = false;
          }

        }

        return {
          ...b,
          registration_open: isOpen ? 1 : 0
        };

      }

      return b;

    });

    if (updated) {

      await db.query(
        "UPDATE company_settings SET branches = ? WHERE id = 1",
        [JSON.stringify(updatedBranches)]
      );

    }

    const branch = updatedBranches.find(
      (b) => b.id == branch_id
    );

    res.json({
      registration_open:
        branch?.registration_open || 0
    });

  } catch (err) {

    console.error("STATUS ERROR:", err);

    res.status(500).json({
      message: err.message
    });

  }
});


module.exports = router;

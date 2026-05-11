const express = require("express");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const puppeteer = require("puppeteer");
const { db, db3 } = require("../database/database");

const router = express.Router();
const exportJobs = new Map();
const exportDir = path.join(os.tmpdir(), "earist-cor-exports");

if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = crcTable[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const dosDateTime = (date = new Date()) => {
  const time =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(date.getSeconds() / 2);
  const dosDate =
    ((date.getFullYear() - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate();
  return { time, date: dosDate };
};

const createZipBuffer = (files) => {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const stamp = dosDateTime();

  files.forEach((file) => {
    const name = Buffer.from(file.name, "utf8");
    const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data);
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(stamp.time, 12);
    central.writeUInt16LE(stamp.date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);

    offset += local.length + name.length + data.length;
  });

  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, end]);
};

const sanitizeFileName = (value) =>
  String(value || "cor")
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim() || "cor";

const getFrontendOrigin = (req) =>
  req.body.frontend_origin ||
  req.headers.origin ||
  process.env.FRONTEND_URL ||
  "http://localhost:5173";

const getBrowserExecutablePath = () => {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate));
};

const updateJob = (job, patch) => {
  Object.assign(job, patch, { updated_at: new Date().toISOString() });
};

const runCorExportJob = async (job) => {
  let browser;
  const files = [];

  try {
    updateJob(job, { status: "running", message: "Launching browser..." });
    const executablePath = getBrowserExecutablePath();
    browser = await puppeteer.launch({
      headless: "new",
      ...(executablePath ? { executablePath } : {}),
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 1 });

    for (let i = 0; i < job.students.length; i += 1) {
      const student = job.students[i];
      const studentNumber = student.student_number;
      updateJob(job, {
        current: i,
        progress: Math.round((i / job.total) * 100),
        message: `Rendering COR ${i + 1}/${job.total}: ${studentNumber}`,
      });

      const url = new URL("/cor_export_render", job.frontend_origin);
      url.searchParams.set("student_number", studentNumber);
      url.searchParams.set("job_id", job.id);
      if (student.person_id) url.searchParams.set("person_id", student.person_id);

      await page.goto(url.toString(), {
        waitUntil: "networkidle0",
        timeout: 90000,
      });
      await page.waitForFunction(
        (expectedStudentNumber) => {
          const root = document.getElementById("server-cor-export");
          if (!root) return false;

          const filledInputs = Array.from(
            root.querySelectorAll("input, textarea, select"),
          ).filter((element) =>
            String(element.value || element.getAttribute("value") || "").trim(),
          );
          const filledValues = filledInputs.map((element) =>
            String(element.value || element.getAttribute("value") || "").trim(),
          );
          const hasStudentNumber = filledValues.some(
            (value) => value === expectedStudentNumber,
          );

          return (
            window.__COR_READY === true &&
            window.__COR_FIT_COMPLETE === true &&
            window.__COR_FITS_A4 === true &&
            (hasStudentNumber || filledInputs.length >= 5)
          );
        },
        { timeout: 90000 },
        studentNumber,
      );
      await page.evaluate(() => {
        const pageRoot = document.getElementById("server-cor-export");
        const content = pageRoot?.firstElementChild?.tagName === "STYLE"
          ? pageRoot.children[1]
          : pageRoot?.firstElementChild;
        if (!pageRoot || !content) return;

        const getScale = () => {
          const transform = window.getComputedStyle(content).transform;
          if (!transform || transform === "none") return 1;
          const match = transform.match(/matrix\(([^,]+)/);
          return match ? Number(match[1]) || 1 : 1;
        };

        const pageRect = pageRoot.getBoundingClientRect();
        const allRects = Array.from(content.querySelectorAll("*")).map((node) =>
          node.getBoundingClientRect(),
        );
        const maxRight = Math.max(
          content.getBoundingClientRect().right,
          ...allRects.map((rect) => rect.right),
        );
        const maxBottom = Math.max(
          content.getBoundingClientRect().bottom,
          ...allRects.map((rect) => rect.bottom),
        );
        const overflowX = Math.max(1, maxRight - pageRect.left);
        const overflowY = Math.max(1, maxBottom - pageRect.top);
        const currentScale = getScale();
        const correction = Math.min(
          1,
          (pageRect.width - 12) / overflowX,
          (pageRect.height - 18) / overflowY,
        );

        if (correction < 1) {
          const nextScale = Math.max(0.1, currentScale * correction);
          content.style.transform = `scale(${nextScale})`;
          window.__COR_SCALE = nextScale;
        }
      });
      await page.waitForFunction(
        () => {
          const pageRoot = document.getElementById("server-cor-export");
          const content = pageRoot?.firstElementChild?.tagName === "STYLE"
            ? pageRoot.children[1]
            : pageRoot?.firstElementChild;
          if (!pageRoot || !content) return false;

          const pageRect = pageRoot.getBoundingClientRect();
          const allRects = Array.from(content.querySelectorAll("*")).map((node) =>
            node.getBoundingClientRect(),
          );
          const maxBottom = Math.max(
            content.getBoundingClientRect().bottom,
            ...allRects.map((rect) => rect.bottom),
          );

          return maxBottom <= pageRect.bottom - 2;
        },
        { timeout: 5000 },
      );
      await page.addStyleTag({
        content:
          "@page { size: A4; margin: 0; } html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }",
      });

      const pdf = await page.pdf({
        width: "210mm",
        height: "297mm",
        printBackground: true,
        displayHeaderFooter: false,
        preferCSSPageSize: true,
        margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
      });

      files.push({
        name: `${sanitizeFileName(studentNumber)}_Certificate_Of_Registration.pdf`,
        data: Buffer.from(pdf),
      });

      updateJob(job, {
        current: i + 1,
        progress: Math.round(((i + 1) / job.total) * 95),
        message: `Generated ${i + 1}/${job.total}`,
      });
    }

    updateJob(job, { message: "Creating ZIP file...", progress: 98 });
    const zip = createZipBuffer(files);
    fs.writeFileSync(job.file_path, zip);
    updateJob(job, {
      status: "done",
      progress: 100,
      current: job.total,
      message: "Ready to download",
    });
  } catch (error) {
    console.error("Server COR export failed:", error);
    updateJob(job, {
      status: "error",
      error: error.message || "Server COR export failed",
      message: "Export failed",
    });
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
};

router.get("/get_student_number", async (req, res) => {
  try {
    const [rows] = await db3.query(`
        SELECT DISTINCT
            sts.student_number,
            pt.person_id,
            sts.year_level_id,
            pt.campus,
            ct.curriculum_id,
            sy.id AS active_school_year_id,
            sy.year_id,
            sy.semester_id
        FROM student_status_table sts
            JOIN student_numbering_table snt ON sts.student_number = snt.student_number
            JOIN person_table pt ON snt.person_id = pt.person_id
            JOIN curriculum_table ct ON sts.active_curriculum = ct.curriculum_id
            JOIN dprtmnt_curriculum_table dct ON ct.curriculum_id = dct.curriculum_id
            JOIN dprtmnt_table dt ON dct.dprtmnt_id = dt.dprtmnt_id
            JOIN active_school_year_table sy ON sts.active_school_year_id = sy.id
        WHERE enrolled_status = 1;
    `);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while fetching data" });
  }
});

router.post("/api/cor-export/jobs", async (req, res) => {
  const students = Array.isArray(req.body.students) ? req.body.students : [];
  const filteredStudents = students
    .filter((student) => student?.student_number)
    .map((student) => ({
      student_number: String(student.student_number),
      person_id: student.person_id ? String(student.person_id) : "",
      preload: student.preload || null,
    }));

  if (filteredStudents.length === 0) {
    return res.status(400).json({ message: "No students selected for export" });
  }

  const id = crypto.randomUUID();
  const fileName = `${sanitizeFileName(req.body.file_name || `cor_export_${id}`)}.zip`;
  const job = {
    id,
    status: "queued",
    total: filteredStudents.length,
    current: 0,
    progress: 0,
    message: "Queued",
    error: "",
    file_name: fileName,
    file_path: path.join(exportDir, fileName),
    frontend_origin: getFrontendOrigin(req),
    students: filteredStudents,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  exportJobs.set(id, job);
  setImmediate(() => runCorExportJob(job));

  res.status(202).json({ job_id: id });
});

router.get("/api/cor-export/jobs/:jobId", (req, res) => {
  const job = exportJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ message: "Export job not found" });

  res.json({
    job_id: job.id,
    status: job.status,
    total: job.total,
    current: job.current,
    progress: job.progress,
    message: job.message,
    error: job.error,
    file_name: job.file_name,
  });
});

router.get("/api/cor-export/jobs/:jobId/preload/:studentNumber", (req, res) => {
  const job = exportJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ message: "Export job not found" });

  const student = job.students.find(
    (item) => item.student_number === req.params.studentNumber,
  );
  if (!student) return res.status(404).json({ message: "Student not found" });

  res.json({ preload: student.preload || null });
});

router.get("/api/cor-export/jobs/:jobId/download", (req, res) => {
  const job = exportJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ message: "Export job not found" });
  if (job.status !== "done" || !fs.existsSync(job.file_path)) {
    return res.status(409).json({ message: "Export job is not ready" });
  }

  res.download(job.file_path, job.file_name);
});

module.exports = router;

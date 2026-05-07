const express = require("express");
const crypto = require("crypto");
const { db, db3 } = require("../database/database");

const router = express.Router();

const parsePositiveInt = (value, fallback, max) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

router.get("/api/audit-logs", async (req, res) => {
  const page = parsePositiveInt(req.query.page, 1, 100000);
  const limit = parsePositiveInt(req.query.limit, 100, 500);
  const offset = (page - 1) * limit;
  const sourceLimit = offset + limit;
  const search = String(req.query.search || "").trim();
  const severity = String(req.query.severity || "").trim();

  const buildWhere = () => {
    const clauses = [];
    const params = [];

    if (search) {
      clauses.push(
        "(actor_id LIKE ? OR role LIKE ? OR action LIKE ? OR message LIKE ?)",
      );
      const searchValue = `%${search}%`;
      params.push(searchValue, searchValue, searchValue, searchValue);
    }

    if (severity) {
      clauses.push("severity = ?");
      params.push(severity);
    }

    return {
      sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
      params,
    };
  };

  try {
    const queries = [];
    const countQueries = [];

    [
      { connection: db, sourceKey: "admission" },
      { connection: db3, sourceKey: "enrollment" },
    ].forEach(({ connection, sourceKey }) => {
      const where = buildWhere();
      queries.push(
        connection.query(
          `
          SELECT
            audit_id,
            actor_id AS email,
            message,
            severity,
            timestamp,
            ? AS source_key
          FROM audit_logs
          ${where.sql}
          ORDER BY timestamp DESC, audit_id DESC
          LIMIT ?
          `,
          [sourceKey, ...where.params, sourceLimit],
        ),
      );
      countQueries.push(
        connection.query(
          `SELECT COUNT(*) AS total FROM audit_logs ${where.sql}`,
          where.params,
        ),
      );
    });

    const [queryResults, countResults] = await Promise.all([
      Promise.all(queries),
      Promise.all(countQueries),
    ]);
    const mergedRows = queryResults
      .flatMap(([rows]) => rows)
      .sort((a, b) => {
        const timeDiff = new Date(b.timestamp) - new Date(a.timestamp);
        if (timeDiff !== 0) return timeDiff;
        return Number(b.audit_id || 0) - Number(a.audit_id || 0);
      });

    const total = countResults.reduce(
      (sum, [rows]) => sum + Number(rows?.[0]?.total || 0),
      0,
    );
    const data = mergedRows.slice(offset, offset + limit).map((row) => ({
      log_key: crypto
        .createHash("sha256")
        .update(`${row.source_key}:${row.audit_id}:${row.timestamp}`)
        .digest("hex"),
      email: row.email,
      message: row.message,
      severity: row.severity,
      timestamp: row.timestamp,
    }));

    res.json({
      success: true,
      data,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: offset + data.length < total,
    });
  } catch (error) {
    console.error("Audit logs fetch error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch audit logs",
    });
  }
});

module.exports = router;

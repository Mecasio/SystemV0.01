const express = require('express');
const { db3 } = require('../database/database');
const { insertAuditLogEnrollment } = require('../../utils/auditLogger');

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

const insertReceiptCounterAuditLog = async ({ req, action, message }) => {
    const { actorId, actorRole } = getAuditActor(req);

    await insertAuditLogEnrollment({
        actorId,
        role: actorRole,
        action,
        severity: "INFO",
        message,
    });
};

const normalizeCounter = (value) => String(value ?? "").trim();
const isDigitsOnly = (value) => /^\d+$/.test(value);
const getFirstFour = (value) => value.slice(0, 4);

router.get('/api/receipt-counter/active/:active_school_year_id', async (req, res) => {
    try {
        const { active_school_year_id } = req.params;

        if (!active_school_year_id) {
            return res.status(400).json({ message: "Active school year is required." });
        }

        const [rows] = await db3.query(
            `SELECT id, counter, employee_id, active_school_year_id
             FROM receipt_counter
             WHERE active_school_year_id = ?`,
            [active_school_year_id]
        );

        return res.json(rows);
    } catch (error) {
        console.error("Error fetching receipt counter assignments:", error);
        return res.status(500).json({ message: "Internal server error." });
    }
});

router.post('/api/receipt-counter/assign', async (req, res) => {
    try {
        const { counter, employee_id, year_id, semester_id } = req.body;
        const normalizedCounter = normalizeCounter(counter);

        if (!normalizedCounter || !employee_id || !year_id || !semester_id) {
            return res.status(400).json({ message: "All fields are required." });
        }
        if (!isDigitsOnly(normalizedCounter)) {
            return res.status(400).json({ message: "Receipt counter must contain digits only." });
        }
        if (normalizedCounter.length < 4) {
            return res.status(400).json({ message: "Receipt counter must be at least 4 digits." });
        }

        const [activeSchoolYearRows] = await db3.query(
            `SELECT id
             FROM active_school_year_table
             WHERE year_id = ? AND semester_id = ?
             LIMIT 1`,
            [year_id, semester_id]
        );

        if (!activeSchoolYearRows.length) {
            return res.status(404).json({ message: "Selected school year and semester not found." });
        }

        const activeSchoolYearId = activeSchoolYearRows[0].id;

        const [existingAssignment] = await db3.query(
            `SELECT id FROM receipt_counter
             WHERE employee_id = ? AND active_school_year_id = ?
             LIMIT 1`,
            [employee_id, activeSchoolYearId]
        );

        if (existingAssignment.length) {
            return res.status(409).json({ message: "Employee is already assigned a receipt counter for this active school year." });
        }

        const [existingCounter] = await db3.query(
            `SELECT id FROM receipt_counter
             WHERE counter = ? AND active_school_year_id = ?
             LIMIT 1`,
            [normalizedCounter, activeSchoolYearId]
        );

        if (existingCounter.length) {
            return res.status(409).json({ message: "Counter is already assigned for this active school year." });
        }

        const firstFour = getFirstFour(normalizedCounter);
        const [existingPrefix] = await db3.query(
            `SELECT id
             FROM receipt_counter
             WHERE LEFT(counter, 4) = ? AND active_school_year_id = ?
             LIMIT 1`,
            [firstFour, activeSchoolYearId]
        );

        if (existingPrefix.length) {
            return res.status(409).json({ message: "The first 4 digits are already assigned to another employee for this active school year." });
        }

        const [insertResult] = await db3.query(
            `INSERT INTO receipt_counter(counter, employee_id, active_school_year_id)
             VALUES (?, ?, ?)`,
            [normalizedCounter, employee_id, activeSchoolYearId]
        );

        const { actorId, actorRole } = getAuditActor(req);
        const roleLabel = formatAuditActorRole(actorRole);
        await insertReceiptCounterAuditLog({
            req,
            action: "RECEIPT_COUNTER_ASSIGN",
            message: `${roleLabel} (${actorId}) assigned receipt counter ${normalizedCounter} to Employee (${employee_id}). Assignment ID: ${insertResult.insertId}.`,
        });

        return res.status(201).json({ message: "Receipt counter assigned successfully." });
    } catch (error) {
        console.error("Error assigning receipt counter:", error);
        return res.status(500).json({ message: "Internal server error." });
    }
});

router.put('/api/receipt-counter/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { counter } = req.body;
        const normalizedCounter = normalizeCounter(counter);

        if (!id || !normalizedCounter) {
            return res.status(400).json({ message: "Assignment id and counter are required." });
        }
        if (!isDigitsOnly(normalizedCounter)) {
            return res.status(400).json({ message: "Receipt counter must contain digits only." });
        }
        if (normalizedCounter.length < 4) {
            return res.status(400).json({ message: "Receipt counter must be at least 4 digits." });
        }

        const [assignmentRows] = await db3.query(
            `SELECT active_school_year_id, employee_id, counter
             FROM receipt_counter
             WHERE id = ?
             LIMIT 1`,
            [id]
        );

        if (!assignmentRows.length) {
            return res.status(404).json({ message: "Assignment not found." });
        }

        const activeSchoolYearId = assignmentRows[0].active_school_year_id;

        const [existingCounter] = await db3.query(
            `SELECT id
             FROM receipt_counter
             WHERE counter = ? AND active_school_year_id = ? AND id <> ?
             LIMIT 1`,
            [normalizedCounter, activeSchoolYearId, id]
        );

        if (existingCounter.length) {
            return res.status(409).json({ message: "Counter is already assigned for this active school year." });
        }

        const firstFour = getFirstFour(normalizedCounter);
        const [existingPrefix] = await db3.query(
            `SELECT id
             FROM receipt_counter
             WHERE LEFT(counter, 4) = ? AND active_school_year_id = ? AND id <> ?
             LIMIT 1`,
            [firstFour, activeSchoolYearId, id]
        );

        if (existingPrefix.length) {
            return res.status(409).json({ message: "The first 4 digits are already assigned to another employee for this active school year." });
        }

        const [result] = await db3.query(
            `UPDATE receipt_counter
             SET counter = ?
             WHERE id = ?`,
            [normalizedCounter, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Assignment not found." });
        }

        const { actorId, actorRole } = getAuditActor(req);
        const roleLabel = formatAuditActorRole(actorRole);
        await insertReceiptCounterAuditLog({
            req,
            action: "RECEIPT_COUNTER_UPDATE",
            message: `${roleLabel} (${actorId}) updated receipt counter assignment ${id} for Employee (${assignmentRows[0].employee_id}) from ${assignmentRows[0].counter} to ${normalizedCounter}.`,
        });

        return res.json({ message: "Receipt counter updated successfully." });
    } catch (error) {
        console.error("Error updating receipt counter:", error);
        return res.status(500).json({ message: "Internal server error." });
    }
});

router.delete('/api/receipt-counter/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ message: "Assignment id is required." });
        }

        const [[assignmentBefore]] = await db3.query(
            `SELECT id, counter, employee_id, active_school_year_id
             FROM receipt_counter
             WHERE id = ?
             LIMIT 1`,
            [id]
        );

        const [result] = await db3.query(
            `DELETE FROM receipt_counter
             WHERE id = ?`,
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Assignment not found." });
        }

        const { actorId, actorRole } = getAuditActor(req);
        const roleLabel = formatAuditActorRole(actorRole);
        await insertReceiptCounterAuditLog({
            req,
            action: "RECEIPT_COUNTER_DEASSIGN",
            message: `${roleLabel} (${actorId}) deassigned receipt counter ${assignmentBefore?.counter || "N/A"} from Employee (${assignmentBefore?.employee_id || "unknown"}).`,
        });

        return res.json({ message: "Receipt counter deassigned successfully." });
    } catch (error) {
        console.error("Error deassigning receipt counter:", error);
        return res.status(500).json({ message: "Internal server error." });
    }
});

module.exports = router;

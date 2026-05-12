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

let receiptCounterColumnsReady = false;

const ensureReceiptCounterAuditColumns = async () => {
    if (receiptCounterColumnsReady) return;

    await db3.query(`
        ALTER TABLE receipt_counter
            ADD COLUMN IF NOT EXISTS last_issued_transaction_id int(11) DEFAULT NULL AFTER counter,
            ADD COLUMN IF NOT EXISTS updated_at timestamp NULL DEFAULT NULL ON UPDATE current_timestamp() AFTER created_at
    `);

    receiptCounterColumnsReady = true;
};

const normalizeCounter = (value) => String(value ?? "").trim();
const isDigitsOnly = (value) => /^\d+$/.test(value);
const getFirstFour = (value) => value.slice(0, 4);

const formatEmployeeName = (row = {}) => {
    const lastName = row.last_name || row.lname || "";
    const firstName = row.first_name || row.fname || "";
    const middleName = row.middle_name || row.mname || "";
    const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ").trim();
    return fullName || "Unknown Employee";
};

const formatSchoolYear = (row = {}) => {
    if (row.current_year && row.next_year && row.semester_description) {
        return `${row.current_year}-${row.next_year}, ${row.semester_description}`;
    }

    return row.active_school_year_id || "N/A";
};

const getEmployeeAuditDetails = async (employeeId) => {
    const [[employee]] = await db3.query(
        `SELECT employee_id, first_name, middle_name, last_name
         FROM user_accounts
         WHERE employee_id = ?
         LIMIT 1`,
        [employeeId]
    );

    return employee || { employee_id: employeeId };
};

const getActiveSchoolYearAuditDetails = async (activeSchoolYearId) => {
    const [[row]] = await db3.query(
        `SELECT
            asyt.id AS active_school_year_id,
            yt.year_description AS current_year,
            yt.year_description + 1 AS next_year,
            st.semester_description
         FROM active_school_year_table AS asyt
         LEFT JOIN year_table AS yt ON asyt.year_id = yt.year_id
         LEFT JOIN semester_table AS st ON asyt.semester_id = st.semester_id
         WHERE asyt.id = ?
         LIMIT 1`,
        [activeSchoolYearId]
    );

    return row || { active_school_year_id: activeSchoolYearId };
};

router.get('/api/receipt-counter/active/:active_school_year_id', async (req, res) => {
    try {
        await ensureReceiptCounterAuditColumns();
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
        await ensureReceiptCounterAuditColumns();
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
            `SELECT
                asyt.id,
                yt.year_description AS current_year,
                yt.year_description + 1 AS next_year,
                st.semester_description
             FROM active_school_year_table AS asyt
             LEFT JOIN year_table AS yt ON asyt.year_id = yt.year_id
             LEFT JOIN semester_table AS st ON asyt.semester_id = st.semester_id
             WHERE asyt.year_id = ? AND asyt.semester_id = ?
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
        const employeeDetails = await getEmployeeAuditDetails(employee_id);
        await insertReceiptCounterAuditLog({
            req,
            action: "RECEIPT_COUNTER_ASSIGN",
            message: `${roleLabel} (${actorId}) assigned receipt counter ${normalizedCounter} to ${formatEmployeeName(employeeDetails)} (${employee_id}) for ${formatSchoolYear(activeSchoolYearRows[0])}. Assignment ID: ${insertResult.insertId}.`,
        });

        return res.status(201).json({ message: "Receipt counter assigned successfully." });
    } catch (error) {
        console.error("Error assigning receipt counter:", error);
        return res.status(500).json({ message: "Internal server error." });
    }
});

router.put('/api/receipt-counter/:id', async (req, res) => {
    try {
        await ensureReceiptCounterAuditColumns();
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
            `SELECT active_school_year_id, employee_id, counter, last_issued_transaction_id
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
        const employeeDetails = await getEmployeeAuditDetails(assignmentRows[0].employee_id);
        const schoolYearDetails = await getActiveSchoolYearAuditDetails(activeSchoolYearId);
        await insertReceiptCounterAuditLog({
            req,
            action: "RECEIPT_COUNTER_UPDATE",
            message: `${roleLabel} (${actorId}) updated receipt counter assignment ${id} for ${formatEmployeeName(employeeDetails)} (${assignmentRows[0].employee_id}) in ${formatSchoolYear(schoolYearDetails)} from ${assignmentRows[0].counter} to ${normalizedCounter}. Last issued receipt: ${assignmentRows[0].last_issued_transaction_id || "None"}.`,
        });

        return res.json({ message: "Receipt counter updated successfully." });
    } catch (error) {
        console.error("Error updating receipt counter:", error);
        return res.status(500).json({ message: "Internal server error." });
    }
});

router.delete('/api/receipt-counter/:id', async (req, res) => {
    try {
        await ensureReceiptCounterAuditColumns();
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ message: "Assignment id is required." });
        }

        const [[assignmentBefore]] = await db3.query(
            `SELECT id, counter, employee_id, active_school_year_id, last_issued_transaction_id
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
        const employeeDetails = assignmentBefore?.employee_id
            ? await getEmployeeAuditDetails(assignmentBefore.employee_id)
            : {};
        const schoolYearDetails = assignmentBefore?.active_school_year_id
            ? await getActiveSchoolYearAuditDetails(assignmentBefore.active_school_year_id)
            : {};
        await insertReceiptCounterAuditLog({
            req,
            action: "RECEIPT_COUNTER_DEASSIGN",
            message: `${roleLabel} (${actorId}) deassigned receipt counter ${assignmentBefore?.counter || "N/A"} from ${formatEmployeeName(employeeDetails)} (${assignmentBefore?.employee_id || "unknown"}) for ${formatSchoolYear(schoolYearDetails)}. Last issued receipt: ${assignmentBefore?.last_issued_transaction_id || "None"}.`,
        });

        return res.json({ message: "Receipt counter deassigned successfully." });
    } catch (error) {
        console.error("Error deassigning receipt counter:", error);
        return res.status(500).json({ message: "Internal server error." });
    }
});

module.exports = router;

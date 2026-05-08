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

const insertMatriculationAuditLog = async ({ req, action, message }) => {
    const { actorId, actorRole } = getAuditActor(req);

    await insertAuditLogEnrollment({
        actorId,
        role: actorRole,
        action,
        severity: "INFO",
        message,
    });
};

router.get('/api/payment_matriculation/transactions', async (req, res) => {
    try {
        const [rows] = await db3.query(
            `SELECT
                tt.id,
                tt.student_number,
                tt.payment,
                tt.employee_id,
                tt.active_school_year_id,
                yt.year_description AS current_year,
                yt.year_description + 1 AS next_year,
                st.semester_description,
                tt.remark,
                tt.created_at
             FROM transaction_table AS tt
             LEFT JOIN active_school_year_table AS sy ON tt.active_school_year_id = sy.id
             LEFT JOIN year_table AS yt ON sy.year_id = yt.year_id
             LEFT JOIN semester_table AS st ON sy.semester_id = st.semester_id
             ORDER BY tt.created_at DESC, tt.id DESC`
        );

        return res.json(rows);
    } catch (error) {
        console.error("Error fetching transaction history:", error);
        return res.status(500).json({ message: "Internal server error." });
    }
});

router.put('/api/payment_matriculation/void/:transaction_id', async (req, res) => {
    try {
        const { transaction_id } = req.params;

        if (!transaction_id) {
            return res.status(400).json({ message: "Transaction id is required." });
        }

        const [result] = await db3.query(
            `UPDATE transaction_table
             SET remark = ?
             WHERE id = ?`,
            ["Void", transaction_id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Transaction not found." });
        }

        const { actorId, actorRole } = getAuditActor(req);
        const roleLabel = formatAuditActorRole(actorRole);
        await insertMatriculationAuditLog({
            req,
            action: "MATRICULATION_PAYMENT_VOID",
            message: `${roleLabel} (${actorId}) voided matriculation payment transaction ${transaction_id}.`,
        });

        return res.json({ message: "Transaction marked as void." });
    } catch (error) {
        console.error("Error voiding transaction:", error);
        return res.status(500).json({ message: "Internal server error." });
    }
});

router.put('/api/payment_matriculation/remark/:transaction_id', async (req, res) => {
    try {
        const { transaction_id } = req.params;
        const { remark } = req.body;

        if (!transaction_id) {
            return res.status(400).json({ message: "Transaction id is required." });
        }

        if (!remark || String(remark).trim() === "") {
            return res.status(400).json({ message: "Remark is required." });
        }

        const [result] = await db3.query(
            `UPDATE transaction_table
             SET remark = ?
             WHERE id = ?`,
            [String(remark).trim(), transaction_id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Transaction not found." });
        }

        const { actorId, actorRole } = getAuditActor(req);
        const roleLabel = formatAuditActorRole(actorRole);
        await insertMatriculationAuditLog({
            req,
            action: "MATRICULATION_PAYMENT_REMARK",
            message: `${roleLabel} (${actorId}) updated matriculation payment transaction ${transaction_id} remark to ${String(remark).trim()}.`,
        });

        return res.json({ message: "Transaction remark updated successfully." });
    } catch (error) {
        console.error("Error updating transaction remark:", error);
        return res.status(500).json({ message: "Internal server error." });
    }
});

router.put('/api/payment_matriculation/:id', async (req, res) => {
    const connection = await db3.getConnection();
    try {
        const { id } = req.params;
        const { payment, employee_id, balance } = req.body;

        if (!id || payment === undefined || payment === null || payment === "" || !employee_id) {
            return res.status(400).json({ message: "Matriculation id, payment, and employee_id are required." });
        }

        const parsedPayment = Number(payment);
        const parsedBalance = balance === undefined || balance === null || balance === ""
            ? 0
            : Number(balance);0
        const resolvedPaymentStatus = 1;

        if (!Number.isFinite(parsedPayment) || parsedPayment < 0) {
            return res.status(400).json({ message: "Payment must be a valid non-negative number." });
        }

        if (!Number.isFinite(parsedBalance) || parsedBalance < 0) {
            return res.status(400).json({ message: "Balance must be a valid non-negative number." });
        }

        await connection.beginTransaction();

        const [result] = await connection.query(
            `UPDATE matriculation
             SET payment = ?,
                 balance = ?,
                 payment_status = ?
             WHERE id = ?`,
            [parsedPayment, parsedBalance, resolvedPaymentStatus, id]
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Matriculation record not found." });
        }

        const [matriculationRows] = await connection.query(
            `SELECT student_number
             FROM matriculation
             WHERE id = ?
             LIMIT 1`,
            [id]
        );

        if (!matriculationRows.length) {
            await connection.rollback();
            return res.status(404).json({ message: "Matriculation record not found after update." });
        }

        const { student_number } = matriculationRows[0];

        const [activeSchoolYearRows] = await connection.query(
            `SELECT
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
            LIMIT 1`
        );

        if (!activeSchoolYearRows.length) {
            await connection.rollback();
            return res.status(404).json({ message: "No active school year found." });
        }

        const active_school_year_id = activeSchoolYearRows[0].school_year_id;

        const [counterRows] = await connection.query(
            `SELECT counter
             FROM receipt_counter
             WHERE employee_id = ? AND active_school_year_id = ?`,
            [employee_id, active_school_year_id]
        );

        if (!counterRows.length || counterRows[0].counter === null || counterRows[0].counter === undefined) {
            await connection.rollback();
            return res.status(404).json({ message: "Receipt counter not found for this employee and active school year." });
        }

        const counterPrefix = String(counterRows[0].counter).trim();
        const assignedCounter = Number(counterPrefix);

        if (!Number.isFinite(assignedCounter) || !Number.isInteger(assignedCounter) || assignedCounter <= 0) {
            await connection.rollback();
            return res.status(400).json({ message: "Invalid counter format for transaction id generation." });
        }

        const [maxIdRows] = await connection.query(
            `SELECT MAX(CAST(id AS UNSIGNED)) AS max_id
             FROM transaction_table
             WHERE CAST(id AS CHAR) LIKE CONCAT(?, '%')`,
            [counterPrefix]
        );

        const latestId = Number(maxIdRows[0]?.max_id || 0);
        // Use the assigned counter as source of truth, but self-heal if table already has a higher id.
        const nextTransactionId = latestId > 0 ? Math.max(assignedCounter, latestId + 1) : assignedCounter;

        await connection.query(
            `INSERT INTO transaction_table (id, student_number, payment, employee_id, active_school_year_id, remark)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                nextTransactionId,
                student_number,
                parsedPayment,
                employee_id,
                active_school_year_id,
                "Matriculation payment",
            ]
        );

        await connection.query(
            `UPDATE receipt_counter
             SET counter = ?
             WHERE employee_id = ? AND active_school_year_id = ?`,
            [nextTransactionId + 1, employee_id, active_school_year_id]
        );

        await connection.commit();
        const { actorId, actorRole } = getAuditActor(req);
        const roleLabel = formatAuditActorRole(actorRole);
        await insertMatriculationAuditLog({
            req,
            action: "MATRICULATION_PAYMENT_SAVE",
            message: `${roleLabel} (${actorId}) saved matriculation payment for Student (${student_number}). Payment: ${parsedPayment}. Balance: ${parsedBalance}. Transaction ID: ${nextTransactionId}.`,
        });
        return res.json({
            message: "Matriculation payment updated successfully.",
            transaction_id: nextTransactionId,
            active_school_year_id,
            balance: parsedBalance,
            payment_status: resolvedPaymentStatus,
        });
    } catch (error) {
        await connection.rollback();
        console.error("Error updating matriculation payment:", error);
        return res.status(500).json({ message: "Internal server error." });
    } finally {
        connection.release();
    }
});

module.exports = router;

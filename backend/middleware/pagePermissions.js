const { db3 } = require("../routes/database/database");

const createPermissionMiddleware = (permissionKey, actionLabel) => {
  return async (req, res, next) => {
    const employeeId = req.headers["x-employee-id"];
    const pageId = req.headers["x-page-id"];

    if (!employeeId || !pageId) {
      return res.status(400).json({
        success: false,
        message: "Employee ID and page ID are required",
      });
    }

    try {
      const [rows] = await db3.query(
        `SELECT page_privilege, can_delete, can_edit
         FROM page_access
         WHERE user_id = ? AND page_id = ?
         LIMIT 1`,
        [employeeId, pageId],
      );

      if (rows.length === 0 || Number(rows[0].page_privilege) !== 1) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this page",
        });
      }

      if (Number(rows[0][permissionKey]) !== 1) {
        return res.status(403).json({
          success: false,
          message: `You do not have permission to ${actionLabel}`,
        });
      }

      req.pageAccess = rows[0];
      next();
    } catch (error) {
      console.error(`Permission check failed for ${actionLabel}:`, error);
      res.status(500).json({
        success: false,
        message: "Failed to validate page permissions",
      });
    }
  };
};

const CanDelete = createPermissionMiddleware("can_delete", "delete this item");
const CanEdit = createPermissionMiddleware("can_edit", "edit this item");

module.exports = {
  CanDelete,
  CanEdit,
};

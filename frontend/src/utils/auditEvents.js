import axios from "axios";
import API_BASE_URL from "../apiConfig";

const accessDescriptionExcludedRoles = new Set([
  "student",
  "applicant",
  "faculty",
  "professor",
]);

const getAuditActorRole = () => {
  const role = localStorage.getItem("role") || "";
  const normalizedRole = role.trim().toLowerCase().replace(/[\s_-]+/g, "_");

  if (accessDescriptionExcludedRoles.has(normalizedRole)) {
    return role;
  }

  return localStorage.getItem("access_description") || role || "";
};

const getAuditHeaders = () => {
  const token = localStorage.getItem("token") || "";

  return {
    Authorization: token ? `Bearer ${token}` : "",
    "x-audit-actor-id":
      localStorage.getItem("employee_id") ||
      localStorage.getItem("person_id") ||
      localStorage.getItem("email") ||
      "unknown",
    "x-audit-actor-person-id": localStorage.getItem("person_id") || "",
    "x-audit-actor-email": localStorage.getItem("email") || "",
    "x-audit-actor-role": getAuditActorRole(),
  };
};

export const postAuditEvent = async (eventType, details = {}) => {
  await axios.post(
    `${API_BASE_URL}/api/audit/event`,
    {
      event_type: eventType,
      details,
      actor_person_id: localStorage.getItem("person_id") || "",
      actor_employee_id: localStorage.getItem("employee_id") || "",
    },
    { headers: getAuditHeaders() },
  );
};

import axios from "axios";
import API_BASE_URL from "../apiConfig";

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
    "x-audit-actor-role": localStorage.getItem("role") || "",
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

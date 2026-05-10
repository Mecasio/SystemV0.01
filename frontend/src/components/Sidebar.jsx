import React, { useState, useEffect, useContext } from "react";
import { SettingsContext } from "../App";
import { Link, useNavigate } from "react-router-dom";
import {
  AccountCircle, AdminPanelSettings, Assessment, Assignment, Badge,
  CalendarToday, Campaign, ChangeCircle, Class, CollectionsBookmark,
  DateRange, EditCalendar, EditNote, Email, EventAvailable, EventNote,
  FactCheck, FolderCopy, FormatListNumbered, HealthAndSafety, HelpOutline,
  HistoryEdu, Info, Layers, ListAlt, ListAltOutlined, MedicalServices,
  MeetingRoom, MenuBook, Numbers, PersonAdd, Psychology, School, Score,
  Search, Security, SupervisorAccount, TableChart, Timeline, Apartment,
  Business, LibraryBooks, People, LogoutOutlined, Settings, ExpandMore,
  ExpandLess, Menu,
} from "@mui/icons-material";
import PaymentIcon from "@mui/icons-material/Payment";
import DashboardIcon from "@mui/icons-material/Dashboard";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import LockResetIcon from "@mui/icons-material/LockReset";
import { Avatar, Tooltip, Divider } from "@mui/material";
import axios from "axios";
import EventNoteIcon from "@mui/icons-material/EventNote";
import GradeIcon from "@mui/icons-material/Grade";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import PersonIcon from "@mui/icons-material/Person";
import ListAltIcon from "@mui/icons-material/ListAlt";
import WorkIcon from "@mui/icons-material/Work";
import SchoolIcon from "@mui/icons-material/School";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import API_BASE_URL from "../apiConfig";
import AccessTimeIcon from "@mui/icons-material/AccessTime";

const GLOBAL_PAGE_IDS = [13, 15, 17, 38, 39, 40, 41, 42, 50, 56, 59, 62, 73, 80, 92, 96, 101, 104, 105, 106, 117];
const GLOBAL_ACCESS_THRESHOLD = 10;
const CLASS_ROSTER_DEPT = "/class_roster_enrollment";
const CLASS_ROSTER_GLOBAL = "/class_roster";

/* ─────────────────────────────────────────
   Style builder
───────────────────────────────────────── */
function buildStyles(s = {}, hasDept = true, collapsed = false) {
  const accent = s.main_button_color || "#8b1a1a";
  const border = s.border_color || "#e8e8e8";
  const titleColor = s.title_color || "#111111";
  const subColor = s.subtitle_color || "#cccccc";
  const subBtnColor = s.sub_button_color || "#f5f5f5";
  const headerBg = s.header_color || "#8b1a1a";
  const W = collapsed ? "75px" : "290px";

  return `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap');

.sb-root {
  font-family:'Poppins',sans-serif;
  width:${W}; height:calc(100vh - 64px - 42px);
  background:#fff; display:flex; flex-direction:column;
  border-right:1px solid ${border};
  position:fixed; top:64px; bottom:42px; left:0;
  z-index:100; overflow:hidden;
  transition:width .34s cubic-bezier(.22,1,.36,1);
  will-change:width;
}

/* header */
.sb-header { background: lightgray; flex-shrink:0; }

.sb-topbar {
  display:flex; align-items:center;
  padding:${collapsed ? "13px 0" : "11px 16px"};
  gap:${collapsed ? "0" : "10px"};
  justify-content:${collapsed ? "center" : "flex-start"};
  transition:padding .34s cubic-bezier(.22,1,.36,1), gap .34s cubic-bezier(.22,1,.36,1);
}
.sb-hamburger {
  display:flex; align-items:center; justify-content:center;
  cursor:pointer; color:black; background:transparent; border:none;
  padding:0; flex-shrink:0;
}
.sb-topbar-label {
  flex:1; color:black; font-size:13.5px; font-weight:500;
  white-space:nowrap; overflow:hidden;
  max-width:${collapsed ? "0" : "180px"};
  opacity:${collapsed ? "0" : "1"};
  transform:translateX(${collapsed ? "-6px" : "0"});
  transition:max-width .3s cubic-bezier(.22,1,.36,1), opacity .18s ease, transform .28s ease;
}

/* profile inside header */
.sb-profile {
  display:flex; align-items:center;
  gap:${collapsed ? "0" : "12px"};
  padding:${collapsed ? "8px 0 13px" : "8px 16px 16px"};
  justify-content:${collapsed ? "center" : "flex-start"};
  transition:padding .34s cubic-bezier(.22,1,.36,1), gap .34s cubic-bezier(.22,1,.36,1);
}
.sb-avatar-wrap { position:relative; flex-shrink:0; }
.sb-upload-btn {
  position:absolute; bottom:-3px; right:-3px;
  cursor:pointer; display:flex; align-items:center; justify-content:center;
  background:#fff; border-radius:50%; width:18px; height:18px;
  box-shadow:0 1px 4px rgba(0,0,0,.25);
}
.sb-profile-info {
  overflow:hidden;
  max-width:${collapsed ? "0" : "190px"};
  opacity:${collapsed ? "0" : "1"};
  transform:translateX(${collapsed ? "-6px" : "0"});
  transition:max-width .3s cubic-bezier(.22,1,.36,1), opacity .18s ease, transform .28s ease;
}
.sb-profile-name {
  font-size:14.5px; font-weight:600; color: black;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:175px;
}
.sb-profile-role {
  font-size:11.5px; color:black; margin-top:2px;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:175px;
}
.sb-profile-dept {
  font-size:11px; color:black; margin-top:1px;
  display:${hasDept ? "block" : "none"};
  opacity:${collapsed ? "0" : "1"};
  transition:opacity .18s ease;
}

/* scroll */
.sb-scroll {
  flex:1; overflow-y:auto; overflow-x:hidden;
  padding:${collapsed ? "6px 6px 0" : "6px 10px 0"};
  scrollbar-width:thin; scrollbar-color:${border} transparent;
  transition:padding .34s cubic-bezier(.22,1,.36,1);
}
.sb-scroll::-webkit-scrollbar { width:4px; }
.sb-scroll::-webkit-scrollbar-track { background:transparent; }
.sb-scroll::-webkit-scrollbar-thumb { background:${border}; border-radius:4px; }

/* section label */
.sb-section-label {
  font-size:12px; font-weight:700; text-transform:uppercase;
  letter-spacing:.07em; color:#000; padding:9px 8px 3px;
  white-space:nowrap; overflow:hidden;
  max-width:${collapsed ? "0" : "220px"};
  opacity:${collapsed ? "0" : "1"};
  transform:translateX(${collapsed ? "-6px" : "0"});
  transition:max-width .3s cubic-bezier(.22,1,.36,1), opacity .18s ease, transform .28s ease;
}

/* nav item */
.sb-item {
  display:flex; align-items:center;
  gap:${collapsed ? "0" : "10px"};
  padding:${collapsed ? "6px 0" : "8px 10px"};
  border-radius:8px; cursor:pointer;
  color:#111; font-size:13px; font-weight:400;
  transition:background .18s ease, color .18s ease, padding .34s cubic-bezier(.22,1,.36,1), gap .34s cubic-bezier(.22,1,.36,1);
  text-decoration:none; margin-bottom:2px;
  white-space:nowrap; overflow:hidden; line-height:1.25;
  justify-content:${collapsed ? "center" : "flex-start"};
}
.sb-item .sb-icon {
  display:flex; align-items:center; justify-content:center;
  flex-shrink:0; color:#111;
  min-width:${collapsed ? "auto" : "22px"};
}
.sb-item:hover { background:${accent}; color:#fff; }
.sb-item:hover .sb-icon { color:#fff; }
.sb-item.active { background:${accent}; color:#fff !important; }
.sb-item.active .sb-icon { color:#fff !important; }
.sb-item-label {
  flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis;
  max-width:${collapsed ? "0" : "190px"};
  opacity:${collapsed ? "0" : "1"};
  transform:translateX(${collapsed ? "-6px" : "0"});
  transition:max-width .3s cubic-bezier(.22,1,.36,1), opacity .18s ease, transform .28s ease;
}
.sb-sub-item { padding-left:${collapsed ? "0" : "20px"}; }

/* group button */
.sb-group-btn {
  display:flex; align-items:center;
  gap:${collapsed ? "0" : "10px"};
  width:100%; padding:${collapsed ? "6px 0" : "8px 10px"};
  border-radius:8px; border:none; background:transparent; cursor:pointer;
  color:#111; font-size:13px; font-weight:400;
  font-family:'Poppins',sans-serif;
  transition:background .18s ease, padding .34s cubic-bezier(.22,1,.36,1), gap .34s cubic-bezier(.22,1,.36,1);
  text-align:left; margin-bottom:2px; line-height:1.25;
  justify-content:${collapsed ? "center" : "flex-start"};
}
.sb-group-btn .sb-icon { color:#111; min-width:${collapsed ? "auto" : "22px"}; }
.sb-group-btn:hover { background:${accent}; color:#fff; }
.sb-group-btn:hover .sb-icon { color:#fff; }
.sb-group-btn.open { color:${accent}; background:${subBtnColor}; }
.sb-group-btn.open .sb-icon { color:${accent}; }
.sb-group-label {
  flex:1; overflow:hidden; white-space:nowrap;
  max-width:${collapsed ? "0" : "190px"};
  opacity:${collapsed ? "0" : "1"};
  transform:translateX(${collapsed ? "-6px" : "0"});
  transition:max-width .3s cubic-bezier(.22,1,.36,1), opacity .18s ease, transform .28s ease;
}
.sb-group-chevron {
  flex-shrink:0;
  max-width:${collapsed ? "0" : "24px"};
  opacity:${collapsed ? "0" : ".5"};
  overflow:hidden;
  transition:max-width .3s cubic-bezier(.22,1,.36,1), opacity .18s ease;
}

.sb-divider { height:1px; background:#f0f0f0; margin:6px 0; }

/* footer */
.sb-footer {
  padding:${collapsed ? "8px 6px" : "8px 10px"};
  border-top:1px solid #f0f0f0; flex-shrink:0;
  transition:padding .34s cubic-bezier(.22,1,.36,1);
}
.sb-logout {
  display:flex; align-items:center;
  gap:${collapsed ? "0" : "10px"};
  padding:${collapsed ? "6px 0" : "8px 10px"};
  border-radius:8px; cursor:pointer;
  font-size:13px; font-weight:500; color:#111;
  transition:background .18s ease, padding .34s cubic-bezier(.22,1,.36,1), gap .34s cubic-bezier(.22,1,.36,1);
  justify-content:${collapsed ? "center" : "flex-start"};
}
.sb-logout:hover { background:${accent}; color:#fff; }
.sb-logout-icon { color:#111; display:flex; align-items:center; }
.sb-logout:hover .sb-logout-icon { color:#fff; }
.sb-logout-label {
  overflow:hidden; white-space:nowrap;
  max-width:${collapsed ? "0" : "120px"};
  opacity:${collapsed ? "0" : "1"};
  transform:translateX(${collapsed ? "-6px" : "0"});
  transition:max-width .3s cubic-bezier(.22,1,.36,1), opacity .18s ease, transform .28s ease;
}
  `;
}

const SIDEBAR_ICON_SIZE = 24;

const ICON_CONTAINER_STYLE = {
  width: 34,
  height: 34,
  borderRadius: "10px",
  border: "gray",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all .2s ease",
};

function injectStyles(settings, hasDept, collapsed) {
  let tag = document.getElementById("sb-styles");
  if (!tag) { tag = document.createElement("style"); tag.id = "sb-styles"; document.head.appendChild(tag); }
  tag.textContent = buildStyles(settings, hasDept, collapsed);
}

/* ─────────────────────────────────────────
   Sub-components
───────────────────────────────────────── */
function NavItem({ to, icon: Icon, label, active, onClick, sub = false, collapsed = false }) {
  const cls = ["sb-item", active ? "active" : "", sub ? "sb-sub-item" : ""]
    .filter(Boolean)
    .join(" ");

  const inner = (
    <>
      {Icon && (
        <span
          className="sb-icon"
          style={{
            ...ICON_CONTAINER_STYLE,
            border: active
              ? "1.5px solid white"
              : "1.5px solid rgba(0,0,0,.08)",
          }}
        >
          <Icon sx={{ fontSize: SIDEBAR_ICON_SIZE }} />
        </span>
      )}

      <span className="sb-item-label">{label}</span>
    </>
  );

  const node = onClick ? (
    <div className={cls} onClick={onClick}>
      {inner}
    </div>
  ) : (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  );

  return collapsed ? (
    <Tooltip title={label} placement="right" arrow>
      {node}
    </Tooltip>
  ) : (
    node
  );
}

function GroupToggle({ label, icon: Icon, open, onToggle, collapsed = false }) {
  const btn = (
    <button
      type="button"
      className={`sb-group-btn${open ? " open" : ""}`}
      onClick={onToggle}
    >
      {Icon && (
        <span
          className="sb-icon"
          style={{
            ...ICON_CONTAINER_STYLE,
            border: open
              ? "1.5px solid black"
              : "1.5px solid rgba(0,0,0,.08)",
          }}
        >
          <Icon sx={{ fontSize: SIDEBAR_ICON_SIZE }} />
        </span>
      )}

      <span className="sb-group-label">{label}</span>

      <span className="sb-group-chevron">
        {open ? (
          <ExpandLess sx={{ fontSize: 18 }} />
        ) : (
          <ExpandMore sx={{ fontSize: 18 }} />
        )}
      </span>
    </button>
  );

  return collapsed ? (
    <Tooltip title={label} placement="right" arrow>
      {btn}
    </Tooltip>
  ) : (
    btn
  );
}

function ProfileUploadInput({ id, onChange }) {
  return <input id={id} type="file" accept="image/*" onChange={onChange} style={{ display: "none" }} />;
}

/* ─────────────────────────────────────────
   SideBar
───────────────────────────────────────── */
const SideBar = ({
  setIsAuthenticated,
  profileImage,
  setProfileImage,
  onCollapseChange,
}) => {
  const settings = useContext(SettingsContext);
  const navigate = useNavigate();

  const accentColor = settings?.main_button_color || "#8b1a1a";
  const shortTerm = settings?.short_term || "EARIST";

  const [collapsed, setCollapsed] = useState(false);
  const [role, setRole] = useState("");
  const [userRole, setUserRole] = useState("");
  const [employeeID, setEmployeeID] = useState("");
  const [personData, setPersonData] = useState({ profile_image: "", fname: "", lname: "", role: "" });
  const [userAccessList, setUserAccessList] = useState({});
  const [accessDescription, setAccessDescription] = useState("");
  const [dir, setDir] = useState("Admin1by1");
  const [classRosterScope, setClassRosterScope] = useState(null);
  const [globalAccessCount, setGlobalAccessCount] = useState(0);
  const [groupOpen, setGroupOpen] = useState({});

  const toggleGroup = (key) => {
    if (collapsed) { setCollapsed(false); setTimeout(() => setGroupOpen(p => ({ ...p, [key]: true })), 260); }
    else setGroupOpen(p => ({ ...p, [key]: !p[key] }));
  };
  const isGroupOpen = (key) => !collapsed && groupOpen[key] === true;
  const hasDept = !!(personData?.dprtmnt_code);

  useEffect(() => { injectStyles(settings, hasDept, collapsed); }, [settings, hasDept, collapsed]);
  useEffect(() => { onCollapseChange?.(collapsed); }, [collapsed, onCollapseChange]);

  /* auth */
  useEffect(() => {
    const token = localStorage.getItem("token");
    const savedRole = localStorage.getItem("role");
    const storedID = localStorage.getItem("person_id");
    if (token && savedRole && storedID) {
      try {
        const decoded = JSON.parse(atob(token.split(".")[1]));
        if (decoded.exp < Date.now() / 1000) {
          ["token", "role", "person_id"].forEach(k => localStorage.removeItem(k));
          setIsAuthenticated(false); navigate("/");
        } else { setRole(savedRole); fetchPersonData(storedID, savedRole); setIsAuthenticated(true); }
      } catch { ["token", "role"].forEach(k => localStorage.removeItem(k)); setIsAuthenticated(false); navigate("/"); }
    } else { setIsAuthenticated(false); navigate("/"); }
  }, []);

  /* access + scope */
  useEffect(() => {
    const email = localStorage.getItem("email");
    const r = localStorage.getItem("role");
    const id = localStorage.getItem("person_id");
    const empID = localStorage.getItem("employee_id");
    if (!email || !r || !id) { window.location.href = "/login"; return; }
    setUserRole(r);
    if (r === "applicant") { setIsAuthenticated(true); return; }
    if (!empID) { window.location.href = "/login"; return; }
    setEmployeeID(empID);
    fetchUserAccessList(empID);
    const determineScope = async (eid) => {
      try {
        const { data: emp } = await axios.get(`${API_BASE_URL}/api/employee/${eid}`);
        const mc = (emp?.accessList ?? []).filter(pid => GLOBAL_PAGE_IDS.includes(pid)).length;
        setGlobalAccessCount(mc);
        if (mc > GLOBAL_ACCESS_THRESHOLD) { setClassRosterScope("GLOBAL"); return; }
        const { data: adm } = await axios.get(`${API_BASE_URL}/api/admin_data/${localStorage.getItem("email")}`);
        setClassRosterScope(adm?.dprtmnt_id ? "DEPARTMENT" : "GLOBAL");
      } catch { setClassRosterScope("GLOBAL"); }
    };
    determineScope(empID);
  }, []);

  useEffect(() => {
    if (!employeeID) return;
    axios.get(`${API_BASE_URL}/api/access_level/${employeeID}`)
      .then(r => setAccessDescription(r.data?.access_description || "")).catch(() => { });
  }, [employeeID]);

  useEffect(() => {
    const map = { applicant: "Applicant1by1", student: "Student1by1", faculty: "Faculty1by1" };
    setDir(map[userRole] || "Admin1by1");
  }, [userRole]);

  const fetchPersonData = async (person_id, r) => {
    try { const res = await axios.get(`${API_BASE_URL}/api/person_data/${person_id}/${r}`); setPersonData(res.data); } catch { }
  };
  const fetchUserAccessList = async (eid) => {
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/page_access/${eid}`);
      setUserAccessList(data.reduce((a, i) => { a[i.page_id] = i.page_privilege === 1; return a; }, {}));
    } catch { }
  };

  const Logout = () => {
    ["token", "email", "role", "person_id"].forEach(k => localStorage.removeItem(k));
    setIsAuthenticated(false); navigate("/");
  };

  const makeUploadHandler = (endpoint, uploadDir) => async (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (role === "applicant") setProfileImage(URL.createObjectURL(file));
    try {
      const pid = localStorage.getItem("person_id");
      const r = localStorage.getItem("role");
      const fd = new FormData();
      fd.append("profile_picture", file); fd.append("person_id", pid);
      await axios.post(`${API_BASE_URL}${endpoint}`, fd);
      const upd = await axios.get(`${API_BASE_URL}/api/person_data/${pid}/${r}`);
      setPersonData(upd.data);
      setProfileImage(`${API_BASE_URL}/uploads/${uploadDir}/${upd.data.profile_image}?t=${Date.now()}`);
    } catch { }
  };
  const uploadHandlers = {
    registrar: makeUploadHandler("/admin/update_registrar", "Admin1by1"),
    applicant: makeUploadHandler("/form/upload-profile-picture", "Applicant1by1"),
    faculty: makeUploadHandler("/faculty/update_faculty", "Faculty1by1"),
    student: makeUploadHandler("/update_student", "Student1by1"),
  };

  function accessObjToSet(list) {
    const s = new Set(); for (const k in list) { if (list[k]) s.add(Number(k)); } return s;
  }
  function getRegistrarDashboard(aSet) {
    if (aSet.has(101)) return "/registrar_dashboard";
    if (aSet.has(102)) return "/enrollment_officer_dashboard";
    if (aSet.has(103)) return "/admission_officer_dashboard";
    return "/registrar_dashboard";
  }

  const loc = typeof window !== "undefined" ? window.location.pathname : "";
  const isActive = p => loc === p;
  const isActivePrefix = px => loc.startsWith(px);
  const isClassRosterActive = lp => loc === lp;

  const avatarSrc = profileImage || (personData?.profile_image ? `${API_BASE_URL}/uploads/${dir}/${personData.profile_image}?t=${Date.now()}` : null);
  const showUploadFor = ["registrar", "applicant", "faculty", "student"].includes(role);
  const classRosterEnrollmentLink = CLASS_ROSTER_DEPT;
  const classRosterRegistrarLink = CLASS_ROSTER_GLOBAL;

  /* ── menu definitions ── */
  const admissionMenuGroups = [{
    key: "admissionOffice", label: "Admission Office", icon: AdminPanelSettings, items: [
      { title: "Applicant List", link: "/applicant_list_admin", icon: ListAltOutlined, page_id: 7 },
      { title: "Applicant Profile", link: "/admin_dashboard1", icon: AccountCircle, page_id: 1 },
      { title: "Applicant Online Requirements", link: "/student_requirements", icon: FolderCopy, page_id: 61 },
      { title: "Verify Schedule Mgmt", link: "/verify_schedule", icon: EditCalendar, page_id: 118 },
      { title: "Exam Schedule Mgmt", link: "/assign_schedule_applicant", icon: EditCalendar, page_id: 11 },
      { title: "Examination Permit", link: "/registrar_examination_profile", icon: Badge, page_id: 48 },
      { title: "Entrance Exam Scores", link: "/applicant_scoring", icon: Score, page_id: 8 },
      { title: "Verify Schedule Assignment", link: "/verify_document_schedule", icon: AccessTimeIcon, page_id: 115 },
      { title: "Evaluator Applicant List", link: "/evaluator_schedule_room_list", icon: People, page_id: 120 },
      { title: "Exam Room Assignment", link: "/assign_entrance_exam", icon: AccessTimeIcon, page_id: 9 },
      { title: "Proctor's Applicant List", link: "/admission_schedule_room_list", icon: People, page_id: 33 },
      { title: "Subject Management", link: "/applicant_exam_subjects", icon: SchoolIcon, page_id: 145 },
      { title: "Announcement", link: "/announcement_for_admission", icon: Campaign, page_id: 98 },
      { title: "Application Process Admin", link: "/application_process_admin", icon: PersonAdd, page_id: 139 },
    ]
  }];
  const enrollmentMenuGroups = [{
    key: "enrollmentOfficer", label: "Enrollment Officer", icon: AssignmentIndIcon, items: [
      { title: "Applicant List", link: "/applicant_list", icon: ListAlt, page_id: 6 },
      { title: "Applicant Profile", link: "/registrar_dashboard1", icon: AccountCircle, page_id: 43 },
      { title: "Applicant Online Requirements", link: "/registrar_requirements", icon: FolderCopy, page_id: 49 },
      { title: "Qualifying Schedule Mgmt", link: "/assign_schedule_applicants_qualifying_interview", icon: EditCalendar, page_id: 12 },
      { title: "Qualifying / Interview Scores", link: "/qualifying_interview_exam_scores", icon: Assessment, page_id: 37 },
      { title: "Student Numbering", link: "/student_numbering_per_college", icon: FormatListNumbered, page_id: 60 },
      { title: "Student List", link: "/student_list_for_enrollment", icon: ListAlt, page_id: 104 },
      { title: "Student Profile", link: "/official_student_dashboard1", icon: AccountCircle, page_id: 43 },
      { title: "Student Online Requirements", link: "/student_official_requirements", icon: FolderCopy, page_id: 124 },
      { title: "Course Tagging", link: "/course_tagging_for_college", icon: Class, page_id: 124 },
      { title: "Course Tagging For Summer", link: "/summer_tagging_for_college", icon: Class, page_id: 141 },
      { title: "Search COR", link: "/search_cor_for_college", icon: Search, page_id: 125 },
      { title: "Class List", link: classRosterEnrollmentLink, icon: Class, page_id: 15, activeCheck: () => isClassRosterActive(classRosterEnrollmentLink) },
      { title: "Qualifying Room Mgmt", link: "/assign_qualifying_interview_exam", icon: AccessTimeIcon, page_id: 10 },
      { title: "Interviewer Applicant List", link: "/enrollment_schedule_room_list", icon: People, page_id: 36 },
    ]
  }];
  const medicalMenuGroups = [{
    key: "medicalDental", label: "Medical & Dental", icon: MedicalServices, items: [
      { title: "Student List", link: "/medical_student_list", icon: ListAltOutlined, page_id: 24 },
      { title: "Student Profile", link: "/medical_dashboard1", icon: AccountCircle, page_id: 25 },
      { title: "Student Online Requirements", link: "/medical_requirements", icon: FolderCopy, page_id: 30 },
      { title: "Medical Requirements", link: "/medical_requirements_form", icon: MedicalServices, page_id: 31 },
      { title: "Dental Assessment", link: "/dental_assessment", icon: HealthAndSafety, page_id: 19 },
      { title: "Physical & Neuro Exam", link: "/physical_neuro_exam", icon: Psychology, page_id: 32 },
    ]
  }];
  const registrarMenuGroups = [{
    key: "registrarOffice", label: "Registrar's Office", icon: HistoryEdu, items: [
      { title: "Applicant List", link: "/super_admin_applicant_list", icon: ListAltOutlined, page_id: 80 },
      { title: "Student Numbering Panel", link: "/student_numbering", icon: Numbers, page_id: 59 },
      { title: "Course Tagging", link: "/course_tagging", icon: Class, page_id: 17 },
      { title: "Course Tagging For Summer", link: "/course_tagging_for_summer", icon: Class, page_id: 140 },
      { title: "Student List", link: "/student_list", icon: ListAltOutlined, page_id: 104 },
      { title: "Student Profile", link: "/readmission_dashboard1", icon: AccountCircle, page_id: 38 },
      { title: "Student Online Requirements", link: "/submitted_documents", icon: FolderCopy, page_id: 106 },
      { title: "Class List", link: classRosterRegistrarLink, icon: Class, page_id: 15, activeCheck: () => isClassRosterActive(classRosterRegistrarLink) },
      { title: "Search COR", link: "/search_cor", icon: Search, page_id: 56 },
      { title: "Report of Grades", link: "/report_of_grades", icon: Assessment, page_id: 50 },
      { title: "Transcript of Records", link: "/transcript_of_records", icon: HistoryEdu, page_id: 62 },
      { title: "Grading Evaluation", link: "/grading_evaluation_for_registrar", icon: FactCheck, page_id: 105 },
      { title: "COR Exporting Module", link: "/cor_exporting_module", icon: FolderCopy, page_id: 117 },
    ]
  }];
  const courseMenuGroups = [{
    key: "courseManagement", label: "Course Management", icon: MenuBook, items: [
      { title: "Program Tagging Panel", link: "/program_tagging", icon: CollectionsBookmark, page_id: 35 },
      { title: "Program Panel Form", link: "/program_panel", icon: LibraryBooks, page_id: 34 },
      { title: "Create Curriculum", link: "/curriculum_panel", icon: EditNote, page_id: 18 },
      { title: "Course Panel Form", link: "/course_panel", icon: MenuBook, page_id: 16 },
      { title: "NSTP Tagging", link: "/nstp_tagging", icon: MenuBook, page_id: 16 },
      { title: "Program Payment", link: "/program_payment", icon: LibraryBooks, page_id: 111 },
      { title: "Program Unit", link: "/program_unit", icon: MenuBook, page_id: 113 },
      { title: "Prerequisite", link: "/prerequisite", icon: MenuBook, page_id: 112 },
    ]
  }];
  const departmentMenuGroups = [{
    key: "departmentManagement", label: "Department Management", icon: Apartment, items: [
      { title: "Schedule Plotting Form", link: "/select_college", icon: EventNote, page_id: 53 },
      { title: "Department Section Panel", link: "/department_section_panel", icon: Apartment, page_id: 20 },
      { title: "Department Panel", link: "/department_registration", icon: Assignment, page_id: 21 },
      { title: "Department Room Panel", link: "/department_room", icon: MeetingRoom, page_id: 22 },
      { title: "Department Section Tagging", link: "/department_section_tagging", icon: MeetingRoom, page_id: 22 },
      { title: "Slot Monitoring Panel", link: "/section_slot_monitoring", icon: MeetingRoom, page_id: 123 },
      { title: "Department Curriculum Panel", link: "/department_curriculum_panel", icon: MenuBook, page_id: 107 },
      { title: "College Schedule Plotting", link: "/college_schedule_plotting", icon: EventNote, page_id: 108 },
    ]
  }];
  const systemMenuGroups = [
    {
      key: "roomRequirements", label: "Room & Requirements", icon: MeetingRoom, items: [
        { title: "Room Registration", link: "/room_registration", icon: MeetingRoom, page_id: 52 },
        { title: "Requirements Panel", link: "/requirements_form", icon: Assignment, page_id: 51 },
      ]
    },
    {
      key: "settingsCommunication", label: "Settings & Communication", icon: Campaign, items: [
        { title: `${shortTerm} Profile`, link: "/settings", icon: Settings, page_id: 74 },
        { title: "Program Slot Remaining", link: "/program_slot_limit", icon: People, page_id: 110 },
        { title: "Branch Management", link: "/admin_branches", icon: Settings, page_id: 138 },
        { title: "Grade Conversion Mgmt", link: "/grade_conversion_admin", icon: Settings, page_id: 144 },
        { title: "Email Sender", link: "/email_template_manager", icon: Email, page_id: 67 },
        { title: "Announcement", link: "/announcement", icon: Campaign, page_id: 66 },
        { title: "Audit Logs", link: "/audit_logs", icon: HistoryEdu, page_id: 95 },
        { title: "Signature Upload", link: "/signature_upload", icon: Settings, page_id: 114 },
      ]
    },
    {
      key: "sectionSemester", label: "Section & Semester", icon: Class, items: [
        { title: "Section Panel Form", link: "/section_panel", icon: Class, page_id: 57 },
        { title: "Semester Panel Form", link: "/semester_panel", icon: Timeline, page_id: 58 },
        { title: "Change Grading Period", link: "/change_grade_period", icon: ChangeCircle, page_id: 14 },
      ]
    },
    {
      key: "yearSchool", label: "Year & School", icon: CalendarToday, items: [
        { title: "Year Level Panel Form", link: "/year_level_panel", icon: Layers, page_id: 63 },
        { title: "Year Panel Form", link: "/year_panel", icon: CalendarToday, page_id: 64 },
        { title: "School Year Activator", link: "/school_year_activator_panel", icon: EventAvailable, page_id: 54 },
        { title: "School Year Panel", link: "/school_year_panel", icon: DateRange, page_id: 55 },
      ]
    },
    {
      key: "paymentEvaluation", label: "Payment & Evaluation", icon: Assessment, items: [
        { title: "Evaluation Management", link: "/evaluation_crud", icon: HelpOutline, page_id: 23 },
        { title: "TOSF CRUD", link: "/tosf_crud", icon: HelpOutline, page_id: 99 },
        { title: "Payment Exporting Module", link: "/payment_exporting_module", icon: HelpOutline, page_id: 116 },
        { title: "Student Scholarship List", link: "/student_scholarship_list", icon: HelpOutline, page_id: 116 },
        { title: "Receipt Counter Assignment", link: "/assign_receipt_counter", icon: HelpOutline, page_id: 122 },
        { title: "Matriculation Payment", link: "/matriculation_payment", icon: HelpOutline, page_id: 121 },
      ]
    },
  ];
  const accountMenuGroups = [
    {
      key: "accountSettings", label: "Settings", icon: Settings, items: [
        { title: "Settings", link: "/registrar_reset_password", icon: Settings, page_id: 73 },
        { title: "Student Grade File", link: "/student_grade_file", icon: Settings, page_id: 126 },
        { title: "Migration Data Panel", link: "/migration_data_panel", icon: Settings, page_id: 114 },
        { title: "Academic Achiever Awardee's", link: "/honors_report", icon: Settings, page_id: 146 },
      ]
    },
    {
      key: "accountCreation", label: "Account Creation", icon: PersonAdd, items: [
        { title: "Add Faculty Accounts", link: "/register_prof", icon: PersonAdd, page_id: 70 },
        { title: "Add Registrar Account", link: "/register_registrar", icon: PersonAdd, page_id: 71 },
        { title: "Create Student Account", link: "/student_accounts", icon: Info, page_id: 143 },
        { title: "Professor Education", link: "/superadmin_professor_education", icon: PersonAdd, page_id: 109 },
      ]
    },
    {
      key: "accountInformation", label: "Account Information", icon: Info, items: [
        { title: "Applicant Information", link: "/super_admin_applicant_dashboard1", icon: Info, page_id: 75 },
        { title: "Upload Requirements", link: "/super_admin_requirements_uploader", icon: Info, page_id: 84 },
        { title: "Student Information", link: "/super_admin_student_dashboard1", icon: Info, page_id: 86 },
        { title: "Archive", link: "/archived", icon: Info, page_id: 142 },
      ]
    },
    {
      key: "userPageAccess", label: "User Access & Page Table", icon: Security, items: [
        { title: "User Page Access", link: "/user_page_access", icon: Security, page_id: 72 },
        { title: "Page Table", link: "/page_crud", icon: TableChart, page_id: 72 },
      ]
    },
    {
      key: "resetPasswordManagement", label: "Reset Password", icon: SupervisorAccount, items: [
        { title: "Applicant Reset Password", link: "/superadmin_applicant_reset_password", icon: People, page_id: 81 },
        { title: "Student Reset Password", link: "/superadmin_student_reset_password", icon: School, page_id: 91 },
        { title: "Faculty Reset Password", link: "/superadmin_faculty_reset_password", icon: SupervisorAccount, page_id: 82 },
        { title: "Registrar Reset Password", link: "/superadmin_registrar_reset_password", icon: AdminPanelSettings, page_id: 83 },
      ]
    },
  ];

  const sectionMenus = {
    admission: admissionMenuGroups, enrollment: enrollmentMenuGroups,
    medical: medicalMenuGroups, registrar: registrarMenuGroups,
    course: courseMenuGroups, department: departmentMenuGroups,
    system: systemMenuGroups, account: accountMenuGroups,
  };
  const managementItems = [
    { key: "admission", title: "Admission Management", path: "/admission_dashboard", icon: Business, page_id: 92 },
    { key: "enrollment", title: "Enrollment Management", path: "/admission_dashboard", icon: Business, page_id: 92 },
    { key: "medical", title: "Medical Management", path: "/admission_dashboard", icon: Business, page_id: 92 },
    { key: "registrar", title: "Registrar Management", path: "/admission_dashboard", icon: Business, page_id: 92 },
    { key: "course", title: "Course Management", path: "/course_management", icon: LibraryBooks, page_id: 93 },
    { key: "department", title: "Department Management", path: "/department_dashboard", icon: Apartment, page_id: 94 },
    { key: "system", title: "System Management", path: "/system_dashboard", icon: Settings, page_id: 95 },
    { key: "account", title: "Account Management", path: "/account_dashboard", icon: People, page_id: 96 },
  ];

  const accessSet = accessObjToSet(userAccessList);
  const registrarDashboard = getRegistrarDashboard(accessSet);

  const renderSection = (item) => {
    if (!userAccessList[item.page_id]) return null;
    const groups = sectionMenus[item.key];
    const hasVisible = groups
      ? groups.some(g => g.items.some(si => si.page_id === undefined || userAccessList[si.page_id]))
      : true;
    if (!hasVisible) return null;

    const isAcct = item.key === "account";
    const visGroups = groups
      ? groups.filter(g => g.items.some(si => si.page_id === undefined || userAccessList[si.page_id]))
      : [];
    const onlySettings = isAcct && visGroups.length === 1 && visGroups[0].key === "accountSettings";

    return (
      <div key={item.key}>
        <div className="sb-section-label">{item.title}</div>
        {onlySettings ? (
          visGroups[0].items
            .filter(si => si.page_id === undefined || userAccessList[si.page_id])
            .map(si => (
              <NavItem key={si.link} to={si.link} icon={si.icon} label={si.title}
                active={si.activeCheck ? si.activeCheck() : isActive(si.link)} collapsed={collapsed} />
            ))
        ) : groups ? (
          groups.map(group => {
            const vis = group.items.filter(si => si.page_id === undefined || userAccessList[si.page_id]);
            if (!vis.length) return null;
            const gKey = `${item.key}_${group.key}`;
            const open = isGroupOpen(gKey);
            return (
              <div key={gKey}>
                <GroupToggle label={group.label} icon={group.icon} open={open}
                  onToggle={() => toggleGroup(gKey)} collapsed={collapsed} />
                {open && !collapsed && vis.map(si => (
                  <NavItem key={si.link} to={si.link} icon={si.icon} label={si.title}
                    active={si.activeCheck ? si.activeCheck() : isActive(si.link)}
                    sub collapsed={collapsed} />
                ))}
              </div>
            );
          })
        ) : (
          <NavItem to={item.path} icon={item.icon} label={`Open ${item.title}`}
            active={isActive(item.path)} collapsed={collapsed} />
        )}
        <Divider sx={{ bgcolor: "#f0f0f0", my: "5px" }} />
      </div>
    );
  };

  /* ── render ── */
  return (
    <div className="sb-root hidden-print">

      {/* ── dark maroon header ── */}
      <div className="sb-header">
        <Tooltip
          title={
            collapsed
              ? (`${personData?.fname || ""} ${personData?.lname || ""}`.trim() || role)
              : ""
          }
          placement="right"
          arrow
        >
          <div
            style={{
              display: "flex",
              flexDirection: collapsed ? "column" : "row",
              alignItems: "center",
              gap: collapsed ? "10px" : "12px",
              padding: "10px 12px"
            }}
          >

            {/* menu icon */}
            <button
              className="sb-hamburger"
              onClick={() => setCollapsed(c => !c)}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "black"
              }}
            >
            <div
  style={{
    ...ICON_CONTAINER_STYLE,
    border: "1.5px solid black",
  }}
>
                <Menu sx={{ fontSize: SIDEBAR_ICON_SIZE, color: "black" }} />
              </div>
            </button>

            {/* avatar */}
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center"
              }}
            >
              {avatarSrc ? (
                <Avatar
                  src={avatarSrc}
                  sx={{
                    width: collapsed ? 36 : 44,
                    height: collapsed ? 36 : 44,
                    border: "1.5px solid black",
                    boxShadow: "0 2px 8px rgba(0,0,0,.15)",
                    transition: "all .25s ease"
                  }}
                />
              ) : (
                <Avatar
                  sx={{
                    width: collapsed ? 36 : 44,
                    height: collapsed ? 36 : 44,
                    bgcolor: "rgba(255,255,255,.2)",
                    fontSize: 15,
                    border: "1.5px solid black",
                    boxShadow: "0 2px 8px rgba(0,0,0,.15)",
                    transition: "all .25s ease"
                  }}
                >
                  {personData?.fname?.[0] || "?"}
                </Avatar>
              )}

              {showUploadFor && !collapsed && (
                <>
                  <label
                    htmlFor="sb-upload"
                    style={{
                      position: "absolute",
                      bottom: -2,
                      right: -2,
                      width: 18,
                      border: "black",
                      height: 18,
                      borderRadius: "50%",
                      background: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer"
                    }}
                  >
                    <AddCircleIcon
                      sx={{
                        fontSize: 13,
                        color: accentColor
                      }}
                    />
                  </label>

                  <ProfileUploadInput
                    id="sb-upload"
                    onChange={uploadHandlers[role]}
                  />
                </>
              )}
            </div>

            {/* info */}
            {!collapsed && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden"
                }}
              >
                <div
                  style={{
                    color: "black",
                    fontWeight: 600,
                    fontSize: 14,
                    lineHeight: 1.25,
                    wordBreak: "break-word",
                    overflowWrap: "break-word",
                    maxWidth: "100%"
                  }}
                >
                  {personData?.fname
                    ? `${personData.fname} ${personData.lname}`
                    : role || "User"}
                </div>

                <div
                  style={{
                    color: "black",
                    fontSize: 12,
                    lineHeight: 1.2,
                    wordBreak: "break-word",
                    overflowWrap: "break-word",
                    maxWidth: "100%"
                  }}
                >
                  {role === "registrar"
                    ? `${accessDescription} · ${personData?.employee_id || ""}`
                    : role === "student"
                      ? `Student · ${personData?.student_number || ""}`
                      : role === "faculty"
                        ? `Faculty · ${personData?.employee_id || ""}`
                        : role === "applicant"
                          ? `Applicant · ${personData?.applicant_number || ""}`
                          : role
                            ? role.charAt(0).toUpperCase() + role.slice(1)
                            : ""}
                </div>

                {hasDept && (
                  <div
                    style={{
                      color: "black",
                      fontSize: 11
                    }}
                  >
                    {personData.dprtmnt_code} Department
                  </div>
                )}
              </div>
            )}

          </div>
        </Tooltip>
      </div>
      {/* ── scrollable nav ── */}
      <div className="sb-scroll">

        {/* REGISTRAR */}
        {role === "registrar" && (
          <>
            <div className="sb-section-label">Navigation</div>
            <NavItem to={registrarDashboard} icon={DashboardIcon} label="Dashboard"
              active={isActive(registrarDashboard)} collapsed={collapsed} />
            <Divider sx={{ bgcolor: "#f0f0f0", my: "5px" }} />
            {managementItems.map(renderSection)}
            <div className="sb-divider" />
          </>
        )}

        {/* APPLICANT */}
        {role === "applicant" && (
          <>
            <div className="sb-section-label">Navigation</div>
            <NavItem to="/applicant_dashboard" icon={DashboardIcon} label="Dashboard"
              active={isActivePrefix("/applicant_dashboard")} collapsed={collapsed} />
            <NavItem icon={AssignmentIndIcon} label="Applicant Profile"
              active={isActivePrefix("/dashboard/")} collapsed={collapsed}
              onClick={() => {
                let keys = JSON.parse(localStorage.getItem("dashboardKeys"));
                if (!keys) {
                  const g = () => Math.random().toString(36).substring(2, 10);
                  keys = { step1: g(), step2: g(), step3: g(), step4: g(), step5: g() };
                  localStorage.setItem("dashboardKeys", JSON.stringify(keys));
                }
                window.location.href = `/dashboard/${keys.step1}`;
              }} />
            <NavItem to="/requirements_uploader" icon={CloudUploadIcon} label="Upload Requirements"
              active={isActivePrefix("/requirements_uploader")} collapsed={collapsed} />
            <div className="sb-section-label">Setting</div>
            <NavItem to="/applicant_reset_password" icon={LockResetIcon} label="Change Password"
              active={isActivePrefix("/applicant_reset_password")} collapsed={collapsed} />
          </>
        )}

        {/* FACULTY */}
        {role === "faculty" && (
          <>
            <div className="sb-section-label">Navigation</div>
            <NavItem to="/faculty_dashboard" icon={DashboardIcon} label="Dashboard" active={isActive("/faculty_dashboard")} collapsed={collapsed} />
            <NavItem to="/faculty_workload" icon={WorkIcon} label="Workload" active={isActive("/faculty_workload")} collapsed={collapsed} />
            <NavItem to="/faculty_masterlist" icon={ListAltIcon} label="Class List" active={isActive("/faculty_masterlist")} collapsed={collapsed} />
            <NavItem to="/grading_sheet" icon={AssignmentTurnedInIcon} label="Grading Management" active={isActive("/grading_sheet")} collapsed={collapsed} />
            <NavItem to="/faculty_evaluation" icon={SchoolIcon} label="Faculty Evaluation" active={isActive("/faculty_evaluation")} collapsed={collapsed} />
            <div className="sb-section-label">Setting</div>
            <NavItem to="/faculty_reset_password" icon={Settings} label="Settings" active={isActive("/faculty_reset_password")} collapsed={collapsed} />
          </>
        )}

        {/* STUDENT */}
        {role === "student" && (
          <>
            <div className="sb-section-label">Navigation</div>
            <NavItem to="/student_dashboard" icon={DashboardIcon} label="Dashboard" active={isActive("/student_dashboard")} collapsed={collapsed} />
            <NavItem to="/student_schedule" icon={EventNoteIcon} label="Schedule" active={isActive("/student_schedule")} collapsed={collapsed} />
            <NavItem to="/grades_page" icon={GradeIcon} label="Grades" active={isActive("/grades_page")} collapsed={collapsed} />
            <NavItem to="/student_section_offering" icon={MenuBook} label="Curriculum" active={isActive("/student_section_offering")} collapsed={collapsed} />
            <NavItem to="/student_faculty_evaluation" icon={AssignmentTurnedInIcon} label="Faculty Evaluation" active={isActive("/student_faculty_evaluation")} collapsed={collapsed} />
            <NavItem to="/student_dashboard1" icon={PersonIcon} label="Student Profile" active={/^\/student_dashboard[1-5]$/.test(loc)} collapsed={collapsed} />
            <NavItem to="/student_online_requirements" icon={FolderCopy} label="Student Online Requirements" active={isActive("/student_online_requirements")} collapsed={collapsed} />
            <NavItem to="/student_account_balance" icon={PaymentIcon} label="Student Account Balance" active={isActive("/student_account_balance")} collapsed={collapsed} />
            <div className="sb-section-label">Setting</div>
            <NavItem to="/student_reset_password" icon={Settings} label="Settings" active={isActive("/student_reset_password")} collapsed={collapsed} />
          </>
        )}

        <div style={{ height: 12 }} />
      </div>

      {/* ── footer ── */}
      <div className="sb-footer">
        <Tooltip title={collapsed ? "Logout" : ""} placement="right" arrow>
          <div className="sb-logout" onClick={Logout}>
            <span
              className="sb-logout-icon"
              style={{
                ...ICON_CONTAINER_STYLE,
                border: "1.5px solid rgba(0,0,0,.08)",
              }}
            >
              <LogoutOutlined sx={{ fontSize: SIDEBAR_ICON_SIZE }} />
            </span>
            <span className="sb-logout-label">Logout</span>
          </div>
        </Tooltip>
      </div>
    </div>
  );
};

export default SideBar;

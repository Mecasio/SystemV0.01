import React, { useState, useEffect, useContext } from "react";
import { SettingsContext } from "../App";
import axios from "axios";
import Unauthorized from "../components/Unauthorized";
import LoadingOverlay from "../components/LoadingOverlay";

import {
  Assignment,        // Requirements
  MeetingRoom,       // Room
  Class,             // Section
  Timeline,          // Semester
  ChangeCircle,      // Change Grade Period
  Update,            // Year Update
  EventAvailable,    // School Year Activator
  Layers,            // Year Level
  CalendarToday,     // Year Panel
  DateRange,         // School Year Panel
  Email,             // Email Template Manager
  Settings,
  Campaign,          // Announcement
} from "@mui/icons-material";

import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { Link } from "react-router-dom";
import { Box, Typography } from "@mui/material";
import API_BASE_URL from "../apiConfig";
const SystemDashboardPanel = () => {
  const settings = useContext(SettingsContext);

  const [titleColor, setTitleColor] = useState("#000000");
  const [subtitleColor, setSubtitleColor] = useState("#555555");
  const [borderColor, setBorderColor] = useState("#000000");
  const [mainButtonColor, setMainButtonColor] = useState("#1976d2");
  const [subButtonColor, setSubButtonColor] = useState("#ffffff");   // ✅ NEW
  const [stepperColor, setStepperColor] = useState("#000000");       // ✅ NEW

  const [fetchedLogo, setFetchedLogo] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [shortTerm, setShortTerm] = useState("");
  const [campusAddress, setCampusAddress] = useState("");

  useEffect(() => {
    if (!settings) return;

    // 🎨 Colors
    if (settings.title_color) setTitleColor(settings.title_color);
    if (settings.subtitle_color) setSubtitleColor(settings.subtitle_color);
    if (settings.border_color) setBorderColor(settings.border_color);
    if (settings.main_button_color) setMainButtonColor(settings.main_button_color);
    if (settings.sub_button_color) setSubButtonColor(settings.sub_button_color);   // ✅ NEW
    if (settings.stepper_color) setStepperColor(settings.stepper_color);           // ✅ NEW

    // 🏫 Logo
    if (settings.logo_url) {
      setFetchedLogo(`${API_BASE_URL}${settings.logo_url}`);
    } else {
      setFetchedLogo(EaristLogo);
    }

    // 🏷️ School Information
    if (settings.company_name) setCompanyName(settings.company_name);
    if (settings.short_term) setShortTerm(settings.short_term);
    if (settings.campus_address) setCampusAddress(settings.campus_address);

  }, [settings]);


  // Access Control
  const [userID, setUserID] = useState("");
  const [userRole, setUserRole] = useState("");
  const [employeeID, setEmployeeID] = useState("");
  const [hasAccess, setHasAccess] = useState(null);
  const [loading, setLoading] = useState(false);

  // ✅ NEW access map
  const [userAccessList, setUserAccessList] = useState({});

  const pageId = 95; // SYSTEM MANAGEMENT

  // Load theme
  useEffect(() => {
    if (!settings) return;

    setTitleColor(settings.title_color || "#000000");
    setBorderColor(settings.border_color || "#000000");
    setMainButtonColor(settings.main_button_color || "#1976d2");

    if (settings.logo_url) {
      setFetchedLogo(`${API_BASE_URL}${settings.logo_url}`);
    }
  }, [settings]);

  // Load user & access
  useEffect(() => {
    const email = localStorage.getItem("email");
    const role = localStorage.getItem("role");
    const id = localStorage.getItem("person_id");
    const empID = localStorage.getItem("employee_id");

    if (email && role && id && empID) {
      setUserRole(role);
      setUserID(id);
      setEmployeeID(empID);

      if (role === "registrar") {
        checkAccess(empID);
        fetchUserAccessList(empID);
      } else {
        window.location.href = "/login";
      }
    } else {
      window.location.href = "/login";
    }
  }, []);

  const checkAccess = async (employeeID) => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_BASE_URL}/api/page_access/${employeeID}/${pageId}`
      );
      setHasAccess(response.data?.page_privilege === 1);
    } catch (error) {
      setHasAccess(false);
    } finally {
      setLoading(false);
    }
  };

  // ✅ SAME access list logic as Admission
  const fetchUserAccessList = async (employeeID) => {
    try {
      const { data } = await axios.get(
        `${API_BASE_URL}/api/page_access/${employeeID}`
      );

      const accessMap = data.reduce((acc, item) => {
        acc[item.page_id] = item.page_privilege === 1;
        return acc;
      }, {});

      setUserAccessList(accessMap);
    } catch (err) {
      console.error("Access list failed:", err);
    }
  };

  // ✅ REAL SYSTEM MANAGEMENT MENU
  const groupedMenu = [
    {
      label: "ROOM & REQUIREMENTS MANAGEMENT",
      items: [
        { title: "ROOM FORM", link: "/super_admin_room_registration", icon: MeetingRoom, page_id: 85 },
        { title: "REQUIREMENTS PANEL", link: "/requirements_form", icon: Assignment, page_id: 51 },
      ],
    },
    {
      label: "SETTINGS & COMMUNICATION",
      items: [
        {
          title: `${settings?.short_term || shortTerm} PROFILE`,
          link: "/settings",
          icon: Settings,
          page_id: 74
        },
        { title: "EMAIL SENDER", link: "/email_template_manager", icon: Email, page_id: 67 },
        { title: "ANNOUNCEMENT", link: "/announcement", icon: Campaign, page_id: 66 },
        { title: "AUDIT LOGS", link: "/audit_logs", icon: HelpOutlineIcon, page_id: 95 },
        {
          title: `SIGNATURE UPLOAD`,
          link: "/signature_upload",
          icon: Settings,
          page_id: 114
        },
      ],
    },
    {
      label: "DATA MIGRATIONS",
      items: [
        { title: "MIGRATION DATA PANEL", link: "/migration_data_panel", icon: Settings, page_id: 114 },
      ],
    },
    {
      label: "SECTION & SEMESTER MANAGEMENT",
      items: [
        { title: "SECTION PANEL FORM", link: "/section_panel", icon: Class, page_id: 57 },
        { title: "SEMESTER PANEL FORM", link: "/semester_panel", icon: Timeline, page_id: 58 },
        { title: "CHANGE GRADING PERIOD", link: "/change_grade_period", icon: ChangeCircle, page_id: 14 },

      ],
    },
    {
      label: "PAYMENT MODULE / EVALUATION CRUD",
      items: [

        { title: "EVALUATION MANAGEMENT", link: "/evaluation_crud", icon: HelpOutlineIcon, page_id: 23 },
        { title: "TOSF CRUD", link: "/tosf_crud", icon: HelpOutlineIcon, page_id: 99 },
        { title: "PAYMENT EXPORTING MODULE", link: "/payment_exporting_module", icon: HelpOutlineIcon, page_id: 116 },
        { title: "STUDENT SCHOLARSHIP LIST", link: "/student_scholarship_list", icon: HelpOutlineIcon, page_id: 129 },
        { title: "RECEIPT COUNTER ASSIGNMENT", link: "/assign_receipt_counter", icon: HelpOutlineIcon, page_id: 122 },
        { title: "MATRICULATION PAYMENT MODULE", link: "/matriculation_payment", icon: HelpOutlineIcon, page_id: 121 },
      ],
    },
    {
      label: "YEAR & SCHOOL MANAGEMENT",
      items: [
        { title: "YEAR LEVEL PANEL FORM", link: "/year_level_panel", icon: Layers, page_id: 63 },
        { title: "YEAR PANEL FORM", link: "/year_panel", icon: CalendarToday, page_id: 64 },
        { title: "SCHOOL YEAR ACTIVATOR PANEL", link: "/school_year_activator_panel", icon: EventAvailable, page_id: 54 },
        { title: "SCHOOL YEAR PANEL", link: "/school_year_panel", icon: DateRange, page_id: 55 },
      ],
    },
    {
      label: "SYSTEM CONFIGURATION",
      items: [
        { title: "SCHOOL YEAR AND SEMESTER", link: "/evaluation_crud", icon: HelpOutlineIcon, page_id: 23 },
        { title: "GRADE POSTING", link: "/evaluation_crud", icon: HelpOutlineIcon, page_id: 23 },
        { title: "CUT-OFF REGISTRATION", link: "/evaluation_crud", icon: HelpOutlineIcon, page_id: 23 },
        { title: "CURRICULUM EVALUATION DISPLAY", link: "/evaluation_crud", icon: HelpOutlineIcon, page_id: 23 },
        { title: "STUDENT ENROLLMENT CUT OFF", link: "/evaluation_crud", icon: HelpOutlineIcon, page_id: 23 },
        { title: "REGISTRATION PERIODS", link: "/evaluation_crud", icon: HelpOutlineIcon, page_id: 23 },
        { title: "NAME AND DESIGNATION SIGNATURE", link: "/signature_upload", icon: HelpOutlineIcon, page_id: 114 },
        { title: "FACULTY LOADING CUT OFF", link: "/evaluation_crud", icon: HelpOutlineIcon, page_id: 23 },
        { title: "OVERDUE INC FINAL GRADE", link: "/evaluation_crud", icon: HelpOutlineIcon, page_id: 23 },
        { title: "SECTION OFFERING CUT OFF", link: "/evaluation_crud", icon: HelpOutlineIcon, page_id: 23 },
        { title: "REGISTRATION FORM NO.", link: "/evaluation_crud", icon: HelpOutlineIcon, page_id: 23 },
        { title: "BATCH UPDATE (STUDENT ENROLLMENT)", link: "/evaluation_crud", icon: HelpOutlineIcon, page_id: 23 },
      ],
    },
  ];

  if (loading || hasAccess === null)
    return <LoadingOverlay open={loading} message="Loading..." />;

  if (!hasAccess) return <Unauthorized />;

  const backgroundImage = settings?.bg_image
    ? `url(${API_BASE_URL}${settings.bg_image})`
    : "linear-gradient(to right, #e0e0e0, #bdbdbd)"

  return (
    <Box
      sx={{
        height: "calc(100vh - 100px)", // fixed viewport height
        width: "100%",
        backgroundImage,
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
        backgroundPosition: "center",
        position: "relative",
      }}
    >
      {/* Overlay */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.1)",
          backdropFilter: "blur(0.5px)",
          WebkitBackdropFilter: "blur(0.5px)",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />


      {/* Scrollable content */}
      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          height: "100%",        // take full height of parent
          overflowY: "auto",     // ✅ THIS allows scrolling
          padding: 2,
        }}
      >
        {groupedMenu
          .map((group) => ({
            ...group,
            items: group.items.filter((item) => userAccessList[item.page_id]),
          }))
          .filter((group) => group.items.length > 0)
          .map((group, idx) => (
            <Box key={idx} sx={{ mb: 5 }}>
              {/* HEADER */}
              <Box
                sx={{
                  borderBottom: `4px solid ${borderColor}`,
                  mb: 2,
                  pb: 1,
                  paddingLeft: 2,
                }}
              >
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: "bold",
                    color: "white",
                    textTransform: "uppercase",
                    fontSize: "34px",
                  }}
                >
                  {group.label}
                </Typography>
              </Box>

              <div className="p-2 px-10 w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {group.items.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div className="relative" key={i}>
                      <Link to={item.link}>
                        {/* ICON BOX */}
                        <div
                          className="bg-white p-4 rounded-lg absolute left-16 top-12"
                          style={{
                            border: `5px solid ${borderColor}`,
                            color: titleColor,
                            transition: "0.2s ease-in-out",
                          }}
                        >
                          <Icon sx={{ fontSize: 36, color: titleColor }} />
                        </div>

                        {/* HOVERABLE BUTTON */}
                        <button
                          className="bg-[#fff9ec] rounded-lg p-4 w-80 h-36 font-medium mt-20 ml-8 flex items-end justify-center"
                          style={{
                            border: `5px solid ${borderColor}`,
                            color: titleColor,
                            transition: "0.2s ease-in-out",
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = mainButtonColor;
                            e.currentTarget.style.color = "#ffffff";
                            e.currentTarget.style.border = `5px solid ${borderColor}`;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#fff9ec";
                            e.currentTarget.style.color = titleColor;
                            e.currentTarget.style.border = `5px solid ${borderColor}`;
                          }}
                        >
                          {item.title}
                        </button>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </Box>
          ))}
      </Box>
    </Box>
  );
};

export default SystemDashboardPanel;

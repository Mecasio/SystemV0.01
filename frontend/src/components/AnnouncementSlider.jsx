import API_BASE_URL from "../apiConfig";
import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  ListSubheader,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Collapse,
  Toolbar,
  Typography,
  IconButton,
  Tooltip,
  Avatar,
  Box,
  Divider,
  Dialog,
  DialogContent,
  CircularProgress,
} from "@mui/material";
import {
  Badge,
  AccountTree,
  Dvr,
  House,
  ChevronLeft,
  ChevronRight,
  Dashboard as DashboardIcon,
  ExpandMore,
  ExpandLess,
  ChildFriendlyRounded,
  BadgeRounded,
  School,
  Streetview,
  Psychology as PsychologyIcon,
  SportsKabaddi,
  FileCopy,
  Logout as LogoutIcon,
  Category as CategoryIcon,
  Feed as FeedIcon,
  Portrait as PortraitIcon,
  ContactPage as ContactPageIcon,
  Payment as PaymentsIcon,
  EditNote as EditNoteIcon,
  AccountBalance as AccountBalanceIcon,
  LocalHospital as LocalHospitalIcon,
  TableChart as TableChartIcon,
  PeopleAlt as PeopleAltIcon,
  People as PeopleIcon,
  MonetizationOn as MonetizationOnIcon,
  Business as BusinessIcon,
  BusinessCenter as BusinessCenterIcon,
  EventNote as EventNoteIcon,
  AssignmentInd as AssignmentIndIcon,
  Assignment as AssignmentIcon,
  Description as DescriptionIcon,
  AccessTime as AccessTimeIcon,
  Devices as DevicesIcon,
  Person as PersonAddIcon,
  AppRegistration,
  EditCalendar,
  RequestQuote,
  AddBusiness,
  ReceiptLong,
  Receipt,
  Info,
  TransferWithinAStation,
  NewReleases,
  Lock,
  LockOpen,
  Assessment,
  Settings,
  AdminPanelSettings,
  ContactPage,
  PointOfSale,
  LibraryBooks,
  Calculate as CalculateIcon,
  PlaylistAdd,
  PostAdd,
} from "@mui/icons-material";
import {
  AccessAlarm,
  CalendarToday,
  CheckCircle,
  EventNote,
  FolderSpecial,
  Search,
  WorkHistory,
} from "@mui/icons-material";

import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import logo from "../assets/logo.PNG";
import { getAuthHeaders } from "../utils/auth";
import usePageAccesses from "../hooks/usePageAccesses";
import {
  getAllComponentIdentifiers,
  getComponentIdentifierForRoute,
} from "../utils/routeToComponentMapping";

const useSystemSettings = () => {
  const [settings, setSettings] = useState({
    primaryColor: "#894444",
    secondaryColor: "#6d2323",
    accentColor: "#FEF9E1",
    textColor: "#FFFFFF",
    textPrimaryColor: "#6D2323",
    textSecondaryColor: "#FEF9E1",
    hoverColor: "#6D2323",
    backgroundColor: "#FFFFFF",
  });

  useEffect(() => {
    const storedSettings = localStorage.getItem("systemSettings");
    if (storedSettings) {
      try {
        const parsedSettings = JSON.parse(storedSettings);
        setSettings(parsedSettings);
      } catch (error) {
        console.error("Error parsing stored settings:", error);
      }
    }

    const fetchSettings = async () => {
      try {
        const url = API_BASE_URL.includes("/api")
          ? `${API_BASE_URL}/system-settings`
          : `${API_BASE_URL}/api/system-settings`;

        const response = await axios.get(url);
        setSettings(response.data);
        localStorage.setItem("systemSettings", JSON.stringify(response.data));
      } catch (error) {
        console.error("Error fetching system settings:", error);
      }
    };

    fetchSettings();
  }, []);

  return settings;
};

const drawerWidth = 270;
const collapsedWidth = 60;

const getUserInfo = () => {
  const token = localStorage.getItem("token");
  if (!token) return {};

  try {
    const decoded = JSON.parse(atob(token.split(".")[1]));
    return {
      role: decoded.role,
      employeeNumber: decoded.employeeNumber,
      username: decoded.username,
    };
  } catch (error) {
    console.error("Error decoding token:", error);
    return {};
  }
};

const Sidebar = ({
  open,
  handleClick,
  open2,
  handleClickAttendance,
  open3,
  handleClickPayroll,
  open4,
  handleClickForms,
  open5,
  handleClickPDSFiles,
  onDrawerStateChange,
  systemSettings,
  openSystemAdmin: propOpenSystemAdmin,
  handleClickSystemAdministration: propHandleClickSystemAdministration,
}) => {
  // Add internal state for System Administration dropdown
  const [internalOpenSystemAdmin, setInternalOpenSystemAdmin] = useState(false);

  // Add internal state for DTR dropdown
  const [openDTR, setOpenDTR] = useState(false);
  const handleClickDTR = () => {
    setOpenDTR(!openDTR);
  };

  // Add internal state for Leave dropdown
  const [openLeave, setOpenLeave] = useState(false);
  const handleClickLeave = () => {
    setOpenLeave(!openLeave);
  };

  // Use prop value if provided, otherwise use internal state
  const openSystemAdmin =
    propOpenSystemAdmin !== undefined
      ? propOpenSystemAdmin
      : internalOpenSystemAdmin;

  // Create internal handler if not provided
  const handleClickSystemAdministration =
    propHandleClickSystemAdministration ||
    (() => {
      setInternalOpenSystemAdmin(!openSystemAdmin);
    });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [profilePicture, setProfilePicture] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [hasUsersListAccess, setHasUsersListAccess] = useState(false);
  const [pageAccessVersion, setPageAccessVersion] = useState(0);
  const settings = useSystemSettings();

  const navigate = useNavigate();
  const location = useLocation();

  // Get all component identifiers that need access checking
  const allComponentIdentifiers = getAllComponentIdentifiers();

  // Check page access for all menu items
  const { hasAccess: checkPageAccess, loading: accessLoading } =
    usePageAccesses(allComponentIdentifiers, {
      employeeNumber,
      pageAccessVersion,
    });

  // Helper function to check if a route should be shown based on page access
  const shouldShowMenuItem = (route) => {
    // Always show home, admin-home, and profile
    if (route === "/home" || route === "/admin-home" || route === "/profile") {
      return true;
    }

    // Don't show anything while loading access data
    if (accessLoading) {
      return false;
    }

    const componentIdentifier = getComponentIdentifierForRoute(route);

    // If no component identifier mapping, show by default (for backward compatibility)
    if (!componentIdentifier) {
      return true;
    }

    // Check access using the hook - only show if user has access
    // Returns false if no access, so item will be completely hidden
    return checkPageAccess(componentIdentifier) === true;
  };

  // Menu item arrays for access control
  const informationManagementItems = [
    "personalinfo",
    "children",
    "college",
    "graduate",
    "vocational",
    "learningdev",
    "eligibility",
    "voluntarywork",
    "workexperience",
    "other-information",
  ];

  const attendanceManagementItems = [
    "view_attendance",
    "attendance_form",
    "search_attendance",
    "daily_time_record_faculty",
    "attendance_module",
    "attendance_module_faculty",
    "attendance_module_faculty_40hrs",
    "attendance_summary",
    "official_time",
  ];

  const payrollManagementItems = [
    "payroll-table",
    "payroll-jo",
    "payroll-processed",
    "payroll-processed-jo",
    "payroll-released",
    "distribution-payslip",
    "overall-payslip",
    "remittance-table",
    "item-table",
    "salary-grade",
    "department-table",
    "department-assignment",
    "holiday",
    "philhealth",
    "payroll-formulas",
    "leave-table",
    "leave-assignment",
    "leave-request",
    "leave-request-user",
  ];

  const leaveManagementItems = [
    "leave-table",
    "leave-assignment",
    "leave-request",
    "leave-request-user",
    "leave-commutation",
    "service-credits",
    "compensatory-time-off",
    "assignment-management",
    "earnings-management",
  ];

  const formsItems = [
    "assessment-clearance",
    "clearance",
    "faculty-clearance",
    "hrms-request-forms",
    "individual-faculty-loading",
    "in-service-training",
    "leave-card",
    "locator-slip",
    "permission-to-teach",
    "request-for-id",
    "saln-front",
    "scholarship-agreement",
    "subject",
  ];

  const pdsItems = ["pds1", "pds2", "pds3", "pds4", "file201"];

  const systemAdministrationItems = [
    "reports",
    "user-management",
    "system-settings",
    "registration",
    "reset-password",
    "payroll-formulas",
    "admin-security",
    "pds-templates",
  ];

  useEffect(() => {
    const storedUser = localStorage.getItem("username");
    const { role: decodedRole, employeeNumber, username } = getUserInfo();

    setUsername(storedUser || username || "");
    setEmployeeNumber(employeeNumber || "");
    setUserRole(decodedRole || "");

    const fetchProfileData = async () => {
      try {
        const response = await axios.get(
          `${API_BASE_URL}/personalinfo/person_table`,
        );
        const person = response.data.find(
          (p) => p.agencyEmployeeNum === employeeNumber,
        );
        if (person) {
          if (person.profile_picture) {
            setProfilePicture(`${API_BASE_URL}${person.profile_picture}`);
          }
          const fullNameFromPerson = `${person.firstName || ""} ${
            person.middleName || ""
          } ${person.lastName || ""} ${person.nameExtension || ""}`.trim();
          if (fullNameFromPerson) {
            setFullName(fullNameFromPerson);
          }
        }
      } catch (error) {
        console.error("Error fetching profile data:", error);
      }
    };

    if (employeeNumber) {
      fetchProfileData();
    }
  }, [employeeNumber, location.pathname]);

  // Check page access for Users List
  useEffect(() => {
    const checkUsersListAccess = async () => {
      if (!employeeNumber) {
        setHasUsersListAccess(false);
        return;
      }

      try {
        const authHeaders = getAuthHeaders();
        const pagesResponse = await fetch(`${API_BASE_URL}/pages`, {
          method: "GET",
          ...authHeaders,
        });

        if (pagesResponse.ok) {
          let pagesData = await pagesResponse.json();
          pagesData = Array.isArray(pagesData)
            ? pagesData
            : pagesData.pages || pagesData.data || [];

          const usersListPage = pagesData.find(
            (page) =>
              page.page_name &&
              (page.page_name.toLowerCase().includes("user") ||
                page.page_name.toLowerCase().includes("users list") ||
                page.page_name.toLowerCase().includes("user management")),
          );

          if (usersListPage) {
            const pageId = usersListPage.id;
            const accessResponse = await fetch(
              `${API_BASE_URL}/page_access/${employeeNumber}`,
              {
                method: "GET",
                ...authHeaders,
              },
            );

            if (accessResponse.ok) {
              const accessDataRaw = await accessResponse.json();
              const accessData = Array.isArray(accessDataRaw)
                ? accessDataRaw
                : accessDataRaw.data || [];

              const hasAccess = accessData.some(
                (access) =>
                  access.page_id === pageId &&
                  String(access.page_privilege) === "1",
              );

              setHasUsersListAccess(hasAccess);
            } else {
              setHasUsersListAccess(false);
            }
          } else {
            setHasUsersListAccess(false);
          }
        } else {
          setHasUsersListAccess(false);
        }
      } catch (error) {
        console.error("Error checking Users List access:", error);
        setHasUsersListAccess(false);
      }
    };

    if (employeeNumber) {
      checkUsersListAccess();
    }
  }, [employeeNumber]);

  // Listen for page access updates from UsersList dialog
  useEffect(() => {
    const handlePageAccessUpdated = () => {
      // Increment version to force usePageAccesses to re-run
      setPageAccessVersion((prev) => prev + 1);

      // Also re-check the Users List specific access
      const recheckAccess = async () => {
        if (!employeeNumber) return;
        try {
          const authHeaders = getAuthHeaders();
          const pagesResponse = await fetch(`${API_BASE_URL}/pages`, {
            method: "GET",
            ...authHeaders,
          });

          if (!pagesResponse.ok) return;

          let pagesData = await pagesResponse.json();
          pagesData = Array.isArray(pagesData)
            ? pagesData
            : pagesData.pages || pagesData.data || [];

          const usersListPage = pagesData.find(
            (page) =>
              page.page_name &&
              (page.page_name.toLowerCase().includes("user") ||
                page.page_name.toLowerCase().includes("users list") ||
                page.page_name.toLowerCase().includes("user management")),
          );

          if (!usersListPage) {
            setHasUsersListAccess(false);
            return;
          }

          const accessResponse = await fetch(
            `${API_BASE_URL}/page_access/${employeeNumber}`,
            { method: "GET", ...authHeaders },
          );

          if (!accessResponse.ok) {
            setHasUsersListAccess(false);
            return;
          }

          const accessDataRaw = await accessResponse.json();
          const accessData = Array.isArray(accessDataRaw)
            ? accessDataRaw
            : accessDataRaw.data || [];

          const hasAccess = accessData.some(
            (access) =>
              access.page_id === usersListPage.id &&
              String(access.page_privilege) === "1",
          );

          setHasUsersListAccess(hasAccess);
        } catch (error) {
          console.error("Error rechecking page access:", error);
        }
      };

      recheckAccess();
    };

    window.addEventListener("pageAccessUpdated", handlePageAccessUpdated);
    return () => {
      window.removeEventListener("pageAccessUpdated", handlePageAccessUpdated);
    };
  }, [employeeNumber]);

  const currentPath = location.pathname;
  useEffect(() => {
    // ... (all the path checks remain the same)
    if (currentPath === "/home" || currentPath === "/admin-home") {
      setSelectedItem("home");
    } else if (currentPath === "/attendance-user-state") {
      setSelectedItem("attendance-user-state");
    } else if (currentPath === "/daily_time_record") {
      setSelectedItem("daily_time_record");
    } else if (currentPath === "/payslip") {
      setSelectedItem("payslip");
    } else if (currentPath === "/pds-templates") {
      setSelectedItem("pds-templates");
    } else if (currentPath === "/file201") {
      setSelectedItem("file201");
    } else if (currentPath === "/pds1") {
      setSelectedItem("pds1");
    } else if (currentPath === "/pds2") {
      setSelectedItem("pds2");
    } else if (currentPath === "/pds3") {
      setSelectedItem("pds3");
    } else if (currentPath === "/pds4") {
      setSelectedItem("pds4");
    } else if (
      currentPath === "/registration" ||
      currentPath === "/bulk-register"
    ) {
      setSelectedItem("bulk-register");
    } else if (currentPath === "/employee-category") {
      setSelectedItem("employee-category");
    } else if (currentPath === "/reset-password") {
      setSelectedItem("reset-password");
    } else if (currentPath === "/personalinfo") {
      setSelectedItem("personalinfo");
    } else if (currentPath === "/children") {
      setSelectedItem("children");
    } else if (currentPath === "/college") {
      setSelectedItem("college");
    } else if (currentPath === "/graduate") {
      setSelectedItem("graduate");
    } else if (currentPath === "/vocational") {
      setSelectedItem("vocational");
    } else if (currentPath === "/learningdev") {
      setSelectedItem("learningdev");
    } else if (currentPath === "/eligibility") {
      setSelectedItem("eligibility");
    } else if (currentPath === "/voluntarywork") {
      setSelectedItem("voluntarywork");
    } else if (currentPath === "/workexperience") {
      setSelectedItem("workexperience");
    } else if (currentPath === "/other-information") {
      setSelectedItem("other-information");
    } else if (currentPath === "/view_attendance") {
      setSelectedItem("view_attendance");
    } else if (currentPath === "/attendance_form") {
      setSelectedItem("attendance_form");
    } else if (currentPath === "/search_attendance") {
      setSelectedItem("search_attendance");
    } else if (currentPath === "/daily_time_record_faculty") {
      setSelectedItem("daily_time_record_faculty");
    } else if (currentPath === "/daily_time_record_honorarium") {
      setSelectedItem("daily_time_record_honorarium");
    } else if (currentPath === "/daily_time_record_service_credits") {
      setSelectedItem("daily_time_record_service_credits");
    } else if (currentPath === "/daily_time_record_overtime") {
      setSelectedItem("daily_time_record_overtime");
    } else if (currentPath === "/attendance_module") {
      setSelectedItem("attendance_module");
    } else if (currentPath === "/attendance_module_faculty") {
      setSelectedItem("attendance_module_faculty");
    } else if (currentPath === "/attendance_module_faculty_40hrs") {
      setSelectedItem("attendance_module_faculty_40hrs");
    } else if (currentPath === "/attendance_summary") {
      setSelectedItem("attendance_summary");
    } else if (currentPath === "/official_time") {
      setSelectedItem("official_time");
    } else if (currentPath === "/payroll-table") {
      setSelectedItem("payroll-table");
    } else if (currentPath === "/payroll-jo") {
      setSelectedItem("payroll-jo");
    } else if (currentPath === "/payroll-processed") {
      setSelectedItem("payroll-processed");
    } else if (currentPath === "/payroll-processed-jo") {
      setSelectedItem("payroll-processed-jo");
    } else if (currentPath === "/payroll-released") {
      setSelectedItem("payroll-released");
    } else if (currentPath === "/distribution-payslip") {
      setSelectedItem("distribution-payslip");
    } else if (currentPath === "/overall-payslip") {
      setSelectedItem("overall-payslip");
    } else if (currentPath === "/remittance-table") {
      setSelectedItem("remittance-table");
    } else if (currentPath === "/item-table") {
      setSelectedItem("item-table");
    } else if (currentPath === "/salary-grade") {
      setSelectedItem("salary-grade");
    } else if (currentPath === "/department-table") {
      setSelectedItem("department-table");
    } else if (currentPath === "/department-assignment") {
      setSelectedItem("department-assignment");
    } else if (currentPath === "/leave-table") {
      setSelectedItem("leave-table");
    } else if (currentPath === "/assignment-management") {
      setSelectedItem("assignment-management");
    } else if (currentPath === "/earnings-management") {
      setSelectedItem("earnings-management");
    } else if (currentPath === "/leave-assignment") {
      setSelectedItem("leave-assignment");
    } else if (currentPath === "/leave-request") {
      setSelectedItem("leave-request");
    } else if (currentPath === "/leave-request-user") {
      setSelectedItem("leave-request-user");
    } else if (currentPath === "/leave-commutation") {
      setSelectedItem("leave-commutation");
    } else if (currentPath === "/assessment-clearance") {
      setSelectedItem("assessment-clearance");
    } else if (currentPath === "/clearance") {
      setSelectedItem("clearance");
    } else if (currentPath === "/faculty-clearance") {
      setSelectedItem("faculty-clearance");
    } else if (currentPath === "/hrms-request-forms") {
      setSelectedItem("hrms-request-forms");
    } else if (currentPath === "/individual-faculty-loading") {
      setSelectedItem("individual-faculty-loading");
    } else if (currentPath === "/in-service-training") {
      setSelectedItem("in-service-training");
    } else if (currentPath === "/leave-card") {
      setSelectedItem("leave-card");
    } else if (currentPath === "/locator-slip") {
      setSelectedItem("locator-slip");
    } else if (currentPath === "/permission-to-teach") {
      setSelectedItem("permission-to-teach");
    } else if (currentPath === "/request-for-id") {
      setSelectedItem("request-for-id");
    } else if (currentPath === "/saln-front") {
      setSelectedItem("saln-front");
    } else if (currentPath === "/scholarship-agreement") {
      setSelectedItem("scholarship-agreement");
    } else if (currentPath === "/subject") {
      setSelectedItem("subject");
    } else if (currentPath === "/reports") {
      setSelectedItem("reports");
    } else if (currentPath === "/employee-reports") {
      setSelectedItem("employee-reports");
    } else if (currentPath === "/users-list") {
      setSelectedItem("users-list");
    } else if (currentPath === "/settings") {
      setSelectedItem("settings");
    } else if (currentPath === "/admin-security") {
      setSelectedItem("admin-security");
    } else if (currentPath === "/system-settings") {
      setSelectedItem("system-settings");
    } else if (currentPath === "/profile") {
      setSelectedItem(null);
    } else {
      setSelectedItem(null);
    }
  }, [currentPath]);

  const handleDrawerStateChange = (isOpen) => {
    if (!isLocked) {
      setDrawerOpen(isOpen);
      if (onDrawerStateChange) {
        onDrawerStateChange(isOpen, isLocked);
      }
    }
  };

  const handleToggleLock = (e) => {
    e.stopPropagation();
    const newLockedState = !isLocked;
    setIsLocked(newLockedState);

    if (newLockedState) {
      setDrawerOpen(true);
      if (onDrawerStateChange) {
        onDrawerStateChange(true, true);
      }
    } else {
      if (onDrawerStateChange) {
        onDrawerStateChange(drawerOpen, false);
      }
    }
  };

  const handleSidebarClick = (e) => {
    e.stopPropagation();
    setIsLocked(!isLocked);
    const newState = !isLocked || drawerOpen;
    setDrawerOpen(newState);
    if (onDrawerStateChange) {
      onDrawerStateChange(newState);
    }
  };

  const handleLogout = () => {
    setLogoutOpen(true);

    setTimeout(() => {
      localStorage.removeItem("token");
      localStorage.clear();
      window.location.href = "/"; // login
    }, 1500);
  };

  const handleToggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleItemClick = (item) => {
    setSelectedItem(item);

    if (informationManagementItems.includes(item) && !open) {
      handleClick();
    }
    if (attendanceManagementItems.includes(item) && !open2) {
      handleClickAttendance();
    }
    if (payrollManagementItems.includes(item) && !open3) {
      handleClickPayroll();
    }
    if (formsItems.includes(item) && !open4) {
      handleClickForms();
    }
    if (pdsItems.includes(item) && !open5) {
      handleClickPDSFiles();
    }
    if (systemAdministrationItems.includes(item) && !openSystemAdmin) {
      handleClickSystemAdministration();
    }

    if (item === "home") {
      if (userRole === "staff") {
        navigate("/home");
      } else {
        navigate("/admin-home");
      }
    } else if (item === "employee-reports") {
      navigate("/employee-reports");
    } else if (item === "#") {
      navigate("/");
    }
  };

  const dynamicDrawerWidth = drawerOpen ? drawerWidth : collapsedWidth;

  return (
    <Drawer
      className="no-print"
      variant="permanent"
      sx={{
        width: dynamicDrawerWidth,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: dynamicDrawerWidth,
          boxSizing: "border-box",
          transition: "width 0.3s",
          display: "flex",
          flexDirection: "column",
          boxShadow: 10,
          zIndex: 1200,
          pt: 2.5,
          background: `linear-gradient(180deg, ${systemSettings.primaryColor} 0%, ${systemSettings.sidebarGradientEnd || systemSettings.primaryColor} 100%)`,
          overflow: "hidden",
        },
      }}
    >
      <Box
        onMouseEnter={() => !isLocked && handleDrawerStateChange(true)}
        onMouseLeave={() => !isLocked && handleDrawerStateChange(false)}
        sx={{
          display: "flex",
          flexDirection: "column",
          width: dynamicDrawerWidth,
          minWidth: 270,
          height: "100vh",
          transition: "all 0.3s ease",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            "&::-webkit-scrollbar": { width: 8 },
            "&::-webkit-scrollbar-thumb": {
              bgcolor: systemSettings?.hoverColor || "#6d2323",
              borderRadius: 2,
            },
          }}
        >
          <Toolbar
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              px: 2,
              minHeight: "48px !important",
              width: dynamicDrawerWidth,
              overflow: "hidden",
            }}
          >
            {drawerOpen && (
              <Box display="flex" alignItems="center" gap={1}></Box>
            )}
          </Toolbar>

          <List>
            {userRole !== "" && (
              <>
                <List component="div" disablePadding sx={{ pl: 2.5 }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginRight: 2.5,
                    }}
                  >
                    <Tooltip title="Go to Profile">
                      <Box
                        onClick={() => {
                          setSelectedItem(null);
                          navigate("/profile");
                        }}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          cursor: "pointer",
                        }}
                      >
                        <Avatar
                          alt={fullName || username}
                          src={profilePicture}
                          sx={{
                            width: 35,
                            height: 35,
                            marginLeft: -1,
                            color: settings.textSecondaryColor,
                            bgcolor: "inherit",
                          }}
                        />
                        <Box>
                          <Typography
                            variant="body2"
                            fontWeight="bold"
                            sx={{
                              fontFamily: "Poppins, sans-serif",
                              marginLeft: "9px",
                              color: settings.textSecondaryColor,
                            }}
                          >
                            {fullName || username}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              fontFamily: "Poppins, sans-serif",
                              marginLeft: "9px",
                              color: settings.textSecondaryColor,
                            }}
                          >
                            {employeeNumber}
                          </Typography>
                        </Box>
                      </Box>
                    </Tooltip>

                    <Tooltip
                      title={
                        isLocked
                          ? "Click to auto-close sidebar"
                          : "Click to keep sidebar open"
                      }
                    >
                      <IconButton
                        onClick={handleToggleLock}
                        size="small"
                        sx={{
                          color: isLocked
                            ? settings.accentColor || "#FEF9E1"
                            : settings.textSecondaryColor || "#FFFFFF",
                          transition: "all 0.3s ease",
                          "&:hover": {
                            bgcolor: "rgba(255, 255, 255, 0.1)",
                            transform: "scale(1.1)",
                          },
                        }}
                      >
                        {isLocked ? (
                          <Lock fontSize="small" />
                        ) : (
                          <LockOpen fontSize="small" />
                        )}
                      </IconButton>
                    </Tooltip>
                  </Box>

                  <Dialog
                    open={logoutOpen}
                    fullScreen
                    PaperProps={{
                      sx: { backgroundColor: "transparent", boxShadow: "none" },
                    }}
                    BackdropProps={{
                      sx: {
                        backgroundColor: "rgba(0,0,0,0.7)",
                        backdropFilter: "blur(4px)",
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "column",
                        overflow: "hidden",
                        position: "relative",
                      }}
                    >
                      {[0, 1, 2, 3].map((i) => (
                        <Box
                          key={i}
                          sx={{
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            background:
                              i % 2 === 0
                                ? "rgba(163,29,29,0.8)"
                                : "rgba(163,29,29,0.8)",
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transformOrigin: "-60px 0px",
                            animation: `orbit${i} ${3 + i}s linear infinite`,
                            boxShadow:
                              "0 0 15px rgba(163,29,29,0.5), 0 0 8px rgba(163,29,29,0.8)",
                          }}
                        />
                      ))}

                      <Box
                        sx={{ position: "relative", width: 120, height: 120 }}
                      >
                        <Box
                          sx={{
                            width: 120,
                            height: 120,
                            borderRadius: "50%",
                            background:
                              "radial-gradient(circle at 30% 30%, #6d2323, #700000)",
                            boxShadow:
                              "0 0 40px rgba(163,29,29,0.7), 0 0 80px rgba(163,29,29,0.5)",
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            animation:
                              "floatSphere 2s ease-in-out infinite alternate",
                          }}
                        >
                          <Box
                            component="img"
                            src={logo}
                            alt="Logo"
                            sx={{
                              width: 60,
                              height: 60,
                              borderRadius: "50%",
                              boxShadow:
                                "0 0 20px rgba(163,29,29,0.7), 0 0 10px #6d2323",
                              animation: "heartbeat 1s infinite",
                            }}
                          />
                        </Box>
                      </Box>

                      <Typography
                        variant="h6"
                        sx={{
                          mt: 3,
                          fontWeight: "bold",
                          color: "#FFF8E1",
                          textShadow: "0 0 10px #FEF9E1",
                          animation: "pulse 1.5s infinite",
                        }}
                      >
                        Signing out...
                      </Typography>

                      <Box
                        component="style"
                        children={`
                        @keyframes heartbeat {
                          0%,100% { transform: scale(1); }
                          25%,75% { transform: scale(1.15); }
                          50% { transform: scale(1.05); }
                        }
                        @keyframes pulse {
                          0% { opacity: 1; }
                          50% { opacity: 0.6; }
                          100% { opacity: 1; }
                        }
                        @keyframes floatSphere {
                          0% { transform: translate(-50%, -50%) translateY(0); }
                          50% { transform: translate(-50%, -50%) translateY(-15px); }
                          100% { transform: translate(-50%, -50%) translateY(0); }
                        }
                        @keyframes orbit0 { 0% { transform: rotate(0deg) translateX(60px); } 100% { transform: rotate(360deg) translateX(60px); } }
                        @keyframes orbit1 { 0% { transform: rotate(90deg) translateX(60px); } 100% { transform: rotate(450deg) translateX(60px); } }
                        @keyframes orbit2 { 0% { transform: rotate(180deg) translateX(60px); } 100% { transform: rotate(540deg) translateX(60px); } }
                        @keyframes orbit3 { 0% { transform: rotate(270deg) translateX(60px); } 100% { transform: rotate(630deg) translateX(60px); } }
                      `}
                      />
                    </Box>
                  </Dialog>
                </List>
              </>
            )}

            {drawerOpen ? (
              <List
                subheader={
                  <ListSubheader
                    component="div"
                    sx={{
                      bgcolor: "transparent",
                      fontWeight: "bold",
                      fontSize: "0.7rem",
                      color: settings.textSecondaryColor,
                      fontFamily: "Poppins, sans-serif",
                      textTransform: "uppercase",
                      mb: -1,
                    }}
                  >
                    General Panel
                  </ListSubheader>
                }
              >
                {" "}
              </List>
            ) : (
              <Divider
                sx={{ borderColor: "rgba(255,255,255,0.2)", mx: 1, my: 1 }}
              />
            )}

            {/* HOME */}
            <ListItem
              button
              selected={selectedItem === "home"}
              onClick={() => handleItemClick("home")}
              sx={{
                cursor: "pointer",
                bgcolor:
                  selectedItem === "home"
                    ? settings.accentColor || "#FEF9E1"
                    : "inherit",
                color:
                  selectedItem === "home"
                    ? settings.textPrimaryColor
                    : settings.textSecondaryColor,

                "& .MuiListItemIcon-root": {
                  color:
                    selectedItem === "home"
                      ? settings.textPrimaryColor
                      : settings.textSecondaryColor,
                },
                "& .MuiListItemText-primary": {
                  color:
                    selectedItem === "home"
                      ? settings.textPrimaryColor
                      : settings.textSecondaryColor,
                },

                "&:hover": {
                  bgcolor: settings.hoverColor || "#6D2323",
                  color: settings.textSecondaryColor,
                  "& .MuiListItemIcon-root": {
                    color: settings.textSecondaryColor,
                  },
                  "& .MuiListItemText-primary": {
                    color: settings.textSecondaryColor,
                  },
                },

                borderTopRightRadius: selectedItem === "home" ? "15px" : 0,
                borderBottomRightRadius: selectedItem === "home" ? "15px" : 0,
              }}
            >
              <ListItemIcon>
                <House sx={{ fontSize: 29, marginLeft: "-6%" }} />
              </ListItemIcon>
              <ListItemText primary="Home" sx={{ marginLeft: "-10px" }} />
            </ListItem>
            {/* ATTENDANCE */}
            {shouldShowMenuItem("/attendance-user-state") && (
              <ListItem
                button
                component={Link}
                to="/attendance-user-state"
                onClick={() => handleItemClick("attendance-user-state")}
                sx={{
                  bgcolor:
                    selectedItem === "attendance-user-state"
                      ? settings.accentColor || "#FEF9E1"
                      : "inherit",
                  color:
                    selectedItem === "attendance-user-state"
                      ? settings.textPrimaryColor
                      : settings.textSecondaryColor,

                  "& .MuiListItemIcon-root": {
                    color:
                      selectedItem === "attendance-user-state"
                        ? settings.textPrimaryColor
                        : settings.textSecondaryColor,
                  },
                  "& .MuiListItemText-primary": {
                    color:
                      selectedItem === "attendance-user-state"
                        ? settings.textPrimaryColor
                        : settings.textSecondaryColor,
                  },

                  "&:hover": {
                    bgcolor: settings.hoverColor || "#6D2323",
                    color: settings.textSecondaryColor,
                    "& .MuiListItemIcon-root": {
                      color: settings.textSecondaryColor,
                    },
                    "& .MuiListItemText-primary": {
                      color: settings.textSecondaryColor,
                    },
                  },

                  borderTopRightRadius:
                    selectedItem === "attendance-user-state" ? "15px" : 0,
                  borderBottomRightRadius:
                    selectedItem === "attendance-user-state" ? "15px" : 0,
                }}
              >
                <ListItemIcon>
                  <PersonAddIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Attendance"
                  sx={{ marginLeft: "-10px" }}
                />
              </ListItem>
            )}

            {/* DAILY TIME RECORD DROPDOWN */}
            {(shouldShowMenuItem("/daily_time_record") ||
              shouldShowMenuItem("/daily_time_record_faculty") ||
              shouldShowMenuItem("/daily_time_record_honorarium") ||
              shouldShowMenuItem("/daily_time_record_service_credits") ||
              shouldShowMenuItem("/daily_time_record_overtime")) && (
              <>
                <ListItem
                  button
                  onClick={handleClickDTR}
                  sx={{
                    color: settings.textSecondaryColor,
                    cursor: "pointer",
                    "&:hover": {
                      bgcolor: settings.hoverColor || "#6D2323",
                    },
                  }}
                >
                  <ListItemIcon>
                    <CalendarToday
                      sx={{ color: settings.textSecondaryColor }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary="Daily Time Record"
                    sx={{ marginLeft: "-10px", whiteSpace: "noWrap" }}
                  />
                  <ListItemIcon
                    sx={{
                      marginLeft: "10rem",
                      color: settings.textSecondaryColor,
                    }}
                  >
                    {openDTR ? <ExpandLess /> : <ExpandMore />}
                  </ListItemIcon>
                </ListItem>

                <Collapse in={openDTR} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding sx={{ pl: 5.4 }}>
                    {/* Regular Work Days */}
                    {shouldShowMenuItem("/daily_time_record") && (
                      <ListItem
                        button
                        component={Link}
                        to="/daily_time_record"
                        onClick={() => handleItemClick("daily_time_record")}
                        sx={{
                          bgcolor:
                            selectedItem === "daily_time_record"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          color:
                            selectedItem === "daily_time_record"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                          "& .MuiListItemIcon-root": {
                            color:
                              selectedItem === "daily_time_record"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },
                          "& .MuiListItemText-primary": {
                            color:
                              selectedItem === "daily_time_record"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },
                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color: settings.textSecondaryColor,
                            },
                          },
                          borderTopRightRadius:
                            selectedItem === "daily_time_record" ? "15px" : 0,
                          borderBottomRightRadius:
                            selectedItem === "daily_time_record" ? "15px" : 0,
                        }}
                      >
                        <ListItemIcon sx={{ marginRight: "-1rem" }}>
                          <CalendarToday />
                        </ListItemIcon>
                        <ListItemText
                          primary="Regular"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>
                    )}
                    {/* Overtime */}

                    {/* 
                  {/* Honorarium */}
                    {shouldShowMenuItem("/daily_time_record_honorarium") && (
                      <ListItem
                        button
                        component={Link}
                        to="/daily_time_record_honorarium"
                        onClick={() =>
                          handleItemClick("daily_time_record_honorarium")
                        }
                        sx={{
                          bgcolor:
                            selectedItem === "daily_time_record_honorarium"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          color:
                            selectedItem === "daily_time_record_honorarium"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                          "& .MuiListItemIcon-root": {
                            color:
                              selectedItem === "daily_time_record_honorarium"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },
                          "& .MuiListItemText-primary": {
                            color:
                              selectedItem === "daily_time_record_honorarium"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },
                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color: settings.textSecondaryColor,
                            },
                          },
                          borderTopRightRadius:
                            selectedItem === "daily_time_record_honorarium"
                              ? "15px"
                              : 0,
                          borderBottomRightRadius:
                            selectedItem === "daily_time_record_honorarium"
                              ? "15px"
                              : 0,
                        }}
                      >
                        <ListItemIcon sx={{ marginRight: "-1rem" }}>
                          <CalendarToday />
                        </ListItemIcon>
                        <ListItemText
                          primary="Honorarium"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>
                    )}

                    {/* Service Credits */}
                    {shouldShowMenuItem(
                      "/daily_time_record_service_credits",
                    ) && (
                      <ListItem
                        button
                        component={Link}
                        to="/daily_time_record_service_credits"
                        onClick={() =>
                          handleItemClick("daily_time_record_service_credits")
                        }
                        sx={{
                          bgcolor:
                            selectedItem === "daily_time_record_service_credits"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          color:
                            selectedItem === "daily_time_record_service_credits"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                          "& .MuiListItemIcon-root": {
                            color:
                              selectedItem ===
                              "daily_time_record_service_credits"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },
                          "& .MuiListItemText-primary": {
                            color:
                              selectedItem ===
                              "daily_time_record_service_credits"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },
                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color: settings.textSecondaryColor,
                            },
                          },
                          borderTopRightRadius:
                            selectedItem === "daily_time_record_service_credits"
                              ? "15px"
                              : 0,
                          borderBottomRightRadius:
                            selectedItem === "daily_time_record_service_credits"
                              ? "15px"
                              : 0,
                        }}
                      >
                        <ListItemIcon sx={{ marginRight: "-1rem" }}>
                          <CalendarToday />
                        </ListItemIcon>
                        <ListItemText
                          primary="Service Credits"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>
                    )}

                    {/* Overtime */}
                    {shouldShowMenuItem("/daily_time_record_overtime") && (
                      <ListItem
                        button
                        component={Link}
                        to="/daily_time_record_overtime"
                        onClick={() =>
                          handleItemClick("daily_time_record_overtime")
                        }
                        sx={{
                          bgcolor:
                            selectedItem === "daily_time_record_overtime"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          color:
                            selectedItem === "daily_time_record_overtime"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                          "& .MuiListItemIcon-root": {
                            color:
                              selectedItem === "daily_time_record_overtime"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },
                          "& .MuiListItemText-primary": {
                            color:
                              selectedItem === "daily_time_record_overtime"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },
                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color: settings.textSecondaryColor,
                            },
                          },
                          borderTopRightRadius:
                            selectedItem === "daily_time_record_overtime"
                              ? "15px"
                              : 0,
                          borderBottomRightRadius:
                            selectedItem === "daily_time_record_overtime"
                              ? "15px"
                              : 0,
                        }}
                      >
                        <ListItemIcon sx={{ marginRight: "-1rem" }}>
                          <CalendarToday />
                        </ListItemIcon>
                        <ListItemText
                          primary="Overtime"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>
                    )}
                  </List>
                </Collapse>
              </>
            )}

            {/* Leave Request User (under Daily Time Record) */}
            {shouldShowMenuItem("/leave-request-user") && (
              <ListItem
                button
                component={Link}
                to="/leave-request-user"
                onClick={() => handleItemClick("leave-request-user")}
                sx={{
                  bgcolor:
                    selectedItem === "leave-request-user"
                      ? settings.accentColor || "#FEF9E1"
                      : "inherit",
                  color:
                    selectedItem === "leave-request-user"
                      ? settings.textPrimaryColor
                      : settings.textSecondaryColor,

                  "& .MuiListItemIcon-root": {
                    color:
                      selectedItem === "leave-request-user"
                        ? settings.textPrimaryColor
                        : settings.textSecondaryColor,
                  },
                  "& .MuiListItemText-primary": {
                    color:
                      selectedItem === "leave-request-user"
                        ? settings.textPrimaryColor
                        : settings.textSecondaryColor,
                  },
                  "&:hover": {
                    bgcolor: settings.hoverColor || "#6D2323",
                    color: settings.textSecondaryColor,
                    "& .MuiListItemIcon-root": {
                      color: settings.textSecondaryColor,
                    },
                    "& .MuiListItemText-primary": {
                      color: settings.textSecondaryColor,
                    },
                  },

                  borderTopRightRadius:
                    selectedItem === "leave-request-user" ? "15px" : 0,
                  borderBottomRightRadius:
                    selectedItem === "leave-request-user" ? "15px" : 0,
                }}
              >
                <ListItemIcon>
                  <DescriptionIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Leave Request User"
                  sx={{ marginLeft: "-10px" }}
                />
              </ListItem>
            )}

            {/* PAYSLIP */}
            {shouldShowMenuItem("/payslip") && (
              <ListItem
                button
                component={Link}
                to="/payslip"
                onClick={() => handleItemClick("payslip")}
                sx={{
                  bgcolor:
                    selectedItem === "payslip"
                      ? settings.accentColor || "#FEF9E1"
                      : "inherit",
                  color:
                    selectedItem === "payslip"
                      ? settings.textPrimaryColor
                      : settings.textSecondaryColor,

                  "& .MuiListItemIcon-root": {
                    color:
                      selectedItem === "payslip"
                        ? settings.textPrimaryColor
                        : settings.textSecondaryColor,
                  },
                  "& .MuiListItemText-primary": {
                    color:
                      selectedItem === "payslip"
                        ? settings.textPrimaryColor
                        : settings.textSecondaryColor,
                  },

                  "&:hover": {
                    bgcolor: settings.hoverColor || "#6D2323",
                    color: settings.textSecondaryColor,
                    "& .MuiListItemIcon-root": {
                      color: settings.textSecondaryColor,
                    },
                    "& .MuiListItemText-primary": {
                      color: settings.textSecondaryColor,
                    },
                  },

                  borderTopRightRadius: selectedItem === "payslip" ? "15px" : 0,
                  borderBottomRightRadius:
                    selectedItem === "payslip" ? "15px" : 0,
                }}
              >
                <ListItemIcon>
                  <Receipt />
                </ListItemIcon>
                <ListItemText primary="Payslip" sx={{ marginLeft: "-10px" }} />
              </ListItem>
            )}

            {userRole !== "" && (
              <>
                <ListItem
                  button
                  onClick={handleClickPDSFiles}
                  sx={{
                    color: settings.textSecondaryColor,
                    cursor: "pointer",
                  }}
                >
                  <ListItemIcon>
                    <ContactPageIcon
                      sx={{ color: settings.textSecondaryColor }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary="PDS Files"
                    sx={{ marginLeft: "-10px" }}
                  />
                  <ListItemIcon
                    sx={{
                      marginLeft: "10rem",
                      color: settings.textSecondaryColor,
                    }}
                  >
                    {open5 ? <ExpandLess /> : <ExpandMore />}
                  </ListItemIcon>
                </ListItem>

                <Collapse in={open5} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding sx={{ pl: 5.4 }}>
                    {(() => {
                      const file201Route = "/file201";
                      return shouldShowMenuItem(file201Route) ? (
                        <ListItem
                          button
                          component={Link}
                          to={file201Route}
                          onClick={() => handleItemClick("file201")}
                          sx={{
                            bgcolor:
                              selectedItem === "file201"
                                ? settings.accentColor || "#FEF9E1"
                                : "inherit",
                            color:
                              selectedItem === "file201"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color:
                                selectedItem === "file201"
                                  ? settings.textPrimaryColor
                                  : settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color:
                                selectedItem === "file201"
                                  ? settings.textPrimaryColor
                                  : settings.textSecondaryColor,
                            },
                            "&:hover": {
                              bgcolor: settings.hoverColor || "#6D2323",
                              color: settings.textSecondaryColor,
                              "& .MuiListItemIcon-root": {
                                color: settings.textSecondaryColor,
                              },
                              "& .MuiListItemText-primary": {
                                color: settings.textSecondaryColor,
                              },
                            },
                            borderTopRightRadius:
                              selectedItem === "file201" ? "15px" : 0,
                            borderBottomRightRadius:
                              selectedItem === "file201" ? "15px" : 0,
                          }}
                        >
                          <ListItemIcon sx={{ marginRight: "-1rem" }}>
                            <FolderSpecial />
                          </ListItemIcon>
                          <ListItemText
                            primary="FILE 201"
                            sx={{ marginLeft: "-10px" }}
                          />
                        </ListItem>
                      ) : null;
                    })()}

                    {/* PDS1 */}
                    {shouldShowMenuItem("/pds1") && (
                      <ListItem
                        button
                        component={Link}
                        to="/pds1"
                        onClick={() => handleItemClick("pds1")}
                        sx={{
                          bgcolor:
                            selectedItem === "pds1"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          color:
                            selectedItem === "pds1"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,

                          "& .MuiListItemIcon-root": {
                            color:
                              selectedItem === "pds1"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },
                          "& .MuiListItemText-primary": {
                            color:
                              selectedItem === "pds1"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },

                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color: settings.textSecondaryColor,
                            },
                          },

                          borderTopRightRadius:
                            selectedItem === "pds1" ? "15px" : 0,
                          borderBottomRightRadius:
                            selectedItem === "pds1" ? "15px" : 0,
                        }}
                      >
                        <ListItemIcon sx={{ marginRight: "-1rem" }}>
                          <FileCopy />
                        </ListItemIcon>
                        <ListItemText
                          primary="PDS1"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>
                    )}

                    {/* PDS2 */}
                    {shouldShowMenuItem("/pds2") && (
                      <ListItem
                        button
                        component={Link}
                        to="/pds2"
                        onClick={() => handleItemClick("pds2")}
                        sx={{
                          bgcolor:
                            selectedItem === "pds2"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          color:
                            selectedItem === "pds2"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,

                          "& .MuiListItemIcon-root": {
                            color:
                              selectedItem === "pds2"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },
                          "& .MuiListItemText-primary": {
                            color:
                              selectedItem === "pds2"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },

                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color: settings.textSecondaryColor,
                            },
                          },

                          borderTopRightRadius:
                            selectedItem === "pds2" ? "15px" : 0,
                          borderBottomRightRadius:
                            selectedItem === "pds2" ? "15px" : 0,
                        }}
                      >
                        <ListItemIcon sx={{ marginRight: "-1rem" }}>
                          <FileCopy />
                        </ListItemIcon>
                        <ListItemText
                          primary="PDS2"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>
                    )}

                    {/* PDS3 */}
                    {shouldShowMenuItem("/pds3") && (
                      <ListItem
                        button
                        component={Link}
                        to="/pds3"
                        onClick={() => handleItemClick("pds3")}
                        sx={{
                          bgcolor:
                            selectedItem === "pds3"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          color:
                            selectedItem === "pds3"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,

                          "& .MuiListItemIcon-root": {
                            color:
                              selectedItem === "pds3"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },
                          "& .MuiListItemText-primary": {
                            color:
                              selectedItem === "pds3"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },

                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color: settings.textSecondaryColor,
                            },
                          },

                          borderTopRightRadius:
                            selectedItem === "pds3" ? "15px" : 0,
                          borderBottomRightRadius:
                            selectedItem === "pds3" ? "15px" : 0,
                        }}
                      >
                        <ListItemIcon sx={{ marginRight: "-1rem" }}>
                          <FileCopy />
                        </ListItemIcon>
                        <ListItemText
                          primary="PDS3"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>
                    )}

                    {/* PDS4 */}
                    {shouldShowMenuItem("/pds4") && (
                      <ListItem
                        button
                        component={Link}
                        to="/pds4"
                        onClick={() => handleItemClick("pds4")}
                        sx={{
                          bgcolor:
                            selectedItem === "pds4"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          color:
                            selectedItem === "pds4"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,

                          "& .MuiListItemIcon-root": {
                            color:
                              selectedItem === "pds4"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },
                          "& .MuiListItemText-primary": {
                            color:
                              selectedItem === "pds4"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },

                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color: settings.textSecondaryColor,
                            },
                          },

                          borderTopRightRadius:
                            selectedItem === "pds4" ? "15px" : 0,
                          borderBottomRightRadius:
                            selectedItem === "pds4" ? "15px" : 0,
                        }}
                      >
                        <ListItemIcon sx={{ marginRight: "-1rem" }}>
                          <FileCopy />
                        </ListItemIcon>
                        <ListItemText
                          primary="PDS4"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>
                    )}
                  </List>
                </Collapse>
                {/* Settings */}
                {shouldShowMenuItem("/settings") && (
                  <ListItem
                    button
                    component={Link}
                    to="/settings"
                    onClick={() => handleItemClick("settings")}
                    sx={{
                      bgcolor:
                        selectedItem === "settings"
                          ? settings.accentColor || "#FEF9E1"
                          : "inherit",
                      color:
                        selectedItem === "settings"
                          ? settings.textPrimaryColor
                          : settings.textSecondaryColor,

                      "& .MuiListItemIcon-root": {
                        color:
                          selectedItem === "settings"
                            ? settings.textPrimaryColor
                            : settings.textSecondaryColor,
                      },
                      "& .MuiListItemText-primary": {
                        color:
                          selectedItem === "settings"
                            ? settings.textPrimaryColor
                            : settings.textSecondaryColor,
                      },
                      "&:hover": {
                        bgcolor: settings.hoverColor || "#6D2323",
                        color: settings.textSecondaryColor,
                        "& .MuiListItemIcon-root": {
                          color: settings.textSecondaryColor,
                        },
                        "& .MuiListItemText-primary": {
                          color: settings.textSecondaryColor,
                        },
                      },
                      borderTopRightRadius:
                        selectedItem === "settings" ? "15px" : 0,
                      borderBottomRightRadius:
                        selectedItem === "settings" ? "15px" : 0,
                    }}
                  >
                    <ListItemIcon sx={{ marginRight: "-1rem" }}>
                      <Settings />
                    </ListItemIcon>
                    <ListItemText
                      primary="Settings"
                      sx={{ marginLeft: "6px" }}
                    />
                  </ListItem>
                )}
              </>
            )}

            <>
              {userRole !== "staff" &&
                (drawerOpen ? (
                  <List
                    subheader={
                      <ListSubheader
                        component="div"
                        sx={{
                          bgcolor: "transparent",
                          fontWeight: "bold",
                          fontSize: "0.7rem",
                          color: settings.textSecondaryColor || "white",
                          fontFamily: "Poppins, sans-serif",
                          textTransform: "uppercase",
                          mt: -1,
                          mb: -1.5,
                        }}
                      >
                        Administrative Panel
                      </ListSubheader>
                    }
                  ></List>
                ) : (
                  <Divider
                    sx={{ borderColor: "rgba(255,255,255,0.2)", mx: 1, my: 1 }}
                  />
                ))}
            </>

            {/* System Administration */}
            {(userRole === "administrator" ||
              userRole === "superadmin" ||
              userRole === "technical") && (
              <>
                <ListItem
                  button
                  onClick={handleClickSystemAdministration}
                  sx={{
                    color: settings.textSecondaryColor,
                    cursor: "pointer",
                  }}
                >
                  <ListItemIcon>
                    <AdminPanelSettings
                      sx={{ color: settings.textSecondaryColor }}
                    />
                  </ListItemIcon>

                  <ListItemText
                    primary="System Administration"
                    sx={{ marginLeft: "-10px" }}
                  />

                  <ListItemIcon
                    sx={{
                      marginLeft: "10rem",
                      color: settings.textSecondaryColor,
                    }}
                  >
                    {openSystemAdmin ? <ExpandLess /> : <ExpandMore />}
                  </ListItemIcon>
                </ListItem>

                <Collapse in={openSystemAdmin} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding sx={{ pl: 5.4 }}>
                    {/* Reports - Hidden */}
                    {/* <ListItem
                      button
                      component={Link}
                      to="/reports"
                      onClick={() => handleItemClick("reports")}
                      sx={{
                        bgcolor:
                          selectedItem === "reports"
                            ? settings.accentColor || "#FEF9E1"
                            : "inherit",
                        color:
                          selectedItem === "reports"
                            ? settings.textPrimaryColor
                            : settings.textSecondaryColor,
                        "& .MuiListItemIcon-root": {
                          color:
                            selectedItem === "reports"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                        },
                        "& .MuiListItemText-primary": {
                          color:
                            selectedItem === "reports"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                        },
                        "&:hover": {
                          bgcolor: settings.hoverColor || "#6D2323",
                          color: settings.textSecondaryColor,
                          "& .MuiListItemIcon-root": {
                            color: settings.textSecondaryColor,
                          },
                          "& .MuiListItemText-primary": {
                            color: settings.textSecondaryColor,
                          },
                        },
                        borderTopRightRadius:
                          selectedItem === "reports" ? "15px" : 0,
                        borderBottomRightRadius:
                          selectedItem === "reports" ? "15px" : 0,
                      }}
                    >
                      <ListItemIcon sx={{ marginRight: "-1rem" }}>
                        <Assessment />
                      </ListItemIcon>
                      <ListItemText
                        primary="Reports"
                        sx={{ marginLeft: "-10px" }}
                      />
                    </ListItem> */}

                    {/* User Management - Hidden for administrators */}
                    {shouldShowMenuItem("/users-list") &&
                      userRole !== "administrator" && (
                        <ListItem
                          button
                          component={Link}
                          to="/users-list"
                          onClick={() => handleItemClick("users-list")}
                          sx={{
                            bgcolor:
                              selectedItem === "users-list"
                                ? settings.accentColor || "#FEF9E1"
                                : "inherit",
                            color:
                              selectedItem === "users-list"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color:
                                selectedItem === "users-list"
                                  ? settings.textPrimaryColor
                                  : settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color:
                                selectedItem === "users-list"
                                  ? settings.textPrimaryColor
                                  : settings.textSecondaryColor,
                            },
                            "&:hover": {
                              bgcolor: settings.hoverColor || "#6D2323",
                              color: settings.textSecondaryColor,
                              "& .MuiListItemIcon-root": {
                                color: settings.textSecondaryColor,
                              },
                              "& .MuiListItemText-primary": {
                                color: settings.textSecondaryColor,
                              },
                            },
                            borderTopRightRadius:
                              selectedItem === "users-list" ? "15px" : 0,
                            borderBottomRightRadius:
                              selectedItem === "users-list" ? "15px" : 0,
                          }}
                        >
                          <ListItemIcon sx={{ marginRight: "-1rem" }}>
                            <PeopleIcon />
                          </ListItemIcon>
                          <ListItemText
                            primary="User Management"
                            sx={{ marginLeft: "-10px" }}
                          />
                        </ListItem>
                      )}

                    {/* Registration */}
                    {shouldShowMenuItem("/registration") && (
                      <ListItem
                        button
                        component={Link}
                        to="/registration"
                        onClick={() => handleItemClick("bulk-register")}
                        sx={{
                          bgcolor:
                            selectedItem === "bulk-register"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          color:
                            selectedItem === "bulk-register"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,

                          "& .MuiListItemIcon-root": {
                            color:
                              selectedItem === "bulk-register"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },
                          "& .MuiListItemText-primary": {
                            color:
                              selectedItem === "bulk-register"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },
                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color: settings.textSecondaryColor,
                            },
                          },
                          borderTopRightRadius:
                            selectedItem === "bulk-register" ? "15px" : 0,
                          borderBottomRightRadius:
                            selectedItem === "bulk-register" ? "15px" : 0,
                        }}
                      >
                        <ListItemIcon sx={{ marginRight: "-1rem" }}>
                          <AppRegistration />
                        </ListItemIcon>
                        <ListItemText
                          primary="Registration"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>
                    )}

                    {/* Employment Category */}
                    {shouldShowMenuItem("/employee-category") && (
                      <ListItem
                        button
                        component={Link}
                        to="/employee-category"
                        onClick={() => handleItemClick("employee-category")}
                        sx={{
                          bgcolor:
                            selectedItem === "employee-category"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          color:
                            selectedItem === "employee-category"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                          "& .MuiListItemIcon-root": {
                            color:
                              selectedItem === "employee-category"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },
                          "& .MuiListItemText-primary": {
                            color:
                              selectedItem === "employee-category"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },
                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color: settings.textSecondaryColor,
                            },
                          },
                          borderTopRightRadius:
                            selectedItem === "employee-category" ? "15px" : 0,
                          borderBottomRightRadius:
                            selectedItem === "employee-category" ? "15px" : 0,
                        }}
                      >
                        <ListItemIcon sx={{ marginRight: "-1rem" }}>
                          <CategoryIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary="Employment Category"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>
                    )}

                    {/* Password Management */}
                    {shouldShowMenuItem("/reset-password") && (
                      <ListItem
                        button
                        component={Link}
                        to="/reset-password"
                        onClick={() => handleItemClick("reset-password")}
                        sx={{
                          bgcolor:
                            selectedItem === "reset-password"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          color:
                            selectedItem === "reset-password"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,

                          "& .MuiListItemIcon-root": {
                            color:
                              selectedItem === "reset-password"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },
                          "& .MuiListItemText-primary": {
                            color:
                              selectedItem === "reset-password"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },
                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color: settings.textSecondaryColor,
                            },
                          },
                          borderTopRightRadius:
                            selectedItem === "reset-password" ? "15px" : 0,
                          borderBottomRightRadius:
                            selectedItem === "reset-password" ? "15px" : 0,
                        }}
                      >
                        <ListItemIcon sx={{ marginRight: "-1rem" }}>
                          <LockOpen />
                        </ListItemIcon>
                        <ListItemText
                          primary="Password Management"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>
                    )}

                    {/* Payroll Formulas - Hidden for administrators */}
                    {shouldShowMenuItem("/payroll-formulas") &&
                      userRole !== "administrator" && (
                        <ListItem
                          button
                          component={Link}
                          to="/payroll-formulas"
                          onClick={() => handleItemClick("payroll-formulas")}
                          sx={{
                            bgcolor:
                              selectedItem === "payroll-formulas"
                                ? settings.accentColor || "#FEF9E1"
                                : "inherit",
                            color:
                              selectedItem === "payroll-formulas"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color:
                                selectedItem === "payroll-formulas"
                                  ? settings.textPrimaryColor
                                  : settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color:
                                selectedItem === "payroll-formulas"
                                  ? settings.textPrimaryColor
                                  : settings.textSecondaryColor,
                            },
                            "&:hover": {
                              bgcolor: settings.hoverColor || "#6D2323",
                              color: settings.textSecondaryColor,
                              "& .MuiListItemIcon-root": {
                                color: settings.textSecondaryColor,
                              },
                              "& .MuiListItemText-primary": {
                                color: settings.textSecondaryColor,
                              },
                            },
                            borderTopRightRadius:
                              selectedItem === "payroll-formulas" ? "15px" : 0,
                            borderBottomRightRadius:
                              selectedItem === "payroll-formulas" ? "15px" : 0,
                          }}
                        >
                          <ListItemIcon sx={{ marginRight: "-1rem" }}>
                            <CalculateIcon />
                          </ListItemIcon>
                          <ListItemText
                            primary="Payroll Formulations"
                            sx={{ marginLeft: "-10px" }}
                          />
                        </ListItem>
                      )}

                    {/* Admin Security - Hidden for administrators */}
                    {shouldShowMenuItem("/admin-security") &&
                      userRole !== "administrator" && (
                        <ListItem
                          button
                          component={Link}
                          to="/admin-security"
                          onClick={() => handleItemClick("admin-security")}
                          sx={{
                            bgcolor:
                              selectedItem === "admin-security"
                                ? settings.accentColor || "#FEF9E1"
                                : "inherit",
                            color:
                              selectedItem === "admin-security"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color:
                                selectedItem === "admin-security"
                                  ? settings.textPrimaryColor
                                  : settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color:
                                selectedItem === "admin-security"
                                  ? settings.textPrimaryColor
                                  : settings.textSecondaryColor,
                            },
                            "&:hover": {
                              bgcolor: settings.hoverColor || "#6D2323",
                              color: settings.textSecondaryColor,
                              "& .MuiListItemIcon-root": {
                                color: settings.textSecondaryColor,
                              },
                              "& .MuiListItemText-primary": {
                                color: settings.textSecondaryColor,
                              },
                            },
                            borderTopRightRadius:
                              selectedItem === "admin-security" ? "15px" : 0,
                            borderBottomRightRadius:
                              selectedItem === "admin-security" ? "15px" : 0,
                          }}
                        >
                          <ListItemIcon sx={{ marginRight: "-1rem" }}>
                            <AdminPanelSettings />
                          </ListItemIcon>
                          <ListItemText
                            primary="System Configuration"
                            sx={{ marginLeft: "-10px" }}
                          />
                        </ListItem>
                      )}

                    {/* PDS Templates - Technical only */}
                    {(userRole === "technical" || userRole === "superadmin") &&
                      shouldShowMenuItem("/pds-templates") && (
                        <ListItem
                          button
                          component={Link}
                          to="/pds-templates"
                          onClick={() => handleItemClick("pds-templates")}
                          sx={{
                            bgcolor:
                              selectedItem === "pds-templates"
                                ? settings.accentColor || "#FEF9E1"
                                : "inherit",
                            color:
                              selectedItem === "pds-templates"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color:
                                selectedItem === "pds-templates"
                                  ? settings.textPrimaryColor
                                  : settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color:
                                selectedItem === "pds-templates"
                                  ? settings.textPrimaryColor
                                  : settings.textSecondaryColor,
                            },
                            "&:hover": {
                              bgcolor: settings.hoverColor || "#6D2323",
                              color: settings.textSecondaryColor,
                              "& .MuiListItemIcon-root": {
                                color: settings.textSecondaryColor,
                              },
                              "& .MuiListItemText-primary": {
                                color: settings.textSecondaryColor,
                              },
                            },
                            borderTopRightRadius:
                              selectedItem === "pds-templates" ? "15px" : 0,
                            borderBottomRightRadius:
                              selectedItem === "pds-templates" ? "15px" : 0,
                          }}
                        >
                          <ListItemIcon sx={{ marginRight: "-1rem" }}>
                            <ContactPageIcon />
                          </ListItemIcon>
                          <ListItemText
                            primary="PDS Version Templates"
                            sx={{ marginLeft: "-10px" }}
                          />
                        </ListItem>
                      )}

                    {/* System Settings - Technical only */}
                    {(userRole === "technical" || userRole === "superadmin") &&
                      shouldShowMenuItem("/system-settings") && (
                        <ListItem
                          button
                          component={Link}
                          to="/system-settings"
                          onClick={() => handleItemClick("system-settings")}
                          sx={{
                            bgcolor:
                              selectedItem === "system-settings"
                                ? settings.accentColor || "#FEF9E1"
                                : "inherit",
                            color:
                              selectedItem === "system-settings"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color:
                                selectedItem === "system-settings"
                                  ? settings.textPrimaryColor
                                  : settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color:
                                selectedItem === "system-settings"
                                  ? settings.textPrimaryColor
                                  : settings.textSecondaryColor,
                            },
                            "&:hover": {
                              bgcolor: settings.hoverColor || "#6D2323",
                              color: settings.textSecondaryColor,
                              "& .MuiListItemIcon-root": {
                                color: settings.textSecondaryColor,
                              },
                              "& .MuiListItemText-primary": {
                                color: settings.textSecondaryColor,
                              },
                            },
                            borderTopRightRadius:
                              selectedItem === "system-settings" ? "15px" : 0,
                            borderBottomRightRadius:
                              selectedItem === "system-settings" ? "15px" : 0,
                          }}
                        >
                          <ListItemIcon sx={{ marginRight: "-1rem" }}>
                            <Settings />
                          </ListItemIcon>
                          <ListItemText
                            primary="System Settings"
                            sx={{ marginLeft: "-10px" }}
                          />
                        </ListItem>
                      )}
                  </List>
                </Collapse>
              </>
            )}

            {/* Employee Reports - Commented out for staff role */}
            {/* {userRole === "staff" && (
              <ListItem
                button
                component={Link}
                to="/employee-reports"
                onClick={() => handleItemClick("employee-reports")}
                sx={{
                  bgcolor:
                    selectedItem === "employee-reports"
                      ? settings.accentColor || "#FEF9E1"
                      : "inherit",
                  color:
                    selectedItem === "employee-reports"
                      ? settings.textPrimaryColor
                      : settings.textSecondaryColor,

                  "& .MuiListItemIcon-root": {
                    color:
                      selectedItem === "employee-reports"
                        ? settings.textPrimaryColor
                        : settings.textSecondaryColor,
                  },
                  "& .MuiListItemText-primary": {
                    color:
                      selectedItem === "employee-reports"
                        ? settings.textPrimaryColor
                        : settings.textSecondaryColor,
                  },

                  "&:hover": {
                    bgcolor: settings.hoverColor || "#6D2323",
                    color: settings.textSecondaryColor,
                    "& .MuiListItemIcon-root": {
                      color: settings.textSecondaryColor,
                    },
                    "& .MuiListItemText-primary": {
                      color: settings.textSecondaryColor,
                    },
                  },

                  borderTopRightRadius:
                    selectedItem === "employee-reports" ? "15px" : 0,
                  borderBottomRightRadius:
                    selectedItem === "employee-reports" ? "15px" : 0,
                }}
              >
                <ListItemIcon>
                  <PeopleAltIcon sx={{ fontSize: 29, marginLeft: "-6%" }} />
                </ListItemIcon>
                <ListItemText
                  primary="Employee Reports"
                  sx={{ marginLeft: "-10px" }}
                />
              </ListItem>
            )} */}

            {userRole !== "staff" &&
              attendanceManagementItems.some((item) =>
                shouldShowMenuItem(`/${item.replace(/_/g, "-")}`),
              ) && (
                <>
                  <ListItem
                    button
                    onClick={() => {
                      handleClickAttendance("Records");
                      handleClickAttendance();
                    }}
                    sx={{
                      color: settings.textSecondaryColor,
                      cursor: "pointer",
                      borderTopRightRadius:
                        selectedItem === "Records" ? "15px" : 0,
                      borderBottomRightRadius:
                        selectedItem === "Records" ? "15px" : 0,
                    }}
                  >
                    <ListItemIcon>
                      <AccessTimeIcon
                        sx={{ color: settings.textSecondaryColor }}
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary="Attendance Management"
                      sx={{ marginLeft: "-10px" }}
                    />
                    <ListItemIcon
                      sx={{
                        marginLeft: "10rem",
                        color: settings.textSecondaryColor,
                      }}
                    >
                      {open2 ? <ExpandLess /> : <ExpandMore />}
                    </ListItemIcon>
                  </ListItem>

                  <Collapse in={open2} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding sx={{ pl: 5.4 }}>
                      {/* DEVICE RECORD */}
                      <ListItem
                        button
                        component={Link}
                        to="/view_attendance"
                        onClick={() => handleItemClick("view_attendance")}
                        sx={{
                          bgcolor:
                            selectedItem === "view_attendance"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          color:
                            selectedItem === "view_attendance"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,

                          "& .MuiListItemIcon-root": {
                            color:
                              selectedItem === "view_attendance"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },
                          "& .MuiListItemText-primary": {
                            color:
                              selectedItem === "view_attendance"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },

                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color: settings.textSecondaryColor,
                            },
                          },

                          borderTopRightRadius:
                            selectedItem === "view_attendance" ? "15px" : 0,
                          borderBottomRightRadius:
                            selectedItem === "view_attendance" ? "15px" : 0,
                        }}
                      >
                        <ListItemIcon sx={{ marginRight: "-1rem" }}>
                          <DevicesIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary="Device Record"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>

                      {/* ATTENDANCE STATE */}
                      <ListItem
                        button
                        component={Link}
                        to="/attendance_form"
                        onClick={() => handleItemClick("attendance_form")}
                        sx={{
                          bgcolor:
                            selectedItem === "attendance_form"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          color:
                            selectedItem === "attendance_form"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,

                          "& .MuiListItemIcon-root": {
                            color:
                              selectedItem === "attendance_form"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },
                          "& .MuiListItemText-primary": {
                            color:
                              selectedItem === "attendance_form"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },

                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color: settings.textSecondaryColor,
                            },
                          },

                          borderTopRightRadius:
                            selectedItem === "attendance_form" ? "15px" : 0,
                          borderBottomRightRadius:
                            selectedItem === "attendance_form" ? "15px" : 0,
                        }}
                      >
                        <ListItemIcon sx={{ marginRight: "-1rem" }}>
                          <EventNote />
                        </ListItemIcon>
                        <ListItemText
                          primary="Attendance State"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>

                      {/* ATTENDANCE MODIFICATION */}
                      <ListItem
                        button
                        component={Link}
                        to="/search_attendance"
                        onClick={() => handleItemClick("search_attendance")}
                        sx={{
                          bgcolor:
                            selectedItem === "search_attendance"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          color:
                            selectedItem === "search_attendance"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,

                          "& .MuiListItemIcon-root": {
                            color:
                              selectedItem === "search_attendance"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },
                          "& .MuiListItemText-primary": {
                            color:
                              selectedItem === "search_attendance"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },

                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color: settings.textSecondaryColor,
                            },
                          },

                          borderTopRightRadius:
                            selectedItem === "search_attendance" ? "15px" : 0,
                          borderBottomRightRadius:
                            selectedItem === "search_attendance" ? "15px" : 0,
                        }}
                      >
                        <ListItemIcon sx={{ marginRight: "-1rem" }}>
                          <EditCalendar />
                        </ListItemIcon>
                        <ListItemText
                          primary="Attendance Modification"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>

                      {/* OVERALL DAILY TIME RECORD */}
                      <ListItem
                        button
                        component={Link}
                        to="/daily_time_record_faculty"
                        onClick={() =>
                          handleItemClick("daily_time_record_faculty")
                        }
                        sx={{
                          bgcolor:
                            selectedItem === "daily_time_record_faculty"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          color:
                            selectedItem === "daily_time_record_faculty"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,

                          "& .MuiListItemIcon-root": {
                            color:
                              selectedItem === "daily_time_record_faculty"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },
                          "& .MuiListItemText-primary": {
                            color:
                              selectedItem === "daily_time_record_faculty"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },

                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color: settings.textSecondaryColor,
                            },
                          },

                          borderTopRightRadius:
                            selectedItem === "daily_time_record_faculty"
                              ? "15px"
                              : 0,
                          borderBottomRightRadius:
                            selectedItem === "daily_time_record_faculty"
                              ? "15px"
                              : 0,
                        }}
                      >
                        <ListItemIcon sx={{ marginRight: "-1rem" }}>
                          <BadgeRounded />
                        </ListItemIcon>
                        <ListItemText
                          primary="Overall Daily Time Record"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>

                      {/* Attendance Module (Non-teaching) */}
                      <ListItem
                        button
                        component={Link}
                        to="/attendance_module"
                        sx={{
                          color:
                            selectedItem === "attendance_module"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                          bgcolor:
                            selectedItem === "attendance_module"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            borderTopRightRadius: "15px",
                            borderBottomRightRadius: "15px",
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                          },
                          borderTopRightRadius:
                            selectedItem === "attendance_module" ? "15px" : 0,
                          borderBottomRightRadius:
                            selectedItem === "attendance_module" ? "15px" : 0,
                        }}
                        onClick={() => handleItemClick("attendance_module")}
                      >
                        <ListItemIcon
                          sx={{
                            marginRight: "-1rem",
                            color:
                              selectedItem === "attendance_module"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                            "&:hover": { color: settings.textSecondaryColor },
                          }}
                        >
                          <WorkHistory />
                        </ListItemIcon>
                        <ListItemText
                          primary="Attendance Records (Non-teaching | JO)"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>

                      {/* Attendance Module Faculty (30hrs) */}
                      <ListItem
                        button
                        component={Link}
                        to="/attendance_module_faculty"
                        sx={{
                          color:
                            selectedItem === "attendance_module_faculty"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                          bgcolor:
                            selectedItem === "attendance_module_faculty"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            borderTopRightRadius: "15px",
                            borderBottomRightRadius: "15px",
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                          },
                          borderTopRightRadius:
                            selectedItem === "attendance_module_faculty"
                              ? "15px"
                              : 0,
                          borderBottomRightRadius:
                            selectedItem === "attendance_module_faculty"
                              ? "15px"
                              : 0,
                        }}
                        onClick={() =>
                          handleItemClick("attendance_module_faculty")
                        }
                      >
                        <ListItemIcon
                          sx={{
                            marginRight: "-1rem",
                            color:
                              selectedItem === "attendance_module_faculty"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                            "&:hover": { color: settings.textSecondaryColor },
                          }}
                        >
                          <WorkHistory />
                        </ListItemIcon>
                        <ListItemText
                          primary="Attendance Records (30 Hours)"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>

                      {/* Attendance Module Faculty (Designated) */}
                      <ListItem
                        button
                        component={Link}
                        to="/attendance_module_faculty_40hrs"
                        sx={{
                          color:
                            selectedItem === "attendance_module_faculty_40hrs"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                          bgcolor:
                            selectedItem === "attendance_module_faculty_40hrs"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            borderTopRightRadius: "15px",
                            borderBottomRightRadius: "15px",
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                          },
                          borderTopRightRadius:
                            selectedItem === "attendance_module_faculty_40hrs"
                              ? "15px"
                              : 0,
                          borderBottomRightRadius:
                            selectedItem === "attendance_module_faculty_40hrs"
                              ? "15px"
                              : 0,
                        }}
                        onClick={() =>
                          handleItemClick("attendance_module_faculty_40hrs")
                        }
                      >
                        <ListItemIcon
                          sx={{
                            marginRight: "-1rem",
                            color:
                              selectedItem === "attendance_module_faculty_40hrs"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                            "&:hover": { color: settings.textSecondaryColor },
                          }}
                        >
                          <WorkHistory />
                        </ListItemIcon>
                        <ListItemText
                          primary="Attendance Records (Designated)"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>

                      {/* Attendance Overall Summary */}
                      <ListItem
                        button
                        component={Link}
                        to="/attendance_summary"
                        sx={{
                          color:
                            selectedItem === "attendance_summary"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                          bgcolor:
                            selectedItem === "attendance_summary"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            borderTopRightRadius: "15px",
                            borderBottomRightRadius: "15px",
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                          },
                          borderTopRightRadius:
                            selectedItem === "attendance_summary" ? "15px" : 0,
                          borderBottomRightRadius:
                            selectedItem === "attendance_summary" ? "15px" : 0,
                        }}
                        onClick={() => handleItemClick("attendance_summary")}
                      >
                        <ListItemIcon
                          sx={{
                            marginRight: "-1rem",
                            color:
                              selectedItem === "attendance_summary"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                            "&:hover": { color: settings.textSecondaryColor },
                          }}
                        >
                          <FolderSpecial />
                        </ListItemIcon>
                        <ListItemText
                          primary="Attendance Overall Summary"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>

                      {/* Official Time Form */}
                      <ListItem
                        button
                        component={Link}
                        to="/official_time"
                        sx={{
                          color:
                            selectedItem === "official_time"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                          bgcolor:
                            selectedItem === "official_time"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            borderTopRightRadius: "15px",
                            borderBottomRightRadius: "15px",
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                          },
                          borderTopRightRadius:
                            selectedItem === "official_time" ? "15px" : 0,
                          borderBottomRightRadius:
                            selectedItem === "official_time" ? "15px" : 0,
                        }}
                        onClick={() => handleItemClick("official_time")}
                      >
                        <ListItemIcon
                          sx={{
                            marginRight: "-1rem",
                            color:
                              selectedItem === "official_time"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                            "&:hover": { color: settings.textSecondaryColor },
                          }}
                        >
                          <AccessAlarm />
                        </ListItemIcon>
                        <ListItemText
                          primary="Official Time Form"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>
                    </List>
                  </Collapse>
                </>
              )}

            {/* LEAVE DROPDOWN */}
            {(shouldShowMenuItem("/leave-table") ||
              shouldShowMenuItem("/leave-assignment") ||
              shouldShowMenuItem("/leave-request")) && (
              <>
                <ListItem
                  button
                  onClick={handleClickLeave}
                  sx={{
                    color: settings.textSecondaryColor,
                    cursor: "pointer",
                    "&:hover": {
                      bgcolor: settings.hoverColor || "#6D2323",
                    },
                  }}
                >
                  <ListItemIcon>
                    <EventNote sx={{ color: settings.textSecondaryColor }} />
                  </ListItemIcon>
                  <ListItemText
                    primary="Leave Management"
                    sx={{ marginLeft: "-10px", whiteSpace: "noWrap" }}
                  />
                  <ListItemIcon
                    sx={{
                      marginLeft: "10rem",
                      color: settings.textSecondaryColor,
                    }}
                  >
                    {openLeave ? <ExpandLess /> : <ExpandMore />}
                  </ListItemIcon>
                </ListItem>

                <Collapse in={openLeave} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding sx={{ pl: 5.4 }}>
                    
                     {userRole !== "staff" &&
                      shouldShowMenuItem("/assignment-management") && (
                        <ListItem
                          button
                          component={Link}
                          to="/assignment-management"
                          onClick={() => handleItemClick("assignment-management")}
                          sx={{
                            bgcolor:
                              selectedItem === "assignment-management"
                                ? settings.accentColor || "#FEF9E1"
                                : "inherit",
                            color:
                              selectedItem === "assignment-management"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color:
                                selectedItem === "assignment-management"
                                  ? settings.textPrimaryColor
                                  : settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color:
                                selectedItem === "assignment-management"
                                  ? settings.textPrimaryColor
                                  : settings.textSecondaryColor,
                            },
                            "&:hover": {
                              bgcolor: settings.hoverColor || "#6D2323",
                              color: settings.textSecondaryColor,
                                 borderTopRightRadius: "15px",      
          borderBottomRightRadius: "15px",
                              "& .MuiListItemIcon-root": {
                                color: settings.textSecondaryColor,
                              },
                              "& .MuiListItemText-primary": {
                                color: settings.textSecondaryColor,
                              },
                            },
                            borderTopRightRadius:
                              selectedItem === "assignment-management" ? "15px" : 0,
                            borderBottomRightRadius:
                              selectedItem === "assignment-management" ? "15px" : 0,
                          }}
                        >
                          <ListItemIcon sx={{ marginRight: "-1rem" }}>
                            <PostAdd />
                          </ListItemIcon>
                          <ListItemText
                            primary="Assignment Management"
                            sx={{ marginLeft: "-10px" }}
                          />
                        </ListItem>
                      )}

                      {/* Earnings Management */}
                       {userRole !== "staff" &&
                      shouldShowMenuItem("/earnings-management") && (
                        <ListItem
                          button
                          component={Link}
                          to="/earnings-management"
                          onClick={() => handleItemClick("earnings-management")}
                          sx={{
                            bgcolor:
                              selectedItem === "earnings-management"
                                ? settings.accentColor || "#FEF9E1"
                                : "inherit",
                            color:
                              selectedItem === "earnings-management"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color:
                                selectedItem === "earnings-management"
                                  ? settings.textPrimaryColor
                                  : settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color:
                                selectedItem === "earnings-management"
                                  ? settings.textPrimaryColor
                                  : settings.textSecondaryColor,
                            },
                            "&:hover": {
                              bgcolor: settings.hoverColor || "#6D2323",
                              color: settings.textSecondaryColor,
                                 borderTopRightRadius: "15px",      
                                 borderBottomRightRadius: "15px",
                              "& .MuiListItemIcon-root": {
                                color: settings.textSecondaryColor,
                              },
                              "& .MuiListItemText-primary": {
                                color: settings.textSecondaryColor,
                              },
                            },
                            borderTopRightRadius:
                              selectedItem === "earnings-management" ? "15px" : 0,
                            borderBottomRightRadius:
                              selectedItem === "earnings-management" ? "15px" : 0,
                          }}
                        >
                          <ListItemIcon sx={{ marginRight: "-1rem" }}>
                            <PlaylistAdd />
                          </ListItemIcon>
                          <ListItemText
                            primary="Earnings Management"
                            sx={{ marginLeft: "-10px" }}
                          />
                        </ListItem>
                      )}
                    
          
                    

                    {/* Leave Assignment - Admin only */}
                    {/* {userRole !== "staff" &&
                      shouldShowMenuItem("/leave-assignment") && (
                        <ListItem
                          button
                          component={Link}
                          to="/leave-assignment"
                          onClick={() => handleItemClick("leave-assignment")}
                          sx={{
                            bgcolor:
                              selectedItem === "leave-assignment"
                                ? settings.accentColor || "#FEF9E1"
                                : "inherit",
                            color:
                              selectedItem === "leave-assignment"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color:
                                selectedItem === "leave-assignment"
                                  ? settings.textPrimaryColor
                                  : settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color:
                                selectedItem === "leave-assignment"
                                  ? settings.textPrimaryColor
                                  : settings.textSecondaryColor,
                            },
                            "&:hover": {
                              bgcolor: settings.hoverColor || "#6D2323",
                              color: settings.textSecondaryColor,
                              "& .MuiListItemIcon-root": {
                                color: settings.textSecondaryColor,
                              },
                              "& .MuiListItemText-primary": {
                                color: settings.textSecondaryColor,
                              },
                            },
                            borderTopRightRadius:
                              selectedItem === "leave-assignment" ? "15px" : 0,
                            borderBottomRightRadius:
                              selectedItem === "leave-assignment" ? "15px" : 0,
                          }}
                        >
                          <ListItemIcon sx={{ marginRight: "-1rem" }}>
                            <AssignmentIcon />
                          </ListItemIcon>
                          <ListItemText
                            primary="Leave Assignment"
                            sx={{ marginLeft: "-10px" }}
                          />
                        </ListItem>
                      )} */}

                    {/* Leave Request - Admin only */}
                    {userRole !== "staff" &&
                      shouldShowMenuItem("/leave-request") && (
                        <ListItem
                          button
                          component={Link}
                          to="/leave-request"
                          onClick={() => handleItemClick("leave-request")}
                          sx={{
                            bgcolor:
                              selectedItem === "leave-request"
                                ? settings.accentColor || "#FEF9E1"
                                : "inherit",
                            color:
                              selectedItem === "leave-request"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color:
                                selectedItem === "leave-request"
                                  ? settings.textPrimaryColor
                                  : settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color:
                                selectedItem === "leave-request"
                                  ? settings.textPrimaryColor
                                  : settings.textSecondaryColor,
                            },
                            "&:hover": {
                              bgcolor: settings.hoverColor || "#6D2323",
                              color: settings.textSecondaryColor,
                              "& .MuiListItemIcon-root": {
                                color: settings.textSecondaryColor,
                              },
                              "& .MuiListItemText-primary": {
                                color: settings.textSecondaryColor,
                              },
                            },
                            borderTopRightRadius:
                              selectedItem === "leave-request" ? "15px" : 0,
                            borderBottomRightRadius:
                              selectedItem === "leave-request" ? "15px" : 0,
                          }}
                        >
                          <ListItemIcon sx={{ marginRight: "-1rem" }}>
                            <DescriptionIcon />
                          </ListItemIcon>
                          <ListItemText
                            primary="Leave Request Management"
                            sx={{ marginLeft: "-10px" }}
                          />
                        </ListItem>
                      )}

                    {/* Leave Commutation - Admin only */}
                    {userRole !== "staff" &&
                      shouldShowMenuItem("/leave-commutation") && (
                        <ListItem
                          button
                          component={Link}
                          to="/leave-commutation"
                          onClick={() => handleItemClick("leave-commutation")}
                          sx={{
                            bgcolor:
                              selectedItem === "leave-commutation"
                                ? settings.accentColor || "#FEF9E1"
                                : "inherit",
                            color:
                              selectedItem === "leave-commutation"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color:
                                selectedItem === "leave-commutation"
                                  ? settings.textPrimaryColor
                                  : settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color:
                                selectedItem === "leave-commutation"
                                  ? settings.textPrimaryColor
                                  : settings.textSecondaryColor,
                            },
                            "&:hover": {
                              bgcolor: settings.hoverColor || "#6D2323",
                              color: settings.textSecondaryColor,
                              "& .MuiListItemIcon-root": {
                                color: settings.textSecondaryColor,
                              },
                              "& .MuiListItemText-primary": {
                                color: settings.textSecondaryColor,
                              },
                            },
                            borderTopRightRadius:
                              selectedItem === "leave-commutation" ? "15px" : 0,
                            borderBottomRightRadius:
                              selectedItem === "leave-commutation" ? "15px" : 0,
                          }}
                        >
                          <ListItemIcon sx={{ marginRight: "-1rem" }}>
                            <MonetizationOnIcon />
                          </ListItemIcon>
                          <ListItemText
                            primary="Leave Commutation"
                            sx={{ marginLeft: "-10px" }}
                          />
                        </ListItem>
                      )}

                       {/* Leave Table - Admin only */}
                    {userRole !== "staff" &&
                      shouldShowMenuItem("/leave-table") && (
                        <ListItem
                          button
                          component={Link}
                          to="/leave-table"
                          onClick={() => handleItemClick("leave-table")}
                          sx={{
                            bgcolor:
                              selectedItem === "leave-table"
                                ? settings.accentColor || "#FEF9E1"
                                : "inherit",
                            color:
                              selectedItem === "leave-table"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color:
                                selectedItem === "leave-table"
                                  ? settings.textPrimaryColor
                                  : settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color:
                                selectedItem === "leave-table"
                                  ? settings.textPrimaryColor
                                  : settings.textSecondaryColor,
                            },
                            "&:hover": {
                              bgcolor: settings.hoverColor || "#6D2323",
                              color: settings.textSecondaryColor,
                              "& .MuiListItemIcon-root": {
                                color: settings.textSecondaryColor,
                              },
                              "& .MuiListItemText-primary": {
                                color: settings.textSecondaryColor,
                              },
                            },
                            borderTopRightRadius:
                              selectedItem === "leave-table" ? "15px" : 0,
                            borderBottomRightRadius:
                              selectedItem === "leave-table" ? "15px" : 0,
                          }}
                        >
                          <ListItemIcon sx={{ marginRight: "-1rem" }}>
                            <TableChartIcon />
                          </ListItemIcon>
                          <ListItemText
                            primary="Leave Table"
                            sx={{ marginLeft: "-10px" }}
                          />
                        </ListItem>
                      )}

                      
                      {/*Service Credits - Admin only */}
                    {/* {userRole !== "staff" &&
                      shouldShowMenuItem("/service-credits") && (
                        <ListItem
                          button
                          component={Link}
                          to="/service-credits"
                          onClick={() => handleItemClick("service-credits")}
                          sx={{
                            bgcolor:
                              selectedItem === "service-credits"
                                ? settings.accentColor || "#FEF9E1"
                                : "inherit",
                            color:
                              selectedItem === "service-credits"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color:
                                selectedItem === "service-credits"
                                  ? settings.textPrimaryColor
                                  : settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color:
                                selectedItem === "service-credits"
                                  ? settings.textPrimaryColor
                                  : settings.textSecondaryColor,
                            },
                            "&:hover": {
                              bgcolor: settings.hoverColor || "#6D2323",
                              color: settings.textSecondaryColor,
                              "& .MuiListItemIcon-root": {
                                color: settings.textSecondaryColor,
                              },
                              "& .MuiListItemText-primary": {
                                color: settings.textSecondaryColor,
                              },
                            },
                            borderTopRightRadius:
                              selectedItem === "service-credits" ? "15px" : 0,
                            borderBottomRightRadius:
                              selectedItem === "service-credits" ? "15px" : 0,
                          }}
                        >
                          <ListItemIcon sx={{ marginRight: "-1rem" }}>
                            <AssignmentIcon />
                          </ListItemIcon>
                          <ListItemText
                            primary="Service Credits"
                            sx={{ marginLeft: "-10px" }}
                          />
                        </ListItem>
                      )} */}
                  </List>
                </Collapse>
              </>
            )}

        

            {userRole !== "staff" &&
              payrollManagementItems.some((item) =>
                shouldShowMenuItem(`/${item.replace(/_/g, "-")}`),
              ) && (
                <>
                  <ListItem
                    button
                    onClick={handleClickPayroll}
                    sx={{
                      color: settings.textSecondaryColor,
                      cursor: "pointer",
                    }}
                  >
                    <ListItemIcon>
                      <PointOfSale
                        sx={{ color: settings.textSecondaryColor }}
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary="Payroll Management"
                      sx={{ marginLeft: "-10px" }}
                    />
                    <ListItemIcon
                      sx={{
                        marginLeft: "10rem",
                        color: settings.textSecondaryColor,
                      }}
                    >
                      {open3 ? <ExpandLess /> : <ExpandMore />}
                    </ListItemIcon>
                  </ListItem>

                  <Collapse in={open3} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding sx={{ pl: 5.4 }}>
                      {/* Regular Payroll Dropdown */}
                      <ListSubheader
                        component="div"
                        sx={{
                          bgcolor: "transparent",
                          fontWeight: "bold",
                          fontSize: "0.7rem",
                          color: settings.textSecondaryColor,
                          fontFamily: "Poppins, sans-serif",
                          textTransform: "uppercase",
                          mb: -1,
                          pl: 2,
                        }}
                      >
                        Regular Payroll
                      </ListSubheader>
                      <ListItem
                        button
                        component={Link}
                        to="/payroll-table"
                        selected={selectedItem === "payroll-table"}
                        onClick={() => handleItemClick("payroll-table")}
                        sx={{
                          color:
                            selectedItem === "payroll-table"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                          bgcolor:
                            selectedItem === "payroll-table"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            borderTopRightRadius: "15px",
                            borderBottomRightRadius: "15px",
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                          },
                          borderTopRightRadius:
                            selectedItem === "payroll-table" ? "15px" : 0,
                          borderBottomRightRadius:
                            selectedItem === "payroll-table" ? "15px" : 0,
                        }}
                      >
                        <ListItemIcon
                          sx={{
                            color:
                              selectedItem === "payroll-table"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          }}
                        >
                          <Assessment />
                        </ListItemIcon>
                        <ListItemText
                          primary="Payroll Processing | Regular"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>
                      <ListItem
                        button
                        component={Link}
                        to="/payroll-processed"
                        selected={selectedItem === "payroll-processed"}
                        onClick={() => handleItemClick("payroll-processed")}
                        sx={{
                          color:
                            selectedItem === "payroll-processed"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                          bgcolor:
                            selectedItem === "payroll-processed"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            borderTopRightRadius: "15px",
                            borderBottomRightRadius: "15px",
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                          },
                          borderTopRightRadius:
                            selectedItem === "payroll-processed" ? "15px" : 0,
                          borderBottomRightRadius:
                            selectedItem === "payroll-processed" ? "15px" : 0,
                        }}
                      >
                        <ListItemIcon
                          sx={{
                            color:
                              selectedItem === "payroll-processed"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          }}
                        >
                          <PaymentsIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary="Payroll Processed | Regular"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>

                      {/* JO Payroll Dropdown */}
                      <ListSubheader
                        component="div"
                        sx={{
                          bgcolor: "transparent",
                          fontWeight: "bold",
                          fontSize: "0.7rem",
                          color: settings.textSecondaryColor,
                          fontFamily: "Poppins, sans-serif",
                          textTransform: "uppercase",
                          mb: -1,
                          pl: 2,
                        }}
                      >
                        JO Payroll
                      </ListSubheader>
                      <ListItem
                        button
                        component={Link}
                        to="/payroll-jo"
                        selected={selectedItem === "payroll-jo"}
                        onClick={() => handleItemClick("payroll-jo")}
                        sx={{
                          color:
                            selectedItem === "payroll-jo"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                          bgcolor:
                            selectedItem === "payroll-jo"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            borderTopRightRadius: "15px",
                            borderBottomRightRadius: "15px",
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                          },
                          borderTopRightRadius:
                            selectedItem === "payroll-jo" ? "15px" : 0,
                          borderBottomRightRadius:
                            selectedItem === "payroll-jo" ? "15px" : 0,
                        }}
                      >
                        <ListItemIcon
                          sx={{
                            color:
                              selectedItem === "payroll-jo"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          }}
                        >
                          <Assessment />
                        </ListItemIcon>
                        <ListItemText
                          primary="Payroll Processing | JO"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>
                      <ListItem
                        button
                        component={Link}
                        to="/payroll-processed-jo"
                        selected={selectedItem === "payroll-processed-jo"}
                        onClick={() => handleItemClick("payroll-processed-jo")}
                        sx={{
                          color:
                            selectedItem === "payroll-processed-jo"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                          bgcolor:
                            selectedItem === "payroll-processed-jo"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            borderTopRightRadius: "15px",
                            borderBottomRightRadius: "15px",
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                          },
                          borderTopRightRadius:
                            selectedItem === "payroll-processed-jo"
                              ? "15px"
                              : 0,
                          borderBottomRightRadius:
                            selectedItem === "payroll-processed-jo"
                              ? "15px"
                              : 0,
                        }}
                      >
                        <ListItemIcon
                          sx={{
                            color:
                              selectedItem === "payroll-processed-jo"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          }}
                        >
                          <PaymentsIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary="Payroll Processed | JO"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>

                      {/* Payroll Administration Dropdown */}
                      <ListSubheader
                        component="div"
                        sx={{
                          bgcolor: "transparent",
                          fontWeight: "bold",
                          fontSize: "0.7rem",
                          color: settings.textSecondaryColor,
                          fontFamily: "Poppins, sans-serif",
                          textTransform: "uppercase",
                          mb: -1,
                          pl: 2,
                        }}
                      >
                        Payslips
                      </ListSubheader>
                      <ListItem
                        button
                        component={Link}
                        to="/payroll-released"
                        selected={selectedItem === "payroll-released"}
                        onClick={() => handleItemClick("payroll-released")}
                        sx={{
                          color:
                            selectedItem === "payroll-released"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                          bgcolor:
                            selectedItem === "payroll-released"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            borderTopRightRadius: "15px",
                            borderBottomRightRadius: "15px",
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                          },
                          borderTopRightRadius:
                            selectedItem === "payroll-released" ? "15px" : 0,
                          borderBottomRightRadius:
                            selectedItem === "payroll-released" ? "15px" : 0,
                        }}
                      >
                        <ListItemIcon
                          sx={{
                            color:
                              selectedItem === "payroll-released"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          }}
                        >
                          <NewReleases />
                        </ListItemIcon>
                        <ListItemText
                          primary="Payroll | Released"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>
                      <ListItem
                        button
                        component={Link}
                        to="/distribution-payslip"
                        selected={selectedItem === "distribution-payslip"}
                        onClick={() => handleItemClick("distribution-payslip")}
                        sx={{
                          color:
                            selectedItem === "distribution-payslip"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                          bgcolor:
                            selectedItem === "distribution-payslip"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            borderTopRightRadius: "15px",
                            borderBottomRightRadius: "15px",
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                          },
                          borderTopRightRadius:
                            selectedItem === "distribution-payslip"
                              ? "15px"
                              : 0,
                          borderBottomRightRadius:
                            selectedItem === "distribution-payslip"
                              ? "15px"
                              : 0,
                        }}
                      >
                        <ListItemIcon
                          sx={{
                            color:
                              selectedItem === "distribution-payslip"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          }}
                        >
                          <ReceiptLong />
                        </ListItemIcon>
                        <ListItemText
                          primary="Payslip Records & Distribution"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>

                      {/* <ListItem
                      button
                      component={Link}
                      to="/overall-payslip"
                      selected={selectedItem === "overall-payslip"}
                      onClick={() => handleItemClick("overall-payslip")}
                      sx={{
                        color:
                          selectedItem === "overall-payslip"
                            ? settings.textPrimaryColor
                            : settings.textSecondaryColor,
                        bgcolor:
                          selectedItem === "overall-payslip"
                            ? settings.accentColor || "#FEF9E1"
                            : "inherit",
                        "&:hover": {
                          bgcolor: settings.hoverColor || "#6D2323",
                          color: settings.textSecondaryColor,
                          borderTopRightRadius: "15px",
                          borderBottomRightRadius: "15px",
                          "& .MuiListItemIcon-root": {
                            color: settings.textSecondaryColor,
                          },
                        },
                        borderTopRightRadius:
                          selectedItem === "overall-payslip" ? "15px" : 0,
                        borderBottomRightRadius:
                          selectedItem === "overall-payslip" ? "15px" : 0,
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          color:
                            selectedItem === "overall-payslip"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                        }}
                      >
                        <Dvr />
                      </ListItemIcon>
                      <ListItemText
                        primary="Payslip Records"
                        sx={{ marginLeft: "-10px" }}
                      />
                    </ListItem> */}

                      <ListSubheader
                        component="div"
                        sx={{
                          bgcolor: "transparent",
                          fontWeight: "bold",
                          fontSize: "0.7rem",
                          color: settings.textSecondaryColor,
                          fontFamily: "Poppins, sans-serif",
                          textTransform: "uppercase",
                          mb: -1,
                          pl: 2,
                        }}
                      >
                        Payroll Administration
                      </ListSubheader>

                      <ListItem
                        button
                        component={Link}
                        to="/remittance-table"
                        selected={selectedItem === "remittance-table"}
                        onClick={() => handleItemClick("remittance-table")}
                        sx={{
                          color:
                            selectedItem === "remittance-table"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                          bgcolor:
                            selectedItem === "remittance-table"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            borderTopRightRadius: "15px",
                            borderBottomRightRadius: "15px",
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                          },
                          borderTopRightRadius:
                            selectedItem === "remittance-table" ? "15px" : 0,
                          borderBottomRightRadius:
                            selectedItem === "remittance-table" ? "15px" : 0,
                        }}
                      >
                        <ListItemIcon
                          sx={{
                            color:
                              selectedItem === "remittance-table"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          }}
                        >
                          <AccountBalanceIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary="Remittances"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>

                      <ListItem
                        button
                        component={Link}
                        to="/item-table"
                        selected={selectedItem === "item-table"}
                        onClick={() => handleItemClick("item-table")}
                        sx={{
                          color:
                            selectedItem === "item-table"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                          bgcolor:
                            selectedItem === "item-table"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            borderTopRightRadius: "15px",
                            borderBottomRightRadius: "15px",
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                          },
                          borderTopRightRadius:
                            selectedItem === "item-table" ? "15px" : 0,
                          borderBottomRightRadius:
                            selectedItem === "item-table" ? "15px" : 0,
                        }}
                      >
                        <ListItemIcon
                          sx={{
                            color:
                              selectedItem === "item-table"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          }}
                        >
                          <Badge />
                        </ListItemIcon>
                        <ListItemText
                          primary="Item Table"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>

                      <ListItem
                        button
                        component={Link}
                        to="/department-table"
                        sx={{
                          color:
                            selectedItem === "department-table"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                          bgcolor:
                            selectedItem === "department-table"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            borderTopRightRadius: "15px",
                            borderBottomRightRadius: "15px",
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                          },
                          borderTopRightRadius:
                            selectedItem === "department-table" ? "15px" : 0,
                          borderBottomRightRadius:
                            selectedItem === "department-table" ? "15px" : 0,
                        }}
                        onClick={() => handleItemClick("department-table")}
                      >
                        <ListItemIcon
                          sx={{
                            color:
                              selectedItem === "department-table"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                            "&:hover": { color: settings.textSecondaryColor },
                          }}
                        >
                          <BusinessIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary="Department"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>

                      <ListItem
                        button
                        component={Link}
                        to="/department-assignment"
                        sx={{
                          color:
                            selectedItem === "department-assignment"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                          bgcolor:
                            selectedItem === "department-assignment"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            borderTopRightRadius: "15px",
                            borderBottomRightRadius: "15px",
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                          },
                          borderTopRightRadius:
                            selectedItem === "department-assignment"
                              ? "15px"
                              : 0,
                          borderBottomRightRadius:
                            selectedItem === "department-assignment"
                              ? "15px"
                              : 0,
                        }}
                        onClick={() => handleItemClick("department-assignment")}
                      >
                        <ListItemIcon
                          sx={{
                            color:
                              selectedItem === "department-assignment"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                            "&:hover": { color: settings.textSecondaryColor },
                          }}
                        >
                          <BusinessCenterIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary="Department Assignment"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>

                      <ListItem
                        button
                        component={Link}
                        to="/salary-grade"
                        selected={selectedItem === "salary-grade"}
                        onClick={() => handleItemClick("salary-grade")}
                        sx={{
                          color:
                            selectedItem === "salary-grade"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                          bgcolor:
                            selectedItem === "salary-grade"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            borderTopRightRadius: "15px",
                            borderBottomRightRadius: "15px",
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                          },
                          borderTopRightRadius:
                            selectedItem === "salary-grade" ? "15px" : 0,
                          borderBottomRightRadius:
                            selectedItem === "salary-grade" ? "15px" : 0,
                        }}
                      >
                        <ListItemIcon
                          sx={{
                            color:
                              selectedItem === "salary-grade"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          }}
                        >
                          <AccountTree />
                        </ListItemIcon>
                        <ListItemText
                          primary="Salary Grade | Tranche"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>
                    </List>
                  </Collapse>
                </>
              )}

            {/* Rest of the sidebar items continue... */}
            {userRole !== "staff" && (
              <>
                <ListItem
                  button
                  onClick={() => {
                    handleItemClick("Dashboards");
                    handleClick();
                  }}
                  sx={{
                    color: settings.textSecondaryColor,
                    cursor: "pointer",
                    borderTopRightRadius:
                      selectedItem === "Dashboards" ? "15px" : 0,
                    borderBottomRightRadius:
                      selectedItem === "Dashboards" ? "15px" : 0,
                  }}
                >
                  <ListItemIcon>
                    <ContactPage sx={{ color: settings.textSecondaryColor }} />
                  </ListItemIcon>
                  <ListItemText
                    primary="Information Management"
                    sx={{ marginLeft: "-10px" }}
                  />
                  <ListItemIcon
                    sx={{
                      marginLeft: "10rem",
                      color: settings.textSecondaryColor,
                    }}
                  >
                    {open ? <ExpandLess /> : <ExpandMore />}
                  </ListItemIcon>
                </ListItem>

                <Collapse in={open} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding sx={{ pl: 5.4 }}>
                    {/* PERSONAL INFO */}
                    {shouldShowMenuItem("/personalinfo") && (
                      <ListItem
                        button
                        component={Link}
                        to="/personalinfo"
                        onClick={() => handleItemClick("personalinfo")}
                        sx={{
                          bgcolor:
                            selectedItem === "personalinfo"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          color:
                            selectedItem === "personalinfo"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,

                          "& .MuiListItemIcon-root": {
                            color:
                              selectedItem === "personalinfo"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },
                          "& .MuiListItemText-primary": {
                            color:
                              selectedItem === "personalinfo"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },

                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color: settings.textSecondaryColor,
                            },
                          },

                          borderTopRightRadius:
                            selectedItem === "personalinfo" ? "15px" : 0,
                          borderBottomRightRadius:
                            selectedItem === "personalinfo" ? "15px" : 0,
                        }}
                      >
                        <ListItemIcon sx={{ marginRight: "-1rem" }}>
                          <PortraitIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary="Personal Information"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>
                    )}

                    {/* CHILDREN */}
                    {shouldShowMenuItem("/children") && (
                      <ListItem
                        button
                        component={Link}
                        to="/children"
                        onClick={() => handleItemClick("children")}
                        sx={{
                          bgcolor:
                            selectedItem === "children"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          color:
                            selectedItem === "children"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,

                          "& .MuiListItemIcon-root": {
                            color:
                              selectedItem === "children"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },
                          "& .MuiListItemText-primary": {
                            color:
                              selectedItem === "children"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },

                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color: settings.textSecondaryColor,
                            },
                          },

                          borderTopRightRadius:
                            selectedItem === "children" ? "15px" : 0,
                          borderBottomRightRadius:
                            selectedItem === "children" ? "15px" : 0,
                        }}
                      >
                        <ListItemIcon sx={{ marginRight: "-1rem" }}>
                          <ChildFriendlyRounded />
                        </ListItemIcon>
                        <ListItemText
                          primary="Children Information"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>
                    )}

                    {/* COLLEGE */}
                    {shouldShowMenuItem("/college") && (
                      <ListItem
                        button
                        component={Link}
                        to="/college"
                        onClick={() => handleItemClick("college")}
                        sx={{
                          bgcolor:
                            selectedItem === "college"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          color:
                            selectedItem === "college"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,

                          "& .MuiListItemIcon-root": {
                            color:
                              selectedItem === "college"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },
                          "& .MuiListItemText-primary": {
                            color:
                              selectedItem === "college"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },

                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color: settings.textSecondaryColor,
                            },
                          },

                          borderTopRightRadius:
                            selectedItem === "college" ? "15px" : 0,
                          borderBottomRightRadius:
                            selectedItem === "college" ? "15px" : 0,
                        }}
                      >
                        <ListItemIcon sx={{ marginRight: "-1rem" }}>
                          <School />
                        </ListItemIcon>
                        <ListItemText
                          primary="College Information"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>
                    )}

                    {/* GRADUATE */}
                    {shouldShowMenuItem("/graduate") && (
                      <ListItem
                        button
                        component={Link}
                        to="/graduate"
                        onClick={() => handleItemClick("graduate")}
                        sx={{
                          bgcolor:
                            selectedItem === "graduate"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          color:
                            selectedItem === "graduate"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,

                          "& .MuiListItemIcon-root": {
                            color:
                              selectedItem === "graduate"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },
                          "& .MuiListItemText-primary": {
                            color:
                              selectedItem === "graduate"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },

                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color: settings.textSecondaryColor,
                            },
                          },

                          borderTopRightRadius:
                            selectedItem === "graduate" ? "15px" : 0,
                          borderBottomRightRadius:
                            selectedItem === "graduate" ? "15px" : 0,
                        }}
                      >
                        <ListItemIcon sx={{ marginRight: "-1rem" }}>
                          <School />
                        </ListItemIcon>
                        <ListItemText
                          primary="Graduate Studies"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>
                    )}

                    {/* VOCATIONAL */}
                    {shouldShowMenuItem("/vocational") && (
                      <ListItem
                        button
                        component={Link}
                        to="/vocational"
                        onClick={() => handleItemClick("vocational")}
                        sx={{
                          bgcolor:
                            selectedItem === "vocational"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          color:
                            selectedItem === "vocational"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,

                          "& .MuiListItemIcon-root": {
                            color:
                              selectedItem === "vocational"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },
                          "& .MuiListItemText-primary": {
                            color:
                              selectedItem === "vocational"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },

                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color: settings.textSecondaryColor,
                            },
                          },

                          borderTopRightRadius:
                            selectedItem === "vocational" ? "15px" : 0,
                          borderBottomRightRadius:
                            selectedItem === "vocational" ? "15px" : 0,
                        }}
                      >
                        <ListItemIcon sx={{ marginRight: "-1rem" }}>
                          <School />
                        </ListItemIcon>
                        <ListItemText
                          primary="Vocational Studies"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>
                    )}

                    {/* LEARNING & DEVELOPMENT */}
                    {shouldShowMenuItem("/learningdev") && (
                      <ListItem
                        button
                        component={Link}
                        to="/learningdev"
                        onClick={() => handleItemClick("learningdev")}
                        sx={{
                          bgcolor:
                            selectedItem === "learningdev"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          color:
                            selectedItem === "learningdev"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,

                          "& .MuiListItemIcon-root": {
                            color:
                              selectedItem === "learningdev"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },
                          "& .MuiListItemText-primary": {
                            color:
                              selectedItem === "learningdev"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },

                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color: settings.textSecondaryColor,
                            },
                          },

                          borderTopRightRadius:
                            selectedItem === "learningdev" ? "15px" : 0,
                          borderBottomRightRadius:
                            selectedItem === "learningdev" ? "15px" : 0,
                        }}
                      >
                        <ListItemIcon sx={{ marginRight: "-1rem" }}>
                          <PsychologyIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary="Learning and Development"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>
                    )}

                    {/* ELIGIBILITY */}
                    {shouldShowMenuItem("/eligibility") && (
                      <ListItem
                        button
                        component={Link}
                        to="/eligibility"
                        onClick={() => handleItemClick("eligibility")}
                        sx={{
                          bgcolor:
                            selectedItem === "eligibility"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          color:
                            selectedItem === "eligibility"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,

                          "& .MuiListItemIcon-root": {
                            color:
                              selectedItem === "eligibility"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },
                          "& .MuiListItemText-primary": {
                            color:
                              selectedItem === "eligibility"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },

                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color: settings.textSecondaryColor,
                            },
                          },

                          borderTopRightRadius:
                            selectedItem === "eligibility" ? "15px" : 0,
                          borderBottomRightRadius:
                            selectedItem === "eligibility" ? "15px" : 0,
                        }}
                      >
                        <ListItemIcon sx={{ marginRight: "-1rem" }}>
                          <BadgeRounded />
                        </ListItemIcon>
                        <ListItemText
                          primary="Eligibility"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>
                    )}

                    {/* VOLUNTARY WORK */}
                    {shouldShowMenuItem("/voluntarywork") && (
                      <ListItem
                        button
                        component={Link}
                        to="/voluntarywork"
                        onClick={() => handleItemClick("voluntarywork")}
                        sx={{
                          bgcolor:
                            selectedItem === "voluntarywork"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          color:
                            selectedItem === "voluntarywork"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,

                          "& .MuiListItemIcon-root": {
                            color:
                              selectedItem === "voluntarywork"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },
                          "& .MuiListItemText-primary": {
                            color:
                              selectedItem === "voluntarywork"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },

                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color: settings.textSecondaryColor,
                            },
                          },

                          borderTopRightRadius:
                            selectedItem === "voluntarywork" ? "15px" : 0,
                          borderBottomRightRadius:
                            selectedItem === "voluntarywork" ? "15px" : 0,
                        }}
                      >
                        <ListItemIcon sx={{ marginRight: "-1rem" }}>
                          <SportsKabaddi />
                        </ListItemIcon>
                        <ListItemText
                          primary="Voluntary Work"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>
                    )}

                    {/* WORK EXPERIENCE */}
                    {shouldShowMenuItem("/workexperience") && (
                      <ListItem
                        button
                        component={Link}
                        to="/workexperience"
                        onClick={() => handleItemClick("workexperience")}
                        sx={{
                          bgcolor:
                            selectedItem === "workexperience"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          color:
                            selectedItem === "workexperience"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,

                          "& .MuiListItemIcon-root": {
                            color:
                              selectedItem === "workexperience"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },
                          "& .MuiListItemText-primary": {
                            color:
                              selectedItem === "workexperience"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },

                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color: settings.textSecondaryColor,
                            },
                          },

                          borderTopRightRadius:
                            selectedItem === "workexperience" ? "15px" : 0,
                          borderBottomRightRadius:
                            selectedItem === "workexperience" ? "15px" : 0,
                        }}
                      >
                        <ListItemIcon sx={{ marginRight: "-1rem" }}>
                          <Streetview />
                        </ListItemIcon>
                        <ListItemText
                          primary="Work Experience"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>
                    )}

                    {/* OTHER INFORMATION */}
                    {shouldShowMenuItem("/other-information") && (
                      <ListItem
                        button
                        component={Link}
                        to="/other-information"
                        onClick={() => handleItemClick("other-information")}
                        sx={{
                          bgcolor:
                            selectedItem === "other-information"
                              ? settings.accentColor || "#FEF9E1"
                              : "inherit",
                          color:
                            selectedItem === "other-information"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,

                          "& .MuiListItemIcon-root": {
                            color:
                              selectedItem === "other-information"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },
                          "& .MuiListItemText-primary": {
                            color:
                              selectedItem === "other-information"
                                ? settings.textPrimaryColor
                                : settings.textSecondaryColor,
                          },

                          "&:hover": {
                            bgcolor: settings.hoverColor || "#6D2323",
                            color: settings.textSecondaryColor,
                            "& .MuiListItemIcon-root": {
                              color: settings.textSecondaryColor,
                            },
                            "& .MuiListItemText-primary": {
                              color: settings.textSecondaryColor,
                            },
                          },

                          borderTopRightRadius:
                            selectedItem === "other-information" ? "15px" : 0,
                          borderBottomRightRadius:
                            selectedItem === "other-information" ? "15px" : 0,
                        }}
                      >
                        <ListItemIcon sx={{ marginRight: "-1rem" }}>
                          <Info />
                        </ListItemIcon>
                        <ListItemText
                          primary="Other Information"
                          sx={{ marginLeft: "-10px" }}
                        />
                      </ListItem>
                    )}
                  </List>
                </Collapse>
              </>
            )}

            {userRole !== "staff" && (
              <>
                <ListItem
                  button
                  onClick={handleClickForms}
                  sx={{
                    color: settings.textSecondaryColor,
                    cursor: "pointer",
                  }}
                >
                  <ListItemIcon>
                    <LibraryBooks sx={{ color: settings.textSecondaryColor }} />
                  </ListItemIcon>
                  <ListItemText primary="Forms" sx={{ marginLeft: "-10px" }} />
                  <ListItemIcon
                    sx={{
                      marginLeft: "10rem",
                      color: settings.textSecondaryColor,
                    }}
                  >
                    {open4 ? <ExpandLess /> : <ExpandMore />}
                  </ListItemIcon>
                </ListItem>

                <Collapse in={open4} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding sx={{ pl: 5.4 }}>
                    <ListItem
                      button
                      component={Link}
                      to="/assessment-clearance"
                      onClick={() => handleItemClick("assessment-clearance")}
                      sx={{
                        color:
                          selectedItem === "assessment-clearance"
                            ? settings.textPrimaryColor
                            : settings.textSecondaryColor,
                        bgcolor:
                          selectedItem === "assessment-clearance"
                            ? settings.accentColor || "#FEF9E1"
                            : "inherit",
                        "&:hover": {
                          bgcolor: settings.hoverColor || "#6D2323",
                          color: settings.textSecondaryColor,
                          borderTopRightRadius: "15px",
                          borderBottomRightRadius: "15px",
                          "& .MuiListItemIcon-root": {
                            color: settings.textSecondaryColor,
                          },
                        },
                        borderTopRightRadius:
                          selectedItem === "assessment-clearance" ? "15px" : 0,
                        borderBottomRightRadius:
                          selectedItem === "assessment-clearance" ? "15px" : 0,
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          marginRight: "-1rem",
                          color:
                            selectedItem === "assessment-clearance"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                          "&:hover": { color: settings.textSecondaryColor },
                        }}
                      >
                        <FeedIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Assessment Clearance"
                        sx={{ marginLeft: "-10px" }}
                      />
                    </ListItem>

                    <ListItem
                      button
                      component={Link}
                      to="/clearance"
                      onClick={() => handleItemClick("clearance")}
                      sx={{
                        color:
                          selectedItem === "clearance"
                            ? settings.textPrimaryColor
                            : settings.textSecondaryColor,
                        bgcolor:
                          selectedItem === "clearance"
                            ? settings.accentColor || "#FEF9E1"
                            : "inherit",
                        "&:hover": {
                          bgcolor: settings.hoverColor || "#6D2323",
                          color: settings.textSecondaryColor,
                          borderTopRightRadius: "15px",
                          borderBottomRightRadius: "15px",
                          "& .MuiListItemIcon-root": {
                            color: settings.textSecondaryColor,
                          },
                        },
                        borderTopRightRadius:
                          selectedItem === "clearance" ? "15px" : 0,
                        borderBottomRightRadius:
                          selectedItem === "clearance" ? "15px" : 0,
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          marginRight: "-1rem",
                          color:
                            selectedItem === "clearance"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                          "&:hover": { color: settings.textSecondaryColor },
                        }}
                      >
                        <FeedIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Clearance"
                        sx={{ marginLeft: "-10px" }}
                      />
                    </ListItem>

                    <ListItem
                      button
                      component={Link}
                      to="/faculty-clearance"
                      onClick={() => handleItemClick("faculty-clearance")}
                      sx={{
                        color:
                          selectedItem === "faculty-clearance"
                            ? settings.textPrimaryColor
                            : settings.textSecondaryColor,
                        bgcolor:
                          selectedItem === "faculty-clearance"
                            ? settings.accentColor || "#FEF9E1"
                            : "inherit",
                        "&:hover": {
                          bgcolor: settings.hoverColor || "#6D2323",
                          color: settings.textSecondaryColor,
                          borderTopRightRadius: "15px",
                          borderBottomRightRadius: "15px",
                          "& .MuiListItemIcon-root": {
                            color: settings.textSecondaryColor,
                          },
                        },
                        borderTopRightRadius:
                          selectedItem === "faculty-clearance" ? "15px" : 0,
                        borderBottomRightRadius:
                          selectedItem === "faculty-clearance" ? "15px" : 0,
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          marginRight: "-1rem",
                          color:
                            selectedItem === "faculty-clearance"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                          "&:hover": { color: settings.textSecondaryColor },
                        }}
                      >
                        <FeedIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Faculty Clearance"
                        sx={{ marginLeft: "-10px" }}
                      />
                    </ListItem>

                    <ListItem
                      button
                      component={Link}
                      to="/hrms-request-forms"
                      onClick={() => handleItemClick("hrms-request-forms")}
                      sx={{
                        color:
                          selectedItem === "hrms-request-forms"
                            ? settings.textPrimaryColor
                            : settings.textSecondaryColor,
                        bgcolor:
                          selectedItem === "hrms-request-forms"
                            ? settings.accentColor || "#FEF9E1"
                            : "inherit",
                        "&:hover": {
                          bgcolor: settings.hoverColor || "#6D2323",
                          color: settings.textSecondaryColor,
                          borderTopRightRadius: "15px",
                          borderBottomRightRadius: "15px",
                          "& .MuiListItemIcon-root": {
                            color: settings.textSecondaryColor,
                          },
                        },
                        borderTopRightRadius:
                          selectedItem === "hrms-request-forms" ? "15px" : 0,
                        borderBottomRightRadius:
                          selectedItem === "hrms-request-forms" ? "15px" : 0,
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          marginRight: "-1rem",
                          color:
                            selectedItem === "hrms-request-forms"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                          "&:hover": { color: settings.textSecondaryColor },
                        }}
                      >
                        <FeedIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="HRMS Request Form"
                        sx={{ marginLeft: "-10px" }}
                      />
                    </ListItem>

                    <ListItem
                      button
                      component={Link}
                      to="/individual-faculty-loading"
                      onClick={() =>
                        handleItemClick("individual-faculty-loading")
                      }
                      sx={{
                        color:
                          selectedItem === "individual-faculty-loading"
                            ? settings.textPrimaryColor
                            : settings.textSecondaryColor,
                        bgcolor:
                          selectedItem === "individual-faculty-loading"
                            ? settings.accentColor || "#FEF9E1"
                            : "inherit",
                        "&:hover": {
                          bgcolor: settings.hoverColor || "#6D2323",
                          color: settings.textSecondaryColor,
                          borderTopRightRadius: "15px",
                          borderBottomRightRadius: "15px",
                          "& .MuiListItemIcon-root": {
                            color: settings.textSecondaryColor,
                          },
                        },
                        borderTopRightRadius:
                          selectedItem === "individual-faculty-loading"
                            ? "15px"
                            : 0,
                        borderBottomRightRadius:
                          selectedItem === "individual-faculty-loading"
                            ? "15px"
                            : 0,
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          marginRight: "-1rem",
                          color:
                            selectedItem === "individual-faculty-loading"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                          "&:hover": { color: settings.textSecondaryColor },
                        }}
                      >
                        <FeedIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Individual Faculty Loading"
                        sx={{ marginLeft: "-10px" }}
                      />
                    </ListItem>

                    <ListItem
                      button
                      component={Link}
                      to="/in-service-training"
                      onClick={() => handleItemClick("in-service-training")}
                      sx={{
                        color:
                          selectedItem === "in-service-training"
                            ? settings.textPrimaryColor
                            : settings.textSecondaryColor,
                        bgcolor:
                          selectedItem === "in-service-training"
                            ? settings.accentColor || "#FEF9E1"
                            : "inherit",
                        "&:hover": {
                          bgcolor: settings.hoverColor || "#6D2323",
                          color: settings.textSecondaryColor,
                          borderTopRightRadius: "15px",
                          borderBottomRightRadius: "15px",
                          "& .MuiListItemIcon-root": {
                            color: settings.textSecondaryColor,
                          },
                        },
                        borderTopRightRadius:
                          selectedItem === "in-service-training" ? "15px" : 0,
                        borderBottomRightRadius:
                          selectedItem === "in-service-training" ? "15px" : 0,
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          marginRight: "-1rem",
                          color:
                            selectedItem === "in-service-training"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                          "&:hover": { color: settings.textSecondaryColor },
                        }}
                      >
                        <FeedIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="In Service Training"
                        sx={{ marginLeft: "-10px" }}
                      />
                    </ListItem>

                    <ListItem
                      button
                      component={Link}
                      to="/leave-card"
                      onClick={() => handleItemClick("leave-card")}
                      sx={{
                        color:
                          selectedItem === "leave-card"
                            ? settings.textPrimaryColor
                            : settings.textSecondaryColor,
                        bgcolor:
                          selectedItem === "leave-card"
                            ? settings.accentColor || "#FEF9E1"
                            : "inherit",
                        "&:hover": {
                          bgcolor: settings.hoverColor || "#6D2323",
                          color: settings.textSecondaryColor,
                          borderTopRightRadius: "15px",
                          borderBottomRightRadius: "15px",
                          "& .MuiListItemIcon-root": {
                            color: settings.textSecondaryColor,
                          },
                        },
                        borderTopRightRadius:
                          selectedItem === "leave-card" ? "15px" : 0,
                        borderBottomRightRadius:
                          selectedItem === "leave-card" ? "15px" : 0,
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          marginRight: "-1rem",
                          color:
                            selectedItem === "leave-card"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                          "&:hover": { color: settings.textSecondaryColor },
                        }}
                      >
                        <FeedIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Employee's Leave Card"
                        sx={{ marginLeft: "-10px" }}
                      />
                    </ListItem>

                    <ListItem
                      button
                      component={Link}
                      to="/locator-slip"
                      onClick={() => handleItemClick("locator-slip")}
                      sx={{
                        color:
                          selectedItem === "locator-slip"
                            ? settings.textPrimaryColor
                            : settings.textSecondaryColor,
                        bgcolor:
                          selectedItem === "locator-slip"
                            ? settings.accentColor || "#FEF9E1"
                            : "inherit",
                        "&:hover": {
                          bgcolor: settings.hoverColor || "#6D2323",
                          color: settings.textSecondaryColor,
                          borderTopRightRadius: "15px",
                          borderBottomRightRadius: "15px",
                          "& .MuiListItemIcon-root": {
                            color: settings.textSecondaryColor,
                          },
                        },
                        borderTopRightRadius:
                          selectedItem === "locator-slip" ? "15px" : 0,
                        borderBottomRightRadius:
                          selectedItem === "locator-slip" ? "15px" : 0,
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          marginRight: "-1rem",
                          color:
                            selectedItem === "locator-slip"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                          "&:hover": { color: settings.textSecondaryColor },
                        }}
                      >
                        <FeedIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Locator's Slip"
                        sx={{ marginLeft: "-10px" }}
                      />
                    </ListItem>

                    <ListItem
                      button
                      component={Link}
                      to="/permission-to-teach"
                      onClick={() => handleItemClick("permission-to-teach")}
                      sx={{
                        color:
                          selectedItem === "permission-to-teach"
                            ? settings.textPrimaryColor
                            : settings.textSecondaryColor,
                        bgcolor:
                          selectedItem === "permission-to-teach"
                            ? settings.accentColor || "#FEF9E1"
                            : "inherit",
                        "&:hover": {
                          bgcolor: settings.hoverColor || "#6D2323",
                          color: settings.textSecondaryColor,
                          borderTopRightRadius: "15px",
                          borderBottomRightRadius: "15px",
                          "& .MuiListItemIcon-root": {
                            color: settings.textSecondaryColor,
                          },
                        },
                        borderTopRightRadius:
                          selectedItem === "permission-to-teach" ? "15px" : 0,
                        borderBottomRightRadius:
                          selectedItem === "permission-to-teach" ? "15px" : 0,
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          marginRight: "-1rem",
                          color:
                            selectedItem === "permission-to-teach"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                          "&:hover": { color: settings.textSecondaryColor },
                        }}
                      >
                        <FeedIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Permission To Teach"
                        sx={{ marginLeft: "-10px" }}
                      />
                    </ListItem>

                    <ListItem
                      button
                      component={Link}
                      to="/request-for-id"
                      onClick={() => handleItemClick("request-for-id")}
                      sx={{
                        color:
                          selectedItem === "request-for-id"
                            ? settings.textPrimaryColor
                            : settings.textSecondaryColor,
                        bgcolor:
                          selectedItem === "request-for-id"
                            ? settings.accentColor || "#FEF9E1"
                            : "inherit",
                        "&:hover": {
                          bgcolor: settings.hoverColor || "#6D2323",
                          color: settings.textSecondaryColor,
                          borderTopRightRadius: "15px",
                          borderBottomRightRadius: "15px",
                          "& .MuiListItemIcon-root": {
                            color: settings.textSecondaryColor,
                          },
                        },
                        borderTopRightRadius:
                          selectedItem === "request-for-id" ? "15px" : 0,
                        borderBottomRightRadius:
                          selectedItem === "request-for-id" ? "15px" : 0,
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          marginRight: "-1rem",
                          color:
                            selectedItem === "request-for-id"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                        }}
                      >
                        <FeedIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Request For ID"
                        sx={{ marginLeft: "-10px" }}
                      />
                    </ListItem>

                    <ListItem
                      button
                      component={Link}
                      to="/saln-front"
                      onClick={() => handleItemClick("saln-front")}
                      sx={{
                        color:
                          selectedItem === "saln-front"
                            ? settings.textPrimaryColor
                            : settings.textSecondaryColor,
                        bgcolor:
                          selectedItem === "saln-front"
                            ? settings.accentColor || "#FEF9E1"
                            : "inherit",
                        "&:hover": {
                          bgcolor: settings.hoverColor || "#6D2323",
                          color: settings.textSecondaryColor,
                          borderTopRightRadius: "15px",
                          borderBottomRightRadius: "15px",
                          "& .MuiListItemIcon-root": {
                            color: settings.textSecondaryColor,
                          },
                        },
                        borderTopRightRadius:
                          selectedItem === "saln-front" ? "15px" : 0,
                        borderBottomRightRadius:
                          selectedItem === "saln-front" ? "15px" : 0,
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          marginRight: "-1rem",
                          color:
                            selectedItem === "saln-front"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                          "&:hover": { color: settings.textSecondaryColor },
                        }}
                      >
                        <FeedIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="S.A.L.N"
                        sx={{ marginLeft: "-10px" }}
                      />
                    </ListItem>

                    <ListItem
                      button
                      component={Link}
                      to="/scholarship-agreement"
                      onClick={() => handleItemClick("scholarship-agreement")}
                      sx={{
                        color:
                          selectedItem === "scholarship-agreement"
                            ? settings.textPrimaryColor
                            : settings.textSecondaryColor,
                        bgcolor:
                          selectedItem === "scholarship-agreement"
                            ? settings.accentColor || "#FEF9E1"
                            : "inherit",
                        "&:hover": {
                          bgcolor: settings.hoverColor || "#6D2323",
                          color: settings.textSecondaryColor,
                          borderTopRightRadius: "15px",
                          borderBottomRightRadius: "15px",
                          "& .MuiListItemIcon-root": {
                            color: settings.textSecondaryColor,
                          },
                        },
                        borderTopRightRadius:
                          selectedItem === "scholarship-agreement" ? "15px" : 0,
                        borderBottomRightRadius:
                          selectedItem === "scholarship-agreement" ? "15px" : 0,
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          marginRight: "-1rem",
                          color:
                            selectedItem === "scholarship-agreement"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                          "&:hover": { color: settings.textSecondaryColor },
                        }}
                      >
                        <FeedIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Scholarship Agreement"
                        sx={{ marginLeft: "-10px" }}
                      />
                    </ListItem>

                    <ListItem
                      button
                      component={Link}
                      to="/subject"
                      onClick={() => handleItemClick("subject")}
                      sx={{
                        color:
                          selectedItem === "subject"
                            ? settings.textPrimaryColor
                            : settings.textSecondaryColor,
                        bgcolor:
                          selectedItem === "subject"
                            ? settings.accentColor || "#FEF9E1"
                            : "inherit",
                        "&:hover": {
                          bgcolor: settings.hoverColor || "#6D2323",
                          color: settings.textSecondaryColor,
                          borderTopRightRadius: "15px",
                          borderBottomRightRadius: "15px",
                          "& .MuiListItemIcon-root": {
                            color: settings.textSecondaryColor,
                          },
                        },
                        borderTopRightRadius:
                          selectedItem === "subject" ? "15px" : 0,
                        borderBottomRightRadius:
                          selectedItem === "subject" ? "15px" : 0,
                        marginBottom: "40px",
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          marginRight: "-1rem",
                          color:
                            selectedItem === "subject"
                              ? settings.textPrimaryColor
                              : settings.textSecondaryColor,
                        }}
                      >
                        <FeedIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Subject Still to be Taken"
                        sx={{ marginLeft: "-10px" }}
                      />
                    </ListItem>
                  </List>
                </Collapse>
              </>
            )}
          </List>
        </Box>

        <ListItem
          button
          onClick={handleLogout}
          sx={{
            cursor: "pointer",
            bgcolor: "inherit",
            color: settings.textSecondaryColor,
            flexShrink: 0,
            zIndex: 1201,
            mb: 7,

            "& .MuiListItemIcon-root": {
              color: settings.textSecondaryColor,
            },
            "& .MuiListItemText-primary": {
              color: settings.textSecondaryColor,
            },

            "&:hover": {
              bgcolor: settings.hoverColor || "#6D2323",
              color: settings.textSecondaryColor,
              "& .MuiListItemIcon-root": { color: settings.textSecondaryColor },
              "& .MuiListItemText-primary": {
                color: settings.textSecondaryColor,
              },
            },
          }}
        >
          <ListItemIcon>
            <LogoutIcon sx={{ fontSize: 29, marginLeft: "-6%" }} />
          </ListItemIcon>
          <ListItemText
            primary="Sign Out"
            sx={{
              marginLeft: "-10px",
              opacity: drawerOpen ? 1 : 0,
              transition: "opacity 0.3s",
              whiteSpace: "nowrap",
            }}
          />
        </ListItem>
      </Box>
    </Drawer>
  );
};





export default Sidebar;

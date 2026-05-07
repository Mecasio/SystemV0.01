import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  Alert,
  Box,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import API_BASE_URL from "../apiConfig";
import { SettingsContext } from "../App";

const PAGE_SIZE = 100;
const ITEM_HEIGHT = 118;
const VIEWPORT_HEIGHT = 620;
const OVERSCAN = 8;

const severityColors = {
  INFO: { bg: "#e0f2fe", color: "#075985", border: "#7dd3fc" },
  WARN: { bg: "#fef3c7", color: "#92400e", border: "#fbbf24" },
  WARNING: { bg: "#fef3c7", color: "#92400e", border: "#fbbf24" },
  ERROR: { bg: "#fee2e2", color: "#991b1b", border: "#fca5a5" },
  CRITICAL: { bg: "#fecaca", color: "#7f1d1d", border: "#ef4444" },
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
};

const AuditLogs = () => {
  const settings = useContext(SettingsContext);
  const titleColor = settings?.title_color || "#000000";
  const borderColor = settings?.border_color || "#d1d5db";

  const scrollRef = useRef(null);
  const requestRef = useRef(false);
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const [severity, setSeverity] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 350);

    return () => clearTimeout(timeout);
  }, [searchInput]);

  const resetList = useCallback(() => {
    setLogs([]);
    setPage(1);
    setHasMore(true);
    setError("");
    setScrollTop(0);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, []);

  const fetchLogs = useCallback(async (pageToLoad = page, replace = false) => {
    if (requestRef.current || (!replace && !hasMore)) return;

    requestRef.current = true;
    setLoading(true);
    setError("");

    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/audit-logs`, {
        params: {
          page: pageToLoad,
          limit: PAGE_SIZE,
          severity,
          search,
        },
      });

      const nextRows = data.data || [];
      setLogs((prev) => {
        if (replace) return nextRows;

        const seen = new Set(prev.map((item) => item.log_key));
        const freshRows = nextRows.filter((item) => !seen.has(item.log_key));
        return [...prev, ...freshRows];
      });
      setHasMore(Boolean(data.hasMore));
      setPage(pageToLoad + 1);
    } catch (err) {
      console.error("Audit logs fetch failed:", err);
      setError(err.response?.data?.message || "Failed to fetch audit logs.");
    } finally {
      requestRef.current = false;
      setLoading(false);
    }
  }, [hasMore, page, search, severity]);

  useEffect(() => {
    resetList();
    fetchLogs(1, true);
  }, [severity, search]);

  const handleScroll = (event) => {
    const target = event.currentTarget;
    setScrollTop(target.scrollTop);

    if (
      target.scrollHeight - target.scrollTop - target.clientHeight <
      ITEM_HEIGHT * 8
    ) {
      fetchLogs();
    }
  };

  const virtualRows = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
    const visibleCount = Math.ceil(VIEWPORT_HEIGHT / ITEM_HEIGHT) + OVERSCAN * 2;
    const endIndex = Math.min(logs.length, startIndex + visibleCount);

    return {
      startIndex,
      rows: logs.slice(startIndex, endIndex),
      topSpacer: startIndex * ITEM_HEIGHT,
      bottomSpacer: Math.max(0, (logs.length - endIndex) * ITEM_HEIGHT),
    };
  }, [logs, scrollTop]);

  return (
    <Box
      sx={{
        height: "calc(100vh - 150px)",
        overflowY: "auto",
        backgroundColor: "transparent",
        mt: 1,
        p: 2,
      }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography
          variant="h4"
          sx={{ fontWeight: "bold", color: titleColor, fontSize: "36px" }}
        >
          AUDIT LOGS
        </Typography>
      </Box>

      <hr style={{ border: "1px solid #ccc", width: "100%" }} />

      <Paper sx={{ mt: 3, p: 2, border: `1px solid ${borderColor}` }}>
        <Box display="flex" gap={2} flexWrap="wrap" alignItems="center" mb={2}>
          <TextField
            label="Search audit trail"
            size="small"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            sx={{ minWidth: 320 }}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Severity</InputLabel>
            <Select
              label="Severity"
              value={severity}
              onChange={(event) => setSeverity(event.target.value)}
            >
              <MenuItem value="">All Severities</MenuItem>
              <MenuItem value="INFO">INFO</MenuItem>
              <MenuItem value="WARN">WARN</MenuItem>
              <MenuItem value="ERROR">ERROR</MenuItem>
              <MenuItem value="CRITICAL">CRITICAL</MenuItem>
            </Select>
          </FormControl>
          <Typography sx={{ ml: "auto", fontSize: 13, color: "text.secondary" }}>
            Loaded {logs.length.toLocaleString()} log{logs.length === 1 ? "" : "s"}
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box
          ref={scrollRef}
          onScroll={handleScroll}
          sx={{
            height: VIEWPORT_HEIGHT,
            overflow: "auto",
            border: `1px solid ${borderColor}`,
            backgroundColor: "#f8fafc",
            p: 2,
          }}
        >
          <Box sx={{ height: virtualRows.topSpacer }} />

          {virtualRows.rows.map((log) => {
            const severityValue = String(log.severity || "INFO").toUpperCase();
            const severityStyle = severityColors[severityValue] || severityColors.INFO;

            return (
              <Box
                key={log.log_key}
                sx={{
                  minHeight: ITEM_HEIGHT - 12,
                  mb: "12px",
                  display: "grid",
                  gridTemplateColumns: "16px 1fr",
                  columnGap: 1.5,
                }}
              >
                <Box
                  sx={{
                    position: "relative",
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      mt: 1.2,
                      borderRadius: "50%",
                      backgroundColor: severityStyle.border,
                      border: "2px solid #fff",
                      boxShadow: "0 0 0 1px rgba(15, 23, 42, 0.16)",
                    }}
                  />
                  <Box
                    sx={{
                      position: "absolute",
                      top: 26,
                      bottom: -12,
                      width: 2,
                      backgroundColor: "#dbe3ea",
                    }}
                  />
                </Box>

                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    border: `1px solid ${borderColor}`,
                    borderLeft: `4px solid ${severityStyle.border}`,
                    borderRadius: 1,
                    backgroundColor: "#fff",
                  }}
                >
                  <Box display="flex" gap={1} flexWrap="wrap" alignItems="center" mb={0.75}>
                    <Chip
                      label={severityValue}
                      size="small"
                      sx={{
                        backgroundColor: severityStyle.bg,
                        color: severityStyle.color,
                        fontWeight: 700,
                      }}
                    />
                    <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
                      {formatDate(log.timestamp)}
                    </Typography>
                  </Box>

                  <Typography
                    sx={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#1f2937",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {log.email || "unknown"}
                  </Typography>

                  <Typography
                    sx={{
                      mt: 0.5,
                      fontSize: 14,
                      color: "#374151",
                      lineHeight: 1.45,
                      overflowWrap: "anywhere",
                    }}
                  >
                    {log.message}
                  </Typography>
                </Paper>
              </Box>
            );
          })}

          <Box sx={{ height: virtualRows.bottomSpacer }} />

          {logs.length === 0 && !loading && (
            <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
              No audit logs found.
            </Box>
          )}

          {loading && (
            <Box sx={{ textAlign: "center", py: 2, color: "text.secondary" }}>
              Loading audit logs...
            </Box>
          )}

          {!hasMore && logs.length > 0 && (
            <Box sx={{ textAlign: "center", py: 2, color: "text.secondary" }}>
              End of audit logs.
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default AuditLogs;

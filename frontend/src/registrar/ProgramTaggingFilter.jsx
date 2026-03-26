import React, { useMemo, useEffect, useState, useContext } from "react";
import { SettingsContext } from "../App";
import { Box, Typography, Select, MenuItem } from "@mui/material";
import API_BASE_URL from "../apiConfig";
import EaristLogo from "../assets/EaristLogo.png";

const ProgramTaggingFilter = ({
  curriculumList,
  yearLevelList,
  semesterList,
  taggedPrograms,

  selectedCurriculum,
  selectedYearLevel,
  selectedSemester,

  setSelectedCurriculum,
  setSelectedYearLevel,
  setSelectedSemester,

  setFilteredPrograms,
}) => {
  const settings = useContext(SettingsContext);

  const [borderColor, setBorderColor] = useState("#000000");
  const [branches, setBranches] = useState([]);
  const [selectedCampus, setSelectedCampus] = useState("");
  const [selectedAcademicProgram, setSelectedAcademicProgram] = useState("");

  // Load settings and branches
  useEffect(() => {
    if (!settings) return;
    if (settings.border_color) setBorderColor(settings.border_color);

    if (settings?.branches) {
      try {
        const parsed =
          typeof settings.branches === "string"
            ? JSON.parse(settings.branches)
            : settings.branches;
        setBranches(parsed);
      } catch (err) {
        console.error("Failed to parse branches:", err);
        setBranches([]);
      }
    }
  }, [settings]);

  /* ===== FILTERS ===== */
  const filteredCurriculumList = useMemo(() => {
    return curriculumList.filter((item) => {
      if (selectedCampus !== "" && Number(item.components) !== Number(selectedCampus))
        return false;
      if (
        selectedAcademicProgram !== "" &&
        Number(item.academic_program) !== Number(selectedAcademicProgram)
      )
        return false;
      return true;
    });
  }, [curriculumList, selectedCampus, selectedAcademicProgram]);

  const yearOrder = {
    "First Year": 1,
    "Second Year": 2,
    "Third Year": 3,
    "Fourth Year": 4,
    "Fifth Year": 5,
  };
  const semesterOrder = {
    "First Semester": 1,
    "Second Semester": 2,
  };

  const filteredYearLevels = useMemo(() => {
    if (!selectedCurriculum) return [];
    const usedYearLevels = taggedPrograms
      .filter((p) => p.curriculum_id == selectedCurriculum)
      .map((p) => p.year_level_id);
    return yearLevelList
      .filter((y) => usedYearLevels.includes(y.year_level_id))
      .sort((a, b) => (yearOrder[a.year_level_description] || 99) - (yearOrder[b.year_level_description] || 99));
  }, [selectedCurriculum, taggedPrograms, yearLevelList]);

  const filteredSemesters = useMemo(() => {
    if (!selectedCurriculum) return [];
    const usedSemesters = taggedPrograms
      .filter((p) => p.curriculum_id == selectedCurriculum)
      .map((p) => p.semester_id);
    return semesterList
      .filter((s) => usedSemesters.includes(s.semester_id))
      .sort((a, b) => (semesterOrder[a.semester_description] || 99) - (semesterOrder[b.semester_description] || 99));
  }, [selectedCurriculum, taggedPrograms, semesterList]);

  const formatSchoolYear = (yearDesc) => {
    const startYear = Number(yearDesc);
    if (isNaN(startYear)) return yearDesc;
    return `${startYear} - ${startYear + 1}`;
  };

  const applyFilter = () => {
    let result = taggedPrograms;
    if (selectedCurriculum) result = result.filter((p) => p.curriculum_id == selectedCurriculum);
    if (selectedYearLevel) result = result.filter((p) => p.year_level_id == selectedYearLevel);
    if (selectedSemester) result = result.filter((p) => p.semester_id == selectedSemester);
    setFilteredPrograms(result);
  };

  useEffect(() => {
    applyFilter();
  }, [selectedCurriculum, selectedYearLevel, selectedSemester, taggedPrograms]);

  return (
    <Box
      sx={{
        border: `1px solid ${borderColor}`,
        borderRadius: 2,
        p: 3,
        display: "flex",
        gap: 2,
        flexWrap: "wrap",
        backgroundColor: "#fafafa",
      }}
    >
      {/* CAMPUS */}
      <Box sx={{ minWidth: 220, flex: 1,}}>
        <Typography sx={{ fontWeight: "bold", mb: 1, fontSize: 14 }}>Campus</Typography>
        <Select
          fullWidth
          size="small"
          value={selectedCampus}
          onChange={(e) => {
            setSelectedCampus(e.target.value);
            setSelectedAcademicProgram("");
            setSelectedCurriculum("");
            setSelectedYearLevel("");
            setSelectedSemester("");
          }}
        >
          <MenuItem value="">
            <em>All Campuses</em>
          </MenuItem>
          {branches.map((b) => (
            <MenuItem key={b.id} value={b.id}>
              {b.branch}
            </MenuItem>
          ))}
        </Select>
      </Box>

      {/* ACADEMIC PROGRAM */}
      <Box sx={{ minWidth: 220, flex: 1 }}>
        <Typography sx={{ fontWeight: "bold", mb: 1, fontSize: 14 }}>Academic Program</Typography>
        <Select
          fullWidth
          size="small"
          value={selectedAcademicProgram}
          onChange={(e) => {
            setSelectedAcademicProgram(e.target.value);
            setSelectedCurriculum("");
            setSelectedYearLevel("");
            setSelectedSemester("");
          }}
          disabled={!selectedCampus}
        >
          <MenuItem value="">
            <em>All Programs</em>
          </MenuItem>
          <MenuItem value="0">Undergraduate</MenuItem>
          <MenuItem value="1">Graduate</MenuItem>
          <MenuItem value="2">Techvoc</MenuItem>
        </Select>
      </Box>

      {/* CURRICULUM */}
      <Box sx={{ minWidth: 220, flex: 1 }}>
        <Typography sx={{ fontWeight: "bold", mb: 1, fontSize: 14 }}>Curriculum</Typography>
        <Select
          fullWidth
          size="small"
          value={selectedCurriculum}
          onChange={(e) => {
            setSelectedCurriculum(e.target.value);
            setSelectedYearLevel("");
            setSelectedSemester("");
          }}
          disabled={!selectedAcademicProgram}
        >
          <MenuItem value="">
            <em>All Curriculums</em>
          </MenuItem>
          {filteredCurriculumList.map((c) => (
            <MenuItem key={c.curriculum_id} value={c.curriculum_id}>
              {formatSchoolYear(c.year_description)}: ({c.program_code}) – {c.program_description}
              {c.major ? ` (${c.major})` : ""}
            </MenuItem>
          ))}
        </Select>
      </Box>

      {/* YEAR LEVEL */}
      <Box sx={{ minWidth: 220, flex: 1 }}>
        <Typography sx={{ fontWeight: "bold", mb: 1, fontSize: 14 }}>Year Level</Typography>
        <Select
          fullWidth
          size="small"
          value={selectedYearLevel}
          onChange={(e) => setSelectedYearLevel(e.target.value)}
          disabled={!selectedCurriculum}
        >
          <MenuItem value="">
            <em>All Year Levels</em>
          </MenuItem>
          {filteredYearLevels.map((y) => (
            <MenuItem key={y.year_level_id} value={y.year_level_id}>
              {y.year_level_description}
            </MenuItem>
          ))}
        </Select>
      </Box>

      {/* SEMESTER */}
      <Box sx={{ minWidth: 220, flex: 1,  }}>
        <Typography sx={{ fontWeight: "bold", mb: 1, fontSize: 14 }}>Semester</Typography>
        <Select
          fullWidth
          size="small"
          value={selectedSemester}
          onChange={(e) => setSelectedSemester(e.target.value)}
          disabled={!selectedCurriculum}
        >
          <MenuItem value="">
            <em>All Semesters</em>
          </MenuItem>
          {filteredSemesters.map((s) => (
            <MenuItem key={s.semester_id} value={s.semester_id}>
              {s.semester_description}
            </MenuItem>
          ))}
        </Select>
      </Box>
    </Box>
  );
};

export default ProgramTaggingFilter;
# Audit Log Access Description Observation List

Use this checklist to observe modules where audit logs should now show:

```text
Access Description (employee id) message
```

Instead of:

```text
Registrar (employee id) message
```

This rule is applied to audit logs for registrar/admin/system-side modules. It is not applied when the actor role is:

- `student`
- `applicant`
- `faculty`
- `professor`

## Payment / Scholarship

- `frontend/src/system_management/StudentScholarshipList.jsx`
- `frontend/src/components/CORForScholarship.jsx`
- `frontend/src/system_management/MatriculationPaymentModule.jsx`
- `frontend/src/system_management/ReceiptCounterAssignment.jsx`
- `frontend/src/system_management/PaymentExportingModule.jsx`

## Registrar / Enrollment

- `frontend/src/registrar/CourseTagging.jsx`
- `frontend/src/account_management/StudentGradeFile.jsx`
- `frontend/src/course_management/CurriculumPanel.jsx`
- `frontend/src/system_management/ChangeYearGradPer.jsx`
- `frontend/src/system_management/TOSFCrud.jsx`

## Faculty / Grades Excluded From Access Description Rule

- `frontend/src/faculty/GradingSheet.jsx`
- `frontend/src/faculty/FacultyWorkload.jsx`
- `frontend/src/system_management/GradeConversionAdmin.jsx`

## Account / Access

- `frontend/src/account_management/RegisterRegistrar.jsx`
- `frontend/src/account_management/UserPageAccess.jsx`

## Admission / Requirements

- `frontend/src/enrollment_management/RegistrarRequirements.jsx`
- `frontend/src/medical_management/MedicalRequirements.jsx`
- `frontend/src/admission/RegistrarExaminationProfile.jsx`
- `frontend/src/admission/ApplicationProcessAdmin.jsx`

Applicant-facing audit logs remain as `Applicant`, but registrar/admission staff actions inside these modules should use their assigned access description.

## Backend Shared Audit Files

- `backend/utils/auditLogger.js`
- `frontend/src/utils/auditEvents.js`
- `backend/routes/auth_routes/userPageAccessRoute.js`

## Suggested First Modules To Test

1. `frontend/src/system_management/StudentScholarshipList.jsx`
2. `frontend/src/components/CORForScholarship.jsx`
3. `frontend/src/system_management/MatriculationPaymentModule.jsx`
4. `frontend/src/system_management/ReceiptCounterAssignment.jsx`
5. `frontend/src/registrar/CourseTagging.jsx`
6. `frontend/src/account_management/UserPageAccess.jsx`

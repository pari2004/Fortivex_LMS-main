"use client";

import AssignmentManagementView from "@/components/assignments/AssignmentManagementView";
import { INSTRUCTOR_ROLES, PROGRAM_COHORT_ADMIN_ROLES } from "@/lib/auth/roles";

export default function InstructorAssignmentsPage() {
  return (
    <AssignmentManagementView
      allowedRoles={[...INSTRUCTOR_ROLES, ...PROGRAM_COHORT_ADMIN_ROLES]}
      roleTitle="Instructor Faculty Portal"
    />
  );
}


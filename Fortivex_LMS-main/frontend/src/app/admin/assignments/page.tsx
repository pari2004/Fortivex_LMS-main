"use client";

import AssignmentManagementView from "@/components/assignments/AssignmentManagementView";

export default function AdminAssignmentsPage() {
  return (
    <AssignmentManagementView
      allowedRoles={["SUPER_ADMIN", "ACADEMIC_ADMIN", "PROGRAM_MANAGER"]}
      roleTitle="Academic Operations & Administration"
    />
  );
}

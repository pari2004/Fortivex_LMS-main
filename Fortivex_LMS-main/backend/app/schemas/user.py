from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(max_length=255)
    phone_number: str | None = Field(default=None, max_length=50)
    bio: str | None = Field(default=None, max_length=1000)
    title: str | None = Field(default=None, max_length=100)
    avatar_url: str | None = Field(default=None, max_length=255)
    github_url: str | None = Field(default=None, max_length=255)
    linkedin_url: str | None = Field(default=None, max_length=255)
    portfolio_url: str | None = Field(default=None, max_length=255)


class UserCreate(BaseModel):
    # min_length guards against trivially-empty passwords; max_length mirrors
    # bcrypt's own 72-byte input limit (bcrypt silently truncates beyond it,
    # which would otherwise let two different long passwords hash the same).
    email: EmailStr
    full_name: str = Field(max_length=255)
    password: str = Field(min_length=8, max_length=72)
    phone_number: str | None = Field(default=None, max_length=50)
    bio: str | None = Field(default=None, max_length=1000)
    title: str | None = Field(default=None, max_length=100)
    avatar_url: str | None = Field(default=None, max_length=255)
    github_url: str | None = Field(default=None, max_length=255)
    linkedin_url: str | None = Field(default=None, max_length=255)
    portfolio_url: str | None = Field(default=None, max_length=255)
    organization_id: int
    # Defaults to STUDENT so a bare invite doesn't create a role-less,
    # effectively-locked-out account. See users.py: granting SUPER_ADMIN
    # requires the caller to already be a SUPER_ADMIN.
    role_names: list[str] = Field(default_factory=lambda: ["STUDENT"])
    must_change_password: bool = True


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=255)
    phone_number: str | None = Field(default=None, max_length=50)
    bio: str | None = Field(default=None, max_length=1000)
    title: str | None = Field(default=None, max_length=100)
    avatar_url: str | None = Field(default=None, max_length=255)
    github_url: str | None = Field(default=None, max_length=255)
    linkedin_url: str | None = Field(default=None, max_length=255)
    portfolio_url: str | None = Field(default=None, max_length=255)
    is_active: bool | None = None


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=72)
    new_password: str = Field(min_length=8, max_length=72)


class UserOrgSummary(BaseModel):
    id: int
    name: str
    code: str
    roles: list[str] = Field(default_factory=list)


class AssignOrganizationPayload(BaseModel):
    organization_id: int
    role_names: list[str] = Field(default_factory=lambda: ["ACADEMIC_ADMIN"])


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    email: str
    full_name: str
    phone_number: str | None = None
    bio: str | None = None
    title: str | None = None
    avatar_url: str | None = None
    github_url: str | None = None
    linkedin_url: str | None = None
    portfolio_url: str | None = None
    roles: list[str]
    organizations: list[UserOrgSummary] = Field(default_factory=list)
    created_at: datetime | None = None
    must_change_password: bool = False


class ProfileOrganizationInfo(BaseModel):
    id: int
    name: str
    slug: str
    code: str
    primary_domain: str | None = None
    lms_domain: str | None = None
    roles: list[str] = []


class StudentProfileEnrollment(BaseModel):
    id: int
    program_id: int
    program_name: str
    program_code: str
    cohort_id: int | None = None
    cohort_name: str | None = None
    status: str
    progress_percentage: int = 0
    enrolled_at: datetime | None = None


class StudentProfileData(BaseModel):
    student_id: int
    student_code: str
    lifecycle_status: str
    enrollments: list[StudentProfileEnrollment] = []
    stats: dict[str, Any] = {}


class InstructorCohortInfo(BaseModel):
    id: int
    name: str
    code: str
    program_names: list[str] = []
    student_count: int = 0
    status: str
    start_date: str | None = None
    end_date: str | None = None


class InstructorProfileData(BaseModel):
    cohorts: list[InstructorCohortInfo] = []
    stats: dict[str, Any] = {}


class AdminProfileData(BaseModel):
    stats: dict[str, Any] = {}


class FullProfileResponse(BaseModel):
    user: UserRead
    organizations: list[ProfileOrganizationInfo] = []
    student_profile: StudentProfileData | None = None
    instructor_data: InstructorProfileData | None = None
    admin_data: AdminProfileData | None = None


class BulkUserItem(BaseModel):
    email: EmailStr
    full_name: str = Field(max_length=255)
    password: str | None = Field(default=None, min_length=8, max_length=72)
    phone_number: str | None = Field(default=None, max_length=50)
    title: str | None = Field(default=None, max_length=100)
    role_names: list[str] = Field(default_factory=lambda: ["STUDENT"])
    must_change_password: bool = True


class BulkUserCreateRequest(BaseModel):
    organization_id: int
    default_password: str = Field(default="Welcome123!", min_length=8, max_length=72)
    default_role_names: list[str] = Field(default_factory=lambda: ["STUDENT"])
    users: list[BulkUserItem]


class BulkUserItemResult(BaseModel):
    email: str
    full_name: str
    status: str  # "created", "already_in_org", "added_to_org", "error"
    detail: str | None = None
    user_id: int | None = None
    temporary_password: str | None = None


class BulkUserCreateResponse(BaseModel):
    total_submitted: int
    total_created: int
    total_skipped: int
    total_errors: int
    results: list[BulkUserItemResult]



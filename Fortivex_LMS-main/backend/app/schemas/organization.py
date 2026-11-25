from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import OrganizationStatus


class OrganizationBase(BaseModel):
    name: str = Field(max_length=255)
    slug: str = Field(max_length=100)
    code: str = Field(max_length=20)
    primary_domain: str | None = Field(default=None, max_length=255)
    lms_domain: str | None = Field(default=None, max_length=255)
    status: OrganizationStatus = OrganizationStatus.ACTIVE
    brand_config: dict = Field(default_factory=dict)


class OrganizationCreate(OrganizationBase):
    pass


class OrganizationUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    slug: str | None = Field(default=None, max_length=100)
    code: str | None = Field(default=None, max_length=20)
    primary_domain: str | None = Field(default=None, max_length=255)
    lms_domain: str | None = Field(default=None, max_length=255)
    status: OrganizationStatus | None = None
    brand_config: dict | None = None


class OrganizationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    code: str
    status: OrganizationStatus
    primary_domain: str | None = None
    lms_domain: str | None = None
    brand_config: dict = Field(default_factory=dict)
    total_admins: int = 0
    total_instructors: int = 0
    total_students: int = 0
    total_programs: int = 0

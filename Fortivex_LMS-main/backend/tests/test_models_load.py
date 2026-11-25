from sqlalchemy.orm import configure_mappers

import app.models as models


def test_all_models_import_and_mappers_configure() -> None:
    """Catches relationship/FK typos without needing a live database."""
    configure_mappers()
    expected_tables = {
        "organizations",
        "organization_memberships",
        "roles",
        "permissions",
        "role_permissions",
        "user_roles",
        "students",
        "users",
        "programs",
        "enrollments",
    }
    assert expected_tables.issubset(models.User.metadata.tables.keys())

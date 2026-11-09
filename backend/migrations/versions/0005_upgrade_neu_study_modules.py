"""Upgrade database schema for NEU Study modules (Personnel, Admissions, Student Support).

Revision ID: 0005_upgrade_neu_study_modules
Revises: 0004_sync_missing_columns
Create Date: 2026-11-09
"""
import logging

from alembic import op
import sqlalchemy as sa

from app.core.database import Base
import app.models  # noqa: F401

revision = "0005_upgrade_neu_study_modules"
down_revision = "0004_sync_missing_columns"
branch_labels = None
depends_on = None

logger = logging.getLogger("alembic.runtime.migration")


def add_missing_columns(conn) -> list[str]:
    Base.metadata.create_all(bind=conn, checkfirst=True)
    inspector = sa.inspect(conn)
    added: list[str] = []
    for table in Base.metadata.sorted_tables:
        if not inspector.has_table(table.name):
            continue
        existing = {col["name"] for col in inspector.get_columns(table.name)}
        for column in table.columns:
            if column.name in existing:
                continue
            col_type = column.type.compile(dialect=conn.dialect)
            ddl = f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {col_type}'
            try:
                with conn.begin_nested():
                    conn.execute(sa.text(ddl))
                added.append(f"{table.name}.{column.name}")
            except Exception as exc:
                logger.warning("Could not add %s.%s: %s", table.name, column.name, exc)
    return added


def upgrade():
    added = add_missing_columns(op.get_bind())
    logger.info("Added missing tables and columns: %s", added or "none")


def downgrade():
    pass


"""move application tables to quiz_app schema

Revision ID: 4298bc7b85ea
Revises: 9f0e2834936d
"""

from typing import Sequence, Union

from alembic import op

revision: str = '4298bc7b85ea'
down_revision: Union[str, Sequence[str], None] = '9f0e2834936d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TABLES = [
    "users",
    "invite_tokens",
    "questions",
    "tests",
    "test_questions",
    "assignments",
    "attempts",
    "answers",
]


def upgrade() -> None:
    op.execute('CREATE SCHEMA IF NOT EXISTS quiz_app')

    for table in TABLES:
        op.execute(
            f"""
            DO $$
            BEGIN
                IF to_regclass('public.{table}') IS NOT NULL THEN
                    ALTER TABLE public."{table}" SET SCHEMA quiz_app;
                ELSIF to_regclass('quiz_app.{table}') IS NULL THEN
                    RAISE EXCEPTION 'Application table {table} is missing';
                END IF;
            END
            $$;
            """
        )


def downgrade() -> None:
    for table in reversed(TABLES):
        op.execute(
            f"""
            DO $$
            BEGIN
                IF to_regclass('quiz_app.{table}') IS NOT NULL THEN
                    ALTER TABLE quiz_app."{table}" SET SCHEMA public;
                ELSIF to_regclass('public.{table}') IS NULL THEN
                    RAISE EXCEPTION 'Application table {table} is missing';
                END IF;
            END
            $$;
            """
        )

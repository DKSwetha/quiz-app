-- Quiz Application schema (PostgreSQL)
-- Run order matters: parent tables first, then tables that reference them.

CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),                       -- NULL until a member sets a password
    role          VARCHAR(10)  NOT NULL DEFAULT 'member'
                  CHECK (role IN ('admin', 'member')),
    batch         VARCHAR(100),
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE invite_tokens (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ  NOT NULL,
    used_at    TIMESTAMPTZ
);

CREATE TABLE questions (
    id             SERIAL PRIMARY KEY,
    text           TEXT         NOT NULL,
    option_a       TEXT         NOT NULL,
    option_b       TEXT         NOT NULL,
    option_c       TEXT         NOT NULL,
    option_d       TEXT         NOT NULL,
    correct_option VARCHAR(1)   NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D')),
    marks          INTEGER      NOT NULL DEFAULT 1 CHECK (marks > 0),
    difficulty     VARCHAR(10)  NOT NULL DEFAULT 'medium'
                   CHECK (difficulty IN ('easy', 'medium', 'hard')),
    topic          VARCHAR(100) NOT NULL,
    explanation    TEXT,
    is_locked      BOOLEAN      NOT NULL DEFAULT FALSE,  -- becomes TRUE once a test uses it
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX ix_questions_topic ON questions(topic);

CREATE TABLE tests (
    id                SERIAL PRIMARY KEY,
    title             VARCHAR(200) NOT NULL,
    instructions      TEXT,
    duration_minutes  INTEGER      NOT NULL CHECK (duration_minutes > 0),
    pass_percentage   DOUBLE PRECISION NOT NULL CHECK (pass_percentage BETWEEN 0 AND 100),
    start_at          TIMESTAMPTZ  NOT NULL,
    end_at            TIMESTAMPTZ  NOT NULL,
    total_marks       INTEGER      NOT NULL DEFAULT 0,
    shuffle_questions BOOLEAN      NOT NULL DEFAULT FALSE,
    shuffle_options   BOOLEAN      NOT NULL DEFAULT FALSE,
    show_answer_key   BOOLEAN      NOT NULL DEFAULT FALSE,
    created_by        INTEGER      REFERENCES users(id),
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CHECK (end_at > start_at)
);

CREATE TABLE test_questions (
    test_id     INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(id),
    position    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (test_id, question_id)
);

CREATE TABLE assignments (
    id          SERIAL PRIMARY KEY,
    test_id     INTEGER     NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    user_id     INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status      VARCHAR(20) NOT NULL DEFAULT 'assigned'
                CHECK (status IN ('assigned', 'in_progress', 'submitted', 'expired')),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_assignment_test_user UNIQUE (test_id, user_id)
);
CREATE INDEX ix_assignments_status ON assignments(status);

CREATE TABLE attempts (
    id             SERIAL PRIMARY KEY,
    assignment_id  INTEGER NOT NULL UNIQUE REFERENCES assignments(id) ON DELETE CASCADE,
    started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at        TIMESTAMPTZ NOT NULL,              -- server-side deadline
    submitted_at   TIMESTAMPTZ,
    score          DOUBLE PRECISION,
    percentage     DOUBLE PRECISION,
    passed         BOOLEAN,
    question_order JSONB,                             -- saved shuffle
    option_order   JSONB                              -- saved shuffle per question
);

CREATE TABLE answers (
    id                SERIAL PRIMARY KEY,
    attempt_id        INTEGER NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
    question_id       INTEGER NOT NULL REFERENCES questions(id),
    selected_option   VARCHAR(1) CHECK (selected_option IN ('A', 'B', 'C', 'D')),
    marked_for_review BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT uq_answer_attempt_question UNIQUE (attempt_id, question_id)
);

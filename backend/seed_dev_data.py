"""Dev-only: insert sample questions, a test and an assignment.
The test is assigned to the existing member: member@gmail.com.
"""
from datetime import datetime, timedelta, timezone

from app.auth import hash_password
from app.database import SessionLocal
from app.models import Assignment, Question, Role, Test, TestQuestion, User

db = SessionLocal()

member = db.query(User).filter(
    User.email == "member@gmail.com",
    User.role == Role.MEMBER,
    User.is_active.is_(True)
).first()

if not member:
    raise SystemExit("Existing member not found or inactive.")

if db.query(Test).filter(Test.title == "Sample Test 1").first():
    raise SystemExit("Sample test already exists.")

sample = [
    ("Which keyword defines a function in Python?", "func", "def", "define", "lambda", "B", "Python", "def starts a function definition."),
    ("Which SQL clause filters rows?", "ORDER BY", "GROUP BY", "WHERE", "LIMIT", "C", "SQL", "WHERE filters rows before grouping."),
    ("Which HTTP status means Not Found?", "200", "301", "404", "500", "C", "Web", "404 means the resource was not found."),
    ("What does CSS stand for?", "Cascading Style Sheets", "Creative Style System", "Computer Style Sheets", "Colorful Style Sheets", "A", "Web", "CSS is Cascading Style Sheets."),
    ("Which data type stores True or False in Python?", "int", "str", "bool", "float", "C", "Python", "bool holds True or False."),
]

questions = []
for text, a, b, c, d, correct, topic, explanation in sample:
    q = Question(
        text=text, option_a=a, option_b=b, option_c=c, option_d=d,
        correct_option=correct, marks=1, difficulty="easy",
        topic=topic, explanation=explanation, is_locked=True,
    )
    db.add(q)
    questions.append(q)
db.flush()

now = datetime.now(timezone.utc)
test = Test(
    title="Sample Test 1",
    instructions="Answer all questions. Each carries 1 mark.",
    duration_minutes=10,
    pass_percentage=40,
    start_at=now - timedelta(days=1),
    end_at=now + timedelta(days=7),
    total_marks=len(questions),
    shuffle_questions=False,
    shuffle_options=False,
    show_answer_key=True,
)
db.add(test)
db.flush()

for pos, q in enumerate(questions, start=1):
    db.add(TestQuestion(test_id=test.id, question_id=q.id, position=pos))

db.add(Assignment(test_id=test.id, user_id=member.id))
db.commit()
print(f"Seeded 5 questions, 1 test and 1 assignment for {member.email}")

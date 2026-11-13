
import random
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import require_member
from app.database import get_db
from app.models import User, Assignment, Test, Attempt, Role, AssignmentStatus, TestQuestion, Question, Answer

router = APIRouter(prefix="/members", tags=["members"])

MINUTES_PER_QUESTION = 2

@router.get("/{user_id}/dashboard")
def get_member_dashboard(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_member),
):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="You can only access your own dashboard")

    # 1. Check whether the member exists
    user = db.query(User).filter(
        User.id == user_id,
        User.role == Role.MEMBER,
        User.is_active == True
    ).first()

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="Member not found"
        )

    # 2. Get all tests assigned to this member
    assignments = (
        db.query(Assignment, Test)
        .join(Test, Assignment.test_id == Test.id)
        .filter(Assignment.user_id == user_id)
        .all()
    )

    assigned_tests = []

    for assignment, test in assignments:
        assigned_tests.append({
            "assignment_id": assignment.id,
            "test_id": test.id,
            "title": test.title,
            "duration_minutes": test.duration_minutes,
            "total_marks": test.total_marks,
            "status": assignment.status
        })

    # 3. Get the member's recently submitted attempts
    attempts = (
        db.query(Attempt, Assignment, Test)
        .join(Assignment, Attempt.assignment_id == Assignment.id)
        .join(Test, Assignment.test_id == Test.id)
        .filter(
            Assignment.user_id == user_id,
            Attempt.submitted_at.isnot(None)
        )
        .order_by(Attempt.submitted_at.desc())
        .limit(5)
        .all()
    )

    recent_results = []

    for attempt, assignment, test in attempts:
        recent_results.append({
            "title": test.title,
            "score": attempt.score,
            "total_marks": test.total_marks,
            "submitted_at": attempt.submitted_at
        })

    # 4. Return dashboard data
    return {
        "assigned_tests": assigned_tests,
        "recent_results": recent_results
    }




@router.get("/{user_id}/tests/{test_id}")
def get_test_details(
    user_id: int,
    test_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_member),
):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="You can only view your own assigned tests")

    # Check member
    user = db.query(User).filter(
        User.id == user_id,
        User.role == Role.MEMBER,
        User.is_active == True
    ).first()

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="Member not found"
        )

    # Check test assignment
    assignment = db.query(Assignment).filter(
        Assignment.user_id == user_id,
        Assignment.test_id == test_id
    ).first()

    if assignment is None:
        raise HTTPException(
            status_code=403,
            detail="This test is not assigned to you"
        )

    # Get test details
    test = db.query(Test).filter(
        Test.id == test_id
    ).first()

    if test is None:
        raise HTTPException(
            status_code=404,
            detail="Test not found"
        )

    # Count questions assigned to this test
    question_count = db.query(TestQuestion).filter(
        TestQuestion.test_id == test_id
    ).count()

    # Calculate duration
    duration_minutes = question_count * MINUTES_PER_QUESTION

    # Return test details
    return {
        "test_id": test.id,
        "assignment_id": assignment.id,
        "title": test.title,
        "instructions": test.instructions,
        "question_count": question_count,
        "minutes_per_question": MINUTES_PER_QUESTION,
        "duration_minutes": duration_minutes,
        "total_marks": test.total_marks,
        "pass_percentage": test.pass_percentage,
        "start_at": test.start_at,
        "end_at": test.end_at,
        "status": assignment.status
    }



@router.post("/{user_id}/tests/{test_id}/start")
def start_test(
    user_id: int,
    test_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_member),
):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="You can only start your own tests")

    # Check member
    user = db.query(User).filter(
        User.id == user_id,
        User.role == Role.MEMBER,
        User.is_active.is_(True)
    ).first()

    if user is None:
        raise HTTPException(status_code=404, detail="Member not found")

    # Check assignment
    assignment = db.query(Assignment).filter(
        Assignment.user_id == user_id,
        Assignment.test_id == test_id
    ).first()

    if assignment is None:
        raise HTTPException(
            status_code=403,
            detail="This test is not assigned to you"
        )

    # Get test
    test = db.query(Test).filter(Test.id == test_id).first()

    if test is None:
        raise HTTPException(status_code=404, detail="Test not found")

    now = datetime.now(timezone.utc)

    # Check existing attempt
    attempt = db.query(Attempt).filter(
        Attempt.assignment_id == assignment.id
    ).first()

    if attempt:
        if attempt.submitted_at is not None:
            raise HTTPException(
                status_code=409,
                detail="This test has already been submitted"
            )

        if now >= attempt.ends_at:
            assignment.status = AssignmentStatus.EXPIRED
            db.commit()

            raise HTTPException(
                status_code=409,
                detail="Test time has expired"
            )

        return {
            "message": "Resuming existing attempt",
            "attempt_id": attempt.id,
            "started_at": attempt.started_at,
            "ends_at": attempt.ends_at,
            "status": assignment.status
        }

    # Check test availability
    if assignment.status != AssignmentStatus.ASSIGNED:
        raise HTTPException(
            status_code=409,
            detail="This test cannot be started"
        )

    if now < test.start_at:
        raise HTTPException(
            status_code=403,
            detail="Test has not started yet"
        )

    if now >= test.end_at:
        assignment.status = AssignmentStatus.EXPIRED
        db.commit()

        raise HTTPException(
            status_code=403,
            detail="Test availability period has ended"
        )

    # Get questions assigned to the test
    test_questions = db.query(TestQuestion).filter(
        TestQuestion.test_id == test_id
    ).order_by(TestQuestion.position).all()

    if not test_questions:
        raise HTTPException(
            status_code=400,
            detail="No questions available for this test"
        )

    question_ids = [item.question_id for item in test_questions]

    if test.shuffle_questions:
        random.shuffle(question_ids)

    # Calculate deadline
    ends_at = min(
        now + timedelta(minutes=test.duration_minutes),
        test.end_at
    )

    # Create attempt
    attempt = Attempt(
        assignment_id=assignment.id,
        started_at=now,
        ends_at=ends_at,
        question_order=question_ids
    )

    assignment.status = AssignmentStatus.IN_PROGRESS

    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    return {
        "message": "Test started successfully",
        "attempt_id": attempt.id,
        "started_at": attempt.started_at,
        "ends_at": attempt.ends_at,
        "status": assignment.status
    }


@router.get("/{user_id}/attempts/{attempt_id}/questions")
def get_attempt_questions(
    user_id: int,
    attempt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_member),
):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="You can only access your own attempts")

    # 1. Check whether the member exists
    user = db.query(User).filter(
        User.id == user_id,
        User.role == Role.MEMBER,
        User.is_active.is_(True)
    ).first()

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="Member not found"
        )

    # 2. Find the attempt and verify its ownership
    attempt_data = (
        db.query(Attempt, Assignment, Test)
        .join(Assignment, Attempt.assignment_id == Assignment.id)
        .join(Test, Assignment.test_id == Test.id)
        .filter(
            Attempt.id == attempt_id,
            Assignment.user_id == user_id
        )
        .first()
    )

    if attempt_data is None:
        raise HTTPException(
            status_code=404,
            detail="Test attempt not found"
        )

    attempt, assignment, test = attempt_data

    # 3. Check whether the attempt is already submitted
    if attempt.submitted_at is not None:
        raise HTTPException(
            status_code=409,
            detail="This test has already been submitted"
        )

    # 4. Check the server-side deadline
    now = datetime.now(timezone.utc)

    if now >= attempt.ends_at:
        raise HTTPException(
            status_code=409,
            detail="Test time has expired"
        )

    if assignment.status != AssignmentStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=409,
            detail="This test attempt is not active"
        )

    # 5. Fetch questions and any saved answers
    rows = (
        db.query(Question, Answer)
        .join(
            TestQuestion,
            TestQuestion.question_id == Question.id
        )
        .outerjoin(
            Answer,
            (Answer.question_id == Question.id) &
            (Answer.attempt_id == attempt.id)
        )
        .filter(TestQuestion.test_id == test.id)
        .order_by(TestQuestion.position)
        .all()
    )

    if not rows:
        raise HTTPException(
            status_code=400,
            detail="No questions found for this test"
        )

    # 6. Prepare the question data
    question_map = {}

    for question, answer in rows:
        question_map[question.id] = {
            "question_id": question.id,
            "text": question.text,
            "option_a": question.option_a,
            "option_b": question.option_b,
            "option_c": question.option_c,
            "option_d": question.option_d,
            "marks": question.marks,
            "selected_option": (
                answer.selected_option if answer else None
            ),
            "marked_for_review": (
                answer.marked_for_review if answer else False
            )
        }

    # 7. Preserve the question order saved in the attempt
    saved_order = attempt.question_order or []

    if saved_order:
        ordered_questions = [
            question_map[question_id]
            for question_id in saved_order
            if question_id in question_map
        ]
    else:
        ordered_questions = list(question_map.values())

    # 8. Return questions without correct answers
    return {
        "attempt_id": attempt.id,
        "test_title": test.title,
        "ends_at": attempt.ends_at,
        "questions": ordered_questions
    }

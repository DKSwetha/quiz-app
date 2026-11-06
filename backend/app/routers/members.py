
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Assignment, Test, Attempt, Role

router = APIRouter(prefix="/members", tags=["members"])


@router.get("/{user_id}/dashboard")
def get_member_dashboard(user_id: int, db: Session = Depends(get_db)):

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

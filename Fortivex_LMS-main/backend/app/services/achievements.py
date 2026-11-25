from datetime import date, datetime, timedelta
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.models.cohort import Cohort
from app.models.curriculum import Activity, Lesson, ProgramModule, Week
from app.models.enrollment import Enrollment
from app.models.enums import EnrollmentStatus
from app.models.progress import (
    ActivityCompletion,
    QuizAttempt,
    StudentStreak,
    StudentStreakFreezeLog,
)
from app.models.student import Student
from app.models.user import User
from app.schemas.achievements import (
    AchievementBadge,
    BadgeProgress,
    CohortAchievementsResponse,
    CohortBenchmark,
    CurrentStudentStats,
    PeerComparisonResponse,
    PeerLeaderboardItem,
    StreakActionResponse,
    StreakDayStatus,
    StreakInfo,
    StudentCohortSummary,
)

# Badge Catalog Definitions
BASE_BADGES = [
    {
        "id": "FIRST_STEP",
        "title": "First Steps",
        "description": "Completed your first learning activity in this cohort",
        "icon": "rocket_launch",
        "color": "#3b82f6",
        "category": "Curriculum",
        "tier": "Bronze",
        "xp_reward": 50,
        "type": "ACTIVITIES",
        "target": 1,
        "unit": "activity",
    },
    {
        "id": "KNOWLEDGE_SEEKER",
        "title": "Knowledge Seeker",
        "description": "Completed 5 learning activities in this cohort",
        "icon": "menu_book",
        "color": "#06b6d4",
        "category": "Curriculum",
        "tier": "Bronze",
        "xp_reward": 150,
        "type": "ACTIVITIES",
        "target": 5,
        "unit": "activities",
    },
    {
        "id": "DILIGENT_SCHOLAR",
        "title": "Diligent Scholar",
        "description": "Completed 10 learning activities in this cohort",
        "icon": "school",
        "color": "#8b5cf6",
        "category": "Curriculum",
        "tier": "Silver",
        "xp_reward": 300,
        "type": "ACTIVITIES",
        "target": 10,
        "unit": "activities",
    },
    {
        "id": "CURRICULUM_COMPLETER",
        "title": "Curriculum Master",
        "description": "Finished all learning activities in this cohort's program",
        "icon": "workspace_premium",
        "color": "#ec4899",
        "category": "Curriculum",
        "tier": "Gold",
        "xp_reward": 600,
        "type": "CURRICULUM_100",
        "target": 100,
        "unit": "%",
    },
    {
        "id": "FIRST_QUIZ",
        "title": "Quiz Challenger",
        "description": "Attempted your first knowledge check quiz assessment",
        "icon": "quiz",
        "color": "#f59e0b",
        "category": "Assessment",
        "tier": "Bronze",
        "xp_reward": 75,
        "type": "QUIZ_COUNT",
        "target": 1,
        "unit": "quiz",
    },
    {
        "id": "PERFECT_SCORE",
        "title": "Quiz Ace",
        "description": "Scored 100% on a cohort quiz assessment",
        "icon": "stars",
        "color": "#10b981",
        "category": "Assessment",
        "tier": "Gold",
        "xp_reward": 250,
        "type": "PERFECT_QUIZ",
        "target": 1,
        "unit": "ace",
    },
    {
        "id": "HIGH_ACHIEVER",
        "title": "High Achiever",
        "description": "Maintained an average quiz score of 80% or higher",
        "icon": "psychology",
        "color": "#6366f1",
        "category": "Assessment",
        "tier": "Silver",
        "xp_reward": 300,
        "type": "QUIZ_AVG",
        "target": 80,
        "unit": "%",
    },
    {
        "id": "QUIZ_VETERAN",
        "title": "Quiz Veteran",
        "description": "Completed 3 or more graded quiz assessments",
        "icon": "military_tech",
        "color": "#eab308",
        "category": "Assessment",
        "tier": "Silver",
        "xp_reward": 250,
        "type": "QUIZ_COUNT",
        "target": 3,
        "unit": "quizzes",
    },
    {
        "id": "TOP_CONTENDER",
        "title": "Top Contender",
        "description": "Ranked in the top 50% percentile of your cohort",
        "icon": "trending_up",
        "color": "#14b8a6",
        "category": "Cohort Standing",
        "tier": "Bronze",
        "xp_reward": 200,
        "type": "RANK_PERCENTILE",
        "target": 50,
        "unit": "% rank",
    },
    {
        "id": "PODIUM_FINISHER",
        "title": "Podium Finisher",
        "description": "Achieved a top 3 rank in your cohort standings",
        "icon": "emoji_events",
        "color": "#f59e0b",
        "category": "Cohort Standing",
        "tier": "Silver",
        "xp_reward": 400,
        "type": "RANK_TOP3",
        "target": 3,
        "unit": "rank",
    },
    {
        "id": "COHORT_VALEDICTORIAN",
        "title": "Cohort Champion",
        "description": "Ranked #1 highest standing in your cohort",
        "icon": "military_tech",
        "color": "#fbbf24",
        "category": "Cohort Standing",
        "tier": "Platinum",
        "xp_reward": 750,
        "type": "RANK_FIRST",
        "target": 1,
        "unit": "rank",
    },
    {
        "id": "STREAK_3_DAYS",
        "title": "Ignition Flame",
        "description": "Maintained a 3-day consecutive learning streak",
        "icon": "local_fire_department",
        "color": "#f97316",
        "category": "Streak",
        "tier": "Bronze",
        "xp_reward": 100,
        "type": "STREAK",
        "target": 3,
        "unit": "days",
    },
    {
        "id": "STREAK_7_DAYS",
        "title": "Week Warrior",
        "description": "Maintained a 7-day study streak without missing a day",
        "icon": "whatshot",
        "color": "#ef4444",
        "category": "Streak",
        "tier": "Silver",
        "xp_reward": 300,
        "type": "STREAK",
        "target": 7,
        "unit": "days",
    },
    {
        "id": "STREAK_14_DAYS",
        "title": "Fortnight Phenom",
        "description": "Achieved a 14-day study streak",
        "icon": "bolt",
        "color": "#8b5cf6",
        "category": "Streak",
        "tier": "Gold",
        "xp_reward": 600,
        "type": "STREAK",
        "target": 14,
        "unit": "days",
    },
    {
        "id": "STREAK_30_DAYS",
        "title": "Unstoppable Force",
        "description": "Achieved an epic 30-day continuous learning streak",
        "icon": "auto_awesome",
        "color": "#eab308",
        "category": "Streak",
        "tier": "Platinum",
        "xp_reward": 1200,
        "type": "STREAK",
        "target": 30,
        "unit": "days",
    },
    {
        "id": "STREAK_SAVER",
        "title": "Guardian Angel",
        "description": "Successfully used a weekly streak save to protect your flame",
        "icon": "shield",
        "color": "#10b981",
        "category": "Streak",
        "tier": "Bronze",
        "xp_reward": 150,
        "type": "STREAK_SAVED",
        "target": 1,
        "unit": "freeze",
    },
]


def get_or_create_student_streak(db: Session, student_id: int) -> StudentStreak:
    streak = db.query(StudentStreak).filter(StudentStreak.student_id == student_id).first()
    now = datetime.utcnow()
    today = date.today()

    if not streak:
        # Determine initial activity history from completed activities & quizzes
        completions = (
            db.query(ActivityCompletion.created_at)
            .filter(ActivityCompletion.student_id == student_id)
            .all()
        )
        quizzes = (
            db.query(QuizAttempt.created_at)
            .filter(QuizAttempt.student_id == student_id)
            .all()
        )
        active_dates = sorted(
            {c[0].date() for c in completions if c[0]}
            | {q[0].date() for q in quizzes if q[0]}
        )

        current_streak = 0
        longest_streak = 0
        last_date = None

        if active_dates:
            last_date = active_dates[-1]
            temp_streak = 0
            prev_d = None
            for d in active_dates:
                if prev_d is None or d == prev_d + timedelta(days=1):
                    temp_streak += 1
                elif d > prev_d + timedelta(days=1):
                    temp_streak = 1
                prev_d = d
                if temp_streak > longest_streak:
                    longest_streak = temp_streak

            # Check if streak is alive relative to today
            if last_date == today or last_date == today - timedelta(days=1):
                current_streak = temp_streak
            else:
                current_streak = 0

        streak = StudentStreak(
            student_id=student_id,
            current_streak=current_streak,
            longest_streak=longest_streak,
            last_activity_date=last_date,
            streak_freeze_count=1,  # 1 streak save per student per week
            last_freeze_replenished_at=now,
            total_freezes_used=0,
            last_freeze_used_date=None,
        )
        db.add(streak)
        try:
            db.commit()
            db.refresh(streak)
            return streak
        except IntegrityError:
            db.rollback()
            streak = db.query(StudentStreak).filter(StudentStreak.student_id == student_id).first()
            if streak:
                return streak
            raise

    # Check weekly streak freeze replenishment (1 save per student per week)
    if not streak.last_freeze_replenished_at:
        streak.streak_freeze_count = max(streak.streak_freeze_count, 1)
        streak.last_freeze_replenished_at = now
    else:
        days_since_replenish = (today - streak.last_freeze_replenished_at.date()).days
        is_new_iso_week = today.isocalendar()[1] != streak.last_freeze_replenished_at.date().isocalendar()[1]
        if (days_since_replenish >= 7 or is_new_iso_week) and streak.streak_freeze_count < 1:
            streak.streak_freeze_count = 1
            streak.last_freeze_replenished_at = now

    # Continuity check with automatic weekly streak save protection
    if streak.last_activity_date:
        gap_days = (today - streak.last_activity_date).days
        if gap_days == 2:
            # Student was active 2 days ago, missed yesterday (today - 1 day)
            if streak.streak_freeze_count >= 1:
                # Consume 1 weekly streak save to protect yesterday
                yesterday = today - timedelta(days=1)
                streak.streak_freeze_count -= 1
                streak.total_freezes_used += 1
                streak.last_freeze_used_date = yesterday
                freeze_log = StudentStreakFreezeLog(
                    streak_id=streak.id,
                    student_id=student_id,
                    saved_date=yesterday,
                    reason="WEEKLY_AUTO_PROTECTION",
                )
                db.add(freeze_log)
                streak.last_activity_date = yesterday
            else:
                streak.current_streak = 0
        elif gap_days > 2:
            # Missed more than 1 day without back-to-back saves
            streak.current_streak = 0

    db.commit()
    db.refresh(streak)
    return streak


def record_student_activity_today(db: Session, student_id: int, activity_date: date | None = None) -> StudentStreak:
    today = activity_date or date.today()
    streak = get_or_create_student_streak(db, student_id)
    if streak.last_activity_date == today:
        return streak

    if streak.last_activity_date == today - timedelta(days=1):
        streak.current_streak += 1
    else:
        streak.current_streak = 1

    if streak.current_streak > streak.longest_streak:
        streak.longest_streak = streak.current_streak

    streak.last_activity_date = today
    db.commit()
    db.refresh(streak)
    return streak


def apply_streak_save_manual(db: Session, student_id: int) -> tuple[bool, str, StudentStreak]:
    streak = get_or_create_student_streak(db, student_id)
    if streak.streak_freeze_count < 1:
        return False, "You do not have any streak saves available. Saves replenish every week.", streak

    today = date.today()
    yesterday = today - timedelta(days=1)

    if streak.last_activity_date == yesterday or streak.last_freeze_used_date == yesterday:
        return False, "Yesterday is already protected or marked active.", streak

    streak.streak_freeze_count -= 1
    streak.total_freezes_used += 1
    streak.last_freeze_used_date = yesterday
    freeze_log = StudentStreakFreezeLog(
        streak_id=streak.id,
        student_id=student_id,
        saved_date=yesterday,
        reason="MANUAL_STREAK_SAVE",
    )
    db.add(freeze_log)
    streak.last_activity_date = yesterday
    db.commit()
    db.refresh(streak)
    return True, "Streak save successfully applied to protect yesterday!", streak


def get_student_streak_info(db: Session, student_id: int) -> StreakInfo:
    streak = get_or_create_student_streak(db, student_id)
    today = date.today()

    is_active_today = (streak.last_activity_date == today)

    # Days until next replenishment (next Monday)
    days_until_next_monday = (7 - today.weekday()) % 7
    if days_until_next_monday == 0:
        days_until_next_monday = 7

    used_recently = (
        streak.last_freeze_used_date is not None
        and (today - streak.last_freeze_used_date).days <= 3
    )

    used_this_week = (
        streak.last_freeze_used_date is not None
        and (today - streak.last_freeze_used_date).days <= 7
    )

    # Contextual Alert Message
    alert_msg = None
    if streak.last_freeze_used_date == today - timedelta(days=1):
        alert_msg = "🛡️ Streak Protected! Your weekly streak save was activated for yesterday. Complete a learning activity today to keep your streak burning!"
    elif not is_active_today and streak.current_streak > 0:
        if streak.streak_freeze_count > 0:
            alert_msg = f"🔥 Streak on the line: {streak.current_streak} days. Study today to keep it going (1 weekly streak save is guarding your back)!"
        else:
            alert_msg = f"🔥 Protect your {streak.current_streak}-day streak! No streak saves left this week — complete a lesson today!"
    elif is_active_today:
        alert_msg = f"🔥 Flame is blazing! You've logged activity today ({streak.current_streak}-day streak)."

    # 7-day history array
    saved_dates = {
        log.saved_date
        for log in db.query(StudentStreakFreezeLog).filter(StudentStreakFreezeLog.student_id == student_id).all()
    }
    if streak.last_freeze_used_date:
        saved_dates.add(streak.last_freeze_used_date)

    completions = (
        db.query(ActivityCompletion.created_at)
        .filter(ActivityCompletion.student_id == student_id)
        .all()
    )
    quizzes = (
        db.query(QuizAttempt.created_at)
        .filter(QuizAttempt.student_id == student_id)
        .all()
    )
    active_dates = {c[0].date() for c in completions if c[0]} | {q[0].date() for q in quizzes if q[0]}
    if streak.last_activity_date:
        active_dates.add(streak.last_activity_date)

    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    history = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        day_str = d.isoformat()
        day_label = day_names[d.weekday()]

        if d == today:
            status_val = "TODAY_COMPLETED" if is_active_today else "TODAY_PENDING"
        elif d in saved_dates:
            status_val = "SAVED"
        elif d in active_dates:
            status_val = "ACTIVE"
        else:
            status_val = "MISSED"

        history.append(
            StreakDayStatus(
                date=day_str,
                day_name=day_label,
                status=status_val,
            )
        )

    return StreakInfo(
        current_streak=streak.current_streak,
        longest_streak=streak.longest_streak,
        last_activity_date=streak.last_activity_date.isoformat() if streak.last_activity_date else None,
        is_active_today=is_active_today,
        streak_freeze_count=streak.streak_freeze_count,
        streak_freeze_replenishes_in_days=days_until_next_monday,
        streak_freeze_used_this_week=used_this_week,
        total_freezes_used=streak.total_freezes_used,
        last_freeze_used_date=streak.last_freeze_used_date.isoformat() if streak.last_freeze_used_date else None,
        streak_saved_recently=used_recently,
        alert_message=alert_msg,
        history=history,
    )


def resolve_student_and_cohorts(db: Session, user: User) -> tuple[Student, list[Enrollment]]:
    student = db.query(Student).filter(Student.user_id == user.id).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")

    enrollments = (
        db.query(Enrollment)
        .filter(Enrollment.student_id == student.id, Enrollment.cohort_id.isnot(None))
        .options(
            joinedload(Enrollment.cohort),
            joinedload(Enrollment.program),
            joinedload(Enrollment.organization),
        )
        .all()
    )
    return student, enrollments


def get_cohort_activities(db: Session, cohort: Cohort) -> list[Activity]:
    program_ids = [p.id for p in cohort.programs]
    if not program_ids:
        return []

    return (
        db.query(Activity)
        .join(Lesson, Lesson.id == Activity.lesson_id)
        .join(Week, Week.id == Lesson.week_id)
        .join(ProgramModule, ProgramModule.id == Week.program_module_id)
        .filter(ProgramModule.program_id.in_(program_ids))
        .all()
    )


def compute_student_cohort_metrics(
    db: Session,
    student: Student,
    cohort_activity_ids: set[int],
    total_cohort_activities: int,
) -> dict:
    completions = (
        db.query(ActivityCompletion)
        .filter(ActivityCompletion.student_id == student.id)
        .all()
    )
    if cohort_activity_ids:
        cohort_completions = [c for c in completions if c.activity_id in cohort_activity_ids]
    else:
        cohort_completions = completions

    attempts = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.student_id == student.id)
        .all()
    )
    if cohort_activity_ids:
        cohort_attempts = [a for a in attempts if a.activity_id in cohort_activity_ids]
        if not cohort_attempts and attempts:
            cohort_attempts = attempts
    else:
        cohort_attempts = attempts

    activities_completed = len(cohort_completions)
    quizzes_attempted = len(cohort_attempts)

    if cohort_attempts:
        total_quiz_pct = sum((a.score / a.total_questions * 100) if a.total_questions > 0 else 0 for a in cohort_attempts)
        quiz_avg = round(total_quiz_pct / len(cohort_attempts), 1)
        total_quiz_score_pts = sum(a.score for a in cohort_attempts)
        has_perfect_score = any(a.score >= a.total_questions and a.total_questions > 0 for a in cohort_attempts)
    else:
        quiz_avg = 0.0
        total_quiz_score_pts = 0
        has_perfect_score = False

    completion_rate = (
        int(round((activities_completed / total_cohort_activities) * 100))
        if total_cohort_activities > 0
        else (100 if activities_completed > 0 else 0)
    )

    base_xp = (activities_completed * 50) + int(total_quiz_score_pts * 20)
    earliest_activity_time = min([c.created_at for c in cohort_completions], default=datetime.max)
    streak = get_or_create_student_streak(db, student.id)

    return {
        "student": student,
        "activities_completed": activities_completed,
        "quizzes_attempted": quizzes_attempted,
        "quiz_avg": quiz_avg,
        "total_quiz_score_pts": total_quiz_score_pts,
        "has_perfect_score": has_perfect_score,
        "completion_rate": completion_rate,
        "base_xp": base_xp,
        "earliest_activity_time": earliest_activity_time,
        "latest_completion_date": max([c.created_at for c in cohort_completions], default=None),
        "current_streak": streak.current_streak,
        "longest_streak": streak.longest_streak,
        "streak_saves_used": streak.total_freezes_used,
        "streak_freeze_count": streak.streak_freeze_count,
    }


def evaluate_badges_for_student(
    metrics: dict,
    total_cohort_activities: int,
    rank: int,
    cohort_size: int,
) -> list[AchievementBadge]:
    badges = []
    activities_completed = metrics["activities_completed"]
    quizzes_attempted = metrics["quizzes_attempted"]
    quiz_avg = metrics["quiz_avg"]
    has_perfect_score = metrics["has_perfect_score"]
    completion_rate = metrics["completion_rate"]
    latest_date = metrics["latest_completion_date"]

    for b in BASE_BADGES:
        unlocked = False
        current_val = 0
        target_val = b["target"]

        if b["type"] == "ACTIVITIES":
            current_val = activities_completed
            unlocked = activities_completed >= target_val
        elif b["type"] == "CURRICULUM_100":
            current_val = completion_rate
            target_val = 100
            unlocked = completion_rate >= 100 and activities_completed > 0
        elif b["type"] == "QUIZ_COUNT":
            current_val = quizzes_attempted
            unlocked = quizzes_attempted >= target_val
        elif b["type"] == "PERFECT_QUIZ":
            current_val = 1 if has_perfect_score else 0
            unlocked = has_perfect_score
        elif b["type"] == "QUIZ_AVG":
            current_val = int(round(quiz_avg))
            unlocked = quiz_avg >= target_val and quizzes_attempted > 0
        elif b["type"] == "RANK_FIRST":
            current_val = 1 if rank == 1 else 0
            unlocked = rank == 1
        elif b["type"] == "RANK_TOP3":
            current_val = 1 if rank <= 3 else 0
            unlocked = rank <= 3
        elif b["type"] == "RANK_PERCENTILE":
            if cohort_size > 1:
                percentile = int(round((rank / cohort_size) * 100))
            else:
                percentile = 50 if rank == 1 else 100
            current_val = 1 if percentile <= 50 else 0
            unlocked = percentile <= 50 and activities_completed > 0
        elif b["type"] == "STREAK":
            current_val = metrics.get("current_streak", 0)
            unlocked = current_val >= target_val
        elif b["type"] == "STREAK_SAVED":
            current_val = metrics.get("streak_saves_used", 0)
            unlocked = current_val >= target_val

        pct = min(100, int(round((current_val / target_val) * 100))) if target_val > 0 else (100 if unlocked else 0)

        badges.append(
            AchievementBadge(
                id=b["id"],
                title=b["title"],
                description=b["description"],
                icon=b["icon"],
                color=b["color"],
                category=b["category"],
                tier=b["tier"],
                xp_reward=b["xp_reward"],
                unlocked=unlocked,
                unlocked_at=latest_date if unlocked else None,
                progress=BadgeProgress(
                    current=min(current_val, target_val),
                    target=target_val,
                    unit=b["unit"],
                    percentage=pct,
                ),
            )
        )

    return badges


def get_cohort_achievements_data(
    db: Session,
    user: User,
    cohort_id: int | None = None,
) -> CohortAchievementsResponse:
    student, enrollments = resolve_student_and_cohorts(db, user)

    if not enrollments:
        return CohortAchievementsResponse(
            has_cohort=False,
            student_cohorts=[],
            active_cohort=None,
            current_student_stats=None,
            cohort_benchmarks=None,
            badges=[],
            leaderboard=[],
        )

    student_cohorts = [
        StudentCohortSummary(
            cohort_id=e.cohort.id,
            cohort_name=e.cohort.name,
            cohort_code=e.cohort.code,
            program_id=e.program.id if e.program else None,
            program_name=e.program.name if e.program else None,
            organization_name=e.organization.name if e.organization else None,
        )
        for e in enrollments
        if e.cohort
    ]

    selected_cohort_id = cohort_id or (enrollments[0].cohort_id if enrollments else None)
    active_enrollment = next((e for e in enrollments if e.cohort_id == selected_cohort_id), enrollments[0])
    target_cohort = active_enrollment.cohort

    active_cohort_summary = StudentCohortSummary(
        cohort_id=target_cohort.id,
        cohort_name=target_cohort.name,
        cohort_code=target_cohort.code,
        program_id=active_enrollment.program.id if active_enrollment.program else None,
        program_name=active_enrollment.program.name if active_enrollment.program else None,
        organization_name=active_enrollment.organization.name if active_enrollment.organization else None,
    )

    cohort_activities = get_cohort_activities(db, target_cohort)
    total_cohort_activities = len(cohort_activities)
    cohort_activity_ids = {a.id for a in cohort_activities}

    # Fetch ALL students actively enrolled in this exact cohort & organization
    cohort_enrollments = (
        db.query(Enrollment)
        .filter(
            Enrollment.cohort_id == target_cohort.id,
            Enrollment.organization_id == target_cohort.organization_id,
            Enrollment.status.in_([EnrollmentStatus.ENROLLED, EnrollmentStatus.ACTIVE]),
        )
        .options(joinedload(Enrollment.student).joinedload(Student.user))
        .all()
    )

    peer_students = [e.student for e in cohort_enrollments if e.student]
    # Remove duplicates if any
    seen_students = {}
    for s in peer_students:
        seen_students[s.id] = s
    unique_peer_students = list(seen_students.values())
    cohort_size = len(unique_peer_students)

    peer_metrics_list = []
    for peer_s in unique_peer_students:
        m = compute_student_cohort_metrics(
            db=db,
            student=peer_s,
            cohort_activity_ids=cohort_activity_ids,
            total_cohort_activities=total_cohort_activities,
        )
        peer_metrics_list.append(m)

    # Initial sort to estimate ranking
    peer_metrics_list.sort(
        key=lambda x: (x["base_xp"], x["activities_completed"], x["quiz_avg"]),
        reverse=True,
    )

    # Now calculate badges and total XP for all peers
    leaderboard_items = []
    current_student_badges = []
    current_student_stats_obj = None

    for preliminary_rank, m in enumerate(peer_metrics_list, start=1):
        peer_s = m["student"]
        is_current = peer_s.id == student.id

        peer_badges = evaluate_badges_for_student(
            metrics=m,
            total_cohort_activities=total_cohort_activities,
            rank=preliminary_rank,
            cohort_size=cohort_size,
        )

        unlocked_badges = [b for b in peer_badges if b.unlocked]
        bonus_badge_xp = sum(b.xp_reward for b in unlocked_badges)
        total_xp = m["base_xp"] + bonus_badge_xp

        m["total_xp"] = total_xp
        m["unlocked_badges"] = unlocked_badges
        m["all_badges"] = peer_badges

        if is_current:
            current_student_badges = peer_badges

    # Final sort based on total XP (including badge rewards)
    peer_metrics_list.sort(
        key=lambda x: (x["total_xp"], x["activities_completed"], x["quiz_avg"]),
        reverse=True,
    )

    # Build final leaderboard with final ranks
    for final_rank, m in enumerate(peer_metrics_list, start=1):
        peer_s = m["student"]
        peer_user = peer_s.user
        is_current = peer_s.id == student.id

        top_icons = [
            {"icon": b.icon, "color": b.color, "title": b.title}
            for b in m["unlocked_badges"][:4]
        ]

        leaderboard_items.append(
            PeerLeaderboardItem(
                rank=final_rank,
                student_id=peer_s.id,
                user_id=peer_user.id if peer_user else 0,
                name=peer_user.full_name if peer_user else f"Student #{peer_s.id}",
                title=peer_user.title if peer_user else None,
                avatar_url=peer_user.avatar_url if peer_user else None,
                is_current_student=is_current,
                total_xp=m["total_xp"],
                activities_completed=m["activities_completed"],
                total_activities=total_cohort_activities,
                quiz_average=m["quiz_avg"],
                quizzes_attempted=m["quizzes_attempted"],
                badges_count=len(m["unlocked_badges"]),
                current_streak=m.get("current_streak", 0),
                top_badge_icons=top_icons,
            )
        )

        if is_current:
            current_student_stats_obj = CurrentStudentStats(
                student_id=student.id,
                full_name=peer_user.full_name if peer_user else "You",
                rank=final_rank,
                total_xp=m["total_xp"],
                activities_completed=m["activities_completed"],
                total_activities=total_cohort_activities,
                completion_rate=m["completion_rate"],
                quiz_average=m["quiz_avg"],
                quizzes_attempted=m["quizzes_attempted"],
                badges_unlocked=len(m["unlocked_badges"]),
                total_possible_badges=len(m["all_badges"]),
                current_streak=m.get("current_streak", 0),
                longest_streak=m.get("longest_streak", 0),
                streak_freeze_count=m.get("streak_freeze_count", 1),
            )

    # Benchmark statistics across this specific cohort
    if cohort_size > 1:
        avg_xp = int(round(sum(m["total_xp"] for m in peer_metrics_list) / cohort_size))
        avg_act = round(sum(m["activities_completed"] for m in peer_metrics_list) / cohort_size, 1)
        avg_quiz = round(sum(m["quiz_avg"] for m in peer_metrics_list) / cohort_size, 1)
        top_xp = peer_metrics_list[0]["total_xp"] if peer_metrics_list else 0
        student_rank = current_student_stats_obj.rank if current_student_stats_obj else 1
        pct = max(1, int(round((student_rank / cohort_size) * 100)))
        percentile_str = f"Top {pct}%"
    elif cohort_size == 1:
        avg_xp = peer_metrics_list[0]["total_xp"] if peer_metrics_list else 0
        avg_act = float(peer_metrics_list[0]["activities_completed"]) if peer_metrics_list else 0.0
        avg_quiz = float(peer_metrics_list[0]["quiz_avg"]) if peer_metrics_list else 0.0
        top_xp = avg_xp
        percentile_str = "Rank 1 of 1"
    else:
        avg_xp = 0
        avg_act = 0.0
        avg_quiz = 0.0
        top_xp = 0
        percentile_str = "N/A"

    benchmarks = CohortBenchmark(
        cohort_size=cohort_size,
        avg_xp=avg_xp,
        avg_activities_completed=avg_act,
        avg_quiz_score=avg_quiz,
        student_percentile=percentile_str,
        top_cohort_xp=top_xp,
    )

    return CohortAchievementsResponse(
        has_cohort=True,
        student_cohorts=student_cohorts,
        active_cohort=active_cohort_summary,
        current_student_stats=current_student_stats_obj,
        cohort_benchmarks=benchmarks,
        badges=current_student_badges,
        leaderboard=leaderboard_items,
        streak=get_student_streak_info(db, student.id),
    )


def compare_peer_in_cohort(
    db: Session,
    user: User,
    peer_student_id: int,
    cohort_id: int,
) -> PeerComparisonResponse:
    student, enrollments = resolve_student_and_cohorts(db, user)
    # Check that current user is enrolled in this cohort
    my_cohort_enrollment = next((e for e in enrollments if e.cohort_id == cohort_id), None)
    if not my_cohort_enrollment:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not enrolled in this cohort")

    peer_enrollment = (
        db.query(Enrollment)
        .filter(Enrollment.student_id == peer_student_id, Enrollment.cohort_id == cohort_id)
        .first()
    )
    if not peer_enrollment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Peer is not enrolled in this cohort. Achievements can only be compared within the same cohort.",
        )

    # Run cohort calculations
    cohort_data = get_cohort_achievements_data(db=db, user=user, cohort_id=cohort_id)

    # Find current and peer in leaderboard
    current_item = next((item for item in cohort_data.leaderboard if item.student_id == student.id), None)
    peer_item = next((item for item in cohort_data.leaderboard if item.student_id == peer_student_id), None)

    if not current_item or not peer_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student data not found in cohort")

    # Evaluate peer badges
    peer_student = db.get(Student, peer_student_id)
    cohort = db.get(Cohort, cohort_id)
    cohort_activities = get_cohort_activities(db, cohort)
    total_cohort_activities = len(cohort_activities)
    cohort_activity_ids = {a.id for a in cohort_activities}

    peer_metrics = compute_student_cohort_metrics(
        db=db,
        student=peer_student,
        cohort_activity_ids=cohort_activity_ids,
        total_cohort_activities=total_cohort_activities,
    )
    peer_badges = evaluate_badges_for_student(
        metrics=peer_metrics,
        total_cohort_activities=total_cohort_activities,
        rank=peer_item.rank,
        cohort_size=cohort_data.cohort_benchmarks.cohort_size,
    )

    peer_stats = CurrentStudentStats(
        student_id=peer_student.id,
        full_name=peer_item.name,
        rank=peer_item.rank,
        total_xp=peer_item.total_xp,
        activities_completed=peer_item.activities_completed,
        total_activities=total_cohort_activities,
        completion_rate=peer_metrics["completion_rate"],
        quiz_average=peer_item.quiz_average,
        quizzes_attempted=peer_item.quizzes_attempted,
        badges_unlocked=peer_item.badges_count,
        total_possible_badges=len(peer_badges),
        current_streak=peer_metrics.get("current_streak", 0),
        longest_streak=peer_metrics.get("longest_streak", 0),
        streak_freeze_count=peer_metrics.get("streak_freeze_count", 1),
    )

    return PeerComparisonResponse(
        cohort_id=cohort_id,
        cohort_name=cohort_data.active_cohort.cohort_name if cohort_data.active_cohort else "",
        current_student=cohort_data.current_student_stats,
        peer_student=peer_stats,
        peer_badges=[b for b in peer_badges if b.unlocked],
    )

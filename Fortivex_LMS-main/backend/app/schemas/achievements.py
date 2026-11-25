from datetime import datetime
from pydantic import BaseModel, Field


class BadgeProgress(BaseModel):
    current: int
    target: int
    unit: str
    percentage: int = 0


class AchievementBadge(BaseModel):
    id: str
    title: str
    description: str
    icon: str
    color: str
    category: str  # Curriculum | Assessment | Cohort Standing | Mastery
    tier: str  # Bronze | Silver | Gold | Platinum
    xp_reward: int
    unlocked: bool
    unlocked_at: datetime | None = None
    progress: BadgeProgress


class CohortBenchmark(BaseModel):
    cohort_size: int
    avg_xp: int
    avg_activities_completed: float
    avg_quiz_score: float
    student_percentile: str
    top_cohort_xp: int


class StreakDayStatus(BaseModel):
    date: str
    day_name: str
    status: str  # ACTIVE | SAVED | MISSED | TODAY_PENDING | TODAY_COMPLETED


class StreakInfo(BaseModel):
    current_streak: int
    longest_streak: int
    last_activity_date: str | None = None
    is_active_today: bool
    streak_freeze_count: int  # 1 or 0 (available streak saves per week)
    streak_freeze_replenishes_in_days: int
    streak_freeze_used_this_week: bool
    total_freezes_used: int
    last_freeze_used_date: str | None = None
    streak_saved_recently: bool
    alert_message: str | None = None
    history: list[StreakDayStatus] = Field(default_factory=list)


class StreakActionResponse(BaseModel):
    success: bool
    message: str
    streak: StreakInfo


class PeerLeaderboardItem(BaseModel):
    rank: int
    student_id: int
    user_id: int
    name: str
    title: str | None = None
    avatar_url: str | None = None
    is_current_student: bool
    total_xp: int
    activities_completed: int
    total_activities: int
    quiz_average: float
    quizzes_attempted: int
    badges_count: int
    current_streak: int = 0
    top_badge_icons: list[dict] = Field(default_factory=list)


class StudentCohortSummary(BaseModel):
    cohort_id: int
    cohort_name: str
    cohort_code: str
    program_id: int | None = None
    program_name: str | None = None
    organization_name: str | None = None


class CurrentStudentStats(BaseModel):
    student_id: int
    full_name: str
    rank: int
    total_xp: int
    activities_completed: int
    total_activities: int
    completion_rate: int
    quiz_average: float
    quizzes_attempted: int
    badges_unlocked: int
    total_possible_badges: int
    current_streak: int = 0
    longest_streak: int = 0
    streak_freeze_count: int = 1


class CohortAchievementsResponse(BaseModel):
    has_cohort: bool
    student_cohorts: list[StudentCohortSummary] = Field(default_factory=list)
    active_cohort: StudentCohortSummary | None = None
    current_student_stats: CurrentStudentStats | None = None
    cohort_benchmarks: CohortBenchmark | None = None
    badges: list[AchievementBadge] = Field(default_factory=list)
    leaderboard: list[PeerLeaderboardItem] = Field(default_factory=list)
    streak: StreakInfo | None = None


class PeerComparisonResponse(BaseModel):
    cohort_id: int
    cohort_name: str
    current_student: CurrentStudentStats
    peer_student: CurrentStudentStats
    peer_badges: list[AchievementBadge] = Field(default_factory=list)


import asyncio
import os
import sys
from datetime import date
from sqlalchemy.orm import Session

# Add the root directory to sys.path so we can import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.db.session import SessionLocal
from app.models.cohort import Cohort
from app.models.enums import CohortStatus, ActivityType
from app.models.document import ProgramDocument
from app.models.curriculum import ProgramModule, Week, Lesson, Activity
from app.services.ai_quiz import extract_text_from_pdf_bytes, generate_quiz_from_text

async def generate_quizzes_for_week():
    db: Session = SessionLocal()
    try:
        print("Starting weekly automated quiz generation...")
        # Find all active cohorts
        active_cohorts = db.query(Cohort).filter(Cohort.status == CohortStatus.ACTIVE).all()
        print(f"Found {len(active_cohorts)} active cohorts.")

        for cohort in active_cohorts:
            # Calculate current week number
            days_passed = (date.today() - cohort.start_date).days
            if days_passed < 0:
                print(f"Cohort {cohort.code} hasn't started yet. Skipping.")
                continue
            
            current_week_number = (days_passed // 7) + 1
            print(f"Cohort {cohort.code} is in Week {current_week_number}.")
            
            for program in cohort.programs:
                # Find documents for this program marked for quiz use
                docs = db.query(ProgramDocument).filter(
                    ProgramDocument.program_id == program.id,
                    ProgramDocument.use_for_quiz == True
                ).all()
                
                if not docs:
                    print(f"No quiz documents found for program {program.code}. Skipping.")
                    continue
                    
                # Find the corresponding Week in curriculum
                week = db.query(Week).join(ProgramModule).filter(
                    ProgramModule.program_id == program.id,
                    Week.week_number == current_week_number
                ).first()
                
                if not week:
                    print(f"Week {current_week_number} not found in curriculum for {program.code}. Skipping.")
                    continue
                    
                lesson = db.query(Lesson).filter(Lesson.week_id == week.id).first()
                if not lesson:
                    print(f"No lessons found in Week {current_week_number} for {program.code}. Creating a default one.")
                    lesson = Lesson(week_id=week.id, title="Weekly Quizzes", order=99)
                    db.add(lesson)
                    db.commit()
                    db.refresh(lesson)
                
                # Check if we already generated quizzes this week
                existing_quizzes = db.query(Activity).filter(
                    Activity.lesson_id == lesson.id,
                    Activity.title.like("Auto-Generated Quiz %")
                ).count()
                
                if existing_quizzes >= 2:
                    print(f"2 quizzes already exist for {program.code} week {current_week_number}. Skipping.")
                    continue
                
                # Combine text from all relevant documents
                combined_text = ""
                for doc in docs:
                    local_path = doc.file_url.lstrip("/") # Strip leading slash to match relative dir
                    if os.path.exists(local_path):
                        with open(local_path, "rb") as f:
                            text = extract_text_from_pdf_bytes(f.read())
                            combined_text += text + "\n\n"
                    else:
                        print(f"File {local_path} not found on disk.")
                            
                if not combined_text.strip():
                    print("No text could be extracted from documents.")
                    continue
                    
                print(f"Generating {(2 - existing_quizzes)} quizzes for {program.code}...")
                
                for i in range(existing_quizzes + 1, 3):
                    try:
                        quiz_response = await generate_quiz_from_text(combined_text, num_questions=10)
                        
                        activity = Activity(
                            lesson_id=lesson.id,
                            title=f"Auto-Generated Quiz {i} - Week {current_week_number}",
                            activity_type=ActivityType.QUIZ,
                            content={"questions": [q.model_dump() for q in quiz_response.questions]},
                            order=90 + i
                        )
                        db.add(activity)
                        db.commit()
                        print(f"Successfully generated and saved Quiz {i} for {program.code}.")
                    except Exception as e:
                        print(f"Failed to generate Quiz {i} for {program.code}: {e}")
                        db.rollback()
                        
    finally:
        db.close()
        print("Weekly automated quiz generation completed.")

if __name__ == "__main__":
    asyncio.run(generate_quizzes_for_week())

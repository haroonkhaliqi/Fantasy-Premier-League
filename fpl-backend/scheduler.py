from apscheduler.schedulers.background import BackgroundScheduler
from live_scoring import fetch_and_score_gameweek

# For now, hardcode which gameweek is "current" - later this could be
# made smarter (e.g. based on today's date vs gameweek deadlines).
CURRENT_GAMEWEEK = 1

scheduler = BackgroundScheduler()


def scheduled_score_update():
    try:
        fetch_and_score_gameweek(CURRENT_GAMEWEEK)
    except Exception as e:
        print(f"Error updating scores: {e}")


def start_scheduler():
    # Runs every 60 seconds
    scheduler.add_job(scheduled_score_update, "interval", seconds=60)
    scheduler.start()
    print("Background scheduler started - scores will refresh every 60s")
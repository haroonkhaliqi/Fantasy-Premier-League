import requests
from database import SessionLocal
from models import Player, PlayerGameweekStats
from scoring_rules import calculate_player_points

FPL_LIVE_URL = "https://fantasy.premierleague.com/api/event/{gameweek}/live/"


def fetch_and_score_gameweek(gameweek: int):
    """
    Pulls live stats for every player in the given gameweek from the FPL API,
    calculates fantasy points, and saves/updates the results in our database.
    """
    response = requests.get(FPL_LIVE_URL.format(gameweek=gameweek))
    response.raise_for_status()
    data = response.json()

    db = SessionLocal()

    for element in data["elements"]:
        fpl_player_id = element["id"]
        stats = element["stats"]

        # Find the matching player in our database.
        # Note: our Player.id is our own auto-increment id, not FPL's id,
        # so in fetch_data.py we'll want to also store FPL's original id
        # to match against here. For now assume they line up 1:1 from import order.
        player = db.query(Player).filter(Player.fpl_id == fpl_player_id).first()
        if not player:
            continue

        points = calculate_player_points(stats, player.position)

        existing = (
            db.query(PlayerGameweekStats)
            .filter(
                PlayerGameweekStats.player_id == player.id,
                PlayerGameweekStats.gameweek_number == gameweek,
            )
            .first()
        )

        if existing:
            existing.minutes = stats.get("minutes", 0)
            existing.goals_scored = stats.get("goals_scored", 0)
            existing.assists = stats.get("assists", 0)
            existing.clean_sheets = stats.get("clean_sheets", 0)
            existing.goals_conceded = stats.get("goals_conceded", 0)
            existing.own_goals = stats.get("own_goals", 0)
            existing.penalties_saved = stats.get("penalties_saved", 0)
            existing.penalties_missed = stats.get("penalties_missed", 0)
            existing.yellow_cards = stats.get("yellow_cards", 0)
            existing.red_cards = stats.get("red_cards", 0)
            existing.saves = stats.get("saves", 0)
            existing.bonus = stats.get("bonus", 0)
            existing.points = points
        else:
            new_stats = PlayerGameweekStats(
                player_id=player.id,
                gameweek_number=gameweek,
                minutes=stats.get("minutes", 0),
                goals_scored=stats.get("goals_scored", 0),
                assists=stats.get("assists", 0),
                clean_sheets=stats.get("clean_sheets", 0),
                goals_conceded=stats.get("goals_conceded", 0),
                own_goals=stats.get("own_goals", 0),
                penalties_saved=stats.get("penalties_saved", 0),
                penalties_missed=stats.get("penalties_missed", 0),
                yellow_cards=stats.get("yellow_cards", 0),
                red_cards=stats.get("red_cards", 0),
                saves=stats.get("saves", 0),
                bonus=stats.get("bonus", 0),
                points=points,
            )
            db.add(new_stats)

    db.commit()
    db.close()
    print(f"Updated scores for gameweek {gameweek}")


if __name__ == "__main__":
    fetch_and_score_gameweek(1)
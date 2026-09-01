import requests
from database import SessionLocal
from models import Team, Player

FPL_BOOTSTRAP_URL = "https://fantasy.premierleague.com/api/bootstrap-static/"

# Maps FPL's numeric position codes to readable labels
POSITION_MAP = {
    1: "GK",
    2: "DEF",
    3: "MID",
    4: "FWD",
}


def fetch_and_store():
    print("Fetching data from FPL API...")
    response = requests.get(FPL_BOOTSTRAP_URL)
    response.raise_for_status()
    data = response.json()

    db = SessionLocal()

    # --- Teams ---
    team_id_map = {}  # maps FPL's team id -> our Team.id
    for team_data in data["teams"]:
        team = Team(
            name=team_data["name"],
            short_name=team_data["short_name"],
        )
        db.add(team)
        db.flush()  # so team.id is populated before players reference it
        team_id_map[team_data["id"]] = team.id

    # --- Players ---
    for player_data in data["elements"]:
        player = Player(
            name=f"{player_data['first_name']} {player_data['second_name']}",
            position=POSITION_MAP.get(player_data["element_type"], "UNKNOWN"),
            price=player_data["now_cost"] / 10,  # FPL stores price *10 (e.g. 125 = £12.5m)
            total_points=player_data["total_points"],
            team_id=team_id_map[player_data["team"]],
        )
        db.add(player)

    db.commit()
    db.close()
    print(f"Done. Inserted {len(data['teams'])} teams and {len(data['elements'])} players.")


if __name__ == "__main__":
    fetch_and_store()
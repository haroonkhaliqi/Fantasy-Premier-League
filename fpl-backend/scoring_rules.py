def calculate_player_points(stats: dict, position: str) -> int:
    """
    Calculate fantasy points for a single player based on their match stats.
    `stats` is expected to have: minutes, goals_scored, assists, clean_sheets,
    goals_conceded, own_goals, penalties_saved, penalties_missed,
    yellow_cards, red_cards, saves, bonus
    """
    points = 0
    minutes = stats.get("minutes", 0)

    # Playing time
    if minutes >= 60:
        points += 2
    elif minutes > 0:
        points += 1

    # Goals (value depends on position)
    goals = stats.get("goals_scored", 0)
    if position == "GK" or position == "DEF":
        points += goals * 6
    elif position == "MID":
        points += goals * 5
    elif position == "FWD":
        points += goals * 4

    # Assists
    points += stats.get("assists", 0) * 3

    # Clean sheets (only count if played 60+ mins)
    if stats.get("clean_sheets", 0) and minutes >= 60:
        if position in ("GK", "DEF"):
            points += 4
        elif position == "MID":
            points += 1

    # Goals conceded (GK/DEF only, per every 2 conceded)
    if position in ("GK", "DEF"):
        conceded = stats.get("goals_conceded", 0)
        points -= (conceded // 2)

    # Penalties
    points += stats.get("penalties_saved", 0) * 5
    points -= stats.get("penalties_missed", 0) * 2

    # Cards
    points -= stats.get("yellow_cards", 0) * 1
    points -= stats.get("red_cards", 0) * 3

    # Own goals
    points -= stats.get("own_goals", 0) * 2

    # Saves (GK only, every 3 saves = 1 point)
    if position == "GK":
        points += stats.get("saves", 0) // 3

    # Bonus points (FPL calculates these separately based on a
    # performance rating system - we'll just pass through what the API gives us)
    points += stats.get("bonus", 0)

    return points
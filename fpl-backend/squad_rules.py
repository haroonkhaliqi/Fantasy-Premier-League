MAX_BUDGET = 100.0
SQUAD_SIZE = 15
POSITION_LIMITS = {
    "GK": 2,
    "DEF": 5,
    "MID": 5,
    "FWD": 3,
}
MAX_PLAYERS_PER_TEAM = 3


def validate_add_player(squad, player, current_squad_players):
    """
    Raises a ValueError with a clear message if adding this player would
    break FPL squad rules. Returns nothing if it's valid.
    """
    if len(current_squad_players) >= SQUAD_SIZE:
        raise ValueError("Squad is already full (15 players)")

    if any(sp.player_id == player.id for sp in current_squad_players):
        raise ValueError("Player is already in your squad")

    if player.price > squad.budget_remaining:
        raise ValueError(
            f"Not enough budget: player costs {player.price}, "
            f"you have {squad.budget_remaining} remaining"
        )

    position_count = sum(
        1 for sp in current_squad_players if sp.player.position == player.position
    )
    if position_count >= POSITION_LIMITS[player.position]:
        raise ValueError(
            f"You already have the max {POSITION_LIMITS[player.position]} "
            f"{player.position} players"
        )

    team_count = sum(
        1 for sp in current_squad_players if sp.player.team_id == player.team_id
    )
    if team_count >= MAX_PLAYERS_PER_TEAM:
        raise ValueError(f"You already have {MAX_PLAYERS_PER_TEAM} players from this team")
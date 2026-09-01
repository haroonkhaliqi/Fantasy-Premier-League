"""
One-off helper script to fill a test squad with 15 valid players,
so we can test lineup-setting and scoring without manually adding
players one by one via curl.
"""
from database import SessionLocal
from models import Player, Squad, SquadPlayer
import squad_rules

# CHANGE THIS to your actual squad's id (probably 1, but check /squad if unsure)
SQUAD_ID = 1

db = SessionLocal()

squad = db.query(Squad).filter(Squad.id == SQUAD_ID).first()
if not squad:
    print(f"No squad found with id {SQUAD_ID}")
    exit()

existing_player_ids = {sp.player_id for sp in squad.squad_players}

# Try to fill 2 GK, 5 DEF, 5 MID, 3 FWD within budget, cheapest-first
needed = {"GK": 2, "DEF": 5, "MID": 5, "FWD": 3}

for position, count_needed in needed.items():
    already_have = sum(
        1 for sp in squad.squad_players if sp.player.position == position
    )
    still_need = count_needed - already_have
    if still_need <= 0:
        continue

    candidates = (
        db.query(Player)
        .filter(Player.position == position)
        .filter(~Player.id.in_(existing_player_ids))
        .order_by(Player.price.asc())
        .limit(still_need * 3)  # grab extras in case some fail team-limit rule
        .all()
    )

    added = 0
    for player in candidates:
        if added >= still_need:
            break
        try:
            squad_rules.validate_add_player(squad, player, squad.squad_players)
        except ValueError as e:
            continue  # skip players that violate budget/team-limit rules

        squad_player = SquadPlayer(squad_id=squad.id, player_id=player.id)
        squad.budget_remaining -= player.price
        db.add(squad_player)
        db.flush()  # so squad.squad_players reflects the new addition immediately
        db.refresh(squad)
        existing_player_ids.add(player.id)
        added += 1

db.commit()

print(f"Squad now has {len(squad.squad_players)} players, £{squad.budget_remaining:.1f}m remaining")
for sp in squad.squad_players:
    print(f"  {sp.player.position}: {sp.player.name} (£{sp.player.price}m)")

db.close()
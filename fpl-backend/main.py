from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import engine, Base, SessionLocal
from auth import get_current_user
import squad_rules
from scheduler import start_scheduler
import xml.etree.ElementTree as ET
import models
import schemas
import auth
import requests

Base.metadata.create_all(bind=engine)

app = FastAPI()

@app.on_event("startup")
def on_startup():
    start_scheduler()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/")
def read_root():
    return {"message": "FPL backend is running"}


@app.get("/players")
def get_players(db: Session = Depends(get_db)):
    players = db.query(models.Player).all()
    return players


@app.post("/signup", response_model=schemas.UserOut)
def signup(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = models.User(
        email=user.email,
        username=user.username,
        hashed_password=auth.hash_password(user.password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@app.post("/login", response_model=schemas.Token)
def login(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == credentials.email).first()
    if not user or not auth.verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    token = auth.create_access_token(data={"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}

@app.post("/squad", response_model=schemas.SquadOut)
def create_squad(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    existing = db.query(models.Squad).filter(models.Squad.user_id == current_user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="You already have a squad")

    squad = models.Squad(user_id=current_user.id, budget_remaining=squad_rules.MAX_BUDGET)
    db.add(squad)
    db.commit()
    db.refresh(squad)
    return squad


@app.get("/squad", response_model=schemas.SquadOut)
def get_my_squad(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    squad = db.query(models.Squad).filter(models.Squad.user_id == current_user.id).first()
    if not squad:
        raise HTTPException(status_code=404, detail="No squad found. Create one first.")
    return squad


@app.post("/squad/players", response_model=schemas.SquadOut)
def add_player_to_squad(
    request: schemas.AddPlayerRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    squad = db.query(models.Squad).filter(models.Squad.user_id == current_user.id).first()
    if not squad:
        raise HTTPException(status_code=404, detail="No squad found. Create one first.")

    player = db.query(models.Player).filter(models.Player.id == request.player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    try:
        squad_rules.validate_add_player(squad, player, squad.squad_players)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    squad_player = models.SquadPlayer(squad_id=squad.id, player_id=player.id)
    squad.budget_remaining -= player.price

    db.add(squad_player)
    db.commit()
    db.refresh(squad)
    return squad

@app.get("/gameweek/{gameweek_number}/stats")
def get_gameweek_stats(gameweek_number: int, db: Session = Depends(get_db)):
    stats = (
        db.query(models.PlayerGameweekStats)
        .filter(models.PlayerGameweekStats.gameweek_number == gameweek_number)
        .order_by(models.PlayerGameweekStats.points.desc())
        .limit(10)
        .all()
    )
    return [
        {
            "player_name": s.player.name,
            "points": s.points,
            "goals": s.goals_scored,
            "assists": s.assists,
            "minutes": s.minutes,
        }
        for s in stats
    ]

@app.get("/squad/points/{gameweek_number}")
def get_squad_points(
    gameweek_number: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    squad = db.query(models.Squad).filter(models.Squad.user_id == current_user.id).first()
    if not squad:
        raise HTTPException(status_code=404, detail="No squad found")

    total_points = 0
    breakdown = []

    for sp in squad.squad_players:
        if not sp.is_starting:
            continue  # bench players don't count toward total

        stats = (
            db.query(models.PlayerGameweekStats)
            .filter(
                models.PlayerGameweekStats.player_id == sp.player_id,
                models.PlayerGameweekStats.gameweek_number == gameweek_number,
            )
            .first()
        )

        player_points = stats.points if stats else 0

        # Captain gets double points
        if sp.is_captain:
            player_points *= 2

        total_points += player_points
        breakdown.append({
            "player_name": sp.player.name,
            "points": player_points,
            "is_captain": sp.is_captain,
        })

    return {
        "gameweek": gameweek_number,
        "total_points": total_points,
        "breakdown": breakdown,
    }

@app.post("/squad/lineup")
def set_lineup(
    request: schemas.SetLineupRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    squad = db.query(models.Squad).filter(models.Squad.user_id == current_user.id).first()
    if not squad:
        raise HTTPException(status_code=404, detail="No squad found")

    if len(request.starting_player_ids) != 11:
        raise HTTPException(status_code=400, detail="Starting lineup must have exactly 11 players")

    if request.captain_id not in request.starting_player_ids:
        raise HTTPException(status_code=400, detail="Captain must be in the starting lineup")

    for sp in squad.squad_players:
        sp.is_starting = sp.player_id in request.starting_player_ids
        sp.is_captain = sp.player_id == request.captain_id

    db.commit()
    return {"message": "Lineup updated"}

@app.get("/leaderboard/{gameweek_number}")
def get_leaderboard(gameweek_number: int, db: Session = Depends(get_db)):
    squads = db.query(models.Squad).all()

    results = []
    for squad in squads:
        total_points = 0
        for sp in squad.squad_players:
            if not sp.is_starting:
                continue

            stats = (
                db.query(models.PlayerGameweekStats)
                .filter(
                    models.PlayerGameweekStats.player_id == sp.player_id,
                    models.PlayerGameweekStats.gameweek_number == gameweek_number,
                )
                .first()
            )
            player_points = stats.points if stats else 0
            if sp.is_captain:
                player_points *= 2
            total_points += player_points

        results.append({
            "username": squad.owner.username,
            "total_points": total_points,
        })

    results.sort(key=lambda r: r["total_points"], reverse=True)

    # Add rank after sorting
    for i, r in enumerate(results, start=1):
        r["rank"] = i

    return {
        "gameweek": gameweek_number,
        "leaderboard": results,
    }

@app.delete("/squad/players/{player_id}", response_model=schemas.SquadOut)
def remove_player_from_squad(
    player_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    squad = db.query(models.Squad).filter(models.Squad.user_id == current_user.id).first()
    if not squad:
        raise HTTPException(status_code=404, detail="No squad found")

    squad_player = (
        db.query(models.SquadPlayer)
        .filter(models.SquadPlayer.squad_id == squad.id, models.SquadPlayer.player_id == player_id)
        .first()
    )
    if not squad_player:
        raise HTTPException(status_code=404, detail="Player not in your squad")

    player = db.query(models.Player).filter(models.Player.id == player_id).first()
    squad.budget_remaining += player.price

    db.delete(squad_player)
    db.commit()
    db.refresh(squad)
    return squad

@app.post("/leagues", response_model=schemas.LeagueOut)
def create_league(
    request: schemas.LeagueCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    league = models.League(name=request.name, owner_id=current_user.id)
    db.add(league)
    db.commit()
    db.refresh(league)

    # Creator automatically joins their own league
    membership = models.LeagueMembership(league_id=league.id, user_id=current_user.id)
    db.add(membership)
    db.commit()

    return league


@app.post("/leagues/join", response_model=schemas.LeagueOut)
def join_league(
    request: schemas.LeagueJoin,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    league = db.query(models.League).filter(models.League.invite_code == request.invite_code.upper()).first()
    if not league:
        raise HTTPException(status_code=404, detail="Invalid invite code")

    existing = (
        db.query(models.LeagueMembership)
        .filter(models.LeagueMembership.league_id == league.id, models.LeagueMembership.user_id == current_user.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="You're already in this league")

    membership = models.LeagueMembership(league_id=league.id, user_id=current_user.id)
    db.add(membership)
    db.commit()

    return league


@app.get("/leagues/mine", response_model=list[schemas.LeagueOut])
def get_my_leagues(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    memberships = db.query(models.LeagueMembership).filter(models.LeagueMembership.user_id == current_user.id).all()
    return [m.league for m in memberships]


@app.get("/leagues/{league_id}/leaderboard/{gameweek_number}")
def get_league_leaderboard(
    league_id: int,
    gameweek_number: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    league = db.query(models.League).filter(models.League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    member_ids = [m.user_id for m in league.memberships]

    results = []
    for user_id in member_ids:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        squad = db.query(models.Squad).filter(models.Squad.user_id == user_id).first()
        if not squad:
            results.append({"username": user.username, "total_points": 0})
            continue

        total_points = 0
        for sp in squad.squad_players:
            if not sp.is_starting:
                continue
            stats = (
                db.query(models.PlayerGameweekStats)
                .filter(
                    models.PlayerGameweekStats.player_id == sp.player_id,
                    models.PlayerGameweekStats.gameweek_number == gameweek_number,
                )
                .first()
            )
            player_points = stats.points if stats else 0
            if sp.is_captain:
                player_points *= 2
            total_points += player_points

        results.append({"username": user.username, "total_points": total_points})

    results.sort(key=lambda r: r["total_points"], reverse=True)
    for i, r in enumerate(results, start=1):
        r["rank"] = i

    return {
        "league_name": league.name,
        "gameweek": gameweek_number,
        "leaderboard": results,
    }

FPL_FIXTURES_URL = "https://fantasy.premierleague.com/api/fixtures/"

@app.get("/fixtures")
def get_fixtures(db: Session = Depends(get_db)):
    response = requests.get(FPL_FIXTURES_URL)
    response.raise_for_status()
    fixtures_data = response.json()

    teams_by_fpl_id = {t.fpl_id: t for t in db.query(models.Team).all()}

    results = []
    for fx in fixtures_data:
        home = teams_by_fpl_id.get(fx["team_h"])
        away = teams_by_fpl_id.get(fx["team_a"])
        results.append({
            "id": fx["id"],
            "gameweek": fx.get("event"),
            "home_team": home.name if home else "Unknown",
            "away_team": away.name if away else "Unknown",
            "home_badge": home.code if home else None,
            "away_badge": away.code if away else None,
            "home_score": fx["team_h_score"],
            "away_score": fx["team_a_score"],
            "kickoff_time": fx["kickoff_time"],
            "started": fx["started"],
            "finished": fx["finished"],
        })

    return results

FPL_BOOTSTRAP_URL = "https://fantasy.premierleague.com/api/bootstrap-static/"

@app.get("/gameweeks/current")
def get_current_gameweek():
    response = requests.get(FPL_BOOTSTRAP_URL)
    response.raise_for_status()
    data = response.json()

    for event in data["events"]:
        if event.get("is_current"):
            return {"current_gameweek": event["id"]}

    # Fallback: if no gameweek is marked current (e.g. pre-season), find the next one
    for event in data["events"]:
        if event.get("is_next"):
            return {"current_gameweek": event["id"]}

    return {"current_gameweek": 1}

@app.get("/fixtures/{fixture_id}")
def get_fixture_detail(fixture_id: int, db: Session = Depends(get_db)):
    response = requests.get(FPL_FIXTURES_URL)
    response.raise_for_status()
    fixtures_data = response.json()

    fixture = next((fx for fx in fixtures_data if fx["id"] == fixture_id), None)
    if not fixture:
        raise HTTPException(status_code=404, detail="Fixture not found")

    teams_by_fpl_id = {t.fpl_id: t for t in db.query(models.Team).all()}
    home = teams_by_fpl_id.get(fixture["team_h"])
    away = teams_by_fpl_id.get(fixture["team_a"])

    players_by_fpl_id = {p.fpl_id: p for p in db.query(models.Player).all()}

    STAT_LABELS = {
        "goals_scored": "Goal",
        "assists": "Assist",
        "yellow_cards": "Yellow Card",
        "red_cards": "Red Card",
        "own_goals": "Own Goal",
        "penalties_saved": "Penalty Saved",
        "penalties_missed": "Penalty Missed",
        "saves": "Save",
        "bonus": "Bonus",
    }

    events = []
    for stat_block in fixture.get("stats", []):
        identifier = stat_block.get("identifier")
        label = STAT_LABELS.get(identifier)
        if not label:
            continue
        for side in ("h", "a"):
            for entry in stat_block.get(side, []):
                player = players_by_fpl_id.get(entry["element"])
                events.append({
                    "type": label,
                    "player_name": player.name if player else "Unknown",
                    "value": entry["value"],
                    "side": "home" if side == "h" else "away",
                })

    def team_lineup(team):
        if not team:
            return []
        gw_stats = (
            db.query(models.PlayerGameweekStats)
            .join(models.Player, models.PlayerGameweekStats.player_id == models.Player.id)
            .filter(
                models.Player.team_id == team.id,
                models.PlayerGameweekStats.gameweek_number == fixture.get("event"),
                models.PlayerGameweekStats.minutes > 0,
            )
            .all()
        )
        players = []
        for gs in gw_stats:
            p = gs.player
            players.append({
                "id": p.id,
                "name": p.name,
                "position": p.position,
                "photo_code": p.photo_code,
                "points": gs.points,
                "stats": {
                    "minutes": gs.minutes,
                    "goals_scored": gs.goals_scored,
                    "assists": gs.assists,
                    "clean_sheets": gs.clean_sheets,
                    "goals_conceded": gs.goals_conceded,
                    "own_goals": gs.own_goals,
                    "penalties_saved": gs.penalties_saved,
                    "penalties_missed": gs.penalties_missed,
                    "yellow_cards": gs.yellow_cards,
                    "red_cards": gs.red_cards,
                    "saves": gs.saves,
                    "bonus": gs.bonus,
                },
            })
        players.sort(key=lambda x: x["points"], reverse=True)
        return players

    return {
        "id": fixture["id"],
        "home_team": home.name if home else "Unknown",
        "away_team": away.name if away else "Unknown",
        "home_badge": home.code if home else None,
        "away_badge": away.code if away else None,
        "home_score": fixture["team_h_score"],
        "away_score": fixture["team_a_score"],
        "finished": fixture["finished"],
        "started": fixture["started"],
        "kickoff_time": fixture["kickoff_time"],
        "events": events,
        "home_players": team_lineup(home),
        "away_players": team_lineup(away),
    }

BBC_PL_RSS_URL = "http://feeds.bbci.co.uk/sport/football/premier-league/rss.xml"

@app.get("/news")
def get_news():
    response = requests.get(BBC_PL_RSS_URL, timeout=10)
    response.raise_for_status()
    root = ET.fromstring(response.content)

    ns = {"media": "http://search.yahoo.com/mrss/"}

    items = []
    for item in root.findall(".//item")[:5]:
        title = item.findtext("title", default="")
        link = item.findtext("link", default="")
        pub_date = item.findtext("pubDate", default="")
        description = item.findtext("description", default="")

        image_url = None
        thumbnail = item.find("media:thumbnail", ns)
        if thumbnail is not None:
            image_url = thumbnail.get("url")

        items.append({
            "title": title,
            "link": link,
            "pub_date": pub_date,
            "description": description,
            "image_url": image_url,
        })

    return items
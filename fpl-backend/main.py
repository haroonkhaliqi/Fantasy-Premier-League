from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import engine, Base, SessionLocal
from auth import get_current_user
import squad_rules
from scheduler import start_scheduler
import models
import schemas
import auth

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
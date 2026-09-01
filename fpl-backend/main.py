from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import engine, Base, SessionLocal
from auth import get_current_user
import squad_rules
import models
import schemas
import auth

Base.metadata.create_all(bind=engine)

app = FastAPI()

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
    players = db.query(models.Player).limit(20).all()
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
from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)

    squads = relationship("Squad", back_populates="owner")


class Team(Base):
    __tablename__ = "teams"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    short_name = Column(String)

    players = relationship("Player", back_populates="team")


class Player(Base):
    __tablename__ = "players"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    position = Column(String)  # "GK", "DEF", "MID", "FWD"
    price = Column(Float)
    total_points = Column(Integer, default=0)
    team_id = Column(Integer, ForeignKey("teams.id"))

    team = relationship("Team", back_populates="players")


class Squad(Base):
    __tablename__ = "squads"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    budget_remaining = Column(Float, default=100.0)

    owner = relationship("User", back_populates="squads")
    squad_players = relationship("SquadPlayer", back_populates="squad")


class SquadPlayer(Base):
    __tablename__ = "squad_players"
    id = Column(Integer, primary_key=True, index=True)
    squad_id = Column(Integer, ForeignKey("squads.id"))
    player_id = Column(Integer, ForeignKey("players.id"))
    is_starting = Column(Boolean, default=False)
    is_captain = Column(Boolean, default=False)

    squad = relationship("Squad", back_populates="squad_players")
    player = relationship("Player")


class Gameweek(Base):
    __tablename__ = "gameweeks"
    id = Column(Integer, primary_key=True, index=True)
    number = Column(Integer, unique=True)
    is_locked = Column(Boolean, default=False)
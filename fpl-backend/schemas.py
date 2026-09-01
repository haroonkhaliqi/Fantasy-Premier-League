from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    username: str

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str

class SquadPlayerOut(BaseModel):
    player_id: int
    is_starting: bool
    is_captain: bool

    class Config:
        from_attributes = True


class SquadOut(BaseModel):
    id: int
    budget_remaining: float
    squad_players: list[SquadPlayerOut]

    class Config:
        from_attributes = True


class AddPlayerRequest(BaseModel):
    player_id: int

class SetLineupRequest(BaseModel):
    starting_player_ids: list[int]  # exactly 11 player ids
    captain_id: int
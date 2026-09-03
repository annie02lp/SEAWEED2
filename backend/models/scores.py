from uuid import uuid4

from pydantic import BaseModel, Field, field_validator


class ScoreCreate(BaseModel):
    nickname: str = Field(min_length=2, max_length=12)
    score: int = Field(ge=0, le=999999)
    collected_count: int = Field(ge=0, le=9999)

    @field_validator("nickname")
    @classmethod
    def clean_nickname(cls, value: str) -> str:
        cleaned = " ".join(value.strip().split())
        if len(cleaned) < 2:
            raise ValueError("El apodo debe tener al menos 2 caracteres")
        return cleaned


class ScoreRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    nickname: str
    score: int
    collected_count: int


class ImpactStats(BaseModel):
    total_games: int
    total_cleanup_points: int
    leaderboard: list[ScoreRecord]
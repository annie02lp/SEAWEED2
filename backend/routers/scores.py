from datetime import datetime, timezone

from fastapi import APIRouter

from lib.db import db
from models.scores import ImpactStats, ScoreCreate, ScoreRecord

router = APIRouter(prefix="/scores", tags=["scores"])


@router.post("", response_model=ScoreRecord, status_code=201)
async def create_score(input: ScoreCreate):
    record = ScoreRecord(**input.model_dump())
    document = record.model_dump()
    document["played_at"] = datetime.now(timezone.utc)
    await db.game_scores.insert_one(document)
    return record


@router.get("/impact", response_model=ImpactStats)
async def get_impact():
    scores = await db.game_scores.find(
        {}, {"_id": 0, "id": 1, "nickname": 1, "score": 1, "collected_count": 1}
    ).sort([("score", -1), ("played_at", 1)]).to_list(10000)
    records = [ScoreRecord(**score) for score in scores]
    return ImpactStats(
        total_games=len(records),
        total_cleanup_points=sum(record.score for record in records),
        leaderboard=records[:10],
    )
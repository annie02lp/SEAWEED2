export interface ScoreSubmit {
  nickname: string;
  score: number;
  collected_count: number;
}

export interface ScoreRecord {
  id: string;
  nickname: string;
  score: number;
  collected_count: number;
}

export interface ImpactStats {
  total_games: number;
  total_cleanup_points: number;
  leaderboard: ScoreRecord[];
}
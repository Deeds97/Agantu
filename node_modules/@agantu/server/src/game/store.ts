import { MatchPlayer, MatchState } from "./types.js";
import { initializeMatch } from "./engine.js";

export class MatchStore {
  private readonly matches = new Map<string, MatchState>();

  createMatch(matchId: string, players: MatchPlayer[], rngSeed: number): MatchState {
    const created = initializeMatch(matchId, players, rngSeed);
    this.matches.set(matchId, created);
    return created;
  }

  getMatch(matchId: string): MatchState | undefined {
    return this.matches.get(matchId);
  }

  updateMatch(matchId: string, next: MatchState): void {
    this.matches.set(matchId, next);
  }
}

export const matchStore = new MatchStore();

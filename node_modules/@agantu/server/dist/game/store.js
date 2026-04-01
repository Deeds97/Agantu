import { initializeMatch } from "./engine.js";
export class MatchStore {
    matches = new Map();
    createMatch(matchId, players, rngSeed) {
        const created = initializeMatch(matchId, players, rngSeed);
        this.matches.set(matchId, created);
        return created;
    }
    getMatch(matchId) {
        return this.matches.get(matchId);
    }
    updateMatch(matchId, next) {
        this.matches.set(matchId, next);
    }
}
export const matchStore = new MatchStore();

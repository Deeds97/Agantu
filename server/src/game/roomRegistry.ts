import { SeatIndex } from "./types.js";
import { matchStore } from "./store.js";

export interface RoomSeatEntry {
  userId: string;
  socketId: string;
  seat: SeatIndex;
  heroName: string;
}

/** All non-empty rooms (shared by socket handlers and HTTP lobby list). */
export const roomSeats = new Map<string, RoomSeatEntry[]>();

/** Joinable lobby only (not full, match not started). */
export interface LobbySummary {
  roomCode: string;
  playerCount: number;
  maxPlayers: number;
  players: Array<{ seat: number; heroName: string }>;
}

export function listLobbySummaries(): LobbySummary[] {
  const out: LobbySummary[] = [];
  for (const [roomCode, seats] of roomSeats.entries()) {
    if (seats.length === 0) continue;
    const match = matchStore.getMatch(roomCode);
    const playerCount = seats.length;
    const joinable = playerCount < 4 && !match;
    if (!joinable) continue;
    out.push({
      roomCode,
      playerCount,
      maxPlayers: 4,
      players: seats.map((s) => ({ seat: s.seat, heroName: s.heroName }))
    });
  }
  out.sort((a, b) => a.roomCode.localeCompare(b.roomCode));
  return out;
}

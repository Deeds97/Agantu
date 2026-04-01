export type SeatIndex = 1 | 2 | 3 | 4;
export type TileValue = 0 | 2 | 3 | 4;
export type UnitType = "soldier" | "commander" | "hero" | "npc";
export type MatchPhase = "preparation" | "duel" | "npc_events" | "rewards";
export type MatchStatus = "waiting" | "active" | "finished";

export interface TileState {
  id: string;
  value: TileValue;
  isHomebase: boolean;
  ownerSeat: SeatIndex | null;
  neighbors: string[];
  effectKey?: string;
}

export interface UnitInstance {
  id: string;
  ownerSeat: SeatIndex | 0;
  type: UnitType;
  hp: number;
  maxHp: number;
  strength: number;
  tileId: string;
  isFainted: boolean;
  isKilled: boolean;
  duelCount: number;
  heroDuelTileId?: string;
}

export interface MatchPlayer {
  userId: string;
  seat: SeatIndex;
  heroName: string;
  vp: number;
  activeQuestIds: string[];
}

export interface MatchState {
  id: string;
  status: MatchStatus;
  rngSeed: number;
  round: number;
  phase: MatchPhase;
  activeSeat: SeatIndex;
  players: MatchPlayer[];
  board: Record<string, TileState>;
  units: Record<string, UnitInstance>;
  turnAp: Record<SeatIndex, number>;
  bountySeat: SeatIndex | null;
  winnerSeat: SeatIndex | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActionContext {
  seat: SeatIndex;
  nowISO: string;
}

export type TurnAction =
  | { type: "move"; unitId: string; toTileId: string }
  | { type: "heal"; unitId: string }
  | { type: "hero_ability"; heroUnitId: string }
  | { type: "draw_or_reroll_quest" }
  | { type: "end_turn" };

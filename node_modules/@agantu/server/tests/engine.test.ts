import { describe, expect, it } from "vitest";
import { applyTurnAction, initializeMatch, scoreRewards } from "../src/game/engine.js";
import { MatchPlayer } from "../src/game/types.js";

function players(): MatchPlayer[] {
  return [
    { userId: "u1", seat: 1, heroName: "Astra", vp: 0, activeQuestIds: [] },
    { userId: "u2", seat: 2, heroName: "Brom", vp: 0, activeQuestIds: [] },
    { userId: "u3", seat: 3, heroName: "Kael", vp: 0, activeQuestIds: [] },
    { userId: "u4", seat: 4, heroName: "Lysa", vp: 0, activeQuestIds: [] }
  ];
}

describe("engine", () => {
  it("creates 4-player match with initial units", () => {
    const state = initializeMatch("m1", players(), 12345);
    expect(state.players).toHaveLength(4);
    expect(Object.values(state.units).filter((u) => u.type === "hero")).toHaveLength(4);
  });

  it("enforces AP and allows valid move", () => {
    const base = initializeMatch("m2", players(), 12);
    base.turnAp[1] = 1;
    const soldier = Object.values(base.units).find((u) => u.ownerSeat === 1 && u.type === "soldier");
    if (!soldier) throw new Error("Soldier missing.");
    const moved = applyTurnAction(base, { type: "move", unitId: soldier.id, toTileId: "t3a" }, { seat: 1, nowISO: new Date().toISOString() });
    expect(moved.units[soldier.id].tileId).toBe("t3a");
    expect(moved.turnAp[1]).toBe(0);
  });

  it("scores zone control and progresses rounds", () => {
    const base = initializeMatch("m3", players(), 777);
    const unit = Object.values(base.units).find((u) => u.ownerSeat === 1 && u.type === "hero");
    if (!unit) throw new Error("Hero missing.");
    unit.tileId = "center";
    const next = scoreRewards(base);
    const p1 = next.players.find((p) => p.seat === 1);
    expect(p1?.vp).toBeGreaterThan(0);
    expect(next.round).toBe(2);
  });
});

const ROUND_LIMIT = 6;
const VP_WIN = 25;
function seatOrder(players) {
    return players.map((p) => p.seat).sort((a, b) => a - b);
}
function nextSeat(current, players) {
    const order = seatOrder(players);
    const idx = order.indexOf(current);
    return order[(idx + 1) % order.length];
}
function apCost(action) {
    switch (action.type) {
        case "move":
            return 1;
        case "heal":
            return 2;
        case "hero_ability":
            return 2;
        case "draw_or_reroll_quest":
            return 2;
        case "end_turn":
            return 0;
    }
}
function maxDamage(damageRoll) {
    return Math.min(3, Math.max(0, damageRoll));
}
function activePlayer(state) {
    const found = state.players.find((p) => p.seat === state.activeSeat);
    if (!found) {
        throw new Error("Active seat has no player.");
    }
    return found;
}
export function createBaseBoard() {
    const board = {};
    board.center = { id: "center", value: 4, isHomebase: false, ownerSeat: null, neighbors: ["t3a", "t3b", "t3c", "t3d"] };
    const ring3 = ["t3a", "t3b", "t3c", "t3d"];
    const ring2 = ["t2a", "t2b", "t2c", "t2d", "t2e", "t2f", "t2g", "t2h"];
    for (const id of ring3) {
        board[id] = { id, value: 3, isHomebase: false, ownerSeat: null, neighbors: ["center"] };
    }
    for (const id of ring2) {
        board[id] = { id, value: 2, isHomebase: false, ownerSeat: null, neighbors: ["t3a", "t3b", "t3c", "t3d"] };
    }
    return board;
}
export function initializeMatch(matchId, players, rngSeed) {
    if (players.length !== 4) {
        throw new Error("Match must contain exactly 4 players.");
    }
    const board = createBaseBoard();
    const homebases = ["t2a", "t2c", "t2e", "t2g"];
    const units = {};
    players.forEach((player, idx) => {
        const hb = homebases[idx];
        board[hb].isHomebase = true;
        board[hb].ownerSeat = player.seat;
        const heroId = `hero-${player.seat}`;
        units[heroId] = {
            id: heroId,
            ownerSeat: player.seat,
            type: "hero",
            hp: 4,
            maxHp: 4,
            strength: 3,
            tileId: hb,
            isFainted: false,
            isKilled: false,
            duelCount: 0
        };
        for (let i = 0; i < 7; i += 1) {
            const id = `soldier-${player.seat}-${i + 1}`;
            units[id] = {
                id,
                ownerSeat: player.seat,
                type: "soldier",
                hp: 1,
                maxHp: 1,
                strength: 1,
                tileId: hb,
                isFainted: false,
                isKilled: false,
                duelCount: 0
            };
        }
    });
    const now = new Date().toISOString();
    return {
        id: matchId,
        status: "active",
        rngSeed,
        round: 1,
        phase: "preparation",
        activeSeat: 1,
        players,
        board,
        units,
        turnAp: { 1: 0, 2: 0, 3: 0, 4: 0 },
        bountySeat: null,
        winnerSeat: null,
        createdAt: now,
        updatedAt: now
    };
}
export function allocatePreparationAp(state, seat, dieRoll) {
    const next = structuredClone(state);
    let ap = 0;
    if (dieRoll >= 1 && dieRoll <= 4)
        ap = dieRoll;
    if (dieRoll === 5)
        ap = 1;
    if (dieRoll === 0)
        ap = 1;
    next.turnAp[seat] = ap;
    return next;
}
export function applyTurnAction(state, action, ctx) {
    if (state.status !== "active")
        throw new Error("Match is not active.");
    if (ctx.seat !== state.activeSeat)
        throw new Error("Only active player can act.");
    if (state.phase !== "preparation")
        throw new Error("Actions only allowed in preparation phase.");
    const cost = apCost(action);
    if (state.turnAp[ctx.seat] < cost)
        throw new Error("Insufficient AP.");
    const next = structuredClone(state);
    next.turnAp[ctx.seat] -= cost;
    if (action.type === "move") {
        const unit = next.units[action.unitId];
        if (!unit)
            throw new Error("Unit not found.");
        if (unit.ownerSeat !== ctx.seat)
            throw new Error("Cannot move enemy unit.");
        if (!next.board[unit.tileId].neighbors.includes(action.toTileId))
            throw new Error("Invalid move.");
        unit.tileId = action.toTileId;
    }
    if (action.type === "heal") {
        const unit = next.units[action.unitId];
        if (!unit)
            throw new Error("Unit not found.");
        if (unit.ownerSeat !== ctx.seat)
            throw new Error("Cannot heal enemy unit.");
        if (unit.type === "soldier")
            throw new Error("Soldiers cannot be healed.");
        unit.hp = Math.min(unit.maxHp, unit.hp + 1);
    }
    if (action.type === "end_turn") {
        next.activeSeat = nextSeat(state.activeSeat, state.players);
        if (next.activeSeat === 1) {
            next.phase = "duel";
        }
    }
    next.updatedAt = ctx.nowISO;
    return next;
}
export function resolveSimpleDuel(attacker, defender, attackerRoll, defenderRoll, damageRoll) {
    const attackerStrength = attacker.strength + Math.max(attackerRoll, 0);
    const defenderStrength = defender.strength + Math.max(defenderRoll, 0);
    const winner = attackerStrength > defenderStrength ? "attacker" : "defender";
    return { winner, damageApplied: maxDamage(damageRoll) };
}
export function scoreRewards(state) {
    const next = structuredClone(state);
    const zoneScore = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const tile of Object.values(next.board)) {
        if (tile.isHomebase)
            continue;
        const bySeat = { 1: 0, 2: 0, 3: 0, 4: 0 };
        for (const unit of Object.values(next.units)) {
            if (unit.isKilled || unit.isFainted)
                continue;
            if (unit.tileId !== tile.id)
                continue;
            if (unit.ownerSeat === 0)
                continue;
            bySeat[unit.ownerSeat] += unit.strength;
        }
        const sorted = Object.entries(bySeat).sort((a, b) => b[1] - a[1]);
        if (sorted[0][1] === 0 || sorted[0][1] === sorted[1][1])
            continue;
        zoneScore[Number(sorted[0][0])] += tile.value;
    }
    next.players = next.players.map((p) => ({ ...p, vp: p.vp + zoneScore[p.seat] }));
    next.players.sort((a, b) => a.vp - b.vp);
    next.activeSeat = next.players[0].seat;
    const leader = [...next.players].sort((a, b) => b.vp - a.vp)[0];
    next.bountySeat = leader.seat;
    const winner = next.players.find((p) => p.vp >= VP_WIN);
    if (winner) {
        next.status = "finished";
        next.winnerSeat = winner.seat;
    }
    else if (next.round >= ROUND_LIMIT) {
        const top = [...next.players].sort((a, b) => b.vp - a.vp)[0];
        next.status = "finished";
        next.winnerSeat = top.seat;
    }
    else {
        next.round += 1;
        next.phase = "preparation";
        Object.keys(next.turnAp).forEach((key) => {
            next.turnAp[key] = 0;
        });
        Object.values(next.units).forEach((u) => {
            u.duelCount = 0;
            if (u.type !== "hero")
                u.heroDuelTileId = undefined;
            if (u.isFainted)
                u.isFainted = false;
        });
    }
    next.updatedAt = new Date().toISOString();
    return next;
}
export function ensureSeatCanAct(state, seat) {
    const player = activePlayer(state);
    if (player.seat !== seat)
        throw new Error("Not your turn.");
}

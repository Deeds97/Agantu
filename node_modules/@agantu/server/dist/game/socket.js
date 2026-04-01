import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { verifySupabaseJwt } from "../auth/supabase.js";
import { applyTurnAction, ensureSeatCanAct, scoreRewards } from "./engine.js";
import { matchStore } from "./store.js";
const roomSeats = new Map();
const reconnectTokens = new Map();
function safeEmitState(io, matchId) {
    const state = matchStore.getMatch(matchId);
    if (!state)
        return;
    io.to(matchId).emit("match:state", state);
}
export function registerGameSockets(io) {
    io.use((socket, next) => {
        if (env.AUTH_BYPASS) {
            const authHeader = socket.handshake.auth.token;
            if (authHeader) {
                try {
                    socket.data.user = verifySupabaseJwt(authHeader);
                }
                catch {
                    socket.data.user = { id: `anon-${randomUUID()}` };
                }
            }
            else {
                socket.data.user = { id: `anon-${randomUUID()}` };
            }
            next();
            return;
        }
        const authHeader = socket.handshake.auth.token;
        if (!authHeader)
            return next(new Error("Missing token."));
        try {
            const user = verifySupabaseJwt(authHeader);
            socket.data.user = user;
            next();
        }
        catch (error) {
            next(error);
        }
    });
    io.on("connection", (socket) => {
        socket.on("room:create_or_join", ({ roomCode, heroName }) => {
            const seats = roomSeats.get(roomCode) ?? [];
            if (seats.length >= 4) {
                socket.emit("room:error", { message: "Room full." });
                return;
            }
            const userId = socket.data.user.id;
            if (seats.some((s) => s.userId === userId)) {
                socket.emit("room:error", { message: "User already joined room." });
                return;
            }
            const seat = (seats.length + 1);
            seats.push({ userId, socketId: socket.id, seat, heroName });
            roomSeats.set(roomCode, seats);
            socket.join(roomCode);
            io.to(roomCode).emit("room:updated", { seats: seats.map((s) => ({ seat: s.seat, heroName: s.heroName })) });
            if (seats.length === 4) {
                const players = seats.map((s) => ({
                    userId: s.userId,
                    seat: s.seat,
                    heroName: s.heroName,
                    vp: 0,
                    activeQuestIds: []
                }));
                const rngSeed = Math.floor(Date.now() % 1000000);
                const match = matchStore.createMatch(roomCode, players, rngSeed);
                io.to(roomCode).emit("match:start", { matchId: match.id });
                safeEmitState(io, roomCode);
            }
        });
        socket.on("turn:action", ({ matchId, action }) => {
            const state = matchStore.getMatch(matchId);
            if (!state)
                return socket.emit("room:error", { message: "Match not found." });
            const player = state.players.find((p) => p.userId === socket.data.user.id);
            if (!player)
                return socket.emit("room:error", { message: "Not in match." });
            try {
                ensureSeatCanAct(state, player.seat);
                const updated = applyTurnAction(state, action, { seat: player.seat, nowISO: new Date().toISOString() });
                matchStore.updateMatch(matchId, updated);
                io.to(matchId).emit("turn:action_applied", { seat: player.seat, action });
                safeEmitState(io, matchId);
            }
            catch (error) {
                socket.emit("turn:rejected", { message: error.message });
            }
        });
        socket.on("round:commit_rewards", ({ matchId }) => {
            const state = matchStore.getMatch(matchId);
            if (!state)
                return socket.emit("room:error", { message: "Match not found." });
            const player = state.players.find((p) => p.userId === socket.data.user.id);
            if (!player)
                return socket.emit("room:error", { message: "Not in match." });
            if (state.activeSeat !== player.seat)
                return socket.emit("room:error", { message: "Only active player can commit rewards." });
            const updated = scoreRewards(state);
            matchStore.updateMatch(matchId, updated);
            io.to(matchId).emit("round:phase", { phase: updated.phase, round: updated.round });
            if (updated.status === "finished") {
                io.to(matchId).emit("match:end", { winnerSeat: updated.winnerSeat });
            }
            safeEmitState(io, matchId);
        });
        socket.on("match:reconnect", ({ token }) => {
            const recon = reconnectTokens.get(token);
            if (!recon)
                return socket.emit("room:error", { message: "Invalid reconnect token." });
            if (!env.AUTH_BYPASS && recon.userId !== socket.data.user.id) {
                return socket.emit("room:error", { message: "Reconnect token mismatch." });
            }
            if (env.AUTH_BYPASS) {
                socket.data.user = { id: recon.userId };
            }
            socket.join(recon.matchId);
            socket.emit("match:reconnected", { matchId: recon.matchId, seat: recon.seat });
            safeEmitState(io, recon.matchId);
        });
        socket.on("disconnect", () => {
            for (const [matchId, seats] of roomSeats.entries()) {
                const disconnected = seats.find((s) => s.socketId === socket.id);
                if (!disconnected)
                    continue;
                const token = randomUUID();
                reconnectTokens.set(token, { matchId, seat: disconnected.seat, userId: disconnected.userId });
                io.to(matchId).emit("match:player_disconnected", {
                    seat: disconnected.seat,
                    reconnectToken: token
                });
            }
        });
    });
}

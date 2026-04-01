import { Server } from "socket.io";
import { randomUUID } from "node:crypto";
import { isAuthBypass } from "../config/env.js";
import { verifySupabaseJwt } from "../auth/supabase.js";
import { applyTurnAction, ensureSeatCanAct, scoreRewards } from "./engine.js";
import { matchStore } from "./store.js";
import { roomSeats } from "./roomRegistry.js";
import { MatchPlayer, SeatIndex, TurnAction } from "./types.js";
const reconnectTokens = new Map<string, { matchId: string; seat: SeatIndex; userId: string }>();

function safeEmitState(io: Server, matchId: string): void {
  const state = matchStore.getMatch(matchId);
  if (!state) return;
  io.to(matchId).emit("match:state", state);
}

function notifyLobbyListChanged(io: Server): void {
  io.emit("lobbies:changed");
}

export function registerGameSockets(io: Server): void {
  io.use((socket, next) => {
    if (isAuthBypass()) {
      const authHeader = socket.handshake.auth.token as string | undefined;
      if (authHeader) {
        try {
          socket.data.user = verifySupabaseJwt(authHeader);
        } catch {
          socket.data.user = { id: `anon-${randomUUID()}` };
        }
      } else {
        socket.data.user = { id: `anon-${randomUUID()}` };
      }
      next();
      return;
    }

    const authHeader = socket.handshake.auth.token as string | undefined;
    if (!authHeader) return next(new Error("Missing token."));
    try {
      const user = verifySupabaseJwt(authHeader);
      socket.data.user = user;
      next();
    } catch (error) {
      next(error as Error);
    }
  });

  io.on("connection", (socket) => {
    socket.on("room:create_or_join", ({ roomCode, heroName }: { roomCode: string; heroName: string }) => {
      const code = roomCode.trim();
      if (!code) {
        socket.emit("room:error", { message: "Room code is required." });
        return;
      }

      const seats = roomSeats.get(code) ?? [];
      const userId: string = socket.data.user.id;
      const existing = seats.find((s) => s.userId === userId);

      if (existing) {
        existing.socketId = socket.id;
        if (heroName.trim()) {
          existing.heroName = heroName.trim();
        }
        socket.join(code);
        const seatSummaries = seats.map((s) => ({ seat: s.seat, heroName: s.heroName }));
        const match = matchStore.getMatch(code);
        socket.emit("room:joined", {
          roomCode: code,
          alreadyInRoom: true,
          seat: existing.seat,
          heroName: existing.heroName,
          seats: seatSummaries,
          matchId: match?.id ?? null
        });
        if (match) {
          socket.emit("match:state", match);
        }
        socket.broadcast.to(code).emit("room:updated", { seats: seatSummaries });
        notifyLobbyListChanged(io);
        return;
      }

      if (seats.length >= 4) {
        socket.emit("room:error", { message: "Room full." });
        return;
      }

      const seat = (seats.length + 1) as SeatIndex;
      const displayName = heroName.trim() || "Hero";
      seats.push({ userId, socketId: socket.id, seat, heroName: displayName });
      roomSeats.set(code, seats);
      socket.join(code);

      const seatSummaries = seats.map((s) => ({ seat: s.seat, heroName: s.heroName }));
      socket.emit("room:joined", {
        roomCode: code,
        alreadyInRoom: false,
        seat,
        heroName: displayName,
        seats: seatSummaries,
        matchId: null
      });
      socket.broadcast.to(code).emit("room:updated", { seats: seatSummaries });
      notifyLobbyListChanged(io);

      if (seats.length === 4) {
        const players: MatchPlayer[] = seats.map((s) => ({
          userId: s.userId,
          seat: s.seat,
          heroName: s.heroName,
          vp: 0,
          activeQuestIds: []
        }));
        const rngSeed = Math.floor(Date.now() % 1000000);
        const match = matchStore.createMatch(code, players, rngSeed);
        io.to(code).emit("match:start", { matchId: match.id });
        safeEmitState(io, code);
        notifyLobbyListChanged(io);
      }
    });

    socket.on("turn:action", ({ matchId, action }: { matchId: string; action: TurnAction }) => {
      const state = matchStore.getMatch(matchId);
      if (!state) return socket.emit("room:error", { message: "Match not found." });

      const player = state.players.find((p) => p.userId === socket.data.user.id);
      if (!player) return socket.emit("room:error", { message: "Not in match." });

      try {
        ensureSeatCanAct(state, player.seat);
        const updated = applyTurnAction(state, action, { seat: player.seat, nowISO: new Date().toISOString() });
        matchStore.updateMatch(matchId, updated);
        io.to(matchId).emit("turn:action_applied", { seat: player.seat, action });
        safeEmitState(io, matchId);
      } catch (error) {
        socket.emit("turn:rejected", { message: (error as Error).message });
      }
    });

    socket.on("round:commit_rewards", ({ matchId }: { matchId: string }) => {
      const state = matchStore.getMatch(matchId);
      if (!state) return socket.emit("room:error", { message: "Match not found." });
      const player = state.players.find((p) => p.userId === socket.data.user.id);
      if (!player) return socket.emit("room:error", { message: "Not in match." });
      if (state.activeSeat !== player.seat) return socket.emit("room:error", { message: "Only active player can commit rewards." });
      const updated = scoreRewards(state);
      matchStore.updateMatch(matchId, updated);
      io.to(matchId).emit("round:phase", { phase: updated.phase, round: updated.round });
      if (updated.status === "finished") {
        io.to(matchId).emit("match:end", { winnerSeat: updated.winnerSeat });
      }
      safeEmitState(io, matchId);
    });

    socket.on("match:reconnect", ({ token }: { token: string }) => {
      const recon = reconnectTokens.get(token);
      if (!recon) return socket.emit("room:error", { message: "Invalid reconnect token." });
      if (!isAuthBypass() && recon.userId !== socket.data.user.id) {
        return socket.emit("room:error", { message: "Reconnect token mismatch." });
      }
      if (isAuthBypass()) {
        socket.data.user = { id: recon.userId };
      }
      socket.join(recon.matchId);
      socket.emit("match:reconnected", { matchId: recon.matchId, seat: recon.seat });
      safeEmitState(io, recon.matchId);
    });

    socket.on("disconnect", () => {
      for (const [matchId, seats] of roomSeats.entries()) {
        const disconnected = seats.find((s) => s.socketId === socket.id);
        if (!disconnected) continue;
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

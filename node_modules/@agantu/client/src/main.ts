import "./style.css";
import Phaser from "phaser";
import { io, Socket } from "socket.io-client";

const env = import.meta.env as ImportMeta["env"] & { VITE_SERVER_URL?: string; VITE_AUTH_BYPASS?: string };
const SERVER_URL = env.VITE_SERVER_URL ?? "http://localhost:4000";
const AUTH_BYPASS = env.VITE_AUTH_BYPASS === "true";

const socket: Socket = io(SERVER_URL, {
  autoConnect: AUTH_BYPASS
});

const statusEl = document.getElementById("lobby-status") as HTMLSpanElement;
const joinBtn = document.getElementById("join-room") as HTMLButtonElement;
const roomInput = document.getElementById("room-code") as HTMLInputElement;
const heroInput = document.getElementById("hero-name") as HTMLInputElement;
const newRoomCodeBtn = document.getElementById("new-room-code") as HTMLButtonElement;
const refreshLobbiesBtn = document.getElementById("refresh-lobbies") as HTMLButtonElement;
const lobbyListEl = document.getElementById("lobby-list") as HTMLUListElement;
const lobbyEmptyEl = document.getElementById("lobby-list-empty") as HTMLParagraphElement;
const lobbyHintEl = document.getElementById("lobby-list-hint") as HTMLParagraphElement;

/** Last room we joined (room:updated does not include the code). */
let currentRoomCode: string | null = null;

let lobbyPollTimer: ReturnType<typeof setInterval> | null = null;

function setStatus(message: string): void {
  statusEl.textContent = message;
}

function formatSeatList(seats: Array<{ seat: number; heroName: string }>): string {
  return seats.map((s) => `P${s.seat} ${s.heroName}`).join(" · ");
}

function updateJoinEnabled(): void {
  joinBtn.disabled = !socket.connected;
}

interface LobbySummary {
  roomCode: string;
  playerCount: number;
  maxPlayers: number;
  players: Array<{ seat: number; heroName: string }>;
}

function renderLobbyList(lobbies: LobbySummary[]): void {
  lobbyListEl.innerHTML = "";

  if (lobbies.length === 0) {
    lobbyEmptyEl.classList.remove("hidden");
  } else {
    lobbyEmptyEl.classList.add("hidden");
  }

  for (const lobby of lobbies) {
    const li = document.createElement("li");
    li.className = "lobby-item";

    const header = document.createElement("div");
    header.className = "lobby-item-header";

    const codeSpan = document.createElement("span");
    codeSpan.className = "lobby-code";
    codeSpan.textContent = lobby.roomCode;

    const badge = document.createElement("span");
    badge.className = "badge badge-open";
    badge.textContent = `${lobby.playerCount}/${lobby.maxPlayers}`;

    header.appendChild(codeSpan);
    header.appendChild(badge);

    const meta = document.createElement("div");
    meta.className = "lobby-meta";
    meta.textContent = formatSeatList(lobby.players);

    const actions = document.createElement("div");
    actions.className = "lobby-item-actions";

    const useBtn = document.createElement("button");
    useBtn.type = "button";
    useBtn.className = "btn-secondary";
    useBtn.textContent = "Use code";
    useBtn.title = "Copy this room code into the field above";
    useBtn.addEventListener("click", () => {
      roomInput.value = lobby.roomCode;
      roomInput.focus();
      setStatus(`Room code set to "${lobby.roomCode}". Add hero name and click Join room.`);
    });

    const joinThisBtn = document.createElement("button");
    joinThisBtn.type = "button";
    joinThisBtn.className = "btn-use-code";
    joinThisBtn.textContent = "Join this room";
    joinThisBtn.disabled = !socket.connected;
    joinThisBtn.addEventListener("click", () => {
      roomInput.value = lobby.roomCode;
      emitJoinRoom();
    });

    actions.appendChild(useBtn);
    actions.appendChild(joinThisBtn);

    li.appendChild(header);
    li.appendChild(meta);
    li.appendChild(actions);
    lobbyListEl.appendChild(li);
  }
}

async function refreshLobbyList(): Promise<void> {
  try {
    const res = await fetch(`${SERVER_URL}/api/lobbies`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { lobbies: LobbySummary[] };
    renderLobbyList(data.lobbies ?? []);
    lobbyHintEl.textContent =
      "Rooms with free seats (not yet in a match) appear here. Pick one or type your own code.";
  } catch (e) {
    lobbyHintEl.textContent = `Could not load lobbies: ${(e as Error).message}. Is the server running?`;
  }
}

function emitJoinRoom(): void {
  const roomCode = roomInput.value.trim() || "default-room";
  const heroName = heroInput.value.trim() || "Hero";
  if (!socket.connected) {
    setStatus("Not connected to server yet.");
    return;
  }
  socket.emit("room:create_or_join", { roomCode, heroName });
  setStatus(`Joining "${roomCode}"…`);
}

socket.on("connect", () => {
  setStatus("Connected — enter room code and join.");
  updateJoinEnabled();
  void refreshLobbyList();
  if (lobbyPollTimer) clearInterval(lobbyPollTimer);
  lobbyPollTimer = setInterval(() => void refreshLobbyList(), 8000);
});

socket.on("disconnect", (reason) => {
  setStatus(`Disconnected (${reason}).`);
  updateJoinEnabled();
  if (lobbyPollTimer) {
    clearInterval(lobbyPollTimer);
    lobbyPollTimer = null;
  }
});

socket.on("connect_error", (err) => {
  setStatus(`Connection failed: ${err.message}`);
});

socket.on("lobbies:changed", () => {
  void refreshLobbyList();
});

interface RoomJoinedPayload {
  roomCode: string;
  alreadyInRoom: boolean;
  seat: number;
  heroName: string;
  seats: Array<{ seat: number; heroName: string }>;
  matchId: string | null;
}

socket.on("room:joined", (payload: RoomJoinedPayload) => {
  currentRoomCode = payload.roomCode;
  const roster = formatSeatList(payload.seats);
  const count = payload.seats.length;
  if (payload.alreadyInRoom) {
    const matchHint = payload.matchId ? " Match in progress." : "";
    setStatus(
      `Already in room "${payload.roomCode}" as seat ${payload.seat} (${payload.heroName}). ${count}/4 — ${roster}.${matchHint}`
    );
  } else {
    setStatus(`Joined "${payload.roomCode}" as seat ${payload.seat} (${payload.heroName}). ${count}/4 — ${roster}.`);
  }
  void refreshLobbyList();
});

socket.on("room:updated", (payload: { seats: Array<{ seat: number; heroName: string }> }) => {
  const label = currentRoomCode ? `Room "${currentRoomCode}"` : "Room";
  const roster = formatSeatList(payload.seats);
  setStatus(`${label}: ${payload.seats.length}/4 — ${roster}`);
});

socket.on("room:error", (payload: { message: string }) => {
  setStatus(`Error: ${payload.message}`);
});

socket.on("match:start", (payload: { matchId: string }) => {
  setStatus(`Match started (${payload.matchId}). Waiting for game state…`);
  void refreshLobbyList();
});

interface MatchStatePayload {
  round: number;
  phase: string;
  activeSeat: number;
  status: string;
}

socket.on("match:state", (state: MatchStatePayload) => {
  if (state.status === "finished") {
    setStatus("Match finished.");
    void refreshLobbyList();
    return;
  }
  const label = currentRoomCode ? `Room "${currentRoomCode}"` : "Match";
  setStatus(
    `${label} — Round ${state.round}, ${state.phase.replace(/_/g, " ")}, active: seat ${state.activeSeat}`
  );
});

joinBtn.addEventListener("click", () => emitJoinRoom());

newRoomCodeBtn.addEventListener("click", () => {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 10)
      : `room-${Date.now().toString(36)}`;
  roomInput.value = id;
  roomInput.focus();
  setStatus(`New room code "${id}" — set hero name and Join room, or share this code with friends.`);
});

refreshLobbiesBtn.addEventListener("click", () => void refreshLobbyList());

if (!AUTH_BYPASS) {
  setStatus("Set VITE_AUTH_BYPASS=true or implement login and pass a JWT in socket auth.");
  joinBtn.disabled = true;
} else {
  joinBtn.disabled = true;
  setStatus("Connecting…");
}

void refreshLobbyList();

class LobbyScene extends Phaser.Scene {
  constructor() {
    super("lobby");
  }

  create(): void {
    this.add.text(20, 20, "Use the bar above or the lobby list on the left to join a room.", {
      color: "#ffffff",
      wordWrap: { width: this.scale.width - 40 }
    });
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: Math.min(1280, window.innerWidth),
  height: Math.max(400, window.innerHeight - 120),
  parent: "app",
  backgroundColor: "#1c2230",
  scene: [LobbyScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
});

window.addEventListener("beforeunload", () => game.destroy(true));

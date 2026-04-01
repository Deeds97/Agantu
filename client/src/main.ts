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

function setStatus(message: string): void {
  statusEl.textContent = message;
}

function updateJoinEnabled(): void {
  joinBtn.disabled = !socket.connected;
}

socket.on("connect", () => {
  setStatus("Connected — enter room code and join.");
  updateJoinEnabled();
});

socket.on("disconnect", (reason) => {
  setStatus(`Disconnected (${reason}).`);
  updateJoinEnabled();
});

socket.on("connect_error", (err) => {
  setStatus(`Connection failed: ${err.message}`);
});

socket.on("room:updated", (payload: { seats: Array<{ seat: number; heroName: string }> }) => {
  const names = payload.seats.map((s) => `P${s.seat} ${s.heroName}`).join(" · ");
  setStatus(`Room: ${payload.seats.length}/4 — ${names}`);
});

socket.on("room:error", (payload: { message: string }) => {
  setStatus(`Error: ${payload.message}`);
});

socket.on("match:start", (payload: { matchId: string }) => {
  setStatus(`Match started: ${payload.matchId}`);
});

socket.on("match:state", () => {
  setStatus("Match state updated.");
});

joinBtn.addEventListener("click", () => {
  const roomCode = roomInput.value.trim() || "default-room";
  const heroName = heroInput.value.trim() || "Hero";
  if (!socket.connected) {
    setStatus("Not connected to server yet.");
    return;
  }
  socket.emit("room:create_or_join", { roomCode, heroName });
  setStatus(`Joining "${roomCode}"…`);
});

if (!AUTH_BYPASS) {
  setStatus("Set VITE_AUTH_BYPASS=true or implement login and pass a JWT in socket auth.");
  joinBtn.disabled = true;
} else {
  joinBtn.disabled = true;
  setStatus("Connecting…");
}

class LobbyScene extends Phaser.Scene {
  constructor() {
    super("lobby");
  }

  create(): void {
    this.add.text(20, 20, "Use the bar above to join a room (same code in 4 tabs to test).", {
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

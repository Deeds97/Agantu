import Phaser from "phaser";
import { io } from "socket.io-client";

const SERVER_URL = (import.meta as ImportMeta & { env: Record<string, string> }).env.VITE_SERVER_URL ?? "http://localhost:4000";

class LobbyScene extends Phaser.Scene {
  private socket = io(SERVER_URL, {
    autoConnect: false
  });

  constructor() {
    super("lobby");
  }

  create(): void {
    const text = this.add.text(20, 20, "Agantu 4P Lobby\nConnect auth token then join room", {
      color: "#ffffff"
    });
    text.setDepth(1);
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  parent: "app",
  backgroundColor: "#1c2230",
  scene: [LobbyScene]
});

window.addEventListener("beforeunload", () => game.destroy(true));

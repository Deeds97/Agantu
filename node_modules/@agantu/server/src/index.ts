import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.js";
import { healthRouter } from "./routes/health.js";
import { lobbiesRouter } from "./routes/lobbies.js";
import { registerGameSockets } from "./game/socket.js";

const app = express();
app.use(cors({ origin: env.CLIENT_ORIGIN }));
app.use(express.json());

app.use("/health", healthRouter);
app.use("/auth", authRouter);
app.use("/api/lobbies", lobbiesRouter);

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: env.CLIENT_ORIGIN }
});

registerGameSockets(io);

httpServer.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`agantu-server listening on ${env.PORT}`);
});

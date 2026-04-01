import { Router } from "express";
import { listLobbySummaries } from "../game/roomRegistry.js";

export const lobbiesRouter = Router();

lobbiesRouter.get("/", (_req, res) => {
  res.json({ lobbies: listLobbySummaries() });
});

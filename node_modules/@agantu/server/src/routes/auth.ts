import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../auth/middleware.js";

export const authRouter = Router();

authRouter.get("/me", requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

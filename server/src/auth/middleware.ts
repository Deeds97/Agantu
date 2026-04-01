import { NextFunction, Request, Response } from "express";
import { verifySupabaseJwt } from "./supabase.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  if (!token) {
    res.status(401).json({ error: "Missing bearer token." });
    return;
  }
  try {
    req.user = verifySupabaseJwt(token);
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token.", details: (error as Error).message });
  }
}

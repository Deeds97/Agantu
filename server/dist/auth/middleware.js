import { env } from "../config/env.js";
import { verifySupabaseJwt } from "./supabase.js";
export function requireAuth(req, res, next) {
    if (env.AUTH_BYPASS) {
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
        if (token) {
            try {
                req.user = verifySupabaseJwt(token);
            }
            catch {
                req.user = { id: "bypass-anonymous" };
            }
        }
        else {
            req.user = { id: "bypass-anonymous" };
        }
        next();
        return;
    }
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
    if (!token) {
        res.status(401).json({ error: "Missing bearer token." });
        return;
    }
    try {
        req.user = verifySupabaseJwt(token);
        next();
    }
    catch (error) {
        res.status(401).json({ error: "Invalid token.", details: error.message });
    }
}

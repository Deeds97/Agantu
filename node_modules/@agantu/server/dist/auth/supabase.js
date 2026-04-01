import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
const supabaseEnabled = Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
export const supabaseClient = supabaseEnabled
    ? createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
    : null;
export function verifySupabaseJwt(token) {
    if (!env.SUPABASE_JWT_SECRET) {
        throw new Error("SUPABASE_JWT_SECRET is not configured.");
    }
    const payload = jwt.verify(token, env.SUPABASE_JWT_SECRET);
    if (!payload.sub)
        throw new Error("Invalid JWT payload.");
    return { id: payload.sub, email: typeof payload.email === "string" ? payload.email : undefined };
}

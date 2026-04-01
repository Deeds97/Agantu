import { config } from "dotenv";
import { z } from "zod";
config();
const envSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().default(4000),
    CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
    /** When true, JWT is not required; each socket gets an anonymous user id (local dev only). */
    AUTH_BYPASS: z
        .string()
        .optional()
        .default("false")
        .transform((v) => v === "true" || v === "1"),
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_ANON_KEY: z.string().optional(),
    SUPABASE_JWT_SECRET: z.string().optional()
});
export const env = envSchema.parse(process.env);

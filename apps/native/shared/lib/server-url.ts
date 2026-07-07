/**
 * server-url.ts — the ONE place the mobile app reads the backend origin.
 *
 * This mirrors the web app's server-url.ts, with one important difference:
 *  - Web reads a RELATIVE-friendly Vite var (VITE_SERVER_URL) and the browser
 *    already knows its own origin.
 *  - A phone has no "current origin", so this MUST be a FULL absolute URL
 *    (https://api.example.com or http://192.168.x.x:3001 for a real device).
 *
 * The value comes from @wandit/env/native, which is the same validated env the
 * better-auth client already uses (EXPO_PUBLIC_SERVER_URL). Keeping it as a
 * function — not a scattered env read — leaves one place to add per-device or
 * per-build resolution later without touching call sites.
 */
import { env } from "@wandit/env/native";

// Single source of the API origin for the whole native API layer. Both the axios
// client (base-service.ts) and any future SSE/streaming code should read from here.
export function getServerUrl() {
	return env.EXPO_PUBLIC_SERVER_URL;
}

/**
 * server-url.ts is the single place the web app reads the API server origin.
 *
 * In the chat flow, BaseService uses this for normal JSON requests such as
 * "load messages" and "send message", while use-project-chat.tsx uses it
 * directly to open the EventSource/SSE stream for live assistant tokens.
 *
 * Keeping this as a function, not a scattered env read, leaves one simple place
 * to support preview deploys, portless local hosts, or tenant-specific API
 * origins later.
 */
// @wandit/env/web validates Vite client env vars at startup. Here it guarantees
// VITE_SERVER_URL is a real URL string before any API client code uses it.
import { env } from "@wandit/env/web";

// Single source of the API origin for the api client. A function rather than
// a constant so environment-dependent resolution (preview deploys, portless
// dev hosts…) can land later without touching call sites.

// Return the API origin used by both axios requests and the chat SSE EventSource.
export function getServerUrl() {
	return env.VITE_SERVER_URL;
}

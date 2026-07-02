import { env } from "@wandit/env/web";

// Single source of the API origin for the api client. A function rather than
// a constant so environment-dependent resolution (preview deploys, portless
// dev hosts…) can land later without touching call sites.
export function getServerUrl() {
	return env.VITE_SERVER_URL;
}

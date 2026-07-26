// Single source of the API origin for the admin app. An empty string means
// "same origin" (relative fetches), which keeps preview deploys working when
// the admin SPA is served behind the API host.
export function getServerUrl(): string {
	return import.meta.env.VITE_SERVER_URL ?? "";
}

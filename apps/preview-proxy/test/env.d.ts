declare module "cloudflare:test" {
	// Give the test env the worker's bindings (PREVIEW_KV, PREVIEW_RATE,
	// PREVIEW_ANALYTICS, the vars, and the secret from index.ts).
	interface ProvidedEnv extends Env {}
}

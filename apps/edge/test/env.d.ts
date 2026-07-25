import type { Env } from "../src/index";

declare module "cloudflare:test" {
	// Give the test env the worker's bindings (PTR, SITES).
	interface ProvidedEnv extends Env {}
}

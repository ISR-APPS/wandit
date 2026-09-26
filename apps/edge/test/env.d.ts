import type { Env } from "../src/index";

declare module "cloudflare:test" {
	// Give the test env the worker's bindings (PTR, SITES, DISPATCHER).
	// router.spec.ts replaces DISPATCHER with a fake: no user Worker runs in a test.
	interface ProvidedEnv extends Env {}
}

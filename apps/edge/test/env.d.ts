import type { Env } from "../src/index";

declare module "cloudflare:test" {
	// Give the test env the worker's bindings (PTR, SITES). DISPATCHER comes
	// from the env override in router.spec.ts until WANDIT-200 adds the binding.
	interface ProvidedEnv extends Env {}
}

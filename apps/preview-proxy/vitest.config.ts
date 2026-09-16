/**
 * Runs the specs in the Workers pool with the bindings of wrangler.jsonc.
 * `pnpm -F preview-proxy test` reads it.
 */
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
	test: {
		poolOptions: {
			workers: {
				wrangler: { configPath: "./wrangler.jsonc" },
				miniflare: {
					// The signing key is a secret, so it cannot sit in wrangler.jsonc;
					// tests get the fixed value "test-key" instead.
					bindings: { PREVIEW_TOKEN_SIGNING_KEY: "test-key" },
				},
			},
		},
	},
});

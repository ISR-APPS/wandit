import { defineConfig } from "@trigger.dev/sdk";

// Trigger.dev project config. The dev CLI (`npx trigger.dev@latest dev`) runs
// from apps/server/, picks this file up, and bundles every task in ./src/trigger.
export default defineConfig({
	project: "proj_stzpldofqndpuwhwrdlw",
	dirs: ["./src/trigger"],
	runtime: "node",
	// Generous ceiling: one page build is a single long model call plus small
	// DB/R2 writes. Compute-seconds, so 600 = 10 minutes.
	maxDuration: 600,
	// One attempt only: a failed build is marked failed in our own attempts
	// table and surfaced to the user — silent model re-runs would just burn
	// tokens on the same brief.
	retries: {
		enabledInDev: false,
		default: { maxAttempts: 1 },
	},
});

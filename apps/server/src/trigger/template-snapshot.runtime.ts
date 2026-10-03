/**
 * Template-snapshot runtime: builds the template snapshot of each target
 * platform when none is ready for the current template, image, and harness.
 * A new project sandbox boots from that snapshot in seconds. The
 * `template-snapshot` task calls it; the spec calls it with fakes.
 */
import { targetPlatforms, type V2EnvName } from "@wandit/contracts";

import type { BuilderHarness } from "../modules/app-builder/domain/ports/builder-harness";
import type { SandboxLogger } from "../modules/app-builder/domain/ports/sandbox-provider";
import type { V2EnvSource } from "../modules/app-builder/infrastructure/env/v2-env";
import { TEMPLATE_PROFILES } from "../modules/app-builder/infrastructure/sandbox/template-profiles";
import type { VercelSandboxProvider } from "../modules/app-builder/infrastructure/sandbox/vercel-sandbox.provider";
import type { TemplateVersionService } from "../modules/app-builder/infrastructure/template/template-version.service";

/**
 * The values that `credentials()` of the Vercel sandbox provider reads.
 * `VERCEL_SANDBOX_IMAGE` has a default, so it is not here.
 */
const SANDBOX_CREDENTIAL_NAMES = [
	"VERCEL_SANDBOX_TOKEN",
	"VERCEL_TEAM_ID",
	"VERCEL_PROJECT_ID",
] as const satisfies readonly V2EnvName[];

type SandboxCredentialName = (typeof SANDBOX_CREDENTIAL_NAMES)[number];

/** The slice of the build the spec fakes. */
export type TemplateSnapshotDeps = {
	provider: Pick<VercelSandboxProvider, "ensureTemplateSnapshot">;
	/** The harness of the builder turns; its install goes into the snapshot. */
	harness: Pick<BuilderHarness, "bootstrapKey" | "prepareSandbox">;
	/** The template version a new project of each platform starts from. */
	versions: Pick<TemplateVersionService, "versionFor">;
	logger: SandboxLogger;
	/** The validated `env` in production. The run reads only the Vercel credentials. */
	envSource: Pick<V2EnvSource, SandboxCredentialName>;
};

/** Platform counts of one run. */
export type TemplateSnapshotResult = {
	built: number;
	existing: number;
	failed: number;
	/** The unset Vercel credentials. When it is not empty, the run skipped every build. */
	missingEnv: SandboxCredentialName[];
};

/**
 * Makes sure each platform has a ready template snapshot. One failed
 * platform logs an error and the next platform still runs. Then the run
 * throws, so Trigger marks it failed; the next tick retries. Without the
 * Vercel credentials, the run builds nothing and returns their names.
 */
export async function runTemplateSnapshotBuild(
	deps: TemplateSnapshotDeps,
): Promise<TemplateSnapshotResult> {
	const result: TemplateSnapshotResult = {
		built: 0,
		existing: 0,
		failed: 0,
		missingEnv: SANDBOX_CREDENTIAL_NAMES.filter(
			(name) => deps.envSource[name] === undefined,
		),
	};
	// A Trigger environment without V2 has no Vercel values. A failed run
	// there would fire the alert on every tick, so the run skips.
	if (result.missingEnv.length > 0) {
		return result;
	}
	const harnessKey = await deps.harness.bootstrapKey();
	for (const platform of targetPlatforms) {
		const { framework } = TEMPLATE_PROFILES[platform];
		try {
			const templateVersion = deps.versions.versionFor(platform);
			const outcome = await deps.provider.ensureTemplateSnapshot(
				{ framework, templateVersion },
				{
					key: harnessKey,
					prepare: (sandbox) => deps.harness.prepareSandbox(sandbox),
				},
			);
			result[outcome === "built" ? "built" : "existing"] += 1;
			deps.logger.info(`sandbox.template-snapshot.${outcome}`, {
				framework,
				templateVersion,
			});
		} catch (error) {
			result.failed += 1;
			deps.logger.error("sandbox.template-snapshot.failed", {
				error: error instanceof Error ? error.message : String(error),
				framework,
			});
		}
	}
	// A green run would hide a build that fails on each tick: every new
	// project then boots the slow way. The failed run makes the alert fire.
	if (result.failed > 0) {
		throw new Error(
			`Template snapshot build failed for ${result.failed} platform(s); see sandbox.template-snapshot.failed`,
		);
	}
	return result;
}

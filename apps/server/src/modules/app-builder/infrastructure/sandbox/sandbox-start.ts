/**
 * Starts the project sandbox outside a builder turn, with the egress inputs
 * of a turn and no LLM proxy token. `VersionsService.restore`,
 * `SandboxWakeService`, and the `publish-app` task call it. It reads the
 * projects row and the `app_backends` row, calls `getOrCreate`, and after a
 * boot writes the backend `.env` through `syncBackendEnvFile`.
 */
import { appBuilderRoutes } from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { getErrorMessage } from "@wandit/observability/error";

import type {
	SandboxHandle,
	SandboxLogger,
	SandboxProvider,
} from "../../domain/ports/sandbox-provider";
import type { AppBackendsRepository } from "../persistence/app-backends.repository";
import type { TurnProjectRepository } from "../persistence/turn-project.repository";
import {
	activeBackendEnvOf,
	type SandboxEnvName,
	syncBackendEnvFile,
} from "./sandbox-env";
import { profileForFramework } from "./template-profiles";

/**
 * The LLM proxy base URL that the sandbox calls. The builder-turn task and
 * `startSandboxWithoutTurn` share it, so both policies allow one proxy host.
 * Local dev sets `V2_LLM_PROXY_PUBLIC_URL` to a tunnel URL.
 */
export function llmProxyBaseUrl(): string {
	return new URL(
		appBuilderRoutes.llmProxyBase,
		env.V2_LLM_PROXY_PUBLIC_URL ?? env.BETTER_AUTH_URL,
	).toString();
}

/** What `startSandboxWithoutTurn` reads and calls. */
export type SandboxStartDeps = {
	sandboxes: Pick<SandboxProvider, "getOrCreate">;
	/** Gives the template, the owner, and `networkAllowedHosts`, layer 3 of the egress list. */
	projects: Pick<TurnProjectRepository, "findForTurn">;
	/** Gives the backend row. Only an active row adds its host to the egress list and fills `.env`. */
	backends: Pick<AppBackendsRepository, "findByProjectId">;
	/** `Sentry.logger` in the API and in the publish task. It gets a failed `.env` write. */
	logger: Pick<SandboxLogger, "warn">;
};

/**
 * Gets or wakes the project sandbox with the egress inputs of a turn. A
 * strict start then works. A running sandbox gets no policy push when the
 * stored hash matches. Throws when the projects row is gone or has no template.
 * After a boot it waits up to 60 s for the dev port to write `.env`.
 */
// LIMIT: no `harnessKey`, so a lost sandbox boots from the image, not the
// template snapshot, and that boot is slower. Upgrade: pass harnessKey when
// the API bundle and the publish deps load the harness.
export async function startSandboxWithoutTurn(
	deps: SandboxStartDeps,
	projectId: string,
): Promise<SandboxHandle> {
	const [project, backend] = await Promise.all([
		deps.projects.findForTurn(projectId),
		deps.backends.findByProjectId(projectId),
	]);
	if (
		project === null ||
		project.framework === null ||
		project.templateVersion === null
	) {
		throw new Error(
			`Project ${projectId} has no template row; its sandbox cannot start`,
		);
	}
	const profile = profileForFramework(project.framework);
	let booted = false;
	const sandbox = await deps.sandboxes.getOrCreate(projectId, {
		backendUrl: activeBackendEnvOf(backend)?.url,
		devCommand: profile.devCommand,
		devPort: profile.devPort,
		// Security: no ANTHROPIC_AUTH_TOKEN. A start without a turn has no run,
		// and a token in the VM lets sandbox code spend LLM credits. The strict
		// policy needs the proxy host. The other two values copy buildSandboxEnv.
		env: {
			ANTHROPIC_API_KEY: "",
			ANTHROPIC_BASE_URL: llmProxyBaseUrl(),
			CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
		} satisfies Partial<Record<SandboxEnvName, string>>,
		framework: project.framework,
		networkAllowedHosts: project.networkAllowedHosts,
		// A running sandbox keeps its `.env`. Only a boot needs the write below.
		onWake: async () => {
			booted = true;
		},
		organizationId: project.organizationId,
		ownerUserId: project.userId,
		templateVersion: project.templateVersion,
	});
	// git does not keep `.env`, so a rebuilt sandbox needs the file again.
	// Provision-backend can mark the row active during the boot. Its own write
	// skips a sandbox that does not run yet, so this code reads the row again.
	if (booted) {
		try {
			const backendEnv = activeBackendEnvOf(
				await deps.backends.findByProjectId(projectId),
			);
			if (backendEnv !== null) {
				await syncBackendEnvFile(sandbox, backendEnv);
			}
		} catch (error) {
			// The app runs without the file, and the next turn writes it. So a
			// failed write does not fail a restore, a wake, or a publish.
			deps.logger.warn("sandbox-start.env-file-failed", {
				message: getErrorMessage(error),
				projectId,
			});
		}
	}
	return sandbox;
}

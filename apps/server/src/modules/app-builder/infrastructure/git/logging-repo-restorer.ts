/**
 * Default `RepoRestorer` until WANDIT-171 lands the durable git copy.
 * The provider calls it on every create and rebuild; it only logs — a
 * sandbox without a durable copy starts from the bare template.
 */
import { Injectable, Optional } from "@nestjs/common";
import { Sentry } from "@wandit/observability/node";

import type { RepoRestorer } from "../../domain/ports/git-store";
import type {
	SandboxHandle,
	SandboxLogger,
} from "../../domain/ports/sandbox-provider";

/**
 * Logs "no durable git copy yet" and returns. Never writes to the sandbox:
 * a silent no-op would hide that work is not restored.
 */
@Injectable()
export class LoggingRepoRestorer implements RepoRestorer {
	constructor(
		// Optional: the SandboxLogger type erases to `Object`, so without
		// @Optional Nest would fail the module boot looking for that token.
		@Optional() private readonly logger: SandboxLogger = Sentry.logger,
	) {}

	restore(projectId: string, sandbox: SandboxHandle): Promise<void> {
		this.logger.warn("sandbox.repo-restore.no-durable-copy", {
			projectId,
			sandboxId: sandbox.providerSandboxId,
		});
		return Promise.resolve();
	}
}

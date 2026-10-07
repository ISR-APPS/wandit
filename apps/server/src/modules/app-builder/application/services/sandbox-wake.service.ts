/**
 * Wakes the sandbox of a V2 project without a builder turn, so the preview
 * comes back without a paid chat message. `SandboxController` calls `wake`.
 * It checks the project scope, holds the project turn lock during the boot,
 * and starts the sandbox through `startSandboxWithoutTurn`.
 */
import { randomUUID } from "node:crypto";

import {
	Inject,
	Injectable,
	InternalServerErrorException,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import type { SandboxWakeResponse } from "@wandit/contracts";
import { getErrorMessage } from "@wandit/observability/error";
import { Sentry } from "@wandit/observability/nestjs";

import type { ProjectScope } from "../../../projects/domain/project-scope";
import {
	SANDBOX_PROVIDER,
	type SandboxProvider,
} from "../../domain/ports/sandbox-provider";
import { TURN_LOCK, type TurnLock } from "../../domain/ports/turn-lock";
import { WAKE_LOCK_HOLDER_PREFIX } from "../../domain/turn-queue";
import { AppBackendsRepository } from "../../infrastructure/persistence/app-backends.repository";
import { AppCommitsRepository } from "../../infrastructure/persistence/app-commits.repository";
import { TurnProjectRepository } from "../../infrastructure/persistence/turn-project.repository";
import { startSandboxWithoutTurn } from "../../infrastructure/sandbox/sandbox-start";

/**
 * 2 min. The boot refreshes the lock every `WAKE_LOCK_REFRESH_MS`, so a slow
 * boot from the image keeps it. A lost API process blocks turns this long.
 */
const WAKE_LOCK_TTL_MS = 2 * 60_000;

/**
 * 40 s: a third of the TTL. After one failed refresh, the next tick still
 * comes 40 s before the lock ends.
 */
const WAKE_LOCK_REFRESH_MS = 40_000;

/**
 * 10 min. A boot from the image takes a few minutes at worst. After this
 * time, the boot stops the refresh. A hung boot then frees the lock at most
 * 12 min after the wake.
 */
const WAKE_LOCK_REFRESH_LIMIT_MS = 10 * 60_000;

/** The wake behind `POST /api/v2/projects/:projectId/sandbox/wake`. */
@Injectable()
export class SandboxWakeService {
	private readonly logger = new Logger(SandboxWakeService.name);

	constructor(
		// The Pick types keep each seam at the methods the service needs.
		// A spec passes plain fakes.
		@Inject(AppCommitsRepository)
		private readonly appCommits: Pick<
			AppCommitsRepository,
			"findScopedProject"
		>,
		@Inject(TurnProjectRepository)
		private readonly projects: Pick<TurnProjectRepository, "findForTurn">,
		@Inject(AppBackendsRepository)
		private readonly backends: Pick<AppBackendsRepository, "findByProjectId">,
		@Inject(SANDBOX_PROVIDER)
		private readonly sandboxes: Pick<
			SandboxProvider,
			"findRunning" | "getOrCreate"
		>,
		@Inject(TURN_LOCK)
		private readonly turnLock: TurnLock,
	) {}

	/**
	 * Answers at once, and the boot runs after the answer. A resume takes 10
	 * to 60 s. A rebuild from the image takes a few minutes.
	 * Throws 404 for a V1 project or a project outside the scope, like the
	 * versions routes, and 500 for a V2 row without a template.
	 */
	async wake(
		scope: ProjectScope,
		projectId: string,
	): Promise<SandboxWakeResponse> {
		const project = await this.appCommits.findScopedProject(scope, projectId);
		if (project?.engine !== "v2_app") {
			throw new NotFoundException();
		}
		// A v2_app row without a template is broken data; no boot can work.
		if (project.framework === null || project.templateVersion === null) {
			this.logger.error(
				`v2_app project ${projectId} has no framework/templateVersion`,
			);
			throw new InternalServerErrorException({
				code: "INTERNAL_ERROR",
				message: "The project row has no template; the sandbox cannot start",
			});
		}
		// The vendor check of `findRunning` matters: a vendor timeout stops a
		// sandbox and leaves its row `running`.
		if ((await this.sandboxes.findRunning(projectId)) !== null) {
			return { status: "running" };
		}
		// Product rule: a wake never boots the sandbox next to a turn or a
		// restore. A held lock means that work boots the sandbox itself.
		const lockId = `${WAKE_LOCK_HOLDER_PREFIX}${randomUUID()}`;
		if (!(await this.turnLock.acquire(projectId, lockId, WAKE_LOCK_TTL_MS))) {
			return { status: "busy" };
		}
		// LIMIT: the boot runs in this API process. An API restart during the
		// boot drops it. The lock then blocks the project for up to 2 min. A
		// boot step that hangs blocks it for up to 12 min. The next wake or
		// turn boots the sandbox. Upgrade: a Trigger task like publish-app.
		void this.boot(projectId, lockId, scope.userId);
		return { status: "starting" };
	}

	// Never throws: the HTTP answer is out, so a failure goes to the log and
	// Sentry, and the web stops at its own poll limit.
	private async boot(
		projectId: string,
		lockId: string,
		userId: string,
	): Promise<void> {
		// The short TTL frees the lock soon after an API restart. While this
		// process lives, the refresh keeps the lock for a slow boot.
		const refreshEndMs = Date.now() + WAKE_LOCK_REFRESH_LIMIT_MS;
		const refreshTimer = setInterval(() => {
			// Some boot steps (git fetch, templateInit) have no timeout. Without
			// this stop, a hung step holds the lock until the 30 min vendor timeout.
			if (Date.now() >= refreshEndMs) {
				clearInterval(refreshTimer);
				this.logger.warn("sandbox.wake-lock-refresh-stopped", { projectId });
				return;
			}
			void this.turnLock
				.refresh(projectId, lockId, WAKE_LOCK_TTL_MS)
				.then((refreshed) => {
					// False: the lock expired, so a turn can start next to this boot.
					if (!refreshed) {
						this.logger.warn("sandbox.wake-lock-lost", { projectId });
					}
				})
				.catch((refreshError: unknown) => {
					// The next tick tries again; the TTL covers one failed refresh.
					this.logger.warn("sandbox.wake-lock-refresh-failed", {
						error: getErrorMessage(refreshError),
						projectId,
					});
				});
		}, WAKE_LOCK_REFRESH_MS);
		try {
			await startSandboxWithoutTurn(
				{
					backends: this.backends,
					logger: Sentry.logger,
					projects: this.projects,
					sandboxes: this.sandboxes,
				},
				projectId,
			);
		} catch (error) {
			this.logger.error("sandbox.wake-failed", {
				error: getErrorMessage(error),
				projectId,
				userId,
			});
			Sentry.captureException(error, {
				extra: { userId },
				tags: { feature: "sandbox-wake", projectId },
			});
		} finally {
			// Without the clear, the timer runs after the boot and logs a false
			// `sandbox.wake-lock-lost` on each tick after the release.
			clearInterval(refreshTimer);
			// A failed release frees at the lock TTL; the boot result stays.
			await this.turnLock
				.release(projectId, lockId)
				.catch((releaseError: unknown) => {
					this.logger.warn("sandbox.wake-lock-release-failed", {
						error: getErrorMessage(releaseError),
						projectId,
					});
				});
		}
	}
}

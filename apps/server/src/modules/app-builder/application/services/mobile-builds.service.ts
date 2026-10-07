/**
 * Application service behind the mobile builds routes (WANDIT-194).
 * `mobile-builds.controller.ts` calls it. `create` holds 50 credits, writes
 * the `queued` row, and starts the `mobile-build` Trigger task. `cancel`
 * stops the EAS build and refunds the hold. It calls two repositories,
 * metering, the task starter, the EAS runner, and the audit log.
 */
import { randomUUID } from "node:crypto";
import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import type {
	CreateMobileBuildBody,
	ListMobileBuildsQuery,
	ListMobileBuildsResponse,
	MobileBuild,
	MobileBuildErrorCode,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { getErrorMessage } from "@wandit/observability/error";

import { MeteringService } from "../../../metering/application/services/metering.service";
import { MOBILE_BUILD_CREDITS } from "../../../metering/domain/operation-registry";
import {
	meteringSubjectFrom,
	type ProjectScope,
	projectOwnerColumns,
} from "../../../projects/domain/project-scope";
import { MobileBuildActiveError } from "../../domain/errors/mobile-build-active.error";
import { mobileBuildHoldKey } from "../../domain/mobile-build";
import {
	EAS_BUILD_RUNNER,
	type EasBuildRunner,
} from "../../domain/ports/eas-build-runner";
import {
	MOBILE_BUILD_TASK_STARTER,
	type MobileBuildTaskStarter,
} from "../../domain/ports/mobile-build-task-starter";
import { AppCommitsRepository } from "../../infrastructure/persistence/app-commits.repository";
import { AuditEventsRepository } from "../../infrastructure/persistence/audit-events.repository";
import {
	type InsertQueuedResult,
	MalformedMobileBuildCursorError,
	type MobileBuildRow,
	MobileBuildsRepository,
} from "../../infrastructure/persistence/mobile-builds.repository";
import { TEMPLATE_PROFILES } from "../../infrastructure/sandbox/template-profiles";

/** Create, list, read, and cancel the EAS builds of one mobile app project. */
@Injectable()
export class MobileBuildsService {
	private readonly logger = new Logger(MobileBuildsService.name);

	constructor(
		// The Pick types keep each seam at the methods the service needs.
		// A spec passes a plain fake. Nest still injects by the class token.
		@Inject(MobileBuildsRepository)
		private readonly builds: Pick<
			MobileBuildsRepository,
			| "findById"
			| "findByRequestKey"
			| "findLive"
			| "insertQueued"
			| "listByProject"
			| "setTriggerRunId"
			| "transition"
		>,
		@Inject(AppCommitsRepository)
		private readonly appCommits: Pick<
			AppCommitsRepository,
			"findBranch" | "findScopedProject"
		>,
		@Inject(AuditEventsRepository)
		private readonly auditEvents: Pick<AuditEventsRepository, "insert">,
		@Inject(MeteringService)
		private readonly metering: Pick<
			MeteringService,
			"findByIdempotencyKey" | "refund" | "reserveWithReplay"
		>,
		@Inject(MOBILE_BUILD_TASK_STARTER)
		private readonly starter: MobileBuildTaskStarter,
		/** Null when EXPO_TOKEN or EXPO_ACCOUNT is unset: `create` then answers 503. */
		@Inject(EAS_BUILD_RUNNER)
		private readonly runner: EasBuildRunner | null,
	) {}

	/**
	 * `POST .../mobile-builds`. Holds the build credits, writes a `queued`
	 * row, and starts the task. A retried request key answers its first
	 * build. A task that does not start leaves the row `start_failed` and
	 * refunds; a 503 of the starter then goes to the client.
	 */
	async create(
		scope: ProjectScope,
		projectId: string,
		body: CreateMobileBuildBody,
		/** Client IP of the request, for the audit row only. */
		ip: string,
	): Promise<MobileBuild> {
		await this.requireMobileProject(scope, projectId);

		// A retry of the same click answers the first build and holds nothing.
		const existing = await this.builds.findByRequestKey(
			projectId,
			body.requestKey,
		);
		if (existing) {
			return toApiMobileBuild(existing);
		}
		if (this.runner === null) {
			throw new ServiceUnavailableException({
				code: "V2_ENV_MISSING",
				message: "EXPO_TOKEN or EXPO_ACCOUNT is not set",
			});
		}
		// The task builds the saved head of `main`. An app with no saved
		// version has no commit to build.
		const branch = await this.appCommits.findBranch(projectId);
		const commitSha = branch?.headSha ?? null;
		if (commitSha === null) {
			throw new ConflictException({
				code: "MOBILE_BUILD_NO_VERSION",
				message: "Save a version of the app before you build it",
			});
		}
		// Fast path of the one-live-build rule. The live index is the real
		// guard at insert time.
		if (await this.builds.findLive(projectId, body.platform)) {
			throw new MobileBuildActiveError();
		}

		const buildId = randomUUID();
		// The hold runs before the insert, so a 402 writes no row.
		// InsufficientCreditsError passes through unchanged.
		// GENERATION_BILLING_MODE=off is the local dev bypass: no hold.
		const billingOff = env.GENERATION_BILLING_MODE === "off";
		const hold = billingOff
			? null
			: await this.metering.reserveWithReplay(
					"mobile_build",
					meteringSubjectFrom(scope),
					{
						attemptRef: buildId,
						credits: MOBILE_BUILD_CREDITS,
						idempotencyKey: mobileBuildHoldKey(buildId),
						projectId,
					},
				);
		if (billingOff) {
			this.logger.log(`billing.off build=${buildId}`);
		}
		const holdEventId = hold?.event.id ?? null;

		let insert: InsertQueuedResult;
		try {
			insert = await this.builds.insertQueued({
				...projectOwnerColumns(scope),
				commitSha,
				id: buildId,
				kind: "apk",
				platform: body.platform,
				projectId,
				requestKey: body.requestKey,
			});
		} catch (error) {
			await this.refundCreateHold(holdEventId, buildId);
			throw error;
		}
		if (insert.kind === "live_exists") {
			await this.refundCreateHold(holdEventId, buildId);
			throw new MobileBuildActiveError();
		}
		if (insert.kind === "request_exists") {
			// A parallel retry of the same click wrote its row first and
			// started its own task. This call starts nothing.
			await this.refundCreateHold(holdEventId, buildId);
			return toApiMobileBuild(insert.row);
		}

		let runId: string;
		try {
			({ runId } = await this.starter.start({
				actorIsLimitExempt: scope.kind === "org" && scope.actorIsLimitExempt,
				buildId,
				projectId,
			}));
		} catch (error) {
			return this.failStart(insert.row, holdEventId, error);
		}
		try {
			await this.builds.setTriggerRunId(buildId, runId);
		} catch (error) {
			// The task writes the same run id when it claims the row, so the
			// build goes on without this write.
			this.logger.warn(
				`mobile-build.run-id-write-failed build=${buildId}: ${getErrorMessage(error)}`,
			);
		}

		await this.auditEvents.insert({
			action: "mobile_build.started",
			actorUserId: scope.userId,
			ip,
			metadata: { commitSha, platform: body.platform },
			organizationId: projectOwnerColumns(scope).organizationId,
			projectId,
			targetId: buildId,
			targetType: "mobile_build",
		});
		return toApiMobileBuild(insert.row);
	}

	/** One page of builds, newest first, for the Android card of the publish popover. */
	async list(
		scope: ProjectScope,
		projectId: string,
		query: ListMobileBuildsQuery,
	): Promise<ListMobileBuildsResponse> {
		await this.requireMobileProject(scope, projectId);
		try {
			const page = await this.builds.listByProject(projectId, query);
			return {
				items: page.items.map(toApiMobileBuild),
				nextCursor: page.nextCursor,
			};
		} catch (error) {
			// The cursor is client input, so a malformed one is a 400, not a 500.
			if (error instanceof MalformedMobileBuildCursorError) {
				throw new BadRequestException({
					code: "VALIDATION_ERROR",
					message: "Malformed mobile builds cursor",
				});
			}
			throw error;
		}
	}

	/** One build of the project. A build of another project answers 404. */
	async get(
		scope: ProjectScope,
		projectId: string,
		buildId: string,
	): Promise<MobileBuild> {
		await this.requireMobileProject(scope, projectId);
		return toApiMobileBuild(await this.requireBuild(projectId, buildId));
	}

	/**
	 * `POST .../:buildId/cancel`. Moves a live build to `canceled`, stops
	 * the EAS build, and refunds the hold. A build that already ended
	 * answers as it is.
	 */
	async cancel(
		scope: ProjectScope,
		projectId: string,
		buildId: string,
		/** Client IP of the request, for the audit row only. */
		ip: string,
	): Promise<MobileBuild> {
		await this.requireMobileProject(scope, projectId);
		await this.requireBuild(projectId, buildId);

		// Compare-and-set: the task and this route cannot both end the build,
		// so only one of them moves the credits.
		const canceled = await this.builds.transition(buildId, {
			to: "canceled",
		});
		if (canceled === null) {
			// The build ended before this write, so its current row is the answer.
			return toApiMobileBuild(await this.requireBuild(projectId, buildId));
		}

		await this.cancelEasBuild(canceled);
		await this.refundCanceledHold(scope, buildId);
		await this.auditEvents.insert({
			action: "mobile_build.canceled",
			actorUserId: scope.userId,
			ip,
			metadata: { platform: canceled.platform },
			organizationId: projectOwnerColumns(scope).organizationId,
			projectId,
			targetId: buildId,
			targetType: "mobile_build",
		});
		return toApiMobileBuild(canceled);
	}

	// A V1 project, a web app, or a project of another workspace answers 404,
	// not 403. Only a V2 mobile app project has builds.
	private async requireMobileProject(
		scope: ProjectScope,
		projectId: string,
	): Promise<void> {
		const project = await this.appCommits.findScopedProject(scope, projectId);
		if (
			project === null ||
			project.engine !== "v2_app" ||
			project.framework !== TEMPLATE_PROFILES.mobile.framework
		) {
			throw new NotFoundException();
		}
	}

	// A build id of another project answers 404, so no id works across projects.
	private async requireBuild(
		projectId: string,
		buildId: string,
	): Promise<MobileBuildRow> {
		const row = await this.builds.findById(buildId);
		if (!row || row.projectId !== projectId) {
			throw new NotFoundException();
		}
		return row;
	}

	// Marks a build whose task did not start as failed, then refunds the hold.
	// The refund runs only when this write wins. A lost write means the row
	// already ended: a cancel or the task moved it and owns the hold.
	private async failStart(
		row: MobileBuildRow,
		holdEventId: string | null,
		error: unknown,
	): Promise<MobileBuild> {
		this.logger.error(
			`mobile-build.start-failed build=${row.id} project=${row.projectId}: ${getErrorMessage(error)}`,
		);
		// A fixed text: the stored message must never hold a secret (security
		// rule 7 of WANDIT-194).
		const failed = await this.builds.transition(row.id, {
			errorCode: "start_failed",
			errorMessage: "The build task could not start",
			to: "failed",
		});
		if (failed === null) {
			return toApiMobileBuild((await this.builds.findById(row.id)) ?? row);
		}
		await this.refundCreateHold(holdEventId, row.id);
		// A 503 of the starter (no TRIGGER_SECRET_KEY) is a deploy fault. The
		// client gets the 503, so the operator sees it and the web translates it.
		if (error instanceof ServiceUnavailableException) {
			throw error;
		}
		return toApiMobileBuild(failed);
	}

	// The compensation of a create that holds credits but starts no build.
	// The catch logs a failed refund and does not throw it over the first
	// error. The stale hold sweep refunds the hold later.
	private async refundCreateHold(
		holdEventId: string | null,
		buildId: string,
	): Promise<void> {
		if (holdEventId === null) {
			return;
		}
		try {
			await this.metering.refund(holdEventId, "mobile_build_create_failed");
		} catch (error) {
			this.logger.error(
				`mobile-build.refund-failed build=${buildId}: ${getErrorMessage(error)}`,
			);
		}
	}

	// Best effort: the row is already `canceled`, and the task stops polling
	// when it reads that. The catch logs a failed call, because EAS then
	// finishes a build that wandit pays for.
	private async cancelEasBuild(row: MobileBuildRow): Promise<void> {
		if (row.easBuildId === null) {
			// No EAS build yet. The task cancels it when its EAS id write loses.
			return;
		}
		if (this.runner === null) {
			this.logger.error(
				`mobile-build.eas-cancel-skipped build=${row.id} eas=${row.easBuildId}: EXPO_TOKEN or EXPO_ACCOUNT is not set`,
			);
			return;
		}
		try {
			await this.runner.cancel(row.easBuildId);
		} catch (error) {
			this.logger.error(
				`mobile-build.eas-cancel-failed build=${row.id} eas=${row.easBuildId}: ${getErrorMessage(error)}`,
			);
		}
	}

	// A canceled build costs nothing. A hold exists only when billing was on
	// at create time. The catch logs a failed refund. The stale hold sweep
	// refunds the hold later.
	private async refundCanceledHold(
		scope: ProjectScope,
		buildId: string,
	): Promise<void> {
		try {
			const hold = await this.metering.findByIdempotencyKey(
				mobileBuildHoldKey(buildId),
				meteringSubjectFrom(scope),
			);
			if (hold?.status !== "reserved") {
				return;
			}
			await this.metering.refund(hold.id, "mobile_build_canceled");
		} catch (error) {
			this.logger.error(
				`mobile-build.refund-failed build=${buildId}: ${getErrorMessage(error)}`,
			);
		}
	}
}

// The API shape of a row: ISO dates, and no run, EAS, or request ids. The
// failure detail stays in the row: it can hold worker paths.
function toApiMobileBuild(row: MobileBuildRow): MobileBuild {
	return {
		artifactUrl: row.artifactUrl,
		commitSha: row.commitSha,
		completedAt: row.completedAt?.toISOString() ?? null,
		createdAt: row.createdAt.toISOString(),
		// SAFETY: `MobileBuildsRepository.transition` is the only writer of
		// `error_code`, and its input type is `MobileBuildErrorCode`.
		errorCode: row.errorCode as MobileBuildErrorCode | null,
		id: row.id,
		kind: row.kind,
		platform: row.platform,
		projectId: row.projectId,
		status: row.status,
	};
}

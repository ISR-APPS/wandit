/**
 * Application service behind the V2 web app publish routes (WANDIT-178).
 * `publish.controller.ts` calls it. `publish` and `rollback` write a
 * `queued` `app_builds` row and start the `publish-app` Trigger task;
 * `unpublish` takes the app down at once. It calls the publish repository,
 * the V1 deployments repository, the KV pointer writer, the W4P client,
 * the commits repository, the credits balance, and the task starter.
 */
import {
	ConflictException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import {
	APP_PUBLISH_HISTORY_LIMIT,
	type AppBuild,
	type AppBuildErrorCode,
	type AppDeployment,
	type AppLive,
	type AppPublishStatus,
	appWorkerName,
	type PublishAppBody,
	type RollbackAppBody,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { getErrorMessage } from "@wandit/observability/error";

import { isR2Configured } from "../../../../infrastructure/storage/r2";
import { CreditsService } from "../../../credits/application/services/credits.service";
import { subjectPayer } from "../../../credits/domain/credit-owner";
import { InsufficientCreditsError } from "../../../credits/domain/errors/insufficient-credits.error";
import { DomainRoutingService } from "../../../domains/infrastructure/cloudflare/domain-routing.service";
import {
	meteringSubjectFrom,
	type ProjectScope,
	projectOwnerColumns,
} from "../../../projects/domain/project-scope";
import { DeploymentsRepository } from "../../../sites/infrastructure/persistence/deployments.repository";
import {
	PUBLISH_APP_TASK_STARTER,
	type PublishAppTaskStarter,
} from "../../domain/ports/publish-app-task-starter";
import {
	WORKERS_FOR_PLATFORMS_CLIENT,
	type WorkersForPlatformsApi,
} from "../../infrastructure/cloudflare/workers-for-platforms.client";
import { AppCommitsRepository } from "../../infrastructure/persistence/app-commits.repository";
import {
	type AppBuildRow,
	type AppDeploymentRow,
	AppPublishRepository,
} from "../../infrastructure/persistence/app-publish.repository";
import { TEMPLATE_PROFILES } from "../../infrastructure/sandbox/template-profiles";

// 30 min without a row change. A run changes the row at the claim and
// before the upload, both within its 900 s `maxDuration`, so a running
// publish never looks stale.
const STALE_LIVE_BUILD_MS = 30 * 60_000;

/** Publish, roll back, unpublish, and read the publish state of one web app. */
@Injectable()
export class PublishService {
	private readonly logger = new Logger(PublishService.name);

	constructor(
		// The Pick types keep each seam at the methods the service needs.
		// A spec passes a plain fake. Nest still injects by the class token.
		@Inject(AppPublishRepository)
		private readonly publish: Pick<
			AppPublishRepository,
			| "findById"
			| "findByRequestKey"
			| "findDeployment"
			| "findLatest"
			| "findLive"
			| "failStaleLive"
			| "findLiveDeployment"
			| "insertQueued"
			| "listDeployments"
			| "setTriggerRunId"
			| "transition"
		>,
		@Inject(DeploymentsRepository)
		private readonly deployments: Pick<
			DeploymentsRepository,
			"healStalePending" | "unpublishActive"
		>,
		@Inject(AppCommitsRepository)
		private readonly appCommits: Pick<
			AppCommitsRepository,
			"findBranch" | "findScopedProject"
		>,
		@Inject(CreditsService)
		private readonly credits: Pick<CreditsService, "getSettledBalance">,
		@Inject(DomainRoutingService)
		private readonly routing: Pick<
			DomainRoutingService,
			"deleteHostPointer" | "isKvConfigured"
		>,
		@Inject(PUBLISH_APP_TASK_STARTER)
		private readonly starter: PublishAppTaskStarter,
		/** Null when a Cloudflare W4P env value is unset: publish answers 503. */
		@Inject(WORKERS_FOR_PLATFORMS_CLIENT)
		private readonly workers: Pick<
			WorkersForPlatformsApi,
			"deleteScript"
		> | null,
	) {}

	/** `GET .../publish`: the live app, the newest attempt, and the history. */
	async status(
		scope: ProjectScope,
		projectId: string,
	): Promise<AppPublishStatus> {
		await this.requireWebApp(scope, projectId);
		await this.healStale(projectId);
		return this.readStatus(projectId);
	}

	/**
	 * `POST .../publish`. Writes a `queued` row for the saved head of `main`
	 * and starts the task. A retried request key answers its first build.
	 */
	async publishHead(
		scope: ProjectScope,
		projectId: string,
		body: PublishAppBody,
	): Promise<AppBuild> {
		await this.requireWebApp(scope, projectId);
		const existing = await this.publish.findByRequestKey(
			projectId,
			body.requestKey,
		);
		if (existing) {
			return toApiBuild(existing);
		}
		this.assertConfigured();
		await this.assertBalanceNotNegative(scope);
		// The task builds the saved head of `main`. An app with no saved
		// version has nothing to publish.
		const commitSha = (await this.appCommits.findBranch(projectId))?.headSha;
		if (!commitSha) {
			throw new ConflictException({
				code: "PUBLISH_NO_VERSION",
				message: "Save a version of the app before you publish it",
			});
		}
		return this.queue(scope, projectId, {
			commitSha,
			requestKey: body.requestKey,
			sourceBuildId: null,
		});
	}

	/**
	 * `POST .../publish/rollback`. Writes a `queued` row that uploads the
	 * stored output of an earlier deployment again. Only a row that was live
	 * once (`superseded` or `unpublished`) can come back.
	 */
	async rollback(
		scope: ProjectScope,
		projectId: string,
		body: RollbackAppBody,
	): Promise<AppBuild> {
		await this.requireWebApp(scope, projectId);
		const existing = await this.publish.findByRequestKey(
			projectId,
			body.requestKey,
		);
		if (existing) {
			return toApiBuild(existing);
		}
		const target = await this.publish.findDeployment(
			projectId,
			body.deploymentId,
		);
		// The check `deployments_kind_source_ck` sets both columns on an app row;
		// the null test only narrows the type.
		if (!target || target.buildId === null || target.commitSha === null) {
			throw new NotFoundException();
		}
		if (target.status !== "superseded" && target.status !== "unpublished") {
			throw new ConflictException({
				code: "PUBLISH_ROLLBACK_INVALID",
				message: "Only an earlier live version can come back",
			});
		}
		const source = await this.publish.findById(target.buildId);
		if (!source || source.projectId !== projectId) {
			throw new NotFoundException();
		}
		this.assertConfigured();
		await this.assertBalanceNotNegative(scope);
		return this.queue(scope, projectId, {
			commitSha: target.commitSha,
			requestKey: body.requestKey,
			// A rollback of a rollback uploads the first stored output again.
			sourceBuildId: source.sourceBuildId ?? source.id,
		});
	}

	/**
	 * `DELETE .../publish`. Removes the slug pointer, deletes the user
	 * Worker, and marks the live row `unpublished`. A live publish answers
	 * 409: it would put the app back up when it ends.
	 */
	async unpublish(
		scope: ProjectScope,
		projectId: string,
	): Promise<AppPublishStatus> {
		await this.requireWebApp(scope, projectId);
		await this.healStale(projectId);
		if (await this.publish.findLive(projectId)) {
			throw activePublishError();
		}
		const live = await this.publish.findLiveDeployment(projectId);
		if (live) {
			// The pointer goes first and its error reaches the client: without
			// it the edge answers "not published", and a retry finds the row live.
			if (this.routing.isKvConfigured()) {
				await this.routing.deleteHostPointer(
					`${live.slug}.${env.SITES_DOMAIN}`,
				);
			} else {
				this.logger.warn(
					`publish.unpublish.kv-unconfigured project=${projectId}`,
				);
			}
			await this.deleteWorker(projectId);
			await this.deployments.unpublishActive(projectId);
		}
		return this.readStatus(projectId);
	}

	// Inserts the row and starts the task. The live index is the real guard
	// against a second live publish; the read before it is the fast path.
	private async queue(
		scope: ProjectScope,
		projectId: string,
		input: {
			commitSha: string;
			requestKey: string;
			sourceBuildId: string | null;
		},
	): Promise<AppBuild> {
		await this.healStale(projectId);
		if (await this.publish.findLive(projectId)) {
			throw activePublishError();
		}
		const insert = await this.publish.insertQueued({
			...projectOwnerColumns(scope),
			...input,
			projectId,
		});
		if (insert.kind === "live_exists") {
			throw activePublishError();
		}
		if (insert.kind === "request_exists") {
			// A parallel retry of the same click wrote its row first and
			// started its own task. This call starts nothing.
			return toApiBuild(insert.row);
		}
		const buildId = insert.row.id;

		let runId: string;
		try {
			({ runId } = await this.starter.start({ buildId, projectId }));
		} catch (error) {
			this.logger.error(
				`publish.start-failed build=${buildId} project=${projectId}: ${getErrorMessage(error)}`,
			);
			const failed = await this.publish.transition(buildId, {
				errorCode: "start_failed",
				errorMessage: "The publish task could not start",
				to: "failed",
			});
			// A 503 of the starter (no TRIGGER_SECRET_KEY) is a deploy fault. The
			// client gets the 503, so the operator sees it.
			if (error instanceof ServiceUnavailableException) {
				throw error;
			}
			return toApiBuild(failed ?? insert.row);
		}
		try {
			await this.publish.setTriggerRunId(buildId, runId);
		} catch (error) {
			// The task writes the same run id when it claims the row, so the
			// publish goes on without this write.
			this.logger.warn(
				`publish.run-id-write-failed build=${buildId}: ${getErrorMessage(error)}`,
			);
		}
		return toApiBuild(insert.row);
	}

	// Self-heal on read, like V1: a run stopped from outside leaves a live
	// row that would block every later publish, and a pending deployment
	// that would never end.
	private async healStale(projectId: string): Promise<void> {
		const stale = new Date(Date.now() - STALE_LIVE_BUILD_MS);
		const ended = await this.publish.failStaleLive(projectId, stale);
		if (ended > 0) {
			this.logger.warn(
				`publish.stale-ended project=${projectId} rows=${ended}`,
			);
		}
		await this.deployments.healStalePending(projectId);
	}

	// Best effort: the pointer is already gone, so no visitor reaches the
	// Worker. A failed delete leaves a Worker that the next publish replaces.
	private async deleteWorker(projectId: string): Promise<void> {
		if (this.workers === null) {
			this.logger.warn(
				`publish.unpublish.w4p-unconfigured project=${projectId}`,
			);
			return;
		}
		try {
			await this.workers.deleteScript({
				projectId,
				scriptName: appWorkerName(projectId),
			});
		} catch (error) {
			this.logger.error(
				`publish.unpublish.worker-delete-failed project=${projectId}: ${getErrorMessage(error)}`,
			);
		}
	}

	// Without the W4P client, R2, or the KV pointer, a publish can never go
	// live, so the API refuses it before any row. The KV rule is the V1 rule:
	// `ALLOW_PUBLISH_WITHOUT_KV` is the local switch.
	private assertConfigured(): void {
		if (this.workers === null || !isR2Configured()) {
			throw new ServiceUnavailableException({
				code: "V2_ENV_MISSING",
				message: "Cloudflare Workers for Platforms or R2 is not configured",
			});
		}
		if (!this.routing.isKvConfigured() && !env.ALLOW_PUBLISH_WITHOUT_KV) {
			throw new ServiceUnavailableException({
				code: "PUBLISH_UNAVAILABLE",
				message: "Cloudflare KV is not configured",
			});
		}
	}

	// Product rule of WANDIT-178: a publish costs no credits, but a payer
	// with a negative settled balance cannot publish.
	private async assertBalanceNotNegative(scope: ProjectScope): Promise<void> {
		const balance = await this.credits.getSettledBalance(
			subjectPayer(meteringSubjectFrom(scope)),
		);
		if (balance.settledBalance < 0) {
			throw new InsufficientCreditsError(
				0,
				balance.balance,
				balance.settledBalance,
			);
		}
	}

	// A V1 project, a mobile app, or a project of another workspace answers
	// 404, not 403. Only a V2 web app publishes to a Worker.
	private async requireWebApp(
		scope: ProjectScope,
		projectId: string,
	): Promise<void> {
		const project = await this.appCommits.findScopedProject(scope, projectId);
		if (
			project === null ||
			project.engine !== "v2_app" ||
			project.framework !== TEMPLATE_PROFILES.web.framework
		) {
			throw new NotFoundException();
		}
	}

	private async readStatus(projectId: string): Promise<AppPublishStatus> {
		const [live, latest, history] = await Promise.all([
			this.publish.findLiveDeployment(projectId),
			this.publish.findLatest(projectId),
			this.publish.listDeployments(projectId, APP_PUBLISH_HISTORY_LIMIT),
		]);
		return {
			history: history.map(toApiDeployment),
			latestBuild: latest === null ? null : toApiBuild(latest),
			live: live === null ? null : toApiLive(live),
		};
	}
}

function activePublishError(): ConflictException {
	return new ConflictException({
		code: "PUBLISH_ACTIVE",
		message: "A publish of this app is running",
	});
}

// The API shape of a row: ISO dates, and no run or request ids. The
// failure detail stays in the row.
function toApiBuild(row: AppBuildRow): AppBuild {
	return {
		commitSha: row.commitSha,
		completedAt: row.completedAt?.toISOString() ?? null,
		createdAt: row.createdAt.toISOString(),
		// SAFETY: the two writers of `error_code` are `AppPublishRepository`
		// `transitionColumns` (an `AppBuildErrorCode`, `gate_blocked` included)
		// and `failStaleLive` (`internal`).
		errorCode: row.errorCode as AppBuildErrorCode | null,
		id: row.id,
		projectId: row.projectId,
		sourceBuildId: row.sourceBuildId,
		status: row.status,
	};
}

function toApiDeployment(row: AppDeploymentRow): AppDeployment {
	// The check `deployments_kind_source_ck` sets both columns on every app row.
	if (row.buildId === null || row.commitSha === null) {
		throw new Error(`App deployment ${row.id} has no build or commit`);
	}
	return {
		buildId: row.buildId,
		commitSha: row.commitSha,
		createdAt: row.createdAt.toISOString(),
		id: row.id,
		slug: row.slug,
		status: row.status,
	};
}

function toApiLive(row: AppDeploymentRow): AppLive {
	const deployment = toApiDeployment(row);
	return {
		commitSha: deployment.commitSha,
		deploymentId: deployment.id,
		// The row turns `active` in its last update.
		publishedAt: row.updatedAt.toISOString(),
		slug: deployment.slug,
		url: `https://${deployment.slug}.${env.SITES_DOMAIN}`,
	};
}

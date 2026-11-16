/**
 * Application service behind the desktop routes (docs/v2/desktop-apps.md
 * section 8). `desktop-builds.controller.ts` calls it. `create` holds the
 * build credits, writes the app and build rows, and starts the
 * `desktop-build` task. `cancel` stops the CI run and releases the hold.
 * `release` writes the updater manifest and the stable download on R2.
 */
import { randomUUID } from "node:crypto";
import {
	ConflictException,
	ForbiddenException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import {
	type CreateDesktopBuildBody,
	type DesktopApp,
	type DesktopBuild,
	type DesktopGateFinding,
	type DesktopOverviewQuery,
	type DesktopOverviewResponse,
	type DesktopPlatform,
	type DesktopUpdateManifest,
	desktopBuildErrorCodeSchema,
	desktopBuildSchema,
	desktopProductNameSchema,
	desktopUpdateManifestSchema,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { getErrorMessage } from "@wandit/observability/error";

import {
	copyObject,
	deleteDesktopReleaseObjects,
	desktopDownloadHeaders,
	desktopManifestKey,
	desktopStableFileName,
	desktopStableInstallerKey,
	desktopUpdatesUrl,
	isR2Configured,
	type ObjectHeaders,
	putObject,
} from "../../../../infrastructure/storage/r2";
import { subjectPayer } from "../../../credits/domain/credit-owner";
import { MeteringService } from "../../../metering/application/services/metering.service";
import { MeteringStateConflictError } from "../../../metering/domain/metering";
import { DESKTOP_BUILD_CREDITS_CENTI } from "../../../metering/domain/operation-registry";
import {
	meteringSubjectFrom,
	type ProjectScope,
	projectOwnerColumns,
} from "../../../projects/domain/project-scope";
import {
	DEFAULT_DESKTOP_PRODUCT_NAME,
	desktopBinaryName,
	desktopBuildHoldKey,
	desktopIdentifier,
	MAX_LIVE_DESKTOP_BUILDS_PER_PAYER,
} from "../../domain/desktop-build";
import { DesktopBuildActiveError } from "../../domain/errors/desktop-build-active.error";
import { DesktopBuildNotReadyError } from "../../domain/errors/desktop-build-not-ready.error";
import {
	DESKTOP_BUILD_RUNNER,
	type DesktopBuildRunner,
} from "../../domain/ports/desktop-build-runner";
import {
	DESKTOP_BUILD_TASK_STARTER,
	type DesktopBuildTaskStarter,
} from "../../domain/ports/desktop-build-task-starter";
import {
	encryptDesktopUpdaterKey,
	generateUpdaterKeyPair,
} from "../../infrastructure/desktop/updater-signature";
import {
	requireV2Env,
	V2_ENV,
	type V2EnvSource,
} from "../../infrastructure/env/v2-env";
import { AppCommitsRepository } from "../../infrastructure/persistence/app-commits.repository";
import {
	type DesktopAppRow,
	type DesktopBuildRow,
	DesktopBuildsRepository,
	type DesktopProject,
	type InsertDesktopBuildResult,
	type NewDesktopApp,
} from "../../infrastructure/persistence/desktop-builds.repository";
import { TEMPLATE_PROFILES } from "../../infrastructure/sandbox/template-profiles";
import {
	parseSecretKeyRing,
	type SecretKeyRing,
} from "../../infrastructure/secrets/secret-crypto";
import { AuditEventsService } from "./audit-events.service";

/** Nest token for the R2 calls of the desktop routes. */
export const DESKTOP_OBJECTS = Symbol.for("app-builder.desktop-objects");

/** The R2 calls the service needs, as a seam: a spec passes a map fake. */
export type DesktopObjectStore = {
	/** True when the R2 credentials exist. */
	isConfigured(): boolean;
	/** Public URL of a `desktop/` key on the updates host, or null without a base URL. */
	publicUrl(key: string): string | null;
	putText(key: string, text: string, headers: ObjectHeaders): Promise<void>;
	copy(
		sourceKey: string,
		destinationKey: string,
		headers: ObjectHeaders,
	): Promise<void>;
	/** Deletes both manifests and the stable download files of both platforms of a project. */
	removeRelease(projectId: string): Promise<number>;
};

/** The production `DesktopObjectStore` on the shared R2 helpers. */
export const r2DesktopObjects: DesktopObjectStore = {
	copy: copyObject,
	isConfigured: isR2Configured,
	publicUrl: desktopUpdatesUrl,
	putText: (key, text, headers) =>
		putObject(key, { kind: "text", text }, headers),
	removeRelease: deleteDesktopReleaseObjects,
};

// Installed apps must see a release at once, so no cache may keep the old
// manifest. `desktopDownloadHeaders` sets the same rule for the build files.
const MANIFEST_HEADERS: ObjectHeaders = {
	cacheControl: "no-cache",
	contentType: "application/json; charset=utf-8",
};

/** Overview, create, cancel, and release of the Windows and macOS builds of one desktop project. */
@Injectable()
export class DesktopBuildsService {
	private readonly logger = new Logger(DesktopBuildsService.name);

	constructor(
		// The Pick types keep each seam at the methods the service needs.
		// A spec passes a plain fake. Nest still injects by the class token.
		@Inject(DesktopBuildsRepository)
		private readonly builds: Pick<
			DesktopBuildsRepository,
			| "findApp"
			| "findById"
			| "findByRequestKey"
			| "findLive"
			| "findProject"
			| "insertQueued"
			| "listRecent"
			| "release"
			| "setTriggerRunId"
			| "transition"
		>,
		@Inject(AppCommitsRepository)
		private readonly appCommits: Pick<AppCommitsRepository, "findBranch">,
		@Inject(AuditEventsService)
		private readonly audit: Pick<AuditEventsService, "record">,
		@Inject(MeteringService)
		private readonly metering: Pick<
			MeteringService,
			"findByIdempotencyKey" | "refund" | "reserveWithReplay"
		>,
		@Inject(DESKTOP_BUILD_TASK_STARTER)
		private readonly starter: DesktopBuildTaskStarter,
		/** Null without DESKTOP_BUILD_GITHUB_TOKEN or DESKTOP_BUILD_REPO. */
		@Inject(DESKTOP_BUILD_RUNNER)
		private readonly runner: DesktopBuildRunner | null,
		@Inject(V2_ENV)
		private readonly v2Env: V2EnvSource,
		@Inject(DESKTOP_OBJECTS)
		private readonly objects: DesktopObjectStore,
	) {}

	/**
	 * `GET .../desktop`: the identity of the app, the newest builds first, and
	 * the staff suspension. The web disables Build while it is set.
	 */
	async overview(
		scope: ProjectScope,
		projectId: string,
		query: DesktopOverviewQuery,
	): Promise<DesktopOverviewResponse> {
		const project = await this.requireDesktopProject(scope, projectId);
		const [app, rows] = await Promise.all([
			this.builds.findApp(projectId),
			this.builds.listRecent(projectId, query.limit),
		]);
		return {
			app: app === null ? null : this.toApiApp(app, project),
			// D36: the web offers macOS only while the API accepts macOS builds.
			buildablePlatforms: env.DESKTOP_MACOS_BUILDS_ENABLED
				? ["windows", "macos"]
				: ["windows"],
			builds: rows.map((row) => this.toApiBuild(row, app, project)),
			// A suspend sets both columns. The same rule as toApiSuspension in publish.service.ts.
			suspension:
				project.suspendedReasonCode === null || project.suspendedAt === null
					? null
					: {
							reasonCode: project.suspendedReasonCode,
							suspendedAt: project.suspendedAt.toISOString(),
						},
		};
	}

	/**
	 * `POST .../desktop/builds` (section 8, steps 1 to 7). A retried request
	 * key answers its first build. Any other macOS create answers 403 while
	 * DESKTOP_MACOS_BUILDS_ENABLED is false. A task that does not start leaves the row
	 * `failed` with `start_failed` and releases the hold. `rebuildOfBuildId`
	 * builds the commit of an earlier ready build with the next version.
	 */
	async create(
		scope: ProjectScope,
		projectId: string,
		body: CreateDesktopBuildBody,
		/** Client IP of the request, for the audit row only. */
		ip: string,
	): Promise<DesktopBuild> {
		const project = await this.requireDesktopProject(scope, projectId);
		assertNotSuspended(project);

		// A retry of the same click answers the first build and holds nothing.
		const existing = await this.builds.findByRequestKey(
			projectId,
			body.requestKey,
		);
		if (existing) {
			return this.toApiBuild(
				existing,
				await this.builds.findApp(projectId),
				project,
			);
		}
		// D36: macOS builds stay off until the macOS staging checks pass. The check follows the
		// replay, so a retry of an accepted request still answers its first build.
		if (body.platform === "macos" && !env.DESKTOP_MACOS_BUILDS_ENABLED) {
			throw new ForbiddenException({
				code: "DESKTOP_PLATFORM_UNAVAILABLE",
				message: "macOS builds are not available now.",
			});
		}
		const commitSha = await this.findBuildCommit(
			projectId,
			body.rebuildOfBuildId,
		);
		const ring = this.requireBuildConfig(projectId, body.platform);
		// Fast path of the one-live-build rule. The live index is the real
		// guard at insert time.
		if (await this.builds.findLive(projectId)) {
			throw new DesktopBuildActiveError();
		}

		const buildId = randomUUID();
		const holdEventId = await this.holdBuildCredits(
			scope,
			projectId,
			body.requestKey,
			buildId,
		);
		const app = await this.builds.findApp(projectId);

		let insert: InsertDesktopBuildResult;
		try {
			insert = await this.builds.insertQueued(
				{
					// `desktop_builds.user_id` holds the actor (workspaces-sharing.md 4).
					// `organizationId` is the team org of the project or null.
					organizationId: projectOwnerColumns(scope).organizationId,
					userId: scope.actorUserId,
					commitSha,
					id: buildId,
					notes: body.notes || null,
					platform: body.platform,
					projectId,
					requestKey: body.requestKey,
				},
				app === null
					? this.newDesktopApp(scope, project, body.productName, ring)
					: null,
				// The cap counts the builds of the pool that pays the hold.
				subjectPayer(meteringSubjectFrom(scope)),
			);
		} catch (error) {
			await this.refundCreateHold(holdEventId, buildId);
			throw error;
		}
		if (insert.kind === "live_exists") {
			await this.refundCreateHold(holdEventId, buildId);
			throw new DesktopBuildActiveError();
		}
		if (insert.kind === "payer_limit") {
			await this.refundCreateHold(holdEventId, buildId);
			throw new ConflictException({
				code: "DESKTOP_BUILD_LIMIT_REACHED",
				message: `This workspace already runs ${MAX_LIVE_DESKTOP_BUILDS_PER_PAYER} desktop builds. Wait for one to finish, then try again.`,
			});
		}
		if (insert.kind === "request_exists") {
			// A parallel retry of the same click wrote its row first. The hold
			// has the same key, so it now belongs to that row: no refund here.
			return this.toApiBuild(insert.row, app, project);
		}

		let runId: string;
		try {
			({ runId } = await this.starter.start({ buildId, projectId }));
		} catch (error) {
			return this.failStart(insert.row, project, holdEventId, error);
		}
		try {
			await this.builds.setTriggerRunId(buildId, runId);
		} catch (error) {
			// The task writes the same run id when it claims the row, so the
			// build goes on without this write.
			this.logger.warn(
				`desktop-build.run-id-write-failed build=${buildId}: ${getErrorMessage(error)}`,
			);
		}

		await this.audit.record({
			action: "desktop.build",
			actorUserId: scope.actorUserId,
			ip,
			metadata: {
				commitSha,
				platform: body.platform,
				// Set on a rollback: a new build of the code of an older build.
				rebuildOfBuildId: body.rebuildOfBuildId ?? null,
				version: insert.row.version,
			},
			organizationId: projectOwnerColumns(scope).organizationId,
			projectId,
			targetId: buildId,
			targetType: "desktop_build",
		});
		return this.toApiBuild(insert.row, app, project);
	}

	/**
	 * `POST .../builds/:buildId/cancel`. Moves a live build to `canceled`,
	 * cancels the CI run, and releases the hold. A build that already ended
	 * answers as it is. So does a build in `signing`, until a crashed run
	 * leaves it there past DESKTOP_SIGNING_STUCK_AFTER_MS.
	 */
	async cancel(
		scope: ProjectScope,
		projectId: string,
		buildId: string,
		/** Client IP of the request, for the audit row only. */
		ip: string,
	): Promise<DesktopBuild> {
		const project = await this.requireDesktopProject(scope, projectId);
		await this.requireBuild(projectId, buildId);

		// Compare-and-set: the task and this route cannot both end the build,
		// so only one of them moves the credits.
		const canceled = await this.builds.transition(buildId, {
			by: "user",
			to: "canceled",
		});
		if (canceled === null) {
			return this.toApiBuild(
				await this.requireBuild(projectId, buildId),
				await this.builds.findApp(projectId),
				project,
			);
		}

		await this.cancelCiRun(canceled);
		await this.refundCanceledHold(scope, canceled);
		await this.audit.record({
			action: "desktop.cancel",
			actorUserId: scope.actorUserId,
			ip,
			metadata: { version: canceled.version },
			organizationId: projectOwnerColumns(scope).organizationId,
			projectId,
			targetId: buildId,
			targetType: "desktop_build",
		});
		// A canceled build is never the current one.
		return this.toApiBuild(canceled, null, project);
	}

	/**
	 * `POST .../builds/:buildId/release` (sections 8 and 10). Copies the
	 * download file to the stable key of the build platform, writes the
	 * manifest of that platform, and makes the build current there. A build
	 * older than the current build of its platform answers 409: the owner
	 * rebuilds it instead. A release costs no credits. The macOS flag does not
	 * gate it: a fixed build must reach Mac apps also while new builds are off.
	 */
	async release(
		scope: ProjectScope,
		projectId: string,
		buildId: string,
		/** Client IP of the request, for the audit row only. */
		ip: string,
	): Promise<DesktopBuild> {
		const project = await this.requireDesktopProject(scope, projectId);
		assertNotSuspended(project);
		const build = await this.requireBuild(projectId, buildId);
		const installerKey = build.installerKey;
		const signature = build.updaterSignature;
		// The updater installs the re-packed archive on a Tauri Mac app. Windows
		// installs the setup exe, and an Electron Mac app installs from the disk
		// image: those builds have no archive. A null engine is an older Tauri project.
		const updateKey =
			build.platform === "macos" && project.desktopEngine !== "electron"
				? build.updateArchiveKey
				: installerKey;
		if (
			build.status !== "ready" ||
			installerKey === null ||
			signature === null ||
			updateKey === null
		) {
			throw new DesktopBuildNotReadyError();
		}
		const app = await this.builds.findApp(projectId);
		if (app === null) {
			throw new Error(
				`Desktop build ${buildId} is ready, but project ${projectId} has no app row`,
			);
		}
		this.requireStorage();
		const manifest = updateManifest({
			notes: build.notes,
			platform: build.platform,
			releasedAt: new Date(),
			signature,
			updateUrl: this.requireUpdatesUrl(updateKey),
			version: build.version,
		});
		const released = await this.builds.release(
			projectId,
			buildId,
			build.platform,
			async ({ currentReleaseNumber, isProjectActive }) => {
				// Installed apps accept only a newer version, so an older build would
				// reach only new installs. The repository reads the current build of
				// the same platform, under the app row lock, so two parallel releases
				// cannot both pass it.
				if (
					currentReleaseNumber !== null &&
					build.releaseNumber < currentReleaseNumber
				) {
					throw new ConflictException({
						code: "DESKTOP_BUILD_OLDER_THAN_CURRENT",
						message:
							"This build is older than the current one. Build it again to release it.",
					});
				}
				await this.objects.copy(
					installerKey,
					desktopStableInstallerKey(projectId, app.binaryName, build.platform),
					desktopDownloadHeaders(
						desktopStableFileName(app.binaryName, build.platform),
					),
				);
				await this.objects.putText(
					desktopManifestKey(projectId, build.platform),
					JSON.stringify(manifest),
					MANIFEST_HEADERS,
				);
				// Staff can suspend the project during the writes. The suspension
				// deletes these objects first, so a late write undoes itself here.
				if (!(await isProjectActive())) {
					await this.objects.removeRelease(projectId);
					throw suspendedError();
				}
			},
		);

		await this.audit.record({
			action: "desktop.release",
			actorUserId: scope.actorUserId,
			ip,
			metadata: { platform: released.platform, version: released.version },
			organizationId: projectOwnerColumns(scope).organizationId,
			projectId,
			targetId: buildId,
			targetType: "desktop_build",
		});
		// The release committed, so this build is now the current build of its platform.
		const releasedApp: DesktopAppRow =
			released.platform === "windows"
				? { ...app, currentWindowsBuildId: released.id }
				: { ...app, currentMacosBuildId: released.id };
		return this.toApiBuild(released, releasedApp, project);
	}

	// A V1 project, a web or mobile app, or a project of another workspace
	// answers 404, not 403. Only a V2 desktop project has desktop builds.
	private async requireDesktopProject(
		scope: ProjectScope,
		projectId: string,
	): Promise<DesktopProject> {
		const project = await this.builds.findProject(scope, projectId);
		if (
			project === null ||
			project.engine !== "v2_app" ||
			project.framework !== TEMPLATE_PROFILES.desktop.framework
		) {
			throw new NotFoundException();
		}
		return project;
	}

	// The commit of a new build. A rebuild takes the commit of an earlier ready
	// build of the project (section 10). Else the task builds the saved head
	// of `main`, and an app with no saved version has no commit to build.
	private async findBuildCommit(
		projectId: string,
		/** `rebuildOfBuildId` of the body: an earlier build of this project, or undefined. */
		rebuildOfBuildId: string | undefined,
	): Promise<string> {
		if (rebuildOfBuildId !== undefined) {
			const source = await this.requireBuild(projectId, rebuildOfBuildId);
			// Only a ready build passed the gate and the CI with this commit.
			if (source.status !== "ready") {
				throw new ConflictException({
					code: "DESKTOP_BUILD_NOT_READY",
					message: "Only a ready desktop build can be built again",
				});
			}
			return source.commitSha;
		}
		const branch = await this.appCommits.findBranch(projectId);
		const commitSha = branch?.headSha ?? null;
		if (commitSha === null) {
			throw new ConflictException({
				code: "DESKTOP_BUILD_NO_VERSION",
				message: "Save a version of the app before you build it",
			});
		}
		return commitSha;
	}

	// A build id of another project answers 404, so no id works across projects.
	private async requireBuild(
		projectId: string,
		buildId: string,
	): Promise<DesktopBuildRow> {
		const row = await this.builds.findById(buildId);
		if (!row || row.projectId !== projectId) {
			throw new NotFoundException();
		}
		return row;
	}

	// Section 8, step 3: every value a build needs, checked before any hold.
	// Answers the key ring that encrypts the updater key of a first build.
	private requireBuildConfig(
		projectId: string,
		/** The platform of the create body. The app embeds the manifest URL of this platform. */
		platform: DesktopPlatform,
	): SecretKeyRing {
		requireV2Env("DESKTOP_BUILD_GITHUB_TOKEN", this.v2Env);
		requireV2Env("DESKTOP_BUILD_REPO", this.v2Env);
		this.requireStorage();
		this.requireUpdatesUrl(desktopManifestKey(projectId, platform));
		return parseSecretKeyRing(
			requireV2Env("APP_SECRETS_ENCRYPTION_KEY", this.v2Env),
		);
	}

	private requireStorage(): void {
		if (!this.objects.isConfigured()) {
			throw new ServiceUnavailableException({
				code: "V2_ENV_MISSING",
				message: "R2 is not configured",
			});
		}
	}

	// Every installed app holds the manifest URL, and tauri-plugin-updater
	// refuses an http endpoint, so only an https base passes.
	private requireUpdatesUrl(key: string): string {
		const url = this.objects.publicUrl(key);
		if (url === null || !url.startsWith("https://")) {
			throw new ServiceUnavailableException({
				code: "V2_ENV_MISSING",
				message:
					"DESKTOP_UPDATES_BASE_URL or R2_PUBLIC_BASE_URL is not an https URL",
			});
		}
		return url;
	}

	// Section 8, step 4. The hold runs before the insert, so a 402 writes no
	// row. GENERATION_BILLING_MODE=off is the local dev bypass: no hold.
	private async holdBuildCredits(
		scope: ProjectScope,
		projectId: string,
		requestKey: string,
		buildId: string,
	): Promise<string | null> {
		if (env.GENERATION_BILLING_MODE === "off") {
			this.logger.log(`billing.off build=${buildId}`);
			return null;
		}
		try {
			const hold = await this.metering.reserveWithReplay(
				"desktop_build",
				meteringSubjectFrom(scope),
				{
					credits: DESKTOP_BUILD_CREDITS_CENTI,
					idempotencyKey: desktopBuildHoldKey(projectId, requestKey),
					projectId,
				},
			);
			return hold.event.id;
		} catch (error) {
			// The hold of this request key already ended: an earlier attempt
			// was refused and released it. A new click sends a new key.
			if (error instanceof MeteringStateConflictError) {
				throw new ConflictException(
					"This build request already ended. Send a new request.",
				);
			}
			throw error;
		}
	}

	// The first build fixes the identity of the app (section 8, step 5).
	private newDesktopApp(
		scope: ProjectScope,
		project: DesktopProject,
		requestedProductName: string | undefined,
		ring: SecretKeyRing,
	): NewDesktopApp {
		const productName = firstProductName(requestedProductName, project.name);
		const keys = generateUpdaterKeyPair();
		return {
			...projectOwnerColumns(scope),
			binaryName: desktopBinaryName(productName),
			productName,
			projectId: project.id,
			updaterKeyId: keys.keyId,
			updaterPrivateKey: encryptDesktopUpdaterKey(
				ring,
				project.id,
				keys.privateKeyPkcs8,
			),
			updaterPublicKey: keys.publicKey,
		};
	}

	// Marks a build whose task did not start as failed, then releases the
	// hold. The release runs only when this write wins. A lost write means a
	// cancel ended the row and owns the hold.
	private async failStart(
		row: DesktopBuildRow,
		project: DesktopProject,
		holdEventId: string | null,
		error: unknown,
	): Promise<DesktopBuild> {
		this.logger.error(
			`desktop-build.start-failed build=${row.id} project=${row.projectId}: ${getErrorMessage(error)}`,
		);
		// A fixed text: the stored message must never hold a secret.
		const failed = await this.builds.transition(row.id, {
			errorCode: "start_failed",
			errorMessage: "The build task could not start",
			to: "failed",
		});
		if (failed === null) {
			return this.toApiBuild(
				(await this.builds.findById(row.id)) ?? row,
				null,
				project,
			);
		}
		await this.refundCreateHold(holdEventId, row.id);
		// A 503 of the starter (no TRIGGER_SECRET_KEY) is a deploy fault. The
		// client gets the 503, so the operator sees it and the web translates it.
		if (error instanceof ServiceUnavailableException) {
			throw error;
		}
		return this.toApiBuild(failed, null, project);
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
			await this.metering.refund(holdEventId, "desktop_build_create_failed");
		} catch (error) {
			this.logger.error(
				`desktop-build.refund-failed build=${buildId}: ${getErrorMessage(error)}`,
			);
		}
	}

	// Best effort: the row is already `canceled`, and the task stops when it
	// reads that. The catch logs a failed call, because GitHub then finishes
	// a build that wandit pays for.
	private async cancelCiRun(row: DesktopBuildRow): Promise<void> {
		if (row.ciRunId === null) {
			// No CI run yet. The task dispatches nothing after it reads `canceled`.
			return;
		}
		if (this.runner === null) {
			this.logger.error(
				`desktop-build.ci-cancel-skipped build=${row.id} run=${row.ciRunId}: DESKTOP_BUILD_GITHUB_TOKEN or DESKTOP_BUILD_REPO is not set`,
			);
			return;
		}
		try {
			await this.runner.cancel(row.ciRunId);
		} catch (error) {
			this.logger.error(
				`desktop-build.ci-cancel-failed build=${row.id} run=${row.ciRunId}: ${getErrorMessage(error)}`,
			);
		}
	}

	// A canceled build costs nothing (section 11). A hold exists only when
	// billing was on at create time. The catch logs a failed refund; the
	// stale hold sweep refunds the hold later.
	private async refundCanceledHold(
		scope: ProjectScope,
		row: DesktopBuildRow,
	): Promise<void> {
		try {
			const hold = await this.metering.findByIdempotencyKey(
				desktopBuildHoldKey(row.projectId, row.requestKey),
				meteringSubjectFrom(scope),
			);
			if (hold?.status !== "reserved") {
				return;
			}
			await this.metering.refund(hold.id, "desktop_build_canceled");
		} catch (error) {
			this.logger.error(
				`desktop-build.refund-failed build=${row.id}: ${getErrorMessage(error)}`,
			);
		}
	}

	// The API shape of an app row. The keys never leave the server.
	private toApiApp(app: DesktopAppRow, project: DesktopProject): DesktopApp {
		return {
			identifier: desktopIdentifier(app.projectId),
			productName: app.productName,
			releases: {
				macos: this.toApiRelease(app, project, "macos"),
				windows: this.toApiRelease(app, project, "windows"),
			},
		};
	}

	// One platform of the app. A suspended project shows no download link:
	// suspension deleted the file.
	private toApiRelease(
		app: DesktopAppRow,
		project: DesktopProject,
		platform: DesktopPlatform,
	): DesktopApp["releases"][DesktopPlatform] {
		const currentBuildId = currentBuildIdOf(app, platform);
		return {
			currentBuildId,
			downloadUrl:
				currentBuildId !== null && project.suspendedReasonCode === null
					? this.requireUpdatesUrl(
							desktopStableInstallerKey(
								app.projectId,
								app.binaryName,
								platform,
							),
						)
					: null,
			updatesUrl: this.requireUpdatesUrl(
				desktopManifestKey(app.projectId, platform),
			),
		};
	}

	// The API shape of a build row: ISO dates, and no run, CI, request, or
	// key fields. The failure detail stays in the row for support.
	private toApiBuild(
		row: DesktopBuildRow,
		/** The app row, for the current-build pointers. Null when the build cannot be current: no app row yet, a cancel, or a failed start. */
		app: DesktopAppRow | null,
		/** The project of the row, from `requireDesktopProject`. */
		project: DesktopProject,
	): DesktopBuild {
		const isReady = row.status === "ready";
		// A staff take-down (WANDIT-181) hides every download link of the app.
		const installerKey =
			isReady && project.suspendedReasonCode === null ? row.installerKey : null;
		return {
			commitSha: row.commitSha,
			completedAt: row.completedAt?.toISOString() ?? null,
			createdAt: row.createdAt.toISOString(),
			errorCode:
				row.status === "failed"
					? (desktopBuildErrorCodeSchema.safeParse(row.errorCode).data ?? null)
					: null,
			findings: row.status === "blocked" ? this.readFindings(row) : [],
			id: row.id,
			installerBytes: isReady ? row.installerBytes : null,
			installerUrl:
				installerKey === null ? null : this.objects.publicUrl(installerKey),
			isCurrent: app !== null && row.id === currentBuildIdOf(app, row.platform),
			notes: row.notes,
			platform: row.platform,
			projectId: row.projectId,
			releasedAt: row.releasedAt?.toISOString() ?? null,
			status: row.status,
			version: row.version,
		};
	}

	// `findings` is jsonb, so it passes the contract schema on read. A row
	// that fails the schema shows no findings, and the log names it.
	private readFindings(row: DesktopBuildRow): DesktopGateFinding[] {
		const parsed = desktopBuildSchema.shape.findings.safeParse(row.findings);
		if (!parsed.success) {
			this.logger.error(`desktop-build.findings-unreadable build=${row.id}`);
			return [];
		}
		return parsed.data;
	}
}

function assertNotSuspended(project: DesktopProject): void {
	// WANDIT-181: a suspended app ships nothing new until staff unsuspend it.
	if (project.suspendedReasonCode !== null) {
		throw suspendedError();
	}
}

function suspendedError(): ForbiddenException {
	return new ForbiddenException({
		code: "PROJECT_SUSPENDED",
		message: "Wandit staff suspended this app. Contact support.",
	});
}

// The body name on the first build, else the project name when it passes
// the name rule, else the default.
function firstProductName(
	requested: string | undefined,
	projectName: string,
): string {
	if (requested !== undefined) {
		return requested;
	}
	const fromProject = desktopProductNameSchema.safeParse(projectName);
	return fromProject.success ? fromProject.data : DEFAULT_DESKTOP_PRODUCT_NAME;
}

// The current build of one platform: the build that its manifest announces.
function currentBuildIdOf(
	app: DesktopAppRow,
	platform: DesktopPlatform,
): string | null {
	return platform === "windows"
		? app.currentWindowsBuildId
		: app.currentMacosBuildId;
}

// The parse refuses an http URL or an empty signature before installed
// apps can read the manifest. The updater reads `<os>-<arch>-<installer>`
// first, then `<os>-<arch>`, so both keys of the platform carry the same entry.
function updateManifest(input: {
	/** The platform of the build. Its manifest holds only its own keys. */
	platform: DesktopPlatform;
	/** Public URL of the update file: the setup exe on Windows; on macOS the `.app.tar.gz` (Tauri) or the disk image (Electron). */
	updateUrl: string;
	notes: string | null;
	releasedAt: Date;
	/** `desktop_builds.updater_signature`: it signs `version`. */
	signature: string;
	version: string;
}): DesktopUpdateManifest {
	const entry = { signature: input.signature, url: input.updateUrl };
	return desktopUpdateManifestSchema.parse({
		...(input.notes === null ? {} : { notes: input.notes }),
		platforms:
			input.platform === "windows"
				? { "windows-x86_64": entry, "windows-x86_64-nsis": entry }
				: { "darwin-aarch64": entry, "darwin-aarch64-app": entry },
		pub_date: input.releasedAt.toISOString(),
		version: input.version,
	});
}

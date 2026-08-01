/**
 * Publishing: turn a draft version's R2 bytes into the live site.
 *
 * The pipeline is synchronous on purpose (1 R2 GET → pixel injection →
 * 2 R2 PUTs → 0-1 KV PUT → 1 DB promotion, sub-second) but keeps the
 * queue-shaped deployments row lifecycle (pending → active | failed) so the
 * dashboard's "publishing" state stays real and an async swap is a drop-in.
 *
 * Money-shaped invariant, same as generation: R2 writes happen BEFORE the
 * row is promoted — an active deployment must never point at bytes that do
 * not exist.
 */
import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
	type Deployment,
	type DeploymentCurrent,
	type DeploymentCurrentResponse,
	type DeploymentUiState,
	deploymentSlugSchema,
	isReservedSlug,
	type ListDeploymentsResponse,
	type PublishDeploymentBody,
	type PublishDeploymentResponse,
	type RollbackDeploymentBody,
	type SlugAvailabilityResponse,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";

import { AnalyticsService } from "../../../../infrastructure/analytics/analytics.service";
import {
	deleteObject,
	getPageHtml,
	isR2Configured,
	publishedArchiveKey,
	publishedCurrentKey,
	putPageHtml,
} from "../../../../infrastructure/storage/r2";
import { DomainRoutingService } from "../../../domains/infrastructure/cloudflare/domain-routing.service";
import {
	buildLeadsCaptureUrl,
	injectLeadsRuntime,
} from "../../../leads/runtime/inject-leads-runtime";
import {
	NoVersionToPublishError,
	PublishFailedError,
	PublishUnavailableError,
	SlugReservedError,
	SlugTakenError,
} from "../../domain/errors/site.errors";
import {
	assertNoEditorArtifacts,
	injectPixels,
} from "../../domain/pixel-injector";
import { slugifyProjectName, withRandomSuffix } from "../../domain/slugify";
import {
	type DeploymentRow,
	DeploymentsRepository,
	type OwnedProjectRow,
} from "../../infrastructure/persistence/deployments.repository";

const SLUG_SUFFIX_ATTEMPTS = 5;

@Injectable()
export class SitesService {
	private readonly logger = new Logger(SitesService.name);

	constructor(
		@Inject(DeploymentsRepository)
		private readonly deploymentsRepository: DeploymentsRepository,
		@Inject(DomainRoutingService)
		private readonly domainRoutingService: DomainRoutingService,
		@Inject(AnalyticsService)
		private readonly analyticsService: AnalyticsService,
	) {}

	async current(
		userId: string,
		projectId: string,
	): Promise<DeploymentCurrentResponse> {
		await this.deploymentsRepository.getOwnedProject(userId, projectId);
		await this.deploymentsRepository.healStalePending(projectId);

		return { current: await this.buildCurrent(projectId) };
	}

	async list(
		userId: string,
		projectId: string,
	): Promise<ListDeploymentsResponse> {
		await this.deploymentsRepository.getOwnedProject(userId, projectId);

		const rows = await this.deploymentsRepository.listByProject(projectId);

		return { deployments: rows.map(mapDeployment) };
	}

	async slugAvailability(
		userId: string,
		projectId: string,
		slug: string,
	): Promise<SlugAvailabilityResponse> {
		await this.deploymentsRepository.getOwnedProject(userId, projectId);

		if (isReservedSlug(slug)) {
			return { available: false, reason: "reserved", slug };
		}

		const taken = await this.deploymentsRepository.isSlugTakenByOther(
			slug,
			projectId,
		);

		return { available: !taken, reason: taken ? "taken" : null, slug };
	}

	async publish(
		userId: string,
		projectId: string,
		body: PublishDeploymentBody,
	): Promise<PublishDeploymentResponse> {
		const project = await this.deploymentsRepository.getOwnedProject(
			userId,
			projectId,
		);

		await this.deploymentsRepository.healStalePending(projectId);

		const version = await this.resolveVersion(projectId, body.versionId);
		const html = await this.readDraftHtml(version.r2Key);

		const deployment = await this.runPublishPipeline({
			html,
			project,
			requestedSlug: body.slug,
			versionId: version.id,
		});
		this.analyticsService.capture(userId, "site_published", {
			projectId: project.id,
		});

		return {
			current: await this.buildCurrent(projectId),
			deployment: mapDeployment(deployment),
		};
	}

	async rollback(
		userId: string,
		projectId: string,
		body: RollbackDeploymentBody,
	): Promise<PublishDeploymentResponse> {
		const project = await this.deploymentsRepository.getOwnedProject(
			userId,
			projectId,
		);

		await this.deploymentsRepository.healStalePending(projectId);

		const target = await this.deploymentsRepository.findById(
			body.deploymentId,
			projectId,
		);

		if (!target) {
			throw new NotFoundException("Deployment not found");
		}

		// Prefer the archived published bytes (pixels already injected). Fall
		// back to re-building from the version's draft bytes when the archive
		// predates archiving or was cleaned up.
		let html = await getPageHtml(
			publishedArchiveKey(projectId, target.id),
		).catch(() => null);
		let alreadyInjected = true;

		if (html === null) {
			const version = await this.deploymentsRepository.findVersionForProject(
				target.versionId,
				projectId,
			);

			if (!version) {
				throw new NoVersionToPublishError();
			}

			html = await this.readDraftHtml(version.r2Key);
			alreadyInjected = false;
		}

		const deployment = await this.runPublishPipeline({
			html,
			project,
			requestedSlug: undefined,
			skipInjection: alreadyInjected,
			versionId: target.versionId,
		});

		return {
			current: await this.buildCurrent(projectId),
			deployment: mapDeployment(deployment),
		};
	}

	async unpublish(
		userId: string,
		projectId: string,
	): Promise<DeploymentCurrentResponse> {
		await this.deploymentsRepository.getOwnedProject(userId, projectId);

		const unpublished =
			await this.deploymentsRepository.unpublishActive(projectId);

		if (unpublished) {
			// Order matters for serving: dropping current.html takes every host
			// (subdomain AND custom domains) to the not-published page at once.
			if (isR2Configured()) {
				await deleteObject(publishedCurrentKey(projectId));
			}

			await this.deleteSlugPointer(unpublished.slug);
		}

		return { current: await this.buildCurrent(projectId) };
	}

	/*
	 * The shared pipeline behind publish and rollback:
	 * validate slug → pending row → R2 writes → KV pointer → promote.
	 * Every throw after the pending row exists marks it failed first.
	 */
	private async runPublishPipeline(input: {
		html: string;
		project: OwnedProjectRow;
		requestedSlug: string | undefined;
		skipInjection?: boolean;
		versionId: string;
	}): Promise<DeploymentRow> {
		if (!isR2Configured()) {
			throw new PublishUnavailableError();
		}

		const active = await this.deploymentsRepository.findActiveByProject(
			input.project.id,
		);
		const slug = await this.resolveSlug(
			input.project,
			input.requestedSlug,
			active?.slug ?? null,
		);

		const pending = await this.deploymentsRepository.insertPending({
			projectId: input.project.id,
			slug,
			versionId: input.versionId,
		});

		try {
			const withPixels = input.skipInjection
				? input.html
				: injectPixels(input.html, {
						metaPixelId: input.project.metaPixelId,
						tiktokPixelId: input.project.tiktokPixelId,
					});

			// Unconditional on purpose: the injector is idempotent (id marker),
			// so fresh publishes gain the lead-capture runtime and rollbacks of
			// pre-runtime archives gain it too instead of losing lead capture.
			const published = injectLeadsRuntime(withPixels, {
				captureUrl: buildLeadsCaptureUrl(
					env.BETTER_AUTH_URL,
					input.project.publicFormId,
				),
			});

			assertNoEditorArtifacts(published);

			// Archive first, then flip the live bytes: the mutable key must
			// never point at a publish that has no immutable audit copy.
			await putPageHtml(
				publishedArchiveKey(input.project.id, pending.id),
				published,
			);
			await putPageHtml(publishedCurrentKey(input.project.id), published);

			// Always write the host pointer: it is one idempotent PUT, and
			// skipping it when the slug "already exists" strands sites whose
			// first publish ran before Cloudflare credentials were configured.
			await this.writeSlugPointer(input.project.id, slug);

			const promoted = await this.deploymentsRepository.promoteToActive(
				pending.id,
				input.project.id,
			);

			// The old slug's host must stop resolving once the new one is live.
			if (active && active.slug !== slug) {
				await this.deleteSlugPointer(active.slug);
			}

			return promoted;
		} catch (error) {
			await this.deploymentsRepository.markFailed(
				pending.id,
				failureSummary(error),
			);

			if (error instanceof SlugTakenError) {
				throw error;
			}

			this.logger.error(
				`Publish failed for project ${input.project.id}`,
				error instanceof Error ? (error.stack ?? error.message) : String(error),
			);

			throw error instanceof PublishFailedError
				? error
				: new PublishFailedError(failureSummary(error));
		}
	}

	private async resolveVersion(
		projectId: string,
		versionId: string | undefined,
	): Promise<{ id: string; r2Key: string }> {
		const version = versionId
			? await this.deploymentsRepository.findVersionForProject(
					versionId,
					projectId,
				)
			: await this.deploymentsRepository.findDraftVersion(projectId);

		if (!version) {
			throw new NoVersionToPublishError();
		}

		return version;
	}

	private async readDraftHtml(r2Key: string): Promise<string> {
		if (!isR2Configured()) {
			throw new PublishUnavailableError();
		}

		const html = await getPageHtml(r2Key);

		if (html === null) {
			throw new NoVersionToPublishError();
		}

		return html;
	}

	private async resolveSlug(
		project: OwnedProjectRow,
		requestedSlug: string | undefined,
		liveSlug: string | null,
	): Promise<string> {
		// Explicit choice > current live slug > generated from the name.
		if (requestedSlug) {
			this.assertSlugUsable(requestedSlug, project.id, { strict: true });

			if (
				await this.deploymentsRepository.isSlugTakenByOther(
					requestedSlug,
					project.id,
				)
			) {
				throw new SlugTakenError(requestedSlug);
			}

			return requestedSlug;
		}

		if (liveSlug) {
			return liveSlug;
		}

		let candidate = slugifyProjectName(project.name);

		if (isReservedSlug(candidate)) {
			candidate = withRandomSuffix(candidate);
		}

		for (let attempt = 0; attempt < SLUG_SUFFIX_ATTEMPTS; attempt += 1) {
			if (
				!(await this.deploymentsRepository.isSlugTakenByOther(
					candidate,
					project.id,
				))
			) {
				return candidate;
			}

			candidate = withRandomSuffix(slugifyProjectName(project.name));
		}

		throw new SlugTakenError(candidate);
	}

	private assertSlugUsable(
		slug: string,
		_projectId: string,
		_options: { strict: boolean },
	): void {
		// The contract regex already ran in the validation pipe, but publish
		// can also be reached with a stored slug — re-validate defensively.
		if (!deploymentSlugSchema.safeParse(slug).success) {
			throw new SlugReservedError(slug);
		}

		if (isReservedSlug(slug)) {
			throw new SlugReservedError(slug);
		}
	}

	private slugHost(slug: string): string {
		return `${slug}.${env.SITES_DOMAIN}`;
	}

	// KV degrades to log-and-skip without Cloudflare credentials (mirrors the
	// isR2Configured contract) so local dev still publishes.
	private async writeSlugPointer(
		projectId: string,
		slug: string,
	): Promise<void> {
		if (!this.domainRoutingService.isKvConfigured()) {
			this.logger.warn(
				`Cloudflare KV not configured; skipping slug pointer for ${this.slugHost(slug)}`,
			);
			return;
		}

		await this.domainRoutingService.putHostPointer(this.slugHost(slug), {
			projectId,
			slug,
			source: "slug",
		});
	}

	private async deleteSlugPointer(slug: string): Promise<void> {
		if (!this.domainRoutingService.isKvConfigured()) {
			this.logger.warn(
				`Cloudflare KV not configured; skipping slug pointer delete for ${this.slugHost(slug)}`,
			);
			return;
		}

		await this.domainRoutingService.deleteHostPointer(this.slugHost(slug));
	}

	private async buildCurrent(projectId: string): Promise<DeploymentCurrent> {
		const rows = await this.deploymentsRepository.findCurrent(projectId);
		const uiState = deriveUiState(rows);
		const active = rows.active;
		const visible = rows.newestPending ?? active ?? rows.newest;

		return {
			activeDeploymentId: active?.id ?? null,
			error: uiState === "failed" ? (rows.newest?.error ?? null) : null,
			liveUrl: active ? `https://${this.slugHost(active.slug)}` : null,
			pendingVersionId: rows.pendingVersionId,
			publishedAt: active?.updatedAt.toISOString() ?? null,
			publishedVersionId: active?.versionId ?? null,
			slug: visible?.slug ?? null,
			uiState,
		};
	}
}

function deriveUiState(rows: {
	active: DeploymentRow | null;
	newest: DeploymentRow | null;
	newestPending: DeploymentRow | null;
}): DeploymentUiState {
	if (rows.newestPending) {
		return "publishing";
	}

	if (rows.active) {
		return "published";
	}

	if (rows.newest?.status === "failed") {
		return "failed";
	}

	return "draft";
}

function mapDeployment(row: DeploymentRow): Deployment {
	return {
		createdAt: row.createdAt.toISOString(),
		error: row.error,
		id: row.id,
		projectId: row.projectId,
		slug: row.slug,
		status: row.status,
		updatedAt: row.updatedAt.toISOString(),
		versionId: row.versionId,
	};
}

function failureSummary(error: unknown): string {
	if (error instanceof Error && error.message) {
		return error.message.replace(/\s+/g, " ").slice(0, 180);
	}

	return "Publishing failed";
}

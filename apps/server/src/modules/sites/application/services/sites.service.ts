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
 * not exist. If the live-byte flip succeeds but promotion fails, best-effort
 * compensation restores the previous live state because R2, KV, and Postgres
 * share no transaction.
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
	publicAssetKeyFromUrl,
	publishedArchiveKey,
	publishedCurrentKey,
	putPageHtml,
	r2ObjectExists,
} from "../../../../infrastructure/storage/r2";
import { DomainRoutingService } from "../../../domains/infrastructure/cloudflare/domain-routing.service";
import {
	buildLeadsCaptureUrl,
	injectLeadsRuntime,
} from "../../../leads/runtime/inject-leads-runtime";
import { inlineKnownCdnScripts } from "../../../pages/domain/inline-cdn-scripts";
import { optimizeFontLoading } from "../../../pages/domain/optimize-font-loading";
import {
	emitResponsiveImages,
	optimizeImageMarkup,
} from "../../../pages/domain/optimize-image-markup";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import {
	collectAssetUrls,
	verifyAssetUrls,
} from "../../domain/asset-validator";
import { injectWanditBadge } from "../../domain/badge-injector";
import {
	NoVersionToPublishError,
	PublishFailedError,
	PublishUnavailableError,
	SiteAssetsUnreachableError,
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

/**
 * Does this candidate rendition URL point at an object that really exists?
 * emitResponsiveImages speaks in public URLs (that is what it writes into the
 * HTML), R2 speaks in object keys, so the boundary is translated here. A URL
 * outside our bucket, or any storage error, answers false — the srcset then
 * simply omits that width.
 */
async function publishedVariantExists(url: string): Promise<boolean> {
	const key = publicAssetKeyFromUrl(url);

	return key === null ? false : r2ObjectExists(key);
}

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
		scope: ProjectScope,
		projectId: string,
	): Promise<DeploymentCurrentResponse> {
		await this.deploymentsRepository.getAccessibleProject(scope, projectId);
		await this.deploymentsRepository.healStalePending(projectId);

		return { current: await this.buildCurrent(projectId) };
	}

	async list(
		scope: ProjectScope,
		projectId: string,
	): Promise<ListDeploymentsResponse> {
		await this.deploymentsRepository.getAccessibleProject(scope, projectId);

		const rows = await this.deploymentsRepository.listByProject(projectId);

		return { deployments: rows.map(mapDeployment) };
	}

	async slugAvailability(
		scope: ProjectScope,
		projectId: string,
		slug: string,
	): Promise<SlugAvailabilityResponse> {
		await this.deploymentsRepository.getAccessibleProject(scope, projectId);

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
		scope: ProjectScope,
		projectId: string,
		body: PublishDeploymentBody,
	): Promise<PublishDeploymentResponse> {
		const project = await this.deploymentsRepository.getAccessibleProject(
			scope,
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
		this.analyticsService.capture(scope.userId, "site_published", {
			projectId: project.id,
		});

		return {
			current: await this.buildCurrent(projectId),
			deployment: mapDeployment(deployment),
		};
	}

	async rollback(
		scope: ProjectScope,
		projectId: string,
		body: RollbackDeploymentBody,
	): Promise<PublishDeploymentResponse> {
		const project = await this.deploymentsRepository.getAccessibleProject(
			scope,
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

		// Prefer the archived published bytes as input. Fall back to the version's
		// draft bytes when the archive predates archiving or was cleaned up; the
		// deterministic publish transforms run again in either case.
		let html = await getPageHtml(
			publishedArchiveKey(projectId, target.id),
		).catch(() => null);

		if (html === null) {
			const version = await this.deploymentsRepository.findVersionForProject(
				target.versionId,
				projectId,
			);

			if (!version) {
				throw new NoVersionToPublishError();
			}

			html = await this.readDraftHtml(version.r2Key);
		}

		const deployment = await this.runPublishPipeline({
			html,
			project,
			requestedSlug: undefined,
			versionId: target.versionId,
		});

		return {
			current: await this.buildCurrent(projectId),
			deployment: mapDeployment(deployment),
		};
	}

	async unpublish(
		scope: ProjectScope,
		projectId: string,
	): Promise<DeploymentCurrentResponse> {
		await this.deploymentsRepository.getAccessibleProject(scope, projectId);

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
	 * Once the live flip starts, storage compensation has priority over the
	 * best-effort failed-row write; neither cleanup path may replace the
	 * original publish error.
	 */
	private async runPublishPipeline(input: {
		html: string;
		project: OwnedProjectRow;
		requestedSlug: string | undefined;
		versionId: string;
	}): Promise<DeploymentRow> {
		if (!isR2Configured()) {
			throw new PublishUnavailableError();
		}
		const kvConfigured = this.assertKvAvailableForPublish();

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
		let liveBytesFlipped = false;
		let promoted: DeploymentRow | null = null;

		try {
			// Unconditional and idempotent like the injectors below: drafts and
			// archives generated before CDN inlining existed still publish
			// self-contained instead of depending on jsdelivr at view time.
			const inlined = inlineKnownCdnScripts(input.html);

			// Same reasoning, one layer up the page: the font stylesheet link
			// is hoisted above the inline <style> so the browser discovers the
			// render-blocking font request immediately. Pure and idempotent, so
			// already-optimized drafts and replayed archives pass through
			// unchanged and old sites are fixed by their next publish.
			const withFonts = optimizeFontLoading(inlined);

			// One prioritized LCP image, everything else lazy, then a srcset
			// built only from renditions this pass just verified in R2. Both
			// run BEFORE the preflight below, so every URL they emit is one of
			// the URLs the preflight probes. Both are idempotent: the markup
			// pass returns the identical string once the attributes already
			// read that way, and the srcset pass skips any <img> that already
			// carries one, so replayed archives keep their bytes.
			const withImages = await emitResponsiveImages(
				optimizeImageMarkup(withFonts),
				{ exists: publishedVariantExists },
			);

			// Restamp recognized canonical blocks from current project state; an
			// unrecognized carrier leaves this injector's input untouched.
			const withPixels = injectPixels(withImages, {
				metaPixelId: input.project.metaPixelId,
				tiktokPixelId: input.project.tiktokPixelId,
			});

			// Restamp recognized canonical blocks from current project state; an
			// unrecognized carrier leaves this injector's input untouched.
			const withRuntime = injectLeadsRuntime(withPixels, {
				captureUrl: buildLeadsCaptureUrl(
					env.BETTER_AUTH_URL,
					input.project.publicFormId,
				),
				deploymentId: pending.id,
			});

			// Restamp recognized canonical blocks from current project state; an
			// unrecognized carrier leaves this injector's input untouched. The hide
			// toggle only counts for an entitled owner.
			const published = injectWanditBadge(withRuntime, {
				hide: input.project.hideWanditBadge && input.project.ownerIsEntitled,
			});

			assertNoEditorArtifacts(published);

			await this.assertPublishedAssetsReachable(published);

			// Archive first, then flip the live bytes: the mutable key must
			// never point at a publish that has no immutable audit copy.
			await putPageHtml(
				publishedArchiveKey(input.project.id, pending.id),
				published,
			);
			await putPageHtml(publishedCurrentKey(input.project.id), published);
			liveBytesFlipped = true;

			// Always write the host pointer: it is one idempotent PUT, and
			// skipping it when the slug "already exists" strands sites whose
			// first publish ran before Cloudflare credentials were configured.
			await this.writeSlugPointer(input.project.id, slug, kvConfigured);

			promoted = await this.deploymentsRepository.promoteToActive(
				pending.id,
				input.project.id,
			);

			// The old slug's host must stop resolving once the new one is live.
			if (active && active.slug !== slug) {
				await this.deleteSlugPointer(active.slug);
			}

			return promoted;
		} catch (error) {
			if (liveBytesFlipped && promoted === null) {
				try {
					await this.restorePreviousLiveState({
						activeSnapshot: active,
						projectId: input.project.id,
						slug,
					});
				} catch (restoreError) {
					this.logger.error(
						`Publish compensation failed for project ${input.project.id}`,
						restoreError instanceof Error
							? (restoreError.stack ?? restoreError.message)
							: String(restoreError),
					);
				}
			}

			// Failure-state persistence is best-effort: an outage leaves this row
			// pending for healStalePending to reclaim on the next project read.
			try {
				await this.deploymentsRepository.markFailed(
					pending.id,
					failureSummary(error),
				);
			} catch (markFailedError) {
				this.logger.error(
					`Publish failure state could not be recorded for deployment ${pending.id}`,
					markFailedError instanceof Error
						? (markFailedError.stack ?? markFailedError.message)
						: String(markFailedError),
				);
			}

			if (
				error instanceof SlugTakenError ||
				error instanceof SiteAssetsUnreachableError
			) {
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

	// Preflight the final bytes before any R2 write: a publish whose media can
	// never load must fail loudly instead of going live half-blank. Only
	// structural failures block (relative URLs, 404/410/403); transient probe
	// trouble is logged and the publish proceeds.
	private async assertPublishedAssetsReachable(html: string): Promise<void> {
		// Validated envs hold the transformed boolean; SKIP_ENV_VALIDATION envs
		// (tests, local scripts) hold the raw string. Both spell "off" the same.
		if (String(env.SITE_PUBLISH_ASSET_CHECK) === "false") {
			return;
		}

		const urls = collectAssetUrls(html);

		if (urls.length === 0) {
			return;
		}

		const { broken, warnings } = await verifyAssetUrls(urls);

		for (const url of warnings) {
			this.logger.warn(`Publish asset check could not verify ${url}`);
		}

		if (broken.length > 0) {
			throw new SiteAssetsUnreachableError(broken);
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

	private assertKvAvailableForPublish(): boolean {
		const configured = this.domainRoutingService.isKvConfigured();

		if (!configured && !env.ALLOW_PUBLISH_WITHOUT_KV) {
			throw new PublishUnavailableError(
				"Cloudflare KV is not configured; publishing cannot make the site reachable",
			);
		}

		return configured;
	}

	// The explicit override is for API-only local development, where no edge
	// worker consumes the pointer. Hosted environments must fail the preflight.
	private async writeSlugPointer(
		projectId: string,
		slug: string,
		kvConfigured: boolean,
	): Promise<void> {
		if (!kvConfigured) {
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

	// Live bytes must never reference a deployment row that was not promoted.
	// Compensation is best-effort because R2, KV, and Postgres share no
	// transaction; when an old archive is missing, keeping the new bytes is
	// safer than taking an existing site down.
	private async restorePreviousLiveState(input: {
		activeSnapshot: DeploymentRow | null;
		projectId: string;
		slug: string;
	}): Promise<void> {
		const active = await this.deploymentsRepository
			.findActiveByProject(input.projectId)
			.catch(() => {
				// Promotion failure commonly means Postgres is unavailable; the stale
				// pre-pipeline snapshot still permits a best-effort restore.
				return input.activeSnapshot;
			});

		if (active === null) {
			await deleteObject(publishedCurrentKey(input.projectId));
			await this.deleteSlugPointer(input.slug);

			return;
		}

		const previousHtml = await getPageHtml(
			publishedArchiveKey(input.projectId, active.id),
		).catch(() => null);

		if (previousHtml === null) {
			this.logger.error(
				`Publish compensation could not read archived bytes for deployment ${active.id}`,
			);
		} else {
			await putPageHtml(publishedCurrentKey(input.projectId), previousHtml);
		}

		if (input.slug !== active.slug) {
			await this.deleteSlugPointer(input.slug);
		}
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

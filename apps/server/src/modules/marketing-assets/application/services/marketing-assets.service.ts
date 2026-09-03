import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
	AiErrorData,
	AiErrorKind,
	MarketingAsset,
	MarketingAssetHtmlResponse,
	MarketingAssetsResponse,
} from "@wandit/contracts";
import { aiErrorKindSchema, aiErrorSourceSchema } from "@wandit/contracts";
import { and, eq, lt } from "@wandit/db";
import { marketingAssets } from "@wandit/db/schema/marketing-assets";
import { env } from "@wandit/env/server";
import { AnalyticsService } from "../../../../infrastructure/analytics/analytics.service";
import {
	captureGenerationCompleted,
	captureGenerationFailed,
} from "../../../../infrastructure/analytics/generation-events";
import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import {
	getObjectContentType,
	getPageHtml,
	marketingAssetKey,
} from "../../../../infrastructure/storage/r2";
import {
	captureAiError,
	classifyAiError,
	type NormalizedAiError,
	sanitizeProviderText,
	toClientAiError,
} from "../../../ai-errors/domain";
import { MeteringService } from "../../../metering/application/services/metering.service";
import {
	meteringSubjectFrom,
	type ProjectScope,
} from "../../../projects/domain/project-scope";
import {
	type MarketingAssetRow,
	MarketingAssetsRepository,
} from "../../infrastructure/persistence/marketing-assets.repository";
import { createMarketingAssetBilling } from "./marketing-asset-billing";

const GENERATION_STALE_AFTER_MS = 15 * 60 * 1_000;
const QUEUED_STALE_AFTER_MS = 30 * 60 * 1_000;
const STALE_GENERATION_ERROR =
	"The marketing asset did not finish. Please ask for it again.";
const STALE_QUEUED_ERROR =
	"The marketing request did not reach the background generator. Please try again.";

@Injectable()
export class MarketingAssetsService {
	constructor(
		@Inject(MarketingAssetsRepository)
		private readonly marketingAssetsRepository: MarketingAssetsRepository,
		@Inject(MeteringService)
		private readonly meteringService: MeteringService,
		// Direct database access ONLY for read-time stale settlement (the
		// repository stays the tool-facing surface; these guarded updates are a
		// polling concern of this service).
		@Inject(DATABASE) private readonly db: Database,
		@Inject(AnalyticsService)
		private readonly analyticsService: AnalyticsService,
	) {}

	async list(
		scope: ProjectScope,
		projectId: string,
	): Promise<MarketingAssetsResponse> {
		let rows = await this.marketingAssetsRepository.listForProject(
			scope,
			projectId,
		);

		if (await this.settleStaleRows(rows, scope)) {
			rows = await this.marketingAssetsRepository.listForProject(
				scope,
				projectId,
			);
		}

		// All failure paths converge here. Refunding on read is idempotent, so a
		// transient refund failure is retried by the next poll without ever
		// granting the same reservation twice.
		for (const row of rows) {
			if (row.status === "failed") {
				await createMarketingAssetBilling({
					isBillingDisabled: () => env.GENERATION_BILLING_MODE === "off",
					meteringService: this.meteringService,
				}).refund(meteringSubjectFrom(scope), row.id);
			}
		}

		return { assets: rows.map(mapAssetRow) };
	}

	async html(
		scope: ProjectScope,
		assetId: string,
	): Promise<MarketingAssetHtmlResponse> {
		const document = await this.loadFinishedDocument(scope, assetId);

		return { html: document.html };
	}

	async download(
		scope: ProjectScope,
		assetId: string,
	): Promise<{ fileName: string; html: string }> {
		const document = await this.loadFinishedDocument(scope, assetId);

		return {
			fileName: `${sanitizeFileName(document.row.name)}.html`,
			html: document.html,
		};
	}

	private async loadFinishedDocument(
		scope: ProjectScope,
		assetId: string,
	): Promise<{ html: string; row: MarketingAssetRow }> {
		const row = await this.marketingAssetsRepository.findAccessibleAsset(
			scope,
			assetId,
		);

		if (row?.status !== "succeeded" || !row.r2Key) {
			throw new NotFoundException();
		}

		const html = await getPageHtml(row.r2Key);

		if (html === null) {
			throw new NotFoundException();
		}

		return { html, row };
	}

	/**
	 * Read-time settlement for rows the background task could not close
	 * (crashed worker, expired delivery). Returns true when any row changed so
	 * the caller re-reads.
	 */
	private async settleStaleRows(
		rows: MarketingAssetRow[],
		scope: ProjectScope,
	): Promise<boolean> {
		const userId = scope.userId;
		const queuedCutoff = new Date(Date.now() - QUEUED_STALE_AFTER_MS);
		const generatingCutoff = new Date(Date.now() - GENERATION_STALE_AFTER_MS);
		let changed = false;

		for (const row of rows) {
			if (row.status === "queued" && row.createdAt < queuedCutoff) {
				const failure = internalMarketingFailure(STALE_QUEUED_ERROR);
				const [failed] = await this.db
					.update(marketingAssets)
					.set({
						completedAt: new Date(),
						error: STALE_QUEUED_ERROR,
						...failureColumns(failure),
						status: "failed",
					})
					.where(
						and(
							eq(marketingAssets.id, row.id),
							eq(marketingAssets.status, "queued"),
							lt(marketingAssets.createdAt, queuedCutoff),
						),
					)
					.returning({ projectId: marketingAssets.projectId });

				if (failed) {
					await this.persistStaleFailureEventId(
						row,
						failure,
						STALE_QUEUED_ERROR,
						scope.userId,
					);
					captureGenerationFailed(
						this.analyticsService,
						userId,
						"marketing_asset",
						failed.projectId,
						row.id,
						"stale_queued",
					);
				}
				changed = true;
				continue;
			}

			if (row.status !== "generating") {
				continue;
			}

			const startedBefore = await this.db
				.select({ startedAt: marketingAssets.startedAt })
				.from(marketingAssets)
				.where(eq(marketingAssets.id, row.id))
				.limit(1);
			const startedAt = startedBefore.at(0)?.startedAt ?? null;

			if (startedAt === null || startedAt >= generatingCutoff) {
				continue;
			}

			// The document upload is deterministic — a lost DB write is
			// recoverable from storage before declaring failure.
			const key = marketingAssetKey(row.projectId, row.id);
			const stored = await getObjectContentType(key);

			if (stored) {
				// The deterministic document is proof that generation completed.
				// Settle an existing hold before exposing the recovered asset.
				await createMarketingAssetBilling({
					isBillingDisabled: () => env.GENERATION_BILLING_MODE === "off",
					meteringService: this.meteringService,
				}).settleExisting(meteringSubjectFrom(scope), row.id);

				const [completed] = await this.db
					.update(marketingAssets)
					.set({
						completedAt: new Date(),
						error: null,
						failureKind: null,
						failureProvider: null,
						failureProviderMessage: null,
						failureRequestId: null,
						failureSource: null,
						r2Key: key,
						sentryEventId: null,
						status: "succeeded",
					})
					.where(
						and(
							eq(marketingAssets.id, row.id),
							eq(marketingAssets.status, "generating"),
						),
					)
					.returning({ projectId: marketingAssets.projectId });

				if (completed) {
					captureGenerationCompleted(
						this.analyticsService,
						userId,
						"marketing_asset",
						completed.projectId,
						row.id,
					);
				}
			} else {
				const failure = internalMarketingFailure(STALE_GENERATION_ERROR);
				const [failed] = await this.db
					.update(marketingAssets)
					.set({
						completedAt: new Date(),
						error: STALE_GENERATION_ERROR,
						...failureColumns(failure),
						status: "failed",
					})
					.where(
						and(
							eq(marketingAssets.id, row.id),
							eq(marketingAssets.status, "generating"),
							lt(marketingAssets.startedAt, generatingCutoff),
						),
					)
					.returning({ projectId: marketingAssets.projectId });

				if (failed) {
					await this.persistStaleFailureEventId(
						row,
						failure,
						STALE_GENERATION_ERROR,
						scope.userId,
					);
					captureGenerationFailed(
						this.analyticsService,
						userId,
						"marketing_asset",
						failed.projectId,
						row.id,
						"stale_generation",
					);
				}
			}

			changed = true;
		}

		return changed;
	}

	private async persistStaleFailureEventId(
		row: Pick<MarketingAssetRow, "id" | "projectId">,
		failure: NormalizedAiError,
		message: string,
		userId: string,
	): Promise<void> {
		const sentryEventId = captureAiError(new Error(message), failure, {
			generationId: row.id,
			projectId: row.projectId,
			refunded: true,
			route: "none",
			surface: "marketing",
			userId,
		});

		if (!sentryEventId) {
			return;
		}

		await this.db
			.update(marketingAssets)
			.set({ sentryEventId })
			.where(
				and(
					eq(marketingAssets.id, row.id),
					eq(marketingAssets.status, "failed"),
				),
			);
	}
}

function mapAssetRow(row: MarketingAssetRow): MarketingAsset {
	return {
		assetType: row.assetType,
		completedAt: row.completedAt?.toISOString() ?? null,
		createdAt: row.createdAt.toISOString(),
		error: row.error,
		failure: mapFailure(row),
		id: row.id,
		name: row.name,
		status: row.status,
	};
}

function internalMarketingFailure(message: string): NormalizedAiError {
	const error = new Error(message);
	const failure = classifyAiError(error, {
		refunded: true,
		route: "none",
		surface: "marketing",
	});

	if (!failure) {
		throw new Error("Marketing stale failure classification returned null");
	}

	return failure;
}

function failureColumns(failure: NormalizedAiError): {
	failureKind: string;
	failureProvider: string | null;
	failureProviderMessage: string | null;
	failureRequestId: string | null;
	failureSource: string;
	sentryEventId: string | null;
} {
	return {
		failureKind: failure.kind,
		failureProvider: failure.provider,
		failureProviderMessage: failure.providerMessage,
		failureRequestId: failure.requestId,
		failureSource: failure.source,
		sentryEventId: failure.sentryEventId,
	};
}

function mapFailure(row: MarketingAssetRow): AiErrorData | null {
	const kind = aiErrorKindSchema.safeParse(row.failureKind);
	if (!kind.success) return null;
	const source = aiErrorSourceSchema.safeParse(row.failureSource);
	const route =
		source.success && source.data === "openrouter"
			? "openrouter"
			: source.success &&
					(source.data === "gateway" || source.data.startsWith("provider:"))
				? "vercel"
				: "none";
	const base = classifyAiError(new Error("Persisted marketing failure"), {
		...(row.failureProvider
			? { model: `${row.failureProvider}/persisted` }
			: {}),
		route,
		surface: "marketing",
	});

	if (!base) return null;

	base.kind = kind.data;
	base.source = source.success ? source.data : "unknown";
	base.provider = row.failureProvider;
	base.providerLabel = persistedProviderLabel(row.failureProvider);
	base.providerMessage = row.failureProviderMessage
		? sanitizeProviderText(row.failureProviderMessage, {
				kind: kind.data,
				provider: row.failureProvider,
			})
		: null;
	base.requestId = row.failureRequestId?.slice(0, 80) ?? null;
	base.retryable = persistedRetryable(kind.data);
	base.terminal = true;
	base.refunded = base.source === "ours" ? null : row.failureRequestId === null;
	base.moderationStage = null;

	return toClientAiError(base);
}

function persistedProviderLabel(provider: string | null): string | null {
	if (!provider) return null;
	const known: Record<string, string> = {
		anthropic: "Anthropic",
		bedrock: "Amazon Bedrock",
		bytedance: "Seedance",
		google: "Google",
		higgsfield: "Higgsfield",
		klingai: "Kling",
		openai: "OpenAI",
		openrouter: "OpenRouter",
		xai: "xAI",
	};
	return (
		known[provider] ??
		provider
			.split(/[-_]+/u)
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(" ")
	).slice(0, 40);
}

function persistedRetryable(kind: AiErrorKind): boolean {
	return (
		kind === "internal" ||
		kind === "rate_limited" ||
		kind === "capacity" ||
		kind === "provider_error" ||
		kind === "timeout" ||
		kind === "network" ||
		kind === "connector_unreachable" ||
		kind === "unknown"
	);
}

function sanitizeFileName(name: string): string {
	const slug = name
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);

	return slug.length > 0 ? slug : "marketing-asset";
}

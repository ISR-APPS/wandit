import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
	MarketingAsset,
	MarketingAssetHtmlResponse,
	MarketingAssetsResponse,
} from "@wandit/contracts";
import { and, eq, lt } from "@wandit/db";
import { marketingAssets } from "@wandit/db/schema/marketing-assets";
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
import { GenerationPolicyService } from "../../../generation/application/services/generation-policy.service";
import {
	type MarketingAssetRow,
	MarketingAssetsRepository,
} from "../../infrastructure/persistence/marketing-assets.repository";

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
		@Inject(GenerationPolicyService)
		private readonly generationPolicyService: GenerationPolicyService,
		// Direct database access ONLY for read-time stale settlement (the
		// repository stays the tool-facing surface; these guarded updates are a
		// polling concern of this service).
		@Inject(DATABASE) private readonly db: Database,
		@Inject(AnalyticsService)
		private readonly analyticsService: AnalyticsService,
	) {}

	async list(
		userId: string,
		projectId: string,
	): Promise<MarketingAssetsResponse> {
		let rows = await this.marketingAssetsRepository.listOwnedByProject(
			userId,
			projectId,
		);

		if (await this.settleStaleRows(rows, userId)) {
			rows = await this.marketingAssetsRepository.listOwnedByProject(
				userId,
				projectId,
			);
		}

		// All failure paths converge here. Refunding on read is idempotent, so a
		// transient refund failure is retried by the next poll without ever
		// granting the same reservation twice.
		for (const row of rows) {
			if (row.status === "failed") {
				await this.generationPolicyService.refundGenerationReservation(
					userId,
					row.id,
				);
			}
		}

		return { assets: rows.map(mapAssetRow) };
	}

	async html(
		userId: string,
		assetId: string,
	): Promise<MarketingAssetHtmlResponse> {
		const document = await this.loadFinishedDocument(userId, assetId);

		return { html: document.html };
	}

	async download(
		userId: string,
		assetId: string,
	): Promise<{ fileName: string; html: string }> {
		const document = await this.loadFinishedDocument(userId, assetId);

		return {
			fileName: `${sanitizeFileName(document.row.name)}.html`,
			html: document.html,
		};
	}

	private async loadFinishedDocument(
		userId: string,
		assetId: string,
	): Promise<{ html: string; row: MarketingAssetRow }> {
		const row = await this.marketingAssetsRepository.findOwnedAsset(
			userId,
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
		userId: string,
	): Promise<boolean> {
		const queuedCutoff = new Date(Date.now() - QUEUED_STALE_AFTER_MS);
		const generatingCutoff = new Date(Date.now() - GENERATION_STALE_AFTER_MS);
		let changed = false;

		for (const row of rows) {
			if (row.status === "queued" && row.createdAt < queuedCutoff) {
				const [failed] = await this.db
					.update(marketingAssets)
					.set({
						completedAt: new Date(),
						error: STALE_QUEUED_ERROR,
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
				const [completed] = await this.db
					.update(marketingAssets)
					.set({
						completedAt: new Date(),
						error: null,
						r2Key: key,
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
				const [failed] = await this.db
					.update(marketingAssets)
					.set({
						completedAt: new Date(),
						error: STALE_GENERATION_ERROR,
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
}

function mapAssetRow(row: MarketingAssetRow): MarketingAsset {
	return {
		assetType: row.assetType,
		completedAt: row.completedAt?.toISOString() ?? null,
		createdAt: row.createdAt.toISOString(),
		error: row.error,
		id: row.id,
		name: row.name,
		status: row.status,
	};
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

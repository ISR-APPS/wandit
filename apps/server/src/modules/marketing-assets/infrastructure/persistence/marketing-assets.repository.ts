/**
 * Persistence for durable marketing asset generations.
 *
 * The chat tool creates a queued row before handing work to Trigger.dev. The
 * Trigger task advances that same row through generating -> succeeded/failed,
 * and the Marketing tab reads it through an ownership-checked project join.
 */
import { Inject, Injectable } from "@nestjs/common";
import type {
	MarketingAssetStatus,
	MarketingAssetType,
} from "@wandit/contracts";
import { and, desc, eq, isNull } from "@wandit/db";
import { marketingAssets } from "@wandit/db/schema/marketing-assets";
import { projects } from "@wandit/db/schema/projects";
import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type MarketingAssetRow = {
	assetType: MarketingAssetType;
	completedAt: Date | null;
	createdAt: Date;
	error: string | null;
	id: string;
	name: string;
	projectId: string;
	r2Key: string | null;
	status: MarketingAssetStatus;
};

const ASSET_COLUMNS = {
	assetType: marketingAssets.assetType,
	completedAt: marketingAssets.completedAt,
	createdAt: marketingAssets.createdAt,
	error: marketingAssets.error,
	id: marketingAssets.id,
	name: marketingAssets.name,
	projectId: marketingAssets.projectId,
	r2Key: marketingAssets.r2Key,
	status: marketingAssets.status,
} as const;

@Injectable()
export class MarketingAssetsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async insertAsset(input: {
		assetType: MarketingAssetType;
		brief: string;
		chatId: string;
		name: string;
		projectId: string;
		requestKey: string;
		spec?: Record<string, unknown>;
	}): Promise<{
		created: boolean;
		id: string;
		status: MarketingAssetRow["status"];
	}> {
		const [row] = await this.db
			.insert(marketingAssets)
			.values(input)
			.onConflictDoNothing({
				target: [marketingAssets.chatId, marketingAssets.requestKey],
			})
			.returning({ id: marketingAssets.id, status: marketingAssets.status });

		if (row) {
			return { ...row, created: true };
		}

		const [existing] = await this.db
			.select({ id: marketingAssets.id, status: marketingAssets.status })
			.from(marketingAssets)
			.where(
				and(
					eq(marketingAssets.chatId, input.chatId),
					eq(marketingAssets.requestKey, input.requestKey),
				),
			)
			.limit(1);

		if (!existing) {
			throw new Error(
				"Marketing asset idempotency conflict did not return an asset",
			);
		}

		return { ...existing, created: false };
	}

	async markAssetTriggered(
		assetId: string,
		triggerRunId: string,
	): Promise<void> {
		await this.db
			.update(marketingAssets)
			.set({ triggerRunId })
			.where(eq(marketingAssets.id, assetId));
	}

	async markAssetFailed(assetId: string, error: string): Promise<boolean> {
		const [row] = await this.db
			.update(marketingAssets)
			.set({
				completedAt: new Date(),
				error: error.slice(0, 2_000),
				status: "failed",
			})
			.where(
				and(
					eq(marketingAssets.id, assetId),
					eq(marketingAssets.status, "queued"),
				),
			)
			.returning({ id: marketingAssets.id });

		return Boolean(row);
	}

	async findOwnedAsset(
		userId: string,
		assetId: string,
	): Promise<MarketingAssetRow | null> {
		const [row] = await this.db
			.select(ASSET_COLUMNS)
			.from(marketingAssets)
			.innerJoin(projects, eq(projects.id, marketingAssets.projectId))
			.where(
				and(
					eq(marketingAssets.id, assetId),
					eq(projects.userId, userId),
					isNull(projects.deletedAt),
				),
			)
			.limit(1);

		return row ?? null;
	}

	async listOwnedByProject(
		userId: string,
		projectId: string,
	): Promise<MarketingAssetRow[]> {
		return this.db
			.select(ASSET_COLUMNS)
			.from(marketingAssets)
			.innerJoin(projects, eq(projects.id, marketingAssets.projectId))
			.where(
				and(
					eq(marketingAssets.projectId, projectId),
					eq(projects.userId, userId),
					isNull(projects.deletedAt),
				),
			)
			.orderBy(desc(marketingAssets.createdAt));
	}
}

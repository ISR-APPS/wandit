import { Inject, Injectable } from "@nestjs/common";
import { eq, sql } from "@wandit/db";
import { modelPrices } from "@wandit/db/schema/credits";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import type { PersistedModelPrice } from "../../domain/model-pricing";

export type ModelPriceRow = typeof modelPrices.$inferSelect;

@Injectable()
export class ModelPricesRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async findByModelId(modelId: string): Promise<ModelPriceRow | null> {
		const [row] = await this.db
			.select()
			.from(modelPrices)
			.where(eq(modelPrices.modelId, modelId))
			.limit(1);

		return row ?? null;
	}

	async upsertMany(prices: readonly PersistedModelPrice[]): Promise<number> {
		if (prices.length === 0) {
			return 0;
		}

		const rows = await this.db
			.insert(modelPrices)
			.values([...prices])
			.onConflictDoUpdate({
				set: {
					cacheReadUsdMicrosPerMTok: sql`excluded.cache_read_usd_micros_per_mtok`,
					cacheWriteUsdMicrosPerMTok: sql`excluded.cache_write_usd_micros_per_mtok`,
					imageUsdMicros: sql`excluded.image_usd_micros`,
					inputUsdMicrosPerMTok: sql`excluded.input_usd_micros_per_mtok`,
					modelType: sql`excluded.model_type`,
					outputUsdMicrosPerMTok: sql`excluded.output_usd_micros_per_mtok`,
					provider: sql`excluded.provider`,
					raw: sql`excluded.raw`,
					refreshedAt: sql`excluded.refreshed_at`,
				},
				target: modelPrices.modelId,
			})
			.returning({ modelId: modelPrices.modelId });

		return rows.length;
	}
}

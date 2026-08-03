import { Inject, Injectable } from "@nestjs/common";
import type { PatchProductSettingsBody } from "@wandit/contracts";
import { and, eq, sql } from "@wandit/db";
import { productSettings } from "@wandit/db/schema/billing";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import {
	DEFAULT_PRODUCT_SETTINGS,
	PRODUCT_SETTINGS_ID,
} from "../../domain/product-settings.constants";

export type ProductSettingsRow = typeof productSettings.$inferSelect;

export type ProductSettingsChanges = Omit<PatchProductSettingsBody, "version">;

export type UpdateProductSettingsInput = {
	changes: ProductSettingsChanges;
	expectedVersion: number;
	updatedByUserId: string;
};

@Injectable()
export class ProductSettingsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async getOrCreate(): Promise<ProductSettingsRow> {
		const [inserted] = await this.db
			.insert(productSettings)
			.values(DEFAULT_PRODUCT_SETTINGS)
			.onConflictDoNothing({ target: productSettings.id })
			.returning();

		if (inserted) {
			return inserted;
		}

		const [existing] = await this.db
			.select()
			.from(productSettings)
			.where(eq(productSettings.id, PRODUCT_SETTINGS_ID))
			.limit(1);

		if (!existing) {
			throw new Error("Product settings singleton could not be loaded");
		}

		return existing;
	}

	async updateIfVersion(
		input: UpdateProductSettingsInput,
	): Promise<ProductSettingsRow | null> {
		await this.getOrCreate();

		const [updated] = await this.db
			.update(productSettings)
			.set({
				...input.changes,
				updatedAt: new Date(),
				updatedByUserId: input.updatedByUserId,
				version: sql`${productSettings.version} + 1`,
			})
			.where(
				and(
					eq(productSettings.id, PRODUCT_SETTINGS_ID),
					eq(productSettings.version, input.expectedVersion),
				),
			)
			.returning();

		return updated ?? null;
	}
}

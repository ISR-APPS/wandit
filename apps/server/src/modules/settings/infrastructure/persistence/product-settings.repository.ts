/**
 * Reads and writes the one `product_settings` row through Drizzle. ProductSettingsService calls it.
 * The admin PATCH that turns the Starter pass switch on also runs the pass backfill of StarterPassesRepository.
 */
import { Inject, Injectable } from "@nestjs/common";
import type { PatchProductSettingsBody } from "@wandit/contracts";
import { and, eq, sql } from "@wandit/db";
import { productSettings, signupGrantOutbox } from "@wandit/db/schema/billing";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import { StarterPassesRepository } from "../../../billing/infrastructure/persistence/starter-passes.repository";
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

/** The result of a PATCH that matched the expected version. */
export type ProductSettingsUpdate = {
	row: ProductSettingsRow;
	/** New `grandfathered` passes. Above 0 only when this PATCH turned the Starter pass switch on. */
	grandfatheredPasses: number;
};

@Injectable()
export class ProductSettingsRepository {
	constructor(
		@Inject(DATABASE) private readonly db: Database,
		@Inject(StarterPassesRepository)
		private readonly starterPasses: Pick<
			StarterPassesRepository,
			"grandfatherAll"
		>,
	) {}

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

	/** Users who signed up while the signup grant was off. */
	async countSkippedSignupGrants(): Promise<number> {
		const [row] = await this.db
			.select({ count: sql<number>`count(*)::int`.mapWith(Number) })
			.from(signupGrantOutbox)
			.where(eq(signupGrantOutbox.status, "skipped"));

		return row?.count ?? 0;
	}

	/**
	 * Applies the PATCH when the row still has `expectedVersion`, else returns null.
	 * When the Starter pass switch goes from off to on, the pass backfill runs in the same transaction.
	 */
	async updateIfVersion(
		input: UpdateProductSettingsInput,
	): Promise<ProductSettingsUpdate | null> {
		await this.getOrCreate();

		return this.db.transaction(async (tx) => {
			// The version check makes this read exact: a write between the two statements
			// changes the version, and the update below then matches no row.
			const [before] = await tx
				.select({ starterPassRequired: productSettings.starterPassRequired })
				.from(productSettings)
				.where(eq(productSettings.id, PRODUCT_SETTINGS_ID))
				.limit(1);
			const [updated] = await tx
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

			if (!updated) {
				return null;
			}

			// Product rule: the gate never blocks a pool that already paid. The backfill and the
			// switch commit together, so no paying pool is refused between the two.
			const grandfatheredPasses =
				before?.starterPassRequired === false && updated.starterPassRequired
					? await this.starterPasses.grandfatherAll(tx)
					: 0;

			return { grandfatheredPasses, row: updated };
		});
	}
}

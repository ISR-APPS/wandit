import { Inject, Injectable, Logger } from "@nestjs/common";
import type {
	PatchProductSettingsBody,
	ProductSettings,
	ProductSettingsUpdateResponse,
	PublicSettings,
} from "@wandit/contracts";

import { SettingsVersionConflictError } from "../../domain/errors/settings-version-conflict.error";
import { PRODUCT_SETTINGS_CACHE_TTL_MS } from "../../domain/product-settings.constants";
import { mapProductSettingsRow } from "../../infrastructure/mappers/product-settings.mapper";
import { ProductSettingsRepository } from "../../infrastructure/persistence/product-settings.repository";

type CachedProductSettings = {
	expiresAt: number;
	settings: ProductSettings;
};

@Injectable()
export class ProductSettingsService {
	private readonly logger = new Logger(ProductSettingsService.name);
	private cached: CachedProductSettings | null = null;
	private cacheGeneration = 0;

	constructor(
		@Inject(ProductSettingsRepository)
		private readonly settingsRepository: ProductSettingsRepository,
	) {}

	async get(): Promise<ProductSettings> {
		const now = Date.now();

		if (this.cached && now < this.cached.expiresAt) {
			return this.cached.settings;
		}

		const readGeneration = this.cacheGeneration;
		const settings = mapProductSettingsRow(
			await this.settingsRepository.getOrCreate(),
		);

		if (readGeneration === this.cacheGeneration) {
			this.cached = {
				expiresAt: now + PRODUCT_SETTINGS_CACHE_TTL_MS,
				settings,
			};
		}

		return settings;
	}

	async getPublic(): Promise<PublicSettings> {
		const settings = await this.get();

		return {
			emailAuthEnabled: settings.emailAuthEnabled,
			manualGraceDays: settings.manualGraceDays,
			manualPaymentsEnabled: settings.manualPaymentsEnabled,
			organizationsEnabled: settings.organizationsEnabled,
			paidSubscriptionsEnabled: settings.paidSubscriptionsEnabled,
			signupGrantEnabled: settings.signupGrantEnabled,
			topupsEnabled: settings.topupsEnabled,
		};
	}

	async update(
		input: PatchProductSettingsBody,
		updatedByUserId: string,
	): Promise<ProductSettingsUpdateResponse> {
		const { version: expectedVersion, ...changes } = input;
		const updated = await this.settingsRepository.updateIfVersion({
			changes,
			expectedVersion,
			updatedByUserId,
		});

		this.invalidate();

		if (!updated) {
			throw new SettingsVersionConflictError();
		}

		this.logger.log(
			`product_settings_updated admin=${updatedByUserId} version=${updated.version} fields=${Object.keys(changes).sort().join(",")}`,
		);

		const settings = mapProductSettingsRow(updated);

		// Decide-enable flow: a PATCH that turns the grant on reports the users
		// skipped while it was off. The backfill is a separate, explicit action.
		if (changes.signupGrantEnabled === true) {
			const signupGrantSkippedCount =
				await this.settingsRepository.countSkippedSignupGrants();
			this.logger.log(
				`signup_grant_enabled admin=${updatedByUserId} skipped_rows=${signupGrantSkippedCount}`,
			);

			return { ...settings, signupGrantSkippedCount };
		}

		return settings;
	}

	invalidate(): void {
		this.cached = null;
		this.cacheGeneration += 1;
	}
}

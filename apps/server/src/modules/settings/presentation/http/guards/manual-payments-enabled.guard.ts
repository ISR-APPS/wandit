import { type CanActivate, Inject, Injectable } from "@nestjs/common";

import { ProductSettingsService } from "../../../application/services/product-settings.service";
import { ManualPaymentsDisabledError } from "../../../domain/errors/manual-payments-disabled.error";

@Injectable()
export class ManualPaymentsEnabledGuard implements CanActivate {
	constructor(
		@Inject(ProductSettingsService)
		private readonly settingsService: ProductSettingsService,
	) {}

	async canActivate(): Promise<boolean> {
		const settings = await this.settingsService.get();

		if (!settings.manualPaymentsEnabled) {
			throw new ManualPaymentsDisabledError();
		}

		return true;
	}
}

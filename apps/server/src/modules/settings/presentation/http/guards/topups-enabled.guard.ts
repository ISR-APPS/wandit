import { type CanActivate, Inject, Injectable } from "@nestjs/common";

import { ProductSettingsService } from "../../../application/services/product-settings.service";
import { TopupsDisabledError } from "../../../domain/errors/topups-disabled.error";

@Injectable()
export class TopupsEnabledGuard implements CanActivate {
	constructor(
		@Inject(ProductSettingsService)
		private readonly settingsService: ProductSettingsService,
	) {}

	async canActivate(): Promise<boolean> {
		const settings = await this.settingsService.get();

		if (!settings.topupsEnabled) {
			throw new TopupsDisabledError();
		}

		return true;
	}
}

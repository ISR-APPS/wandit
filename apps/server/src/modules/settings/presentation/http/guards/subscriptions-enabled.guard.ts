import { type CanActivate, Inject, Injectable } from "@nestjs/common";

import { ProductSettingsService } from "../../../application/services/product-settings.service";
import { SubscriptionsDisabledError } from "../../../domain/errors/subscriptions-disabled.error";

@Injectable()
export class SubscriptionsEnabledGuard implements CanActivate {
	constructor(
		@Inject(ProductSettingsService)
		private readonly settingsService: ProductSettingsService,
	) {}

	async canActivate(): Promise<boolean> {
		const settings = await this.settingsService.get();

		if (!settings.paidSubscriptionsEnabled) {
			throw new SubscriptionsDisabledError();
		}

		return true;
	}
}

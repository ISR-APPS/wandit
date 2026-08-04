import { type CanActivate, Inject, Injectable } from "@nestjs/common";

import { ProductSettingsService } from "../../../application/services/product-settings.service";
import { OrganizationsDisabledError } from "../../../domain/errors/organizations-disabled.error";

// Admission control only (org-scoped billing checkout/change, workspace
// creation). Webhooks and fulfillment always honor paid org money regardless.
@Injectable()
export class OrganizationsEnabledGuard implements CanActivate {
	constructor(
		@Inject(ProductSettingsService)
		private readonly settingsService: ProductSettingsService,
	) {}

	async canActivate(): Promise<boolean> {
		const settings = await this.settingsService.get();

		if (!settings.organizationsEnabled) {
			throw new OrganizationsDisabledError();
		}

		return true;
	}
}

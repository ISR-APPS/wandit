import { Controller, Get, Inject } from "@nestjs/common";
import type { PublicSettings } from "@wandit/contracts";

import { Public } from "../../../../auth";
import { ProductSettingsService } from "../../../application/services/product-settings.service";

@Public()
@Controller("v1/settings/public")
export class PublicSettingsController {
	constructor(
		@Inject(ProductSettingsService)
		private readonly settingsService: ProductSettingsService,
	) {}

	@Get()
	get(): Promise<PublicSettings> {
		return this.settingsService.getPublic();
	}
}

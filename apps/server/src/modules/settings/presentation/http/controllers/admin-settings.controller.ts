import { Body, Controller, Get, Inject, Patch } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type PatchProductSettingsBody,
	type ProductSettings,
	patchProductSettingsBodySchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { AdminOnly } from "../../../../admin/presentation/http/decorators/admin-only.decorator";
import { CurrentUser } from "../../../../auth";
import { ProductSettingsService } from "../../../application/services/product-settings.service";

@Controller("v1/admin/settings")
@AdminOnly()
export class AdminSettingsController {
	constructor(
		@Inject(ProductSettingsService)
		private readonly settingsService: ProductSettingsService,
	) {}

	@Get()
	get(): Promise<ProductSettings> {
		return this.settingsService.get();
	}

	@Patch()
	update(
		@Body(new ZodValidationPipe(patchProductSettingsBodySchema))
		body: PatchProductSettingsBody,
		@CurrentUser() admin: AuthUser,
	): Promise<ProductSettings> {
		return this.settingsService.update(body, admin.id);
	}
}

import { Body, Controller, Get, Inject, Patch } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	centiCreditsToCredits,
	creditsToCentiCredits,
	type PatchProductSettingsBody,
	type ProductSettings,
	type ProductSettingsUpdateResponse,
	patchProductSettingsBodySchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { AdminOnly } from "../../../../admin/presentation/http/decorators/admin-only.decorator";
import { AdminPermission } from "../../../../admin/presentation/http/decorators/admin-permission.decorator";
import { CurrentUser } from "../../../../auth";
import { ProductSettingsService } from "../../../application/services/product-settings.service";

@Controller("v1/admin/settings")
@AdminOnly()
@AdminPermission({ settings: ["read"] })
export class AdminSettingsController {
	constructor(
		@Inject(ProductSettingsService)
		private readonly settingsService: ProductSettingsService,
	) {}

	@Get()
	async get(): Promise<ProductSettings> {
		return toApiProductSettings(await this.settingsService.get());
	}

	@Patch()
	@AdminPermission({ settings: ["manage"] })
	async update(
		@Body(new ZodValidationPipe(patchProductSettingsBodySchema))
		body: PatchProductSettingsBody,
		@CurrentUser() admin: AuthUser,
	): Promise<ProductSettingsUpdateResponse> {
		// The admin API speaks whole credits and decimal DZD. Storage uses integer
		// hundredths for both values — convert exactly once here.
		const changes: PatchProductSettingsBody = {
			...body,
			...(body.dzdPerUsdRate === undefined
				? {}
				: { dzdPerUsdRate: Math.round(body.dzdPerUsdRate * 100) }),
			...(body.signupGrantCredits === undefined
				? {}
				: {
						signupGrantCredits: creditsToCentiCredits(body.signupGrantCredits),
					}),
		};

		return toApiProductSettings(
			await this.settingsService.update(changes, admin.id),
		);
	}
}

// Internal settings carry signupGrantCredits and dzdPerUsdRate in integer
// hundredths; the admin API contract exposes their display units.
function toApiProductSettings<T extends ProductSettings>(settings: T): T {
	return {
		...settings,
		dzdPerUsdRate: settings.dzdPerUsdRate / 100,
		signupGrantCredits: centiCreditsToCredits(settings.signupGrantCredits),
	};
}

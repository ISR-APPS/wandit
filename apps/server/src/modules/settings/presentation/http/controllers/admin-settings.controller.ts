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
	async get(): Promise<ProductSettings> {
		return toApiProductSettings(await this.settingsService.get());
	}

	@Patch()
	async update(
		@Body(new ZodValidationPipe(patchProductSettingsBodySchema))
		body: PatchProductSettingsBody,
		@CurrentUser() admin: AuthUser,
	): Promise<ProductSettingsUpdateResponse> {
		// The admin API speaks whole credits; storage (and the signup-grant
		// path that reads it) is centi-credits — convert exactly once here.
		const changes: PatchProductSettingsBody =
			body.signupGrantCredits === undefined
				? body
				: {
						...body,
						signupGrantCredits: creditsToCentiCredits(body.signupGrantCredits),
					};

		return toApiProductSettings(
			await this.settingsService.update(changes, admin.id),
		);
	}
}

// Internal settings carry signupGrantCredits in centi-credits; the admin API
// contract exposes whole credits.
function toApiProductSettings<T extends ProductSettings>(settings: T): T {
	return {
		...settings,
		signupGrantCredits: centiCreditsToCredits(settings.signupGrantCredits),
	};
}

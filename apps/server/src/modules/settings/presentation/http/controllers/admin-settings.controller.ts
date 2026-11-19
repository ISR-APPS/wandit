/**
 * Admin routes of the product settings: GET and PATCH /api/v1/admin/settings.
 * The admin settings page calls them. They call ProductSettingsService.
 * The routes speak whole credits and decimal DZD. The service holds integer hundredths.
 */
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

/** Admin-only. Each credit amount is whole credits in the body and in the answer. */
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
			...(body.userReferralFriendCredits === undefined
				? {}
				: {
						userReferralFriendCredits: creditsToCentiCredits(
							body.userReferralFriendCredits,
						),
					}),
			...(body.userReferralActivationCredits === undefined
				? {}
				: {
						userReferralActivationCredits: creditsToCentiCredits(
							body.userReferralActivationCredits,
						),
					}),
			...(body.userReferralPaidCredits === undefined
				? {}
				: {
						userReferralPaidCredits: creditsToCentiCredits(
							body.userReferralPaidCredits,
						),
					}),
		};

		return toApiProductSettings(
			await this.settingsService.update(changes, admin.id),
		);
	}
}

// Internal settings hold signupGrantCredits, the three userReferral*Credits,
// and dzdPerUsdRate in integer hundredths. The admin API contract shows them
// in display units: whole credits and decimal DZD.
function toApiProductSettings<T extends ProductSettings>(settings: T): T {
	return {
		...settings,
		dzdPerUsdRate: settings.dzdPerUsdRate / 100,
		signupGrantCredits: centiCreditsToCredits(settings.signupGrantCredits),
		userReferralActivationCredits: centiCreditsToCredits(
			settings.userReferralActivationCredits,
		),
		userReferralFriendCredits: centiCreditsToCredits(
			settings.userReferralFriendCredits,
		),
		userReferralPaidCredits: centiCreditsToCredits(
			settings.userReferralPaidCredits,
		),
	};
}

import { Body, Controller, Inject, Post } from "@nestjs/common";
import {
	type BackfillSignupGrantsBody,
	type BackfillSignupGrantsResponse,
	backfillSignupGrantsBodySchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { AdminOnly } from "../../../../admin/presentation/http/decorators/admin-only.decorator";
import { AdminPermission } from "../../../../admin/presentation/http/decorators/admin-permission.decorator";
import { SignupGrantOutboxService } from "../../../application/services/signup-grant-outbox.service";

@Controller("v1/admin/settings/signup-grants")
@AdminOnly()
@AdminPermission({ settings: ["manage"] })
export class AdminSignupGrantsController {
	constructor(
		@Inject(SignupGrantOutboxService)
		private readonly outboxService: SignupGrantOutboxService,
	) {}

	/** Explicit, admin-driven backfill of users who signed up while the grant was off. */
	@Post("backfill")
	backfill(
		@Body(new ZodValidationPipe(backfillSignupGrantsBodySchema))
		body: BackfillSignupGrantsBody,
	): Promise<BackfillSignupGrantsResponse> {
		return this.outboxService.backfillSkipped({
			createdAfter: body.createdAfter ? new Date(body.createdAfter) : undefined,
			dryRun: body.dryRun,
		});
	}
}

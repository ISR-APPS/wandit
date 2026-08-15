import {
	Body,
	Controller,
	Delete,
	Get,
	Inject,
	Param,
	Patch,
	Post,
	Query,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type AcademyGuide,
	type AdminListAcademyGuidesQuery,
	type AdminListAcademyGuidesResponse,
	adminListAcademyGuidesQuerySchema,
	type CreateAcademyGuideInput,
	createAcademyGuideInputSchema,
	type DeleteAcademyGuideResponse,
	type UpdateAcademyGuideInput,
	updateAcademyGuideInputSchema,
	uuidSchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { AdminOnly } from "../../../../admin/presentation/http/decorators/admin-only.decorator";
import { CurrentUser } from "../../../../auth";
import { AcademyService } from "../../../application/services/academy.service";

@Controller("v1/admin/academy/guides")
@AdminOnly()
export class AcademyAdminController {
	constructor(
		@Inject(AcademyService)
		private readonly service: AcademyService,
	) {}

	@Get()
	list(
		@Query(new ZodValidationPipe(adminListAcademyGuidesQuerySchema))
		query: AdminListAcademyGuidesQuery,
	): Promise<AdminListAcademyGuidesResponse> {
		return this.service.adminList(query);
	}

	@Get(":guideId")
	guide(
		@Param("guideId", new ZodValidationPipe(uuidSchema)) guideId: string,
	): Promise<AcademyGuide> {
		return this.service.adminGetById(guideId);
	}

	@Post()
	create(
		@Body(new ZodValidationPipe(createAcademyGuideInputSchema))
		body: CreateAcademyGuideInput,
		@CurrentUser() admin: AuthUser,
	): Promise<AcademyGuide> {
		return this.service.create(body, admin.id);
	}

	@Patch(":guideId")
	update(
		@Param("guideId", new ZodValidationPipe(uuidSchema)) guideId: string,
		@Body(new ZodValidationPipe(updateAcademyGuideInputSchema))
		body: UpdateAcademyGuideInput,
	): Promise<AcademyGuide> {
		return this.service.update(guideId, body);
	}

	@Delete(":guideId")
	delete(
		@Param("guideId", new ZodValidationPipe(uuidSchema)) guideId: string,
	): Promise<DeleteAcademyGuideResponse> {
		return this.service.delete(guideId);
	}
}

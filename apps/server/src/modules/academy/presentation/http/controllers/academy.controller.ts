import { Controller, Get, Inject, Param } from "@nestjs/common";
import {
	type AcademyGuide,
	type ListAcademyGuidesResponse,
	uuidSchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { AcademyService } from "../../../application/services/academy.service";

@Controller("v1/academy/guides")
export class AcademyController {
	constructor(
		@Inject(AcademyService)
		private readonly service: AcademyService,
	) {}

	@Get()
	listPublished(): Promise<ListAcademyGuidesResponse> {
		return this.service.listPublished();
	}

	@Get(":guideId")
	guide(
		@Param("guideId", new ZodValidationPipe(uuidSchema)) guideId: string,
	): Promise<AcademyGuide> {
		return this.service.getPublishedById(guideId);
	}
}

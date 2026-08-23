import {
	Body,
	Controller,
	Get,
	Inject,
	Param,
	Patch,
	Post,
	Query,
} from "@nestjs/common";
import {
	type CreateStoryLinkInput,
	createStoryLinkInputSchema,
	type ListStoryLinksQuery,
	listStoryLinksQuerySchema,
	type StoryLink,
	type StoryLinksResponse,
	type UpdateStoryLinkInput,
	updateStoryLinkInputSchema,
	uuidSchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { AdminOnly } from "../../../../admin/presentation/http/decorators/admin-only.decorator";
import { AdminPermission } from "../../../../admin/presentation/http/decorators/admin-permission.decorator";
import { StoryLinkAdminService } from "../../../application/services/story-link-admin.service";

@Controller("v1/admin/story-links")
@AdminOnly()
@AdminPermission({ links: ["read"] })
export class StoryLinkAdminController {
	constructor(
		@Inject(StoryLinkAdminService)
		private readonly service: StoryLinkAdminService,
	) {}

	@Get()
	list(
		@Query(new ZodValidationPipe(listStoryLinksQuerySchema))
		query: ListStoryLinksQuery,
	): Promise<StoryLinksResponse> {
		return this.service.list(query);
	}

	@Post()
	@AdminPermission({ links: ["manage"] })
	create(
		@Body(new ZodValidationPipe(createStoryLinkInputSchema))
		body: CreateStoryLinkInput,
	): Promise<StoryLink> {
		return this.service.create(body);
	}

	@Patch(":id")
	@AdminPermission({ links: ["manage"] })
	update(
		@Param("id", new ZodValidationPipe(uuidSchema)) id: string,
		@Body(new ZodValidationPipe(updateStoryLinkInputSchema))
		body: UpdateStoryLinkInput,
	): Promise<StoryLink> {
		return this.service.update(id, body);
	}
}

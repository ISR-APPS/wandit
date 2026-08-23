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
	type StoryLinkSignupsQuery,
	type StoryLinkSignupsResponse,
	type StoryLinkStatsQuery,
	type StoryLinkStatsResponse,
	type StoryLinksResponse,
	storyLinkSignupsQuerySchema,
	storyLinkStatsQuerySchema,
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

	@Get(":storyLinkId/stats")
	// Method metadata overrides the class default. The stats payload carries
	// revenue figures, so it needs the same analytics:read the revenue
	// dashboard requires — links:read alone (support role) must not see it.
	@AdminPermission({ analytics: ["read"], links: ["read"] })
	stats(
		@Param("storyLinkId", new ZodValidationPipe(uuidSchema))
		storyLinkId: string,
		@Query(new ZodValidationPipe(storyLinkStatsQuerySchema))
		query: StoryLinkStatsQuery,
	): Promise<StoryLinkStatsResponse> {
		return this.service.stats(storyLinkId, query);
	}

	@Get(":storyLinkId/signups")
	// The list exposes user emails and paid state, so it requires both the
	// analytics and links read permissions.
	@AdminPermission({ analytics: ["read"], links: ["read"] })
	signups(
		@Param("storyLinkId", new ZodValidationPipe(uuidSchema))
		storyLinkId: string,
		@Query(new ZodValidationPipe(storyLinkSignupsQuerySchema))
		query: StoryLinkSignupsQuery,
	): Promise<StoryLinkSignupsResponse> {
		return this.service.signups(storyLinkId, query);
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

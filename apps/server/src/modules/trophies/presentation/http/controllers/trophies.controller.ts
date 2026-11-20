/**
 * HTTP routes of the trophies, under `/api/v1/trophies`. The web feature `trophies` calls them.
 * Both routes need a signed-in user. They call TrophiesService.
 */
import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Inject,
	Post,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type MarkTrophiesSeenBody,
	markTrophiesSeenBodySchema,
	type TrophiesResponse,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { TrophiesService } from "../../../application/services/trophies.service";

// The routes are user-scoped and ignore the workspace header: a trophy belongs to the caller, not to a workspace.
@Controller("v1/trophies")
export class TrophiesController {
	constructor(
		@Inject(TrophiesService)
		private readonly trophiesService: TrophiesService,
	) {}

	/** Every trophy of the catalog with the progress of the caller. It also stores the new unlocks. */
	@Get()
	list(@CurrentUser() user: AuthUser): Promise<TrophiesResponse> {
		return this.trophiesService.list(user.id, new Date());
	}

	/** Marks the given new trophies of the caller as seen. An id that is not stored or already seen is a no-op. */
	@Post("seen")
	@HttpCode(HttpStatus.NO_CONTENT)
	markSeen(
		@Body(new ZodValidationPipe(markTrophiesSeenBodySchema))
		body: MarkTrophiesSeenBody,
		@CurrentUser() user: AuthUser,
	): Promise<void> {
		return this.trophiesService.markSeen(user.id, body.trophyIds);
	}
}

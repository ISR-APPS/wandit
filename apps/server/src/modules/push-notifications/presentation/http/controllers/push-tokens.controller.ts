import { Body, Controller, Delete, Inject, Post } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type RegisterPushTokenBody,
	type RegisterPushTokenResponse,
	registerPushTokenBodySchema,
	type UnregisterPushTokenBody,
	type UnregisterPushTokenResponse,
	unregisterPushTokenBodySchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { PushTokensRepository } from "../../../infrastructure/persistence/push-tokens.repository";

@Controller("v1/push-tokens")
export class PushTokensController {
	constructor(
		@Inject(PushTokensRepository)
		private readonly pushTokensRepository: PushTokensRepository,
	) {}

	@Post()
	async register(
		@Body(new ZodValidationPipe(registerPushTokenBodySchema))
		body: RegisterPushTokenBody,
		@CurrentUser() user: AuthUser,
	): Promise<RegisterPushTokenResponse> {
		await this.pushTokensRepository.register(user.id, body);

		return { ok: true };
	}

	@Delete()
	async unregister(
		@Body(new ZodValidationPipe(unregisterPushTokenBodySchema))
		body: UnregisterPushTokenBody,
		@CurrentUser() user: AuthUser,
	): Promise<UnregisterPushTokenResponse> {
		await this.pushTokensRepository.unregister(user.id, body.token);

		return { ok: true };
	}
}

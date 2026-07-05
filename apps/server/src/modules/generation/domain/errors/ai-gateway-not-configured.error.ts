import { InternalServerErrorException } from "@nestjs/common";

export const AI_GATEWAY_NOT_CONFIGURED_ERROR_CODE = "AI_GATEWAY_NOT_CONFIGURED";

export class AiGatewayNotConfiguredError extends InternalServerErrorException {
	constructor() {
		super({
			code: AI_GATEWAY_NOT_CONFIGURED_ERROR_CODE,
			message: "AI_GATEWAY_API_KEY is required for this operation",
		});
	}
}

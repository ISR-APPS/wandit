/**
 * Error used when the server is missing the AI Gateway API key.
 *
 * This is a server setup problem, not bad user input.
 */
// Nest HTTP exceptions automatically become HTTP responses.
import { InternalServerErrorException } from "@nestjs/common";

// Stable code for frontend/tests/logs.
export const AI_GATEWAY_NOT_CONFIGURED_ERROR_CODE = "AI_GATEWAY_NOT_CONFIGURED";

// HTTP 500 because the server config is wrong.
export class AiGatewayNotConfiguredError extends InternalServerErrorException {
	constructor() {
		// Name the missing env var so it is easy to fix.
		super({
			code: AI_GATEWAY_NOT_CONFIGURED_ERROR_CODE,
			message: "AI_GATEWAY_API_KEY is required for this operation",
		});
	}
}

/**
 * Error used when a chat is already generating.
 *
 * We allow only one running assistant response per chat.
 */
// Nest HTTP exceptions automatically become HTTP responses.
import { ConflictException } from "@nestjs/common";

// Stable code for frontend/tests.
export const GENERATION_ACTIVE_ERROR_CODE = "GENERATION_ACTIVE";

// HTTP 409 means the request is valid, but current state blocks it.
export class GenerationActiveError extends ConflictException {
	constructor() {
		// Keep the body predictable so frontend can check `code`.
		super({
			code: GENERATION_ACTIVE_ERROR_CODE,
			message: "A generation is already active for this chat",
		});
	}
}

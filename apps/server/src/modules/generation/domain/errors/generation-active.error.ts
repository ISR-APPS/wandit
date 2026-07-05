import { ConflictException } from "@nestjs/common";

export const GENERATION_ACTIVE_ERROR_CODE = "GENERATION_ACTIVE";

export class GenerationActiveError extends ConflictException {
	constructor() {
		super({
			code: GENERATION_ACTIVE_ERROR_CODE,
			message: "A generation is already active for this chat",
		});
	}
}

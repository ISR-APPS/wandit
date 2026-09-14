/**
 * 409 for a turn create that lost the race for the project's active slot.
 * `BuilderTurnsRepository.create` throws it when Postgres rejects the
 * second active row (`builder_turns_active_project_uq`); the API exception
 * filter renders it as the `BUILDER_TURN_ACTIVE` envelope.
 */
import { ConflictException } from "@nestjs/common";

/** Stable machine code the client reads to show the "a turn is running" copy. */
export const BUILDER_TURN_ACTIVE_ERROR_CODE = "BUILDER_TURN_ACTIVE";

/** Thrown when a second active turn tries to enter one project. */
export class BuilderTurnActiveError extends ConflictException {
	constructor() {
		super({
			code: BUILDER_TURN_ACTIVE_ERROR_CODE,
			message: "A builder turn is already active for this project",
		});
	}
}

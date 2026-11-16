/**
 * 409 for a turn create while another conversation holds the project.
 * A conversation holds the project while it has an unfinished turn.
 * The turn create of `turns.service.ts` throws it. The API exception
 * filter renders it as the `BUILDER_OTHER_CHAT_BUSY` envelope.
 */
import { ConflictException } from "@nestjs/common";

/** Stable machine code the client reads to show the "another conversation works" copy. */
export const BUILDER_OTHER_CHAT_BUSY_ERROR_CODE = "BUILDER_OTHER_CHAT_BUSY";

/** Thrown when a conversation sends a turn while another conversation holds the project. */
export class BuilderOtherChatBusyError extends ConflictException {
	constructor(
		/** Id of the `chats` row that holds the project. The web offers to open it. */
		chatId: string,
	) {
		super({
			code: BUILDER_OTHER_CHAT_BUSY_ERROR_CODE,
			details: { chatId },
			message: "Another conversation is working on this project",
		});
	}
}

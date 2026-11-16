/**
 * The chat note of a project that started from a starter template.
 * `AppProjectsService` and the `apply-starter-template` runtime store it with
 * `ChatsRepository.insertUiMessagesIfAbsent`. The web renders its data part
 * in the UI language.
 */
import type {
	StarterTemplateNoteData,
	starterTemplateNoteDataPartSchema,
} from "@wandit/contracts";
import type { z } from "zod";

/**
 * The assistant message that holds the note. The id comes from the project,
 * so a repeated write is a no-op and one project has one note.
 */
export function starterTemplateNoteMessage(
	projectId: string,
	data: StarterTemplateNoteData,
) {
	return {
		id: `starter-template-${projectId}`,
		parts: [
			{
				data,
				id: "starter-template",
				type: "data-starter-template",
			} satisfies z.infer<typeof starterTemplateNoteDataPartSchema>,
		],
		role: "assistant" as const,
	};
}

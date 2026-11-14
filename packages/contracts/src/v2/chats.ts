/**
 * Shared contract for the conversations of a V2 project.
 * One project holds several conversations. Each one is a row of `chats`.
 * The API answers them on `appBuilderRoutes.chats`. The web shows the list.
 */
import { z } from "zod";
import { isoDateTimeSchema, uuidSchema } from "../v1/shared/primitives";

/** One conversation of a V2 project, as the conversation list shows it. */
export const projectChatSchema = z.object({
	// Id of the row in `chats`.
	id: uuidSchema,
	// The text of the first user message, cut to 80 characters. Null while the conversation has no message.
	title: z.string().nullable(),
	createdAt: isoDateTimeSchema,
	// Date of the newest message. Null while the conversation has no message.
	lastMessageAt: isoDateTimeSchema.nullable(),
});

/** One conversation row. The web shows "New conversation" for a null `title`. */
export type ProjectChat = z.infer<typeof projectChatSchema>;

/**
 * Answer of `GET /api/v2/projects/:projectId/chats`. The most recent
 * activity comes first: `lastMessageAt`, or `createdAt` when it is null.
 */
export const projectChatListResponseSchema = z.object({
	chats: z.array(projectChatSchema),
});

/** All conversations of one project. Every project member reads the same list. */
export type ProjectChatListResponse = z.infer<
	typeof projectChatListResponseSchema
>;

/** Answer of `POST /api/v2/projects/:projectId/chats`: the new, empty conversation. */
export const createProjectChatResponseSchema = z.object({
	chat: projectChatSchema,
});

/** The new conversation. Its `title` and `lastMessageAt` are null until the first message. */
export type CreateProjectChatResponse = z.infer<
	typeof createProjectChatResponseSchema
>;

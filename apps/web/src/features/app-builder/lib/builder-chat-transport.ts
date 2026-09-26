/**
 * Browser transport of the V2 turn stream. `createBuilderChatTransport`
 * builds one DefaultChatTransport bound to the turn routes of a project;
 * use-builder-chat.ts calls it. `hydrateTurnMessages` rebuilds AI SDK
 * messages from the chat rows the turn task writes. No React here.
 */

import {
	appBuilderRoutes,
	type ChatMessage,
	type CreateTurnRequest,
	turnApprovalAnswerSchema,
	turnAssistantMessageMetadataSchema,
	turnDataPartSchema,
	turnQuestionAnswerSchema,
} from "@wandit/contracts";
import { DefaultChatTransport, type FileUIPart, type TextUIPart } from "ai";
import { z } from "zod";

import { createStatusPreservingChatFetch } from "@/features/workspace";
import { workspaceScopeHeaders } from "@/features/workspaces";
import { getServerUrl } from "@/lib/server-url";
import type { TurnMessage } from "../api/dto";

/**
 * Extras `sendMessage` passes through `options.body`: an answer to a
 * `data-approval` card, the answers to the open `data-question` cards, or
 * the paid model this turn runs on. The SDK types the field loosely, so the
 * schema keeps the boundary typed.
 */
const turnSendOptionsSchema = z.object({
	approval: turnApprovalAnswerSchema.optional(),
	answers: z.array(turnQuestionAnswerSchema).min(1).max(8).optional(),
	model: z.string().min(1).optional(),
});

/**
 * Transport for the V2 turn routes of one project; the chat id comes from
 * each request. The create POST answers with the turn stream. The reconnect
 * GET replays the active turn from the start. It answers 204 when no turn
 * runs; the SDK reads 204 as nothing to resume.
 */
export function createBuilderChatTransport(input: {
	/** Project the turn routes are scoped to (`/api/v2/projects/:id/...`). */
	projectId: string;
	/** Test seam. Production passes nothing and gets `globalThis.fetch`. */
	fetch?: typeof globalThis.fetch;
}): DefaultChatTransport<TurnMessage> {
	const serverUrl = getServerUrl().replace(/\/$/, "");
	return new DefaultChatTransport<TurnMessage>({
		api: `${serverUrl}${appBuilderRoutes.createTurn(input.projectId)}`,
		credentials: "include",
		fetch: createStatusPreservingChatFetch(input.fetch),
		prepareSendMessagesRequest: ({ id, messages, body, headers }) => {
			// One request admits one turn: only the LAST user message goes to the
			// API. The earlier transcript is client state the API already stores.
			const lastUserMessage = messages.findLast(
				(message) => message.role === "user",
			);
			const message = (lastUserMessage?.parts ?? [])
				.filter((part): part is TextUIPart => part.type === "text")
				.map((part) => part.text)
				.join("\n\n");
			const attachments = (lastUserMessage?.parts ?? [])
				.filter((part): part is FileUIPart => part.type === "file")
				.map((part) => ({
					url: part.url,
					mediaType: part.mediaType,
					...(part.filename ? { filename: part.filename } : {}),
				}));
			// The SDK always passes an object here (resolvedBody + options.body).
			// A malformed approval, answer, or model must throw. parse throws,
			// and useChat surfaces the ZodError as `error`; a plain turn would
			// hide the bug.
			const extras = turnSendOptionsSchema.parse(body);
			return {
				body: {
					chatId: id,
					message,
					// `composer` stays off the wire: the UI modes `build | plan` do
					// not map to `composerMetadataSchema.mode`
					// (`auto | page | marketing | image`).
					...(attachments.length > 0 ? { attachments } : {}),
					...(extras.approval ? { approval: extras.approval } : {}),
					...(extras.answers ? { answers: extras.answers } : {}),
					...(extras.model ? { model: extras.model } : {}),
				} satisfies CreateTurnRequest,
				headers: { ...headers, ...workspaceScopeHeaders() },
			};
		},
		prepareReconnectToStreamRequest: ({ headers }) => ({
			api: `${serverUrl}${appBuilderRoutes.activeTurnStream(input.projectId)}`,
			credentials: "include",
			headers: { ...headers, ...workspaceScopeHeaders() },
		}),
	});
}

/**
 * Rebuilds live messages from persisted chat rows. Drops `system` rows and
 * rows with no parts. A V2 assistant row gets its usage back as a
 * `data-turn-usage` part. The receipt line then keeps its tokens and credits
 * after a reload. A V1 row or an old row parses to nothing and stays as is.
 */
export function hydrateTurnMessages(
	rows: readonly ChatMessage[],
): TurnMessage[] {
	return rows.flatMap<TurnMessage>((row) => {
		if (row.role === "system" || row.parts.length === 0) return [];
		// The contract types the stored parts loosely (`Record`s). The card
		// code reads `type` on every part and the `data-*` payloads. A part
		// with no string `type` and a malformed `data-*` part drop instead of
		// breaking a card. A `data-*` part keeps the PARSED value: the schema
		// fills the defaults of rows stored before a field existed.
		const parts = row.parts.flatMap<TurnMessage["parts"][number]>((part) => {
			if (typeof part.type !== "string") return [];
			if (part.type.startsWith("data-")) {
				const parsed = turnDataPartSchema.safeParse(part);
				return parsed.success ? [parsed.data] : [];
			}
			// SAFETY: insertTurnAssistantMessage in
			// apps/server/src/modules/generation/infrastructure/persistence/chats.repository.ts
			// writes AI SDK UIMessage parts, and the user writer stores file and
			// text parts of the same shape. The check above proves the string
			// `type`; the text, file, and tool parts keep the writer's word.
			return [part as TurnMessage["parts"][number]];
		});
		if (row.role === "assistant") {
			const metadata = turnAssistantMessageMetadataSchema.safeParse(
				row.metadata,
			);
			if (metadata.success) {
				// LIMIT: after a reload the receipt shows no model; the usage part
				// carries no model id. Upgrade: a modelId on turnUsageDataSchema.
				parts.push({
					type: "data-turn-usage",
					id: "turn-usage",
					data: metadata.data.usage,
				});
			}
		}
		return [{ id: row.id, role: row.role, parts }];
	});
}

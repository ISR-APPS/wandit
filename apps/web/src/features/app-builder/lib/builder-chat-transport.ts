/**
 * Browser transport of the V2 turn stream. `createBuilderChatTransport`
 * builds the chat transport of one project; use-builder-chat.ts calls it.
 * When a stream stops before the turn ends, it reopens the turn replay.
 * `hydrateTurnMessages` rebuilds AI SDK messages from the stored chat rows.
 */

import {
	appBuilderRoutes,
	type ChatMessage,
	type CreateTurnRequest,
	createTurnResponseSchema,
	turnApprovalAnswerSchema,
	turnAssistantMessageMetadataSchema,
	turnDataPartSchema,
	turnQuestionAnswerSchema,
	uuidSchema,
} from "@wandit/contracts";
import {
	type ChatTransport,
	DefaultChatTransport,
	type FileUIPart,
	type TextUIPart,
	type UIMessageChunk,
} from "ai";
import { z } from "zod";

import { createStatusPreservingChatFetch } from "@/features/workspace";
import { workspaceScopeHeaders } from "@/features/workspaces";
import { ApiClientError } from "@/lib/api-client";
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
 * The `body` that `resumeAfterCut` gives to `reconnectToStream`. The GET
 * sends no body: the turn id only picks the route. No turn id, as on a
 * reload, picks the active turn of the project.
 */
const reconnectBodySchema = z.object({ turnId: uuidSchema.optional() });

// The wait before each reopen in a row. The first reopen goes at once,
// because the 15-minute cut is normal for a long build.
// LIMIT: about 45 s of failed reopens, then the chat shows the error and a
// reload resumes the turn. Upgrade: also wait for the browser `online` event.
const REOPEN_DELAYS_MS = [0, 1_000, 2_000, 4_000, 8_000, 15_000, 15_000];

/**
 * Transport for the V2 turn routes of one project; the chat id comes from
 * each request. The create POST answers with the turn stream. The reconnect
 * GET replays the active turn from the start, or answers 204 when no turn
 * runs. Railway closes every HTTP response at 15 minutes and a build can run
 * longer, so both streams go through `resumeAfterCut`.
 */
export function createBuilderChatTransport(input: {
	/** Project the turn routes are scoped to (`/api/v2/projects/:id/...`). */
	projectId: string;
	/** Test seam. Production passes nothing and gets `globalThis.fetch`. */
	fetch?: typeof globalThis.fetch;
}): ChatTransport<TurnMessage> {
	const serverUrl = getServerUrl().replace(/\/$/, "");
	const http = new DefaultChatTransport<TurnMessage>({
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
			// The elements picked in the preview ride on the user message.
			const targets = (lastUserMessage?.parts ?? []).flatMap((part) =>
				part.type === "data-targets" ? part.data.targets : [],
			);
			// The SDK always passes an object here (resolvedBody + options.body).
			// A malformed approval, answer, or model must throw. parse throws,
			// and useChat surfaces the ZodError as `error`; a plain turn would
			// hide the bug.
			const extras = turnSendOptionsSchema.parse(body);
			return {
				body: {
					chatId: id,
					message,
					// `composer` stays off the wire: the builder composer has no
					// modes, and `composerMetadataSchema.mode` is a V1 field.
					...(attachments.length > 0 ? { attachments } : {}),
					...(extras.approval ? { approval: extras.approval } : {}),
					...(extras.answers ? { answers: extras.answers } : {}),
					...(extras.model ? { model: extras.model } : {}),
					...(targets.length > 0 ? { targets } : {}),
				} satisfies CreateTurnRequest,
				headers: { ...headers, ...workspaceScopeHeaders() },
			};
		},
		prepareReconnectToStreamRequest: ({ body, headers }) => {
			// The SDK always passes an object here (resolvedBody + options.body).
			const { turnId } = reconnectBodySchema.parse(body);
			return {
				api: `${serverUrl}${
					turnId === undefined
						? appBuilderRoutes.activeTurnStream(input.projectId)
						: appBuilderRoutes.turnStream(input.projectId, turnId)
				}`,
				credentials: "include",
				headers: { ...headers, ...workspaceScopeHeaders() },
			};
		},
	});
	const withResume = (
		stream: ReadableStream<UIMessageChunk>,
		chatId: string,
		abortSignal: AbortSignal | undefined,
	) =>
		resumeAfterCut(stream, abortSignal, (turnId) =>
			http.reconnectToStream({ abortSignal, body: { turnId }, chatId }),
		);
	return {
		sendMessages: async (options) =>
			withResume(
				await http.sendMessages(options),
				options.chatId,
				options.abortSignal,
			),
		reconnectToStream: async (options) => {
			const stream = await http.reconnectToStream(options);
			// null is the 204 answer: no turn runs, so nothing resumes.
			return stream === null
				? null
				: withResume(stream, options.chatId, options.abortSignal);
		},
	};
}

/**
 * Joins a turn stream that stops before the turn ends to the replay of the
 * same turn, so useChat sees one stream and shows no error. A stop is a
 * clean close (a cut, or a failed read in the relay) or a TypeError from the
 * network. Each replay starts at the first event, so the chunks that the
 * reader already has drop by count.
 * An abort, an HTTP error, and a bad chunk go to useChat as before.
 */
function resumeAfterCut(
	source: ReadableStream<UIMessageChunk>,
	abortSignal: AbortSignal | undefined,
	/** Opens `GET turns/:turnId/stream`; null when the server answers 204. */
	reopen: (turnId: string) => Promise<ReadableStream<UIMessageChunk> | null>,
): ReadableStream<UIMessageChunk> {
	let reader = source.getReader();
	// From the first `data-turn-created` chunk. Without it, no turn can reopen.
	let turnId: string | null = null;
	// Chunks after `data-turn-created` that went to useChat.
	let delivered = 0;
	// Chunks at the start of the current replay that useChat already has.
	let toSkip = 0;
	// True after `data-turn-done` or `error`: the turn ended for useChat.
	let settled = false;
	// True after useChat cancels the stream (Stop, an error chunk, an unmount).
	let canceled = false;
	// Reopens since the last new chunk. A new chunk sets it back to 0.
	let reopens = 0;

	// The turn to reopen, or null when the stop is the real end.
	const resumableTurnId = (): string | null =>
		settled || canceled || abortSignal?.aborted ? null : turnId;

	const reopenTurn = async (id: string, stop: Error): Promise<void> => {
		let lastError: Error = stop;
		for (const delayMs of REOPEN_DELAYS_MS.slice(reopens)) {
			reopens += 1;
			await new Promise((resolve) => setTimeout(resolve, delayMs));
			// A Stop or a cancel during the wait ends the stream, so no GET opens.
			if (resumableTurnId() === null) throw lastError;
			try {
				const next = await reopen(id);
				if (next !== null) {
					reader = next.getReader();
					// LIMIT: each reopen replays every event of the turn, so a long
					// turn sends its whole stream again. Upgrade: resume from the
					// last event id.
					toSkip = delivered;
					// useChat can cancel while this GET opens. That cancel reached
					// only the old reader. The new stream closes here and frees its
					// open-stream slot.
					if (canceled) await reader.cancel();
					return;
				}
				lastError = new Error(`Turn ${id} has no stream yet`);
			} catch (error) {
				// A network error, a 429, or a 5xx is temporary, as in a deploy.
				// A 429 comes when the server has not yet freed the open-stream
				// slot of the cut stream. Another 4xx, an abort, or a bad chunk
				// is final.
				const isTransient =
					error instanceof TypeError ||
					(error instanceof ApiClientError &&
						(error.statusCode === 429 || error.statusCode >= 500));
				if (!isTransient) throw error;
				lastError = error;
			}
		}
		throw lastError;
	};

	return new ReadableStream<UIMessageChunk>({
		async pull(controller) {
			for (;;) {
				let result: ReadableStreamReadResult<UIMessageChunk>;
				try {
					result = await reader.read();
				} catch (error) {
					const id = resumableTurnId();
					if (!(error instanceof TypeError) || id === null) throw error;
					await reopenTurn(id, error);
					continue;
				}
				if (result.done) {
					if (canceled) return;
					const id = resumableTurnId();
					if (id === null) {
						controller.close();
						return;
					}
					await reopenTurn(
						id,
						new Error(`The stream of turn ${id} closed before the turn ended`),
					);
					continue;
				}
				const chunk = result.value;
				if (chunk.type === "data-turn-created") {
					// The schema is the boundary; useChat parses the frame again.
					turnId = createTurnResponseSchema.parse(chunk.data).turnId;
					controller.enqueue(chunk);
					return;
				}
				const isTurnEnd =
					chunk.type === "data-turn-done" || chunk.type === "error";
				// The replay holds the same events in the same order, because the
				// relay maps each event to the same chunks. The end of the turn
				// always passes: a replay from the row can be shorter.
				if (toSkip > 0 && !isTurnEnd) {
					toSkip -= 1;
					continue;
				}
				toSkip = 0;
				if (isTurnEnd) settled = true;
				delivered += 1;
				reopens = 0;
				controller.enqueue(chunk);
				return;
			}
		},
		cancel(reason) {
			canceled = true;
			return reader.cancel(reason);
		},
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

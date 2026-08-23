import type { createDb } from "@wandit/db";
import { and, eq, inArray, isNull } from "@wandit/db";
import { member } from "@wandit/db/schema/organizations";
import { projects } from "@wandit/db/schema/projects";
import { pushTokens } from "@wandit/db/schema/push-tokens";

const EXPO_PUSH_SEND_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_CHUNK_SIZE = 100;
const EXPO_PUSH_TIMEOUT_MS = 10_000;

type TriggerDatabase = ReturnType<typeof createDb>;

export type SendLeadPushPayload = {
	leadId: string;
	leadName: string;
	leadPhone: string;
	projectId: string;
	wilaya?: string;
};

export type LeadPushRuntimeLogger = {
	warn(message: string, details?: Record<string, unknown>): void;
};

export type LeadPushFetch = (
	input: string | URL | Request,
	init?: RequestInit,
) => Promise<Response>;

export type SendLeadPushResult = {
	prunedTokenCount: number;
	recipientCount: number;
	requestCount: number;
	status: "sent" | "skipped";
	ticketErrorCount: number;
	tokenCount: number;
	reason?: "no_tokens" | "project_not_found";
};

type ExpoPushMessage = {
	to: string;
	sound: "default";
	title: "New lead";
	body: string;
	data: {
		type: "lead.captured";
		projectId: string;
		leadId: string;
	};
};

type ExpoPushTicket = {
	details?: { error?: string };
	message?: string;
	status: "error" | "ok";
};

const silentLogger: LeadPushRuntimeLogger = {
	warn() {},
};

export async function sendLeadPush(
	db: TriggerDatabase,
	payload: SendLeadPushPayload,
	dependencies: {
		fetch?: LeadPushFetch;
		logger?: LeadPushRuntimeLogger;
	} = {},
): Promise<SendLeadPushResult> {
	const fetchImpl = dependencies.fetch ?? globalThis.fetch;
	const logger = dependencies.logger ?? silentLogger;
	const [project] = await db
		.select({
			name: projects.name,
			organizationId: projects.organizationId,
			userId: projects.userId,
		})
		.from(projects)
		.where(and(eq(projects.id, payload.projectId), isNull(projects.deletedAt)))
		.limit(1);

	if (!project) {
		return skippedResult("project_not_found");
	}

	const recipientUserIds = project.organizationId
		? await loadOrganizationRecipientIds(db, project.organizationId)
		: [project.userId];
	const uniqueRecipientUserIds = [...new Set(recipientUserIds)];

	if (uniqueRecipientUserIds.length === 0) {
		return skippedResult("no_tokens");
	}

	const tokenRows = await db
		.select({ token: pushTokens.token })
		.from(pushTokens)
		.where(inArray(pushTokens.userId, uniqueRecipientUserIds));
	const tokens = [...new Set(tokenRows.map((row) => row.token))];

	if (tokens.length === 0) {
		return {
			...skippedResult("no_tokens"),
			recipientCount: uniqueRecipientUserIds.length,
		};
	}

	const body = [payload.leadName, payload.leadPhone, payload.wilaya]
		.filter((value): value is string => Boolean(value))
		.join(" · ");
	const messages = tokens.map<ExpoPushMessage>((token) => ({
		body,
		data: {
			leadId: payload.leadId,
			projectId: payload.projectId,
			type: "lead.captured",
		},
		sound: "default",
		title: "New lead",
		to: token,
	}));
	let prunedTokenCount = 0;
	let requestCount = 0;
	let ticketErrorCount = 0;

	for (
		let offset = 0;
		offset < messages.length;
		offset += EXPO_PUSH_CHUNK_SIZE
	) {
		const chunk = messages.slice(offset, offset + EXPO_PUSH_CHUNK_SIZE);
		const response = await fetchImpl(EXPO_PUSH_SEND_URL, {
			body: JSON.stringify(chunk),
			headers: { "content-type": "application/json" },
			method: "POST",
			signal: AbortSignal.timeout(EXPO_PUSH_TIMEOUT_MS),
		});
		requestCount += 1;

		if (!response.ok) {
			throw new Error(
				`Expo push request failed with status ${response.status}`,
			);
		}

		const tickets = parseTickets(await response.json(), chunk.length);

		// Receipt polling is intentionally deferred; v1 handles immediate tickets only.
		for (const [index, ticket] of tickets.entries()) {
			if (ticket.status === "ok") {
				continue;
			}

			ticketErrorCount += 1;
			const errorCode = ticket.details?.error;
			if (errorCode !== "DeviceNotRegistered") {
				logger.warn("Expo rejected a lead push ticket", {
					errorCode: errorCode ?? "unknown",
					leadId: payload.leadId,
					projectId: payload.projectId,
				});
				continue;
			}

			try {
				const token = chunk[index]?.to;
				if (token) {
					await db.delete(pushTokens).where(eq(pushTokens.token, token));
					prunedTokenCount += 1;
				}
			} catch {
				logger.warn("Failed to prune an unregistered Expo push token", {
					leadId: payload.leadId,
					projectId: payload.projectId,
				});
			}
		}
	}

	return {
		prunedTokenCount,
		recipientCount: uniqueRecipientUserIds.length,
		requestCount,
		status: "sent",
		ticketErrorCount,
		tokenCount: tokens.length,
	};
}

async function loadOrganizationRecipientIds(
	db: TriggerDatabase,
	organizationId: string,
): Promise<string[]> {
	const rows = await db
		.select({ userId: member.userId })
		.from(member)
		.where(eq(member.organizationId, organizationId));

	return rows.map((row) => row.userId);
}

function skippedResult(
	reason: "no_tokens" | "project_not_found",
): SendLeadPushResult {
	return {
		prunedTokenCount: 0,
		reason,
		recipientCount: 0,
		requestCount: 0,
		status: "skipped",
		ticketErrorCount: 0,
		tokenCount: 0,
	};
}

function parseTickets(
	value: unknown,
	expectedLength: number,
): ExpoPushTicket[] {
	if (!isRecord(value) || !Array.isArray(value.data)) {
		throw new Error("Expo push response did not contain tickets");
	}
	if (value.data.length !== expectedLength) {
		throw new Error(
			"Expo push response ticket count did not match the request",
		);
	}

	return value.data.map((ticket) => {
		if (
			!isRecord(ticket) ||
			(ticket.status !== "ok" && ticket.status !== "error")
		) {
			throw new Error("Expo push response contained an invalid ticket");
		}

		const details = isRecord(ticket.details)
			? {
					error:
						typeof ticket.details.error === "string"
							? ticket.details.error
							: undefined,
				}
			: undefined;

		return {
			details,
			message: typeof ticket.message === "string" ? ticket.message : undefined,
			status: ticket.status,
		};
	});
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

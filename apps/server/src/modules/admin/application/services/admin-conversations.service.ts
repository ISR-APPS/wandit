import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import { adminRoleHasPermission } from "@wandit/auth/admin-permissions";
import {
	type AdminAiFailuresResponse,
	type AdminChatCallsResponse,
	type AdminChatDetail,
	type AdminChatMessagesResponse,
	type AdminGenerationAttemptDetail,
	type AdminGenerationSurface,
	type AdminListChatFailuresQuery,
	type AdminListProjectChatsResponse,
	type AdminListUserChatsResponse,
	aiChatBillingErrorDataSchema,
	aiChatMessageUsageSchema,
	aiErrorDataSchema,
	type PaginationQuery,
} from "@wandit/contracts";

import {
	looksLikeCredential,
	redactProviderText,
} from "../../../ai-errors/domain/sanitize-provider-text";

import { AdminAuditRepository } from "../../infrastructure/persistence/admin-audit.repository";
import { AdminConversationsRepository } from "../../infrastructure/persistence/admin-conversations.repository";

const CONVERSATION_VIEW_AUDIT_WINDOW_MS = 15 * 60 * 1_000;

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const PHONE_CANDIDATE_PATTERN =
	/(?<![\p{L}\p{N}])(?:\+?\d|\(\d)[\d\s().-]{5,}\d(?![\p{L}\p{N}])/gu;

export type AdminConversationRequestContext = {
	admin: Pick<AuthUser, "id" | "role">;
	requestId: string | null;
};

@Injectable()
export class AdminConversationsService {
	constructor(
		@Inject(AdminConversationsRepository)
		private readonly conversationsRepository: AdminConversationsRepository,
		@Inject(AdminAuditRepository)
		private readonly auditRepository: AdminAuditRepository,
	) {}

	listProjectChats(
		projectId: string,
		query: PaginationQuery,
	): Promise<AdminListProjectChatsResponse> {
		return this.conversationsRepository.listProjectChats(projectId, query);
	}

	listUserChats(
		userId: string,
		query: PaginationQuery,
	): Promise<AdminListUserChatsResponse> {
		return this.conversationsRepository.listUserChats(userId, query);
	}

	async getChatDetail(chatId: string): Promise<AdminChatDetail> {
		return this.requireChat(chatId);
	}

	async listChatMessages(
		chatId: string,
		query: PaginationQuery,
		context: AdminConversationRequestContext,
	): Promise<AdminChatMessagesResponse> {
		const detail = await this.requireChat(chatId);
		const page = await this.conversationsRepository.listChatMessages(
			chatId,
			query,
		);
		const canReadRaw = adminRoleHasPermission(context.admin.role, {
			conversations: ["read-raw"],
		});

		await this.auditConversationView(chatId, detail, context);

		return {
			...page,
			items: page.items.map((message) => ({
				...message,
				metadata: canReadRaw
					? message.metadata
					: reducedTranscriptMetadata(message.metadata),
				parts: canReadRaw
					? message.parts.map(redactRawToolCredentials)
					: message.parts.map(reduceTranscriptPart),
			})),
		};
	}

	async listChatCalls(
		chatId: string,
		query: PaginationQuery,
	): Promise<AdminChatCallsResponse> {
		await this.requireChat(chatId);
		return this.conversationsRepository.listChatCalls(chatId, query);
	}

	listAiFailures(
		query: AdminListChatFailuresQuery,
	): Promise<AdminAiFailuresResponse> {
		return this.conversationsRepository.listAiFailures(query);
	}

	async getGenerationAttempt(
		surface: AdminGenerationSurface,
		attemptId: string,
	): Promise<AdminGenerationAttemptDetail> {
		const attempt = await this.conversationsRepository.getGenerationAttempt(
			surface,
			attemptId,
		);

		if (!attempt) {
			throw new NotFoundException();
		}

		return attempt;
	}

	private async requireChat(chatId: string): Promise<AdminChatDetail> {
		const detail = await this.conversationsRepository.getChatDetail(chatId);

		if (!detail) {
			throw new NotFoundException();
		}

		return detail;
	}

	private async auditConversationView(
		chatId: string,
		detail: AdminChatDetail,
		context: AdminConversationRequestContext,
	): Promise<void> {
		await this.auditRepository.insertConversationViewIfAbsent(
			{
				adminUserId: context.admin.id,
				requestId: context.requestId,
				targetId: chatId,
				targetUserId: detail.owner?.id ?? null,
			},
			new Date(Date.now() - CONVERSATION_VIEW_AUDIT_WINDOW_MS),
		);
	}
}

function reduceTranscriptPart(value: unknown): unknown {
	if (!isRecord(value)) {
		return { type: "unknown" };
	}

	const type = safeIdentifier(value.type) ?? "unknown";

	if (type === "text" && typeof value.text === "string") {
		return { type, text: redactText(value.text) };
	}

	if (type === "data-ai-error") {
		const parsed = aiErrorDataSchema.safeParse(value.data);
		return parsed.success ? { type, data: parsed.data } : { type };
	}

	if (type === "data-billing-error") {
		const parsed = aiChatBillingErrorDataSchema.safeParse(value.data);
		return parsed.success ? { type, data: parsed.data } : { type };
	}

	if (isToolPart(value, type)) {
		return reduceToolPart(value, type);
	}

	if (type === "file") {
		const filename = safeSummary(value.filename);
		const mediaType = safeIdentifier(value.mediaType);

		return {
			type,
			...(filename === null ? {} : { filename }),
			...(mediaType === null ? {} : { mediaType }),
		};
	}

	// Unknown data/source/step parts retain only their discriminant. Their
	// arbitrary JSON can contain prompts, connector inputs, or provider bodies.
	return { type };
}

function reduceToolPart(
	value: Record<string, unknown>,
	type: string,
): Record<string, unknown> {
	const toolName =
		safeIdentifier(value.toolName) ??
		(type.startsWith("tool-") ? type.slice("tool-".length) : null);
	const state = safeIdentifier(value.state);
	const errorSummary = firstSafeSummary([
		value.errorText,
		value.error,
		isRecord(value.output) ? value.output.message : null,
	]);
	const aiError = firstAiError([
		value.error,
		isRecord(value.output) ? value.output.wanditError : null,
		isRecord(value.output) ? value.output.error : null,
	]);

	return {
		type,
		...(toolName === null ? {} : { toolName }),
		...(state === null ? {} : { state }),
		...(errorSummary === null ? {} : { errorText: errorSummary }),
		...(aiError === null ? {} : { aiError }),
	};
}

function firstAiError(values: unknown[]) {
	for (const value of values) {
		const parsed = aiErrorDataSchema.safeParse(value);
		if (parsed.success) return parsed.data;
	}

	return null;
}

function firstSafeSummary(values: unknown[]): string | null {
	for (const value of values) {
		const summary = safeSummary(value);
		if (summary !== null) return summary;
	}

	return null;
}

function safeSummary(value: unknown): string | null {
	if (typeof value !== "string") return null;
	if (looksLikeCredential(value)) return "[redacted]";

	const sanitized = redactText(redactProviderText(value)).trim();
	if (sanitized.length === 0) return null;

	return sanitized.slice(0, 240);
}

function reducedTranscriptMetadata(value: unknown): unknown {
	if (!isRecord(value)) return null;

	const usage = aiChatMessageUsageSchema.safeParse(value.usage);
	const fields: Record<string, unknown> = {};

	for (const key of [
		"model",
		"finishReason",
		"rawFinishReason",
		"provider",
		"gatewayGenerationId",
	] as const) {
		const sanitized = safeMetadataString(value[key]);
		if (sanitized !== null) fields[key] = sanitized;
	}

	if (usage.success) fields.usage = usage.data;

	return Object.keys(fields).length === 0 ? null : fields;
}

function safeMetadataString(value: unknown): string | null {
	if (typeof value !== "string") return null;
	if (looksLikeCredential(value)) return "[redacted]";

	const sanitized = redactText(redactProviderText(value)).trim();
	return sanitized.length === 0 ? null : sanitized.slice(0, 240);
}

function redactRawToolCredentials(value: unknown): unknown {
	if (!isRecord(value)) return value;

	const type = safeIdentifier(value.type);
	return type !== null && isToolPart(value, type)
		? redactCredentialStrings(value)
		: value;
}

function redactCredentialStrings(value: unknown): unknown {
	if (typeof value === "string") {
		return looksLikeCredential(value) ? "[redacted]" : value;
	}

	if (Array.isArray(value)) {
		return value.map(redactCredentialStrings);
	}

	if (isRecord(value)) {
		return Object.fromEntries(
			Object.entries(value).map(([key, entry]) => [
				key,
				redactCredentialStrings(entry),
			]),
		);
	}

	return value;
}

function isToolPart(value: Record<string, unknown>, type: string): boolean {
	return (
		type.startsWith("tool-") ||
		type === "dynamic-tool" ||
		(typeof value.toolCallId === "string" &&
			("input" in value || "args" in value || "output" in value))
	);
}

function safeIdentifier(value: unknown): string | null {
	return typeof value === "string" &&
		/^[a-z0-9][a-z0-9_+./:-]{0,127}$/iu.test(value)
		? value
		: null;
}

function redactText(value: string): string {
	return value
		.replace(EMAIL_PATTERN, "[redacted]")
		.replace(PHONE_CANDIDATE_PATTERN, (candidate) =>
			looksLikePhoneNumber(candidate) ? "[redacted]" : candidate,
		);
}

function looksLikePhoneNumber(candidate: string): boolean {
	const digitCount = candidate.replace(/\D/gu, "").length;

	if (digitCount < 7 || digitCount > 15) {
		return false;
	}

	// A leading country code or parentheses is a strong phone signal. For local
	// formats, require at least three digit groups and a 3-4 digit final group.
	// This deliberately leaves ISO dates and unformatted numeric ids unchanged.
	if (
		candidate.startsWith("+") ||
		candidate.includes("(") ||
		candidate.includes(")")
	) {
		return true;
	}

	const groups = candidate.split(/\D+/u).filter(Boolean);
	const finalGroupLength = groups.at(-1)?.length ?? 0;

	return groups.length >= 3 && finalGroupLength >= 3 && finalGroupLength <= 4;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object";
}

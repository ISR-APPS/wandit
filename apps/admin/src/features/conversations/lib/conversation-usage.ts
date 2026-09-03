import { aiChatMessageUsageSchema } from "@wandit/contracts";

import type { AiCall } from "@/features/conversations/api/conversations.dto";

export type MessageUsageSummary = {
	callCount: number;
	modelLabels: string[];
	inputTokens: number | null;
	cacheReadTokens: number | null;
	outputTokens: number | null;
	reasoningTokens: number | null;
	totalTokens: number | null;
	costUsd: number | null;
	gatewayGenerationIds: string[];
};

export function groupCallsByMessageId(
	calls: AiCall[],
): Map<string, MessageUsageSummary> {
	const callsByMessageId = new Map<string, AiCall[]>();

	for (const call of calls) {
		if (!call.messageId) continue;

		const messageCalls = callsByMessageId.get(call.messageId) ?? [];
		messageCalls.push(call);
		callsByMessageId.set(call.messageId, messageCalls);
	}

	const grouped = new Map<string, MessageUsageSummary>();

	for (const [messageId, messageCalls] of callsByMessageId) {
		const aggregateCalls = messageCalls.filter(
			(call) => !isGenerationReferenceCall(call),
		);
		const referenceCalls = messageCalls.filter(isGenerationReferenceCall);
		const current = emptyUsageSummary();

		current.callCount =
			aggregateCalls.length > 0 ? aggregateCalls.length : referenceCalls.length;
		current.inputTokens = preferredMetricSum(
			aggregateCalls,
			referenceCalls,
			(call) => call.inputTokens,
		);
		current.cacheReadTokens = preferredMetricSum(
			aggregateCalls,
			referenceCalls,
			(call) => call.cacheReadTokens,
		);
		current.outputTokens = preferredMetricSum(
			aggregateCalls,
			referenceCalls,
			(call) => call.outputTokens,
		);
		current.reasoningTokens = preferredMetricSum(
			aggregateCalls,
			referenceCalls,
			(call) => call.reasoningTokens,
		);
		current.totalTokens = preferredMetricSum(
			aggregateCalls,
			referenceCalls,
			(call) => call.totalTokens,
		);
		current.costUsd = preferredMetricSum(
			aggregateCalls,
			referenceCalls,
			(call) => call.costUsd,
		);

		for (const call of messageCalls) {
			if (call.model && !current.modelLabels.includes(call.model)) {
				current.modelLabels.push(call.model);
			}

			if (
				call.gatewayGenerationId &&
				!current.gatewayGenerationIds.includes(call.gatewayGenerationId)
			) {
				current.gatewayGenerationIds.push(call.gatewayGenerationId);
			}
		}

		grouped.set(messageId, current);
	}

	return grouped;
}

export function isGenerationReferenceCall(call: AiCall): boolean {
	return call.gatewayGenerationId !== null && call.creditsCenti === null;
}

export function getMessageMetadataUsage(
	metadata: unknown,
): MessageUsageSummary | undefined {
	if (!isRecord(metadata)) {
		return undefined;
	}

	const parsedUsage = aiChatMessageUsageSchema.safeParse(metadata.usage);
	if (!parsedUsage.success) {
		return undefined;
	}
	const usage = parsedUsage.data;
	const inputTokens = usage.inputTokens ?? null;
	const outputTokens = usage.outputTokens ?? null;
	const cacheReadTokens = usage.inputTokenDetails?.cacheReadTokens ?? null;
	const reasoningTokens = usage.outputTokenDetails?.reasoningTokens ?? null;
	const totalTokens =
		usage.totalTokens ??
		(inputTokens === null && outputTokens === null
			? null
			: (inputTokens ?? 0) + (outputTokens ?? 0));

	if (
		inputTokens === null &&
		outputTokens === null &&
		cacheReadTokens === null &&
		reasoningTokens === null &&
		totalTokens === null
	) {
		return undefined;
	}

	return {
		callCount: 1,
		modelLabels:
			typeof metadata.model === "string" && metadata.model.trim()
				? [metadata.model]
				: [],
		inputTokens,
		cacheReadTokens,
		outputTokens,
		reasoningTokens,
		totalTokens,
		costUsd: null,
		gatewayGenerationIds:
			typeof metadata.gatewayGenerationId === "string" &&
			metadata.gatewayGenerationId.trim()
				? [metadata.gatewayGenerationId]
				: [],
	};
}

export function mergeUsageSummaries(
	...summaries: Array<MessageUsageSummary | undefined>
): MessageUsageSummary | undefined {
	const present = summaries.filter(
		(summary): summary is MessageUsageSummary => summary !== undefined,
	);
	if (present.length === 0) {
		return undefined;
	}

	const merged = emptyUsageSummary();
	for (const summary of present) {
		merged.callCount += summary.callCount;
		merged.inputTokens = addNullable(merged.inputTokens, summary.inputTokens);
		merged.cacheReadTokens = addNullable(
			merged.cacheReadTokens,
			summary.cacheReadTokens,
		);
		merged.outputTokens = addNullable(
			merged.outputTokens,
			summary.outputTokens,
		);
		merged.reasoningTokens = addNullable(
			merged.reasoningTokens,
			summary.reasoningTokens,
		);
		merged.totalTokens = addNullable(merged.totalTokens, summary.totalTokens);
		merged.costUsd = addNullable(merged.costUsd, summary.costUsd);

		for (const model of summary.modelLabels) {
			if (!merged.modelLabels.includes(model)) {
				merged.modelLabels.push(model);
			}
		}

		for (const generationId of summary.gatewayGenerationIds) {
			if (!merged.gatewayGenerationIds.includes(generationId)) {
				merged.gatewayGenerationIds.push(generationId);
			}
		}
	}

	return merged;
}

function emptyUsageSummary(): MessageUsageSummary {
	return {
		callCount: 0,
		modelLabels: [],
		inputTokens: null,
		cacheReadTokens: null,
		outputTokens: null,
		reasoningTokens: null,
		totalTokens: null,
		costUsd: null,
		gatewayGenerationIds: [],
	};
}

function addNullable(left: number | null, right: number | null): number | null {
	if (left === null && right === null) {
		return null;
	}

	return (left ?? 0) + (right ?? 0);
}

function preferredMetricSum(
	aggregateCalls: AiCall[],
	referenceCalls: AiCall[],
	select: (call: AiCall) => number | null,
): number | null {
	return sumMetric(aggregateCalls, select) ?? sumMetric(referenceCalls, select);
}

function sumMetric(
	calls: AiCall[],
	select: (call: AiCall) => number | null,
): number | null {
	let total: number | null = null;

	for (const call of calls) {
		total = addNullable(total, select(call));
	}

	return total;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

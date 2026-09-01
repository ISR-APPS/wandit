import type { AiCall } from "@/features/conversations/api/conversations.dto";

export type MessageUsageSummary = {
	callCount: number;
	modelLabels: string[];
	inputTokens: number | null;
	outputTokens: number | null;
	costUsd: number | null;
	gatewayGenerationIds: string[];
};

export function groupCallsByMessageId(
	calls: AiCall[],
): Map<string, MessageUsageSummary> {
	const grouped = new Map<string, MessageUsageSummary>();

	for (const call of calls) {
		if (!call.messageId) {
			continue;
		}

		const current = grouped.get(call.messageId) ?? emptyUsageSummary();
		current.callCount += 1;
		current.inputTokens = addNullable(current.inputTokens, call.inputTokens);
		current.outputTokens = addNullable(current.outputTokens, call.outputTokens);
		current.costUsd = addNullable(current.costUsd, call.costUsd);

		if (call.model && !current.modelLabels.includes(call.model)) {
			current.modelLabels.push(call.model);
		}

		if (
			call.gatewayGenerationId &&
			!current.gatewayGenerationIds.includes(call.gatewayGenerationId)
		) {
			current.gatewayGenerationIds.push(call.gatewayGenerationId);
		}

		grouped.set(call.messageId, current);
	}

	return grouped;
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
		merged.outputTokens = addNullable(
			merged.outputTokens,
			summary.outputTokens,
		);
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
		outputTokens: null,
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

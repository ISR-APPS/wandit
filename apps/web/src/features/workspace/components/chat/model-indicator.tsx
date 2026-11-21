/**
 * Shows the brain model and the builder model of a V1 chat, read from the transcript.
 * The brain model comes from the assistant message metadata.
 * The builder model comes from the newest finished `generate_page` tool output.
 * No file imports this component now, so nothing renders it.
 */
import { useTranslation } from "@/lib/i18n";
import { getModelLabel } from "@/lib/model-labels";
import type { WanditUIMessage } from "../../lib/use-ai-chat";

export function ConversationModelIndicator({
	messages,
}: {
	messages: readonly WanditUIMessage[];
}) {
	const { t } = useTranslation();
	const { brainModel, builderModel } = resolveConversationModels(messages);

	if (!brainModel && !builderModel) return null;

	return (
		<p className="mb-2.5 flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap px-0.5 font-mono text-[10px] text-muted-foreground">
			{brainModel ? (
				<ModelSegment
					label={t("workspace.chat.usage.brain")}
					modelId={brainModel}
				/>
			) : null}
			{brainModel && builderModel ? (
				<span aria-hidden className="shrink-0">
					·
				</span>
			) : null}
			{builderModel ? (
				<ModelSegment
					label={t("workspace.chat.usage.builder")}
					modelId={builderModel}
				/>
			) : null}
		</p>
	);
}

function ModelSegment({ label, modelId }: { label: string; modelId: string }) {
	return (
		<span className="flex min-w-0 items-center gap-1 overflow-hidden">
			<span className="shrink-0">{label}:</span>
			<span dir="ltr" className="truncate">
				{getModelLabel(modelId)}
			</span>
		</span>
	);
}

function resolveConversationModels(messages: readonly WanditUIMessage[]): {
	brainModel?: string;
	builderModel?: string;
} {
	let brainModel: string | undefined;
	let transcriptBuilderModel: string | undefined;

	for (
		let messageIndex = messages.length - 1;
		messageIndex >= 0;
		messageIndex--
	) {
		const message = messages[messageIndex];
		if (message?.role !== "assistant") continue;

		if (!brainModel && message.metadata?.model) {
			brainModel = message.metadata.model;
		}

		for (
			let partIndex = message.parts.length - 1;
			partIndex >= 0;
			partIndex--
		) {
			const part = message.parts[partIndex];
			if (
				part?.type !== "tool-generate_page" ||
				part.state !== "output-available"
			) {
				continue;
			}

			if (!transcriptBuilderModel && part.output.builderModel) {
				transcriptBuilderModel = part.output.builderModel;
			}
		}
	}

	return {
		...(brainModel ? { brainModel } : {}),
		...(transcriptBuilderModel ? { builderModel: transcriptBuilderModel } : {}),
	};
}

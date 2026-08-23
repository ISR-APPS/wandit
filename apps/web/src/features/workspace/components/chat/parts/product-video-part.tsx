import { useTranslation } from "@/lib/i18n";
import type { WanditUIMessage } from "../../../lib/use-ai-chat";
import { type VideoAttemptCopy, VideoAttemptPart } from "./generate-video-part";

type ProductVideoToolPart = Extract<
	WanditUIMessage["parts"][number],
	{ type: "tool-product_video" }
>;

export function ProductVideoPart({ part }: { part: ProductVideoToolPart }) {
	const { t } = useTranslation();
	const copy: VideoAttemptCopy = {
		preparing: t("workspace.chat.videoAttempt.product.preparing"),
		queueing: t("workspace.chat.videoAttempt.product.queueing"),
		failedToStart: t("workspace.chat.videoAttempt.product.failedToStart"),
		failedTitle: t("workspace.chat.videoAttempt.product.failedTitle"),
		failedBody: t("workspace.chat.videoAttempt.product.failedBody"),
		statusLoadError: t("workspace.chat.videoAttempt.statusLoadError"),
		prepared: t("workspace.chat.videoAttempt.product.prepared"),
		active: (durationSeconds) =>
			t("workspace.chat.videoAttempt.product.active", {
				seconds: durationSeconds,
			}),
		done: (durationSeconds) =>
			t("workspace.chat.videoAttempt.product.done", {
				seconds: durationSeconds,
			}),
		inQueue: t("workspace.chat.videoAttempt.inQueue"),
		extractingFrame: (piece) =>
			piece
				? t("workspace.chat.videoAttempt.extractingFrame", piece)
				: t("workspace.chat.videoAttempt.extractingFrameFallback"),
		renderingPiece: (piece) =>
			piece
				? t("workspace.chat.videoAttempt.renderingPiece", piece)
				: t("workspace.chat.videoAttempt.renderingPieceFallback"),
		joining: t("workspace.chat.videoAttempt.joining"),
		narration: t("workspace.chat.videoAttempt.narration"),
		publish: t("workspace.chat.videoAttempt.publish"),
		publishing: t("workspace.chat.videoAttempt.product.publishing"),
		published: t("workspace.chat.videoAttempt.published"),
		complete: t("workspace.chat.videoAttempt.product.complete"),
		ready: t("workspace.chat.videoAttempt.product.ready"),
		download: t("workspace.chat.videoAttempt.download"),
		viewAssets: t("workspace.chat.videoAttempt.viewAssets"),
		play: (title) => t("workspace.chat.videoAttempt.play", { title }),
	};

	return <VideoAttemptPart copy={copy} part={part} />;
}

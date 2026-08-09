// In-thread progress and result UI for the standalone animate_image tool.
// The tool queues durable work and returns immediately; this renderer polls
// by attempt id until the image animation succeeds or fails. The source still
// doubles as the final video's poster, so the card remains useful before the
// first frame loads and after a chat-history reload.

import { useQueryClient } from "@tanstack/react-query";
import type { MediaGenerationAttempt } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";
import {
	AlertTriangle,
	Download,
	ExternalLink,
	Film,
	RefreshCw,
} from "lucide-react";
import { type ReactNode, useEffect } from "react";

import { invalidateBalanceAfterGenerationTerminal } from "@/features/credits/lib/terminal-balance-invalidation";
import { useTranslation } from "@/lib/i18n";
import { useMediaGenerationAttemptQuery } from "../../../api/media-generations.queries";
import { mediaGenerationDownloadUrl } from "../../../api/media-generations.services";
import type { WanditUIMessage } from "../../../lib/use-ai-chat";
import { SpinnerArc } from "../request-tray/tray-signals";
import { StatusMessageHeader } from "../status-message-header";

type AnimateImageToolPart = Extract<
	WanditUIMessage["parts"][number],
	{ type: "tool-animate_image" }
>;

export function AnimateImagePart({ part }: { part: AnimateImageToolPart }) {
	const { t } = useTranslation();

	if (part.state === "input-streaming" || part.state === "input-available") {
		const text =
			part.state === "input-streaming"
				? t("workspace.chat.animateImage.preparing")
				: t("workspace.chat.animateImage.queueing");
		return (
			<AnnouncedStatus text={text}>
				<WorkingLine text={text} />
			</AnnouncedStatus>
		);
	}

	if (part.state === "output-error") {
		return (
			<AnnouncedStatus
				text={`${t("workspace.chat.animateImage.failedToStart")}. ${t(
					"workspace.chat.animateImage.failedBody",
				)}`}
			>
				<FailureMessage
					title={t("workspace.chat.animateImage.failedToStart")}
					body={t("workspace.chat.animateImage.failedBody")}
				/>
			</AnnouncedStatus>
		);
	}

	if (part.state !== "output-available") return null;

	if (part.output.status === "queued" && part.output.attemptId) {
		return <MediaGenerationCard attemptId={part.output.attemptId} />;
	}

	return (
		<AnnouncedStatus
			text={`${t("workspace.chat.animateImage.unavailableTitle")}. ${t(
				"workspace.chat.animateImage.unavailableBody",
			)}`}
		>
			<FailureMessage
				title={t("workspace.chat.animateImage.unavailableTitle")}
				body={t("workspace.chat.animateImage.unavailableBody")}
			/>
		</AnnouncedStatus>
	);
}

function MediaGenerationCard({ attemptId }: { attemptId: string }) {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const {
		data: attempt,
		error,
		refetch,
		isFetching,
	} = useMediaGenerationAttemptQuery(attemptId);
	const terminalStatus =
		attempt?.status === "succeeded" || attempt?.status === "failed"
			? attempt.status
			: null;

	useEffect(() => {
		if (!terminalStatus) return;
		invalidateBalanceAfterGenerationTerminal(queryClient, terminalStatus);
	}, [queryClient, terminalStatus]);

	if (error) {
		return (
			<AnnouncedStatus text={t("workspace.chat.animateImage.statusLoadError")}>
				<div className="rounded-xl border border-destructive/25 bg-destructive/[0.035] p-3.5">
					<div className="flex items-start gap-2.5">
						<span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
							<AlertTriangle className="size-3.5" aria-hidden />
						</span>
						<div className="min-w-0 flex-1">
							<p className="font-medium text-[13.5px] text-foreground">
								{t("workspace.chat.animateImage.statusLoadError")}
							</p>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="-ms-2 mt-1 h-7 px-2 text-muted-foreground text-xs"
								disabled={isFetching}
								onClick={() => void refetch()}
							>
								{isFetching ? (
									<SpinnerArc className="size-3" />
								) : (
									<RefreshCw className="size-3" aria-hidden />
								)}
								{t("workspace.chat.animateImage.retry")}
							</Button>
						</div>
					</div>
				</div>
			</AnnouncedStatus>
		);
	}

	if (attempt?.status === "failed") {
		return (
			<AnnouncedStatus
				text={`${t("workspace.chat.animateImage.failedTitle")}. ${t(
					"workspace.chat.animateImage.failedBody",
				)}`}
			>
				<FailureMessage
					title={t("workspace.chat.animateImage.failedTitle")}
					body={t("workspace.chat.animateImage.failedBody")}
				/>
			</AnnouncedStatus>
		);
	}

	if (attempt?.status === "succeeded" && attempt.videoUrl) {
		return (
			<AnnouncedStatus
				text={`${t("workspace.chat.animateImage.resultTitle")}. ${t(
					"workspace.chat.animateImage.ready",
				)}`}
			>
				<MediaGenerationResult attempt={attempt} videoUrl={attempt.videoUrl} />
			</AnnouncedStatus>
		);
	}

	const progressTitle =
		attempt?.status === "generating"
			? t("workspace.chat.animateImage.generatingTitle")
			: t("workspace.chat.animateImage.queuedTitle");
	const progressBody =
		attempt?.status === "generating"
			? t("workspace.chat.animateImage.generatingBody")
			: t("workspace.chat.animateImage.queuedBody");

	return (
		<AnnouncedStatus text={`${progressTitle}. ${progressBody}`}>
			<MediaGenerationProgress attempt={attempt} />
		</AnnouncedStatus>
	);
}

function MediaGenerationProgress({
	attempt,
}: {
	attempt: MediaGenerationAttempt | undefined;
}) {
	const { t } = useTranslation();
	const isGenerating = attempt?.status === "generating";
	const title = isGenerating
		? t("workspace.chat.animateImage.generatingTitle")
		: t("workspace.chat.animateImage.queuedTitle");
	const body = isGenerating
		? t("workspace.chat.animateImage.generatingBody")
		: t("workspace.chat.animateImage.queuedBody");

	return (
		<div className="overflow-hidden rounded-[14px] border border-border bg-background">
			<div
				className={cn(
					"relative grid max-h-72 min-h-36 place-items-center overflow-hidden bg-secondary",
					aspectClass(attempt?.aspect),
				)}
			>
				{attempt?.sourceImageUrl ? (
					<img
						src={attempt.sourceImageUrl}
						alt={t("workspace.chat.animateImage.sourceAlt")}
						className="absolute inset-0 size-full object-cover"
					/>
				) : (
					<Skeleton className="absolute inset-0 size-full rounded-none" />
				)}
				<div className="absolute inset-0 bg-foreground/28 backdrop-blur-[1px]" />
				<span className="relative grid size-11 place-items-center rounded-full border border-background/30 bg-background/88 text-foreground shadow-sm">
					<SpinnerArc className="size-[18px]" />
				</span>
				<span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/75 to-transparent px-3 pt-8 pb-2.5 text-background">
					<span className="block font-medium text-[13px]">{title}</span>
					<span className="block text-[11.5px] text-background/75">{body}</span>
				</span>
			</div>
		</div>
	);
}

function MediaGenerationResult({
	attempt,
	videoUrl,
}: {
	attempt: MediaGenerationAttempt;
	videoUrl: string;
}) {
	const { t } = useTranslation();
	const extension = attempt.videoMediaType === "video/webm" ? "webm" : "mp4";
	const filename = `wandit-animation.${extension}`;

	return (
		<div className="overflow-hidden rounded-[14px] border border-border bg-background">
			<video
				src={videoUrl}
				poster={attempt.sourceImageUrl ?? undefined}
				controls
				muted
				playsInline
				preload="metadata"
				className={cn(
					"block max-h-80 w-full bg-secondary object-contain",
					aspectClass(attempt.aspect),
				)}
				aria-label={t("workspace.chat.animateImage.videoLabel")}
			/>
			<div className="p-3">
				<div className="mb-3 flex items-center gap-2.5">
					<span className="grid size-8 shrink-0 place-items-center rounded-lg bg-success/12 text-success">
						<Film className="size-4" aria-hidden />
					</span>
					<span className="min-w-0 flex-1">
						<span className="block font-medium text-[13.5px] text-foreground">
							{t("workspace.chat.animateImage.resultTitle")}
						</span>
						<span
							dir="ltr"
							className="block text-[11.5px] text-muted-foreground"
						>
							{t("workspace.chat.animateImage.duration", {
								seconds: attempt.durationSeconds,
							})}
							{" · "}
							{attempt.aspect}
						</span>
					</span>
					<span className="shrink-0 rounded-full border border-success/35 bg-success/8 px-2 py-0.5 text-[11px] text-success">
						{t("workspace.chat.animateImage.ready")}
					</span>
				</div>
				<div className="grid grid-cols-2 gap-2">
					<Button
						asChild
						size="sm"
						variant="outline"
						className="h-8 text-[12.5px]"
					>
						<a href={videoUrl} target="_blank" rel="noreferrer">
							<ExternalLink className="size-3.5" aria-hidden />
							{t("workspace.chat.animateImage.open")}
						</a>
					</Button>
					<Button asChild size="sm" className="h-8 text-[12.5px]">
						<a
							href={mediaGenerationDownloadUrl(attempt.id)}
							download={filename}
						>
							<Download className="size-3.5" aria-hidden />
							{t("workspace.chat.animateImage.download")}
						</a>
					</Button>
				</div>
			</div>
		</div>
	);
}

function FailureMessage({ title, body }: { title: string; body: string }) {
	return (
		<div>
			<StatusMessageHeader
				avatarClass="border-destructive/38 bg-destructive/14 text-destructive"
				kickerClass="text-destructive"
				kicker={title}
			>
				<AlertTriangle className="size-3" aria-hidden />
			</StatusMessageHeader>
			<p dir="auto" className="text-[13px] text-muted-foreground leading-[1.5]">
				{body}
			</p>
		</div>
	);
}

function WorkingLine({ text }: { text: string }) {
	return (
		<div className="flex items-center gap-2 text-[13px] text-muted-foreground">
			<SpinnerArc className="size-3.5" />
			<span>{text}</span>
		</div>
	);
}

function AnnouncedStatus({
	text,
	children,
}: {
	text: string;
	children: ReactNode;
}) {
	return (
		<>
			<span
				role="status"
				aria-live="polite"
				aria-atomic="true"
				className="sr-only"
			>
				{text}
			</span>
			{children}
		</>
	);
}

function aspectClass(aspect: MediaGenerationAttempt["aspect"] | undefined) {
	switch (aspect) {
		case "1:1":
			return "aspect-square";
		case "9:16":
			return "aspect-[9/16]";
		default:
			return "aspect-video";
	}
}

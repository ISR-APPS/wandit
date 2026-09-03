// In-thread progress and result UI for the standalone generate_image tool.
// The tool queues durable work and returns immediately; this renderer polls
// by attempt id until the generation succeeds or fails, then shows the image
// grid inline. Finished images also land in the Assets tab (the query is
// invalidated here so that tab freshens without a manual refresh).

import { useQueryClient } from "@tanstack/react-query";
import type { ImageGenerationAttempt } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { type ReactNode, useEffect } from "react";

import { invalidateBalanceAfterGenerationTerminal } from "@/features/credits/lib/terminal-balance-invalidation";
import { useTranslation } from "@/lib/i18n";
import {
	invalidateCompletedImageGeneration,
	useImageGenerationAttemptQuery,
} from "../../../api/image-generations.queries";
import { imageGenerationDownloadUrl } from "../../../api/image-generations.services";
import { useSharedAiChat } from "../../../lib/ai-chat-context";
import {
	durableAiErrorPresentation,
	findToolAiError,
	toolOutputAiError,
} from "../../../lib/ai-error-copy";
import { useWorkspace } from "../../../lib/store";
import type { WanditUIMessage } from "../../../lib/use-ai-chat";
import { SpinnerArc } from "../request-tray/tray-signals";
import { StatusMessageHeader } from "../status-message-header";
import { ChatMediaGallery } from "./chat-media";

type GenerateImageToolPart = Extract<
	WanditUIMessage["parts"][number],
	{ type: "tool-generate_image" }
>;

export function GenerateImagePart({
	part,
	messageParts,
}: {
	part: GenerateImageToolPart;
	messageParts?: WanditUIMessage["parts"];
}) {
	const { t } = useTranslation();
	const { prefillComposer } = useSharedAiChat();
	const prompt =
		typeof part.input?.prompt === "string" ? part.input.prompt : undefined;

	if (part.state === "input-streaming" || part.state === "input-available") {
		const text =
			part.state === "input-streaming"
				? t("workspace.chat.generateImage.preparing")
				: t("workspace.chat.generateImage.queueing");
		return (
			<AnnouncedStatus text={text}>
				<WorkingLine text={text} />
			</AnnouncedStatus>
		);
	}

	if (part.state === "output-error") {
		const failure = findToolAiError(messageParts, part.toolCallId);
		if (failure) {
			const copy = durableAiErrorPresentation(failure, t);
			return (
				<AnnouncedStatus text={`${copy.kicker}. ${copy.body}`}>
					<FailureMessage
						title={copy.kicker}
						body={copy.body}
						attribution={copy.attribution}
						onPrefill={prefillComposer}
						prompt={prompt}
						showPrefill={copy.showRetry}
					/>
				</AnnouncedStatus>
			);
		}

		return (
			<AnnouncedStatus text={t("workspace.chat.generateImage.failedToStart")}>
				<FailureMessage
					title={t("workspace.chat.generateImage.failedToStart")}
					body={t("workspace.chat.generateImage.failedBody")}
				/>
			</AnnouncedStatus>
		);
	}

	if (part.state !== "output-available") return null;
	const outputFailure = toolOutputAiError(part.output);
	if (outputFailure) {
		const copy = durableAiErrorPresentation(outputFailure, t);
		return (
			<AnnouncedStatus text={`${copy.kicker}. ${copy.body}`}>
				<FailureMessage
					title={copy.kicker}
					body={copy.body}
					attribution={copy.attribution}
					onPrefill={prefillComposer}
					prompt={prompt}
					showPrefill={copy.showRetry}
				/>
			</AnnouncedStatus>
		);
	}

	if (part.output.status === "queued" && part.output.attemptId) {
		return (
			<ImageGenerationCard
				attemptId={part.output.attemptId}
				onPrefill={prefillComposer}
			/>
		);
	}

	return (
		<AnnouncedStatus text={part.output.message}>
			<p dir="auto" className="text-[13px] text-muted-foreground leading-[1.5]">
				{part.output.message}
			</p>
		</AnnouncedStatus>
	);
}

function ImageGenerationCard({
	attemptId,
	onPrefill,
}: {
	attemptId: string;
	onPrefill: (prompt: string) => void;
}) {
	const { t } = useTranslation();
	const {
		data: attempt,
		error,
		refetch,
		isFetching,
	} = usePolledImageGenerationAttempt(attemptId);

	if (error) {
		return (
			<AnnouncedStatus text={t("workspace.chat.generateImage.statusLoadError")}>
				<div className="rounded-xl border border-destructive/25 bg-destructive/[0.035] p-3.5">
					<div className="flex items-start gap-2.5">
						<span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
							<AlertTriangle className="size-3.5" aria-hidden />
						</span>
						<div className="min-w-0 flex-1">
							<p className="font-medium text-[13.5px] text-foreground">
								{t("workspace.chat.generateImage.statusLoadError")}
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
								{t("workspace.chat.generateImage.retry")}
							</Button>
						</div>
					</div>
				</div>
			</AnnouncedStatus>
		);
	}

	return <ImageGenerationAttemptView attempt={attempt} onPrefill={onPrefill} />;
}

/**
 * Shared durable-attempt lifecycle for both the standalone card and a batch
 * card. Keeping polling plus terminal cache invalidation here prevents the two
 * presentations from drifting as the worker protocol evolves.
 */
export function usePolledImageGenerationAttempt(attemptId: string) {
	const { projectId } = useWorkspace();
	const queryClient = useQueryClient();
	const query = useImageGenerationAttemptQuery(attemptId);
	const attempt = query.data;

	// Once the images exist, the Assets tab should show them without a manual
	// refresh. Placement stays pending briefly after image success, so this
	// effect runs again when the worker records its final outcome.
	const succeeded = attempt?.status === "succeeded";
	const terminalStatus =
		attempt?.status === "succeeded" || attempt?.status === "failed"
			? attempt.status
			: null;
	useEffect(() => {
		if (!terminalStatus) return;
		invalidateBalanceAfterGenerationTerminal(queryClient, terminalStatus);
	}, [queryClient, terminalStatus]);

	useEffect(() => {
		if (!succeeded) return;
		invalidateCompletedImageGeneration(
			queryClient,
			projectId,
			attempt.placement?.status,
		);
	}, [attempt?.placement?.status, projectId, queryClient, succeeded]);

	return query;
}

export function ImageGenerationAttemptView({
	attempt,
	onPrefill,
}: {
	attempt: ImageGenerationAttempt | undefined;
	onPrefill?: (prompt: string) => void;
}) {
	const { t } = useTranslation();
	const succeeded = attempt?.status === "succeeded";

	if (attempt?.status === "failed") {
		if (attempt.failure) {
			const copy = durableAiErrorPresentation(attempt.failure, t);
			return (
				<AnnouncedStatus text={`${copy.kicker}. ${copy.body}`}>
					<FailureMessage
						title={copy.kicker}
						body={copy.body}
						attribution={copy.attribution}
						onPrefill={onPrefill}
						prompt={attempt.prompt}
						showPrefill={copy.showRetry}
					/>
				</AnnouncedStatus>
			);
		}

		return (
			<AnnouncedStatus text={t("workspace.chat.generateImage.failedTitle")}>
				<FailureMessage
					title={t("workspace.chat.generateImage.failedTitle")}
					body={attempt.error ?? t("workspace.chat.generateImage.failedBody")}
				/>
			</AnnouncedStatus>
		);
	}

	if (succeeded && attempt.images && attempt.images.length > 0) {
		return (
			<AnnouncedStatus text={t("workspace.chat.generateImage.readyTitle")}>
				<ImageGenerationResult attempt={attempt} onPrefill={onPrefill} />
			</AnnouncedStatus>
		);
	}

	const working =
		attempt?.status === "generating"
			? t("workspace.chat.generateImage.generatingTitle")
			: t("workspace.chat.generateImage.queuedTitle");
	const total = attempt?.count ?? 1;
	const partialImages =
		attempt?.status === "queued" || attempt?.status === "generating"
			? attempt.images
			: null;
	const hasIndexed = partialImages?.some((image) => image.index !== undefined);
	const ready = Math.min(partialImages?.length ?? 0, total);
	const showReadyCount = partialImages !== null;

	return (
		<AnnouncedStatus text={working}>
			<div className="overflow-hidden rounded-[14px] border border-border bg-background p-3">
				<div className="mb-2.5 flex items-center gap-2 text-[13px] text-muted-foreground">
					<SpinnerArc className="size-3.5" />
					<span dir="auto" className="min-w-0 truncate">
						{attempt?.title ?? working}
					</span>
				</div>
				<div
					className={cn(
						"grid gap-2",
						total > 4
							? "grid-cols-3"
							: total > 1
								? "grid-cols-2"
								: "grid-cols-1",
					)}
				>
					{Array.from({ length: total }, (_, slot) => {
						const image = hasIndexed
							? partialImages?.find((image) => image.index === slot + 1)
							: partialImages?.[slot];

						return image ? (
							<a
								// biome-ignore lint/suspicious/noArrayIndexKey: each index is one stable requested slot
								key={slot}
								href={image.url}
								target="_blank"
								rel="noreferrer"
								className={cn(
									"block overflow-hidden rounded-lg border border-border bg-secondary",
									imageGenerationAspectClass(attempt?.aspect),
								)}
							>
								<img
									src={image.url}
									alt={`${attempt?.title ?? working} ${image.index ?? slot + 1}`}
									loading="lazy"
									className="block size-full object-cover"
								/>
							</a>
						) : (
							<Skeleton
								// biome-ignore lint/suspicious/noArrayIndexKey: each index is one stable requested slot
								key={slot}
								className={cn(
									"w-full rounded-lg",
									imageGenerationAspectClass(attempt?.aspect),
								)}
							/>
						);
					})}
				</div>
				{showReadyCount ? (
					<p
						dir="auto"
						className="mt-2 font-mono text-[10px] text-muted-foreground"
					>
						{t("workspace.chat.generateImage.readyCount", {
							ready,
							total,
						})}
					</p>
				) : null}
			</div>
		</AnnouncedStatus>
	);
}

export function ImageGenerationResult({
	attempt,
	onPrefill,
}: {
	attempt: ImageGenerationAttempt;
	onPrefill?: (prompt: string) => void;
}) {
	const { t } = useTranslation();
	const images = attempt.images ?? [];
	const partialFailure = attempt.failure
		? durableAiErrorPresentation(attempt.failure, t)
		: null;

	return (
		<div className="overflow-hidden rounded-[14px] border border-border bg-background p-3">
			<p
				dir="auto"
				className="mb-2.5 min-w-0 truncate font-medium text-[13.5px] text-foreground"
			>
				{attempt.title}
			</p>
			<ChatMediaGallery
				items={images.map((image, position) => {
					const generationIndex = image.index ?? position + 1;

					return {
						key: image.url,
						kind: "image" as const,
						url: image.url,
						label: `${attempt.title} ${generationIndex}`,
						downloadUrl: imageGenerationDownloadUrl(
							attempt.id,
							generationIndex,
						),
					};
				})}
			/>
			{partialFailure ? (
				<div className="mt-2 rounded-lg border border-destructive/20 bg-destructive/[0.03] p-2.5">
					<p dir="auto" className="text-[12px] text-muted-foreground">
						{t("workspace.chat.generateImage.partialFailure", {
							sentence: partialFailure.body,
						})}
					</p>
					{partialFailure.attribution ? (
						<p dir="auto" className="mt-1 text-[11px] text-muted-foreground">
							{partialFailure.attribution}
						</p>
					) : null}
					{partialFailure.showRetry && onPrefill ? (
						<div className="mt-2">
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-7 rounded-lg px-2.5 text-xs"
								onClick={() => onPrefill(attempt.prompt)}
							>
								{t("workspace.chat.aiError.tryAgainPrefill.image")}
							</Button>
							<p className="mt-1 text-[10.5px] text-muted-foreground">
								{t("workspace.chat.aiError.tryAgainPrefill.hint")}
							</p>
						</div>
					) : null}
				</div>
			) : null}
			<p className="mt-2 font-mono text-[10px] text-muted-foreground">
				{t("workspace.chat.generateImage.inAssetsTab")}
			</p>
			{attempt.placement?.status === "failed" ? (
				<p dir="auto" className="mt-1.5 text-[11px] text-muted-foreground">
					{t("workspace.chat.generateImage.placementFailed")}
				</p>
			) : null}
		</div>
	);
}

function FailureMessage({
	title,
	body,
	attribution,
	onPrefill,
	prompt,
	showPrefill = false,
}: {
	title: string;
	body: string;
	attribution?: string | null;
	onPrefill?: (prompt: string) => void;
	prompt?: string;
	showPrefill?: boolean;
}) {
	const { t } = useTranslation();
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
			{attribution ? (
				<p dir="auto" className="mt-1 text-[11.5px] text-muted-foreground">
					{attribution}
				</p>
			) : null}
			{showPrefill && prompt && onPrefill ? (
				<div className="mt-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-7 rounded-lg px-2.5 text-xs"
						onClick={() => onPrefill(prompt)}
					>
						{t("workspace.chat.aiError.tryAgainPrefill.image")}
					</Button>
					<p className="mt-1 text-[10.5px] text-muted-foreground">
						{t("workspace.chat.aiError.tryAgainPrefill.hint")}
					</p>
				</div>
			) : null}
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

export function imageGenerationAspectClass(
	aspect: ImageGenerationAttempt["aspect"] | undefined,
) {
	switch (aspect) {
		case "1:1":
			return "aspect-square";
		case "2:3":
			return "aspect-[2/3]";
		case "3:2":
			return "aspect-[3/2]";
		case "4:3":
			return "aspect-[4/3]";
		case "4:5":
			return "aspect-[4/5]";
		case "9:16":
			return "aspect-[9/16]";
		default:
			return "aspect-video";
	}
}

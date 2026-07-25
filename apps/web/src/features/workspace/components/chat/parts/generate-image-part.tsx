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
import { AlertTriangle, Download, RefreshCw } from "lucide-react";
import { type ReactNode, useEffect } from "react";

import { useTranslation } from "@/lib/i18n";
import { useImageGenerationAttemptQuery } from "../../../api/image-generations.queries";
import { imageGenerationDownloadUrl } from "../../../api/image-generations.services";
import { projectAssetKeys } from "../../../api/project-assets.queries";
import { useWorkspace } from "../../../lib/store";
import type { WanditUIMessage } from "../../../lib/use-ai-chat";
import { SpinnerArc } from "../request-tray/tray-signals";
import { StatusMessageHeader } from "../status-message-header";

type GenerateImageToolPart = Extract<
	WanditUIMessage["parts"][number],
	{ type: "tool-generate_image" }
>;

export function GenerateImagePart({ part }: { part: GenerateImageToolPart }) {
	const { t } = useTranslation();

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

	if (part.output.status === "queued" && part.output.attemptId) {
		return <ImageGenerationCard attemptId={part.output.attemptId} />;
	}

	return (
		<AnnouncedStatus text={part.output.message}>
			<p dir="auto" className="text-[13px] text-muted-foreground leading-[1.5]">
				{part.output.message}
			</p>
		</AnnouncedStatus>
	);
}

function ImageGenerationCard({ attemptId }: { attemptId: string }) {
	const { t } = useTranslation();
	const { projectId } = useWorkspace();
	const queryClient = useQueryClient();
	const {
		data: attempt,
		error,
		refetch,
		isFetching,
	} = useImageGenerationAttemptQuery(attemptId);

	// Once the images exist, the Assets tab should show them without a manual
	// refresh.
	const succeeded = attempt?.status === "succeeded";
	useEffect(() => {
		if (!succeeded) return;
		void queryClient.invalidateQueries({
			queryKey: projectAssetKeys.list(projectId),
		});
	}, [succeeded, projectId, queryClient]);

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

	if (attempt?.status === "failed") {
		return (
			<AnnouncedStatus text={t("workspace.chat.generateImage.failedTitle")}>
				<FailureMessage
					title={t("workspace.chat.generateImage.failedTitle")}
					body={t("workspace.chat.generateImage.failedBody")}
				/>
			</AnnouncedStatus>
		);
	}

	if (succeeded && attempt.images && attempt.images.length > 0) {
		return (
			<AnnouncedStatus text={t("workspace.chat.generateImage.readyTitle")}>
				<ImageGenerationResult attempt={attempt} />
			</AnnouncedStatus>
		);
	}

	const working =
		attempt?.status === "generating"
			? t("workspace.chat.generateImage.generatingTitle")
			: t("workspace.chat.generateImage.queuedTitle");

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
						(attempt?.count ?? 1) > 1 ? "grid-cols-2" : "grid-cols-1",
					)}
				>
					{Array.from({ length: attempt?.count ?? 1 }, (_, index) => (
						<Skeleton
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed-size placeholder grid
							key={index}
							className={cn("w-full rounded-lg", aspectClass(attempt?.aspect))}
						/>
					))}
				</div>
			</div>
		</AnnouncedStatus>
	);
}

function ImageGenerationResult({
	attempt,
}: {
	attempt: ImageGenerationAttempt;
}) {
	const { t } = useTranslation();
	const images = attempt.images ?? [];

	return (
		<div className="overflow-hidden rounded-[14px] border border-border bg-background p-3">
			<p
				dir="auto"
				className="mb-2.5 min-w-0 truncate font-medium text-[13.5px] text-foreground"
			>
				{attempt.title}
			</p>
			<div
				className={cn(
					"grid gap-2",
					images.length > 1 ? "grid-cols-2" : "grid-cols-1",
				)}
			>
				{images.map((image, index) => (
					<div
						key={image.url}
						className="group relative overflow-hidden rounded-lg border bg-secondary"
					>
						<a href={image.url} target="_blank" rel="noreferrer">
							<img
								src={image.url}
								alt={`${attempt.title} ${index + 1}`}
								loading="lazy"
								className={cn(
									"block w-full object-cover",
									aspectClass(attempt.aspect),
								)}
							/>
						</a>
						<Button
							asChild
							size="icon-sm"
							variant="secondary"
							className="absolute end-1.5 top-1.5 size-7 rounded-md opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
						>
							<a
								href={imageGenerationDownloadUrl(attempt.id, index + 1)}
								aria-label={t("workspace.chat.generateImage.download")}
							>
								<Download className="size-3.5" aria-hidden />
							</a>
						</Button>
					</div>
				))}
			</div>
			<p className="mt-2 font-mono text-[10px] text-muted-foreground">
				{t("workspace.chat.generateImage.inAssetsTab")}
			</p>
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

function aspectClass(aspect: ImageGenerationAttempt["aspect"] | undefined) {
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

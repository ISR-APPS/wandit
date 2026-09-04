import { useQueryClient } from "@tanstack/react-query";
import {
	type AiErrorData,
	connectorGenerationQueuedOutputSchema,
	generateImageOutputSchema,
	generateMarketingAssetOutputSchema,
	generatePageOutputSchema,
	scrapeLeadsOutputSchema,
	type TriggerRealtimeHandle,
} from "@wandit/contracts";
import { useTranslation } from "@wandit/internationalization/react";
import { router } from "expo-router";
import { Card, useThemeColor } from "heroui-native";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { WanditIcon, type WanditIconName } from "@/components/wandit-icon";
import { creditsKeys } from "@/features/credits";
import {
	connectorGenerationKeys,
	marketingAssetKeys,
	pageKeys,
} from "@/features/workspace/api/generation.keys";
import {
	DURABLE_POLL_INTERVAL_MS,
	REALTIME_BACKSTOP_INTERVAL_MS,
	useConnectorGenerationAttemptQuery,
	useImageGenerationAttemptQuery,
	useMarketingAssetsQuery,
	usePageOverviewQuery,
} from "@/features/workspace/api/generation.queries";
import { imageGenerationDownloadUrl } from "@/features/workspace/api/generation.requests";
import { projectAssetKeys } from "@/features/workspace/api/project-assets.queries";
import { ChatMediaGallery } from "@/features/workspace/components/chat-media";
import { ElapsedTimer } from "@/features/workspace/components/elapsed-timer";
import { LeadScrapeCard } from "@/features/workspace/components/lead-scrape-card";
import { PageBuildCard } from "@/features/workspace/components/page-build-card";
import { SpinnerArc } from "@/features/workspace/components/spinner-arc";
import { SweepBar } from "@/features/workspace/components/sweep-bar";
import { useLiveRun } from "@/features/workspace/lib/use-live-run";
import { AppSkeletonGroup } from "@/shared/ui/skeleton-group";
import { chatErrorPresentation, readAiErrorData } from "../lib/ai-error-copy";
import { originalGenerationPrompt } from "../lib/generation-prefill";

export type AsyncGenerationKind =
	| "page"
	| "marketing"
	| "image"
	| "leads"
	| "connector";

/** Narrow structural type accepted from live AI SDK parts and persisted rows. */
export type AsyncGenerationPart = Readonly<{
	state?: unknown;
	input?: unknown;
	output?: unknown;
	failure?: unknown;
}>;

export type AsyncGenerationCardProps = {
	kind: AsyncGenerationKind;
	projectId: string;
	part: AsyncGenerationPart;
	onPrefillComposer?: (prompt: string) => void;
};

type ToolConfig = {
	title: string;
	icon: WanditIconName;
	preparing: string;
	queueing: string;
	failedToStart: string;
	queued: string;
	building: string;
	ready: string;
	failed: string;
	loadError: string;
	retry: string;
	noMedia: string;
	missing: string;
};

type NormalizedOutput = {
	status: "queued" | "unavailable" | "needs-input";
	message: string;
	attemptId?: string;
	assetId?: string;
	versionNumber?: number;
	connector?: string;
	tool?: string;
	realtime?: TriggerRealtimeHandle;
};

type CardTone = "working" | "success" | "danger" | "muted";
type PrefillGenerationKind = "image" | "marketing" | "connector";

export function AsyncGenerationCard({
	kind,
	projectId,
	part,
	onPrefillComposer,
}: AsyncGenerationCardProps) {
	const config = useToolConfig(kind);
	const failure = readAiErrorData(part.failure) ?? readAiErrorData(part.output);
	const originalPrompt = originalGenerationPrompt(kind, part.input);

	if (part.state === "input-streaming") {
		return (
			<GenerationCardFrame
				config={config}
				headline={config.preparing}
				isWorking
			/>
		);
	}

	if (part.state === "input-available") {
		return (
			<GenerationCardFrame
				config={config}
				headline={config.queueing}
				isWorking
			/>
		);
	}

	if (part.state === "output-error") {
		if (failure) {
			return (
				<AiFailureGenerationCard
					config={config}
					failure={failure}
					kind={kind}
					onPrefill={onPrefillComposer}
					prompt={originalPrompt}
				/>
			);
		}
		return (
			<GenerationCardFrame
				config={config}
				headline={config.failedToStart}
				tone="danger"
			/>
		);
	}

	if (part.state !== "output-available") return null;
	if (failure) {
		return (
			<AiFailureGenerationCard
				config={config}
				failure={failure}
				kind={kind}
				onPrefill={onPrefillComposer}
				prompt={originalPrompt}
			/>
		);
	}
	if (isErrorOutput(part.output)) {
		return (
			<GenerationCardFrame
				config={config}
				headline={config.failedToStart}
				tone="danger"
			/>
		);
	}

	const output = normalizeOutput(kind, part.output);
	if (!output) {
		return (
			<GenerationCardFrame
				config={config}
				headline={config.loadError}
				tone="danger"
			/>
		);
	}

	if (output.status === "unavailable") {
		return (
			<GenerationCardFrame
				config={config}
				detail={output.message}
				headline={config.failed}
				tone="muted"
			/>
		);
	}

	if (output.status === "needs-input") {
		return (
			<GenerationCardFrame
				config={config}
				detail={output.message}
				headline={config.title}
				tone="muted"
			/>
		);
	}

	switch (kind) {
		case "page":
			return (
				<PageGenerationResult
					attemptId={output.attemptId}
					config={config}
					message={output.message}
					projectId={projectId}
					realtime={output.realtime}
					versionNumber={output.versionNumber}
				/>
			);
		case "marketing":
			return (
				<MarketingGenerationResult
					assetId={output.assetId}
					config={config}
					fallbackTitle={readStringField(part.input, "title")}
					message={output.message}
					onPrefill={onPrefillComposer}
					originalPrompt={originalPrompt}
					projectId={projectId}
				/>
			);
		case "image":
			return output.attemptId ? (
				<ImageGenerationResult
					attemptId={output.attemptId}
					config={config}
					message={output.message}
					onPrefill={onPrefillComposer}
					originalPrompt={originalPrompt}
				/>
			) : (
				<MissingAttemptCard config={config} message={output.message} />
			);
		case "leads":
			return output.attemptId ? (
				<LeadScrapeCard
					attemptId={output.attemptId}
					fallbackLocation={readStringField(part.input, "location")}
					fallbackQuery={readStringField(part.input, "query")}
					realtime={output.realtime}
				/>
			) : (
				<MissingAttemptCard config={config} message={output.message} />
			);
		case "connector":
			return output.attemptId ? (
				<ConnectorGenerationResult
					attemptId={output.attemptId}
					args={part.input}
					config={config}
					connector={output.connector}
					fallbackTitle={joinToolTitle(output.connector, output.tool)}
					message={output.message}
					onPrefill={onPrefillComposer}
					originalPrompt={originalPrompt}
					realtime={output.realtime}
					tool={output.tool}
				/>
			) : (
				<MissingAttemptCard config={config} message={output.message} />
			);
	}
}

function PageGenerationResult({
	projectId,
	attemptId,
	versionNumber,
	message,
	config,
	realtime,
}: {
	projectId: string;
	attemptId: string | undefined;
	versionNumber: number | undefined;
	message: string;
	config: ToolConfig;
	realtime: TriggerRealtimeHandle | undefined;
}) {
	const durable = (
		<DurablePageResult
			attemptId={attemptId}
			config={config}
			message={message}
			projectId={projectId}
			versionNumber={versionNumber}
		/>
	);

	// With an attempt row or a realtime handle, the reconciling card takes
	// over (live checklist + durable attempt truth + failed/stopped states);
	// the durable overview rendering remains the whole path only for old
	// messages minted before either existed.
	if (realtime || attemptId) {
		return (
			<PageBuildCard
				attemptId={attemptId}
				fallback={durable}
				projectId={projectId}
				realtime={realtime}
				versionNumber={versionNumber}
			/>
		);
	}

	return durable;
}

function DurablePageResult({
	projectId,
	attemptId,
	versionNumber,
	message,
	config,
}: {
	projectId: string;
	attemptId: string | undefined;
	versionNumber: number | undefined;
	message: string;
	config: ToolConfig;
}) {
	const { t } = useTranslation();
	const query = usePageOverviewQuery(projectId);

	if (query.isError) {
		return <QueryFailureCard config={config} onRetry={query.refetch} />;
	}

	const overview = query.data;
	const attempt = overview?.latestAttempt;
	const isMatchingAttempt = Boolean(
		attempt && (!attemptId || attempt.id === attemptId),
	);
	const resolvedVersion =
		versionNumber ??
		(isMatchingAttempt && attempt?.status === "succeeded"
			? overview?.activeVersion?.number
			: undefined);

	if (isMatchingAttempt && attempt?.status === "failed") {
		const failure = readAiErrorData(attempt);
		if (failure) {
			return <AiFailureGenerationCard config={config} failure={failure} />;
		}
		return (
			<GenerationCardFrame
				config={config}
				detail={attempt.error ?? undefined}
				headline={config.failed}
				tone="danger"
			/>
		);
	}

	if (isMatchingAttempt && attempt?.status === "succeeded") {
		return (
			<GenerationCardFrame
				config={config}
				detail={
					resolvedVersion
						? t("workspace.page.versionShort", { n: resolvedVersion })
						: undefined
				}
				headline={config.ready}
				tone="success"
			/>
		);
	}

	if (
		resolvedVersion &&
		overview?.activeVersion &&
		overview.activeVersion.number >= resolvedVersion
	) {
		return (
			<GenerationCardFrame
				config={config}
				detail={t("workspace.page.versionShort", { n: resolvedVersion })}
				headline={config.ready}
				tone="success"
			/>
		);
	}

	if (!attempt && overview?.activeVersion && !attemptId) {
		return (
			<GenerationCardFrame
				config={config}
				detail={t("workspace.page.versionShort", {
					n: overview.activeVersion.number,
				})}
				headline={config.ready}
				tone="success"
			/>
		);
	}

	const working =
		!overview ||
		(isMatchingAttempt &&
			(attempt?.status === "queued" || attempt?.status === "generating"));

	return (
		<GenerationCardFrame
			config={config}
			detail={working ? message : undefined}
			headline={attempt?.status === "queued" ? config.queued : config.building}
			isWorking={working}
			tone={working ? "working" : "muted"}
		/>
	);
}

function MarketingGenerationResult({
	projectId,
	assetId,
	fallbackTitle,
	message,
	config,
	onPrefill,
	originalPrompt,
}: {
	projectId: string;
	assetId: string | undefined;
	fallbackTitle: string | undefined;
	message: string;
	config: ToolConfig;
	onPrefill?: (prompt: string) => void;
	originalPrompt: string | undefined;
}) {
	const mountedAtRef = useRef(Date.now());
	const queryClient = useQueryClient();
	const query = useMarketingAssetsQuery(projectId);

	// The Marketing tab should show the queued card the moment the tool
	// answers, not a poll-interval later (web parity).
	useEffect(() => {
		void queryClient.invalidateQueries({
			queryKey: marketingAssetKeys.list(projectId),
		});
	}, [projectId, queryClient]);

	if (query.isError) {
		return <QueryFailureCard config={config} onRetry={query.refetch} />;
	}

	const asset = query.data?.find((item) =>
		assetId ? item.id === assetId : item.name === fallbackTitle,
	);
	const title = asset?.name ?? fallbackTitle;

	if (asset?.status === "failed") {
		const failure = readAiErrorData(asset);
		if (failure) {
			return (
				<AiFailureGenerationCard
					config={config}
					failure={failure}
					kind="marketing"
					onPrefill={onPrefill}
					prompt={originalPrompt}
				/>
			);
		}
		return (
			<GenerationCardFrame
				config={config}
				detail={asset.error ?? undefined}
				headline={config.failed}
				titleOverride={title}
				tone="danger"
			/>
		);
	}

	if (asset?.status === "succeeded") {
		return (
			<GenerationCardFrame
				config={config}
				headline={config.ready}
				titleOverride={title}
				tone="success"
			>
				<OpenMarketingTabButton projectId={projectId} />
			</GenerationCardFrame>
		);
	}

	const absenceConfirmed =
		query.data !== undefined &&
		!asset &&
		!query.isFetching &&
		query.dataUpdatedAt >= mountedAtRef.current;

	if (absenceConfirmed) {
		return (
			<GenerationCardFrame
				config={config}
				headline={config.missing}
				titleOverride={title}
				tone="muted"
			/>
		);
	}

	return (
		<GenerationCardFrame
			config={config}
			detail={message}
			headline={asset?.status === "queued" ? config.queued : config.building}
			isWorking
			titleOverride={title}
		>
			<OpenMarketingTabButton projectId={projectId} />
		</GenerationCardFrame>
	);
}

/** The finished (or building) deliverable lives in the Marketing tab — take
 * the user there (web "Open the Marketing tab" parity). */
function OpenMarketingTabButton({ projectId }: { projectId: string }) {
	const { t } = useTranslation();
	const foreground = useThemeColor("foreground");

	return (
		<Pressable
			accessibilityRole="button"
			onPress={() => router.push(`/project/${projectId}/marketing`)}
			className="mt-2 h-8 flex-row items-center justify-center gap-1.5 self-start rounded-full border border-border px-3 active:bg-surface-secondary"
		>
			<Text className="font-sans-semibold text-[12px] text-foreground">
				{t("workspace.chat.marketingAsset.openTab")}
			</Text>
			<WanditIcon name="arrowRight" size={11} color={foreground} />
		</Pressable>
	);
}

// Placeholder aspect map for the generating skeleton (web parity).
const IMAGE_ASPECT_RATIOS: Record<string, number> = {
	"1:1": 1,
	"2:3": 2 / 3,
	"3:2": 3 / 2,
	"4:3": 4 / 3,
	"4:5": 4 / 5,
	"9:16": 9 / 16,
	"16:9": 16 / 9,
};

function ImageGenerationResult({
	attemptId,
	message,
	config,
	onPrefill,
	originalPrompt,
}: {
	attemptId: string;
	message: string;
	config: ToolConfig;
	onPrefill?: (prompt: string) => void;
	originalPrompt: string | undefined;
}) {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const query = useImageGenerationAttemptQuery(attemptId);
	const attempt = query.data;
	const succeeded = attempt?.status === "succeeded";

	// A finished generation belongs in the Assets view; an applied placement
	// also changes the live page, so refresh its overview the moment it lands.
	useEffect(() => {
		if (!succeeded) return;
		void queryClient.invalidateQueries({ queryKey: projectAssetKeys.all });
		if (attempt?.placement?.status !== "applied") return;
		void queryClient.invalidateQueries({ queryKey: pageKeys.all });
	}, [succeeded, attempt?.placement?.status, queryClient]);

	if (query.isError) {
		return <QueryFailureCard config={config} onRetry={query.refetch} />;
	}

	if (
		!attempt ||
		attempt.status === "queued" ||
		attempt.status === "generating"
	) {
		const count = Math.max(1, attempt?.count ?? 1);
		const aspectRatio = IMAGE_ASPECT_RATIOS[attempt?.aspect ?? "1:1"] ?? 1;
		return (
			<GenerationCardFrame
				config={config}
				detail={!attempt ? message : undefined}
				headline={
					attempt?.status === "queued" ? config.queued : config.building
				}
				isWorking
				titleOverride={attempt?.title}
			>
				{/* Aspect-true placeholder blocks so the finished grid lands in
				    the space the skeleton already reserved (web skeleton grid). */}
				<AppSkeletonGroup isLoading>
					<View className="mt-2 flex-row flex-wrap gap-2">
						{Array.from({ length: count }, (_, index) => (
							<AppSkeletonGroup.Item
								// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder geometry
								key={index}
								className={`${count > 1 ? "w-[48%]" : "w-full"} overflow-hidden rounded-xl`}
								style={{ aspectRatio, maxHeight: 220 }}
							/>
						))}
					</View>
				</AppSkeletonGroup>
			</GenerationCardFrame>
		);
	}

	if (attempt.status === "failed") {
		const failure = readAiErrorData(attempt);
		if (failure) {
			return (
				<AiFailureGenerationCard
					config={config}
					failure={failure}
					kind="image"
					onPrefill={onPrefill}
					prompt={originalPrompt}
				/>
			);
		}
		return (
			<GenerationCardFrame
				config={config}
				detail={attempt.error ?? undefined}
				headline={config.failed}
				titleOverride={attempt.title}
				tone="danger"
			/>
		);
	}

	const media = (attempt.images ?? []).map((image, index) => ({
		key: `${attempt.id}:${index}`,
		kind: "image" as const,
		url: image.url,
		label: attempt.title ?? config.title,
		downloadUrl: imageGenerationDownloadUrl(attempt.id, index + 1),
	}));
	const partialFailure = readAiErrorData(attempt);
	const partialFailurePresentation = partialFailure
		? chatErrorPresentation(null, partialFailure, t)
		: null;

	return (
		<GenerationCardFrame
			config={config}
			detail={media.length === 0 ? config.noMedia : undefined}
			headline={config.ready}
			titleOverride={attempt.title}
			tone="success"
		>
			{media.length > 0 ? (
				<View className="mt-2">
					<ChatMediaGallery items={media} />
				</View>
			) : null}
			{partialFailurePresentation ? (
				<View className="mt-2 gap-1 rounded-xl border border-danger/25 bg-danger/5 p-2.5">
					<Text
						className="text-[12px] text-muted leading-[17px]"
						style={{ writingDirection: "auto" }}
					>
						{t("workspace.chat.generateImage.partialFailure", {
							sentence: partialFailurePresentation.body,
						})}
					</Text>
					{partialFailurePresentation.attribution ? (
						<Text
							className="text-[11.5px] text-muted/80 leading-[17px]"
							style={{ writingDirection: "auto" }}
						>
							{partialFailurePresentation.attribution}
						</Text>
					) : null}
					{partialFailurePresentation.retryable &&
					originalPrompt &&
					onPrefill ? (
						<GenerationPrefillButton
							kind="image"
							onPrefill={onPrefill}
							prompt={originalPrompt}
						/>
					) : null}
				</View>
			) : null}
			{attempt.placement?.status === "failed" ? (
				<Text className="mt-1.5 text-[11.5px] text-muted leading-[16px]">
					{t("workspace.chat.generateImage.placementFailed")}
				</Text>
			) : null}
			<Text className="mt-1.5 text-[11.5px] text-muted leading-[16px]">
				{t("workspace.chat.generateImage.inAssetsTab")}
			</Text>
		</GenerationCardFrame>
	);
}

const QUEUED_RUN_STATUSES = new Set([
	"QUEUED",
	"DEQUEUED",
	"DELAYED",
	"PENDING_VERSION",
]);

// The task republishes the provider's own state string (queued, pending,
// processing, rendering…) as run-metadata `stage` on every poll.
const QUEUED_STAGE_PATTERN = /queue|pend|wait|delay/i;

function ConnectorGenerationResult({
	attemptId,
	args,
	connector,
	tool,
	fallbackTitle,
	message,
	onPrefill,
	originalPrompt,
	realtime,
	config,
}: {
	attemptId: string;
	/** Raw MCP tool arguments — duration/aspect enrich the title line. */
	args: unknown;
	connector: string | undefined;
	tool: string | undefined;
	fallbackTitle: string | undefined;
	message: string;
	onPrefill?: (prompt: string) => void;
	originalPrompt: string | undefined;
	realtime: TriggerRealtimeHandle | undefined;
	config: ToolConfig;
}) {
	const { t } = useTranslation();
	const accent = useThemeColor("accent");
	const queryClient = useQueryClient();
	// Flipped when the subscription dies OR the run settles: the poll goes
	// fast until the row is terminal, so a crashed run still resolves via the
	// server's stale-row janitor.
	const [pollFallback, setPollFallback] = useState(false);
	const intervalMs =
		!realtime || pollFallback
			? DURABLE_POLL_INTERVAL_MS.connector
			: REALTIME_BACKSTOP_INTERVAL_MS;
	const query = useConnectorGenerationAttemptQuery(attemptId, intervalMs);
	const attempt = query.data;
	const attemptSettled =
		attempt?.status === "succeeded" || attempt?.status === "failed";
	const terminalStatus = attemptSettled ? attempt.status : null;

	useEffect(() => {
		if (!terminalStatus) return;
		void queryClient.invalidateQueries({ queryKey: creditsKeys.balance() });
	}, [queryClient, terminalStatus]);

	const live = useLiveRun({
		handle: realtime,
		enabled: !attemptSettled,
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: connectorGenerationKeys.attempt(attemptId),
			});
			setPollFallback(true);
		},
	});

	useEffect(() => {
		if (live.failed) setPollFallback(true);
	}, [live.failed]);

	// Stopwatch anchor: the durable row's createdAt once known (mount time
	// until then) — a reload keeps the true age instead of restarting at 0:00.
	const mountedAtIso = useRef(new Date().toISOString());

	if (query.isError) {
		return (
			<QueryFailureCard
				config={config}
				onRetry={query.refetch}
				titleOverride={fallbackTitle}
			/>
		);
	}

	const connectorName = attempt?.connectorSlug ?? connector ?? "";
	const toolName = attempt?.toolName ?? tool ?? "";
	const title = attempt
		? joinToolTitle(attempt.connectorSlug, attempt.toolName)
		: fallbackTitle;

	if (!attempt || attempt.status === "queued" || attempt.status === "running") {
		// The chip prefers the provider's own stage (pushed over Realtime every
		// poll) over the coarse run status, so the card flips to "Generating"
		// the moment the provider actually starts rendering.
		const stage =
			typeof live.metadata?.stage === "string"
				? live.metadata.stage
				: undefined;
		const queued = stage
			? QUEUED_STAGE_PATTERN.test(stage)
			: live.status !== undefined
				? QUEUED_RUN_STATUSES.has(live.status)
				: attempt?.status !== "running";
		const startedAtIso = attempt?.createdAt ?? mountedAtIso.current;
		const heading = titleLine(title ?? message, args);

		return (
			<View className="gap-2" accessibilityLiveRegion="polite">
				<View className="flex-row items-center gap-2">
					<View className="h-[22px] w-[22px] items-center justify-center rounded-full border border-accent/40 bg-accent/12">
						<SpinnerArc size={12} />
					</View>
					<Text
						className="font-mono text-[11px] text-accent uppercase"
						style={{ letterSpacing: 1.1 }}
					>
						{t("workspace.chat.mcpTool.generation.sentTo", {
							connector: connectorName,
						})}
					</Text>
				</View>
				<View className="rounded-[14px] border border-accent/30 bg-accent/5 p-3.5">
					<View className="overflow-hidden rounded-[12px] border border-border bg-background p-3.5">
						<View className="flex-row items-center gap-2">
							<Text
								numberOfLines={1}
								className="min-w-0 flex-1 font-sans-medium text-[13.5px] text-foreground"
							>
								{heading}
							</Text>
							<View className="shrink-0 rounded-full border border-accent/35 bg-accent/5 px-2 py-0.5">
								<Text
									className="font-mono text-[10px] text-accent uppercase"
									style={{ letterSpacing: 0.8 }}
								>
									{queued
										? t("workspace.chat.mcpTool.generation.statusQueued")
										: t("workspace.chat.mcpTool.generation.statusGenerating")}
								</Text>
							</View>
						</View>
						<View className="mt-2.5">
							<SweepBar height={4} />
						</View>
						<Text className="mt-2.5 text-[13px] text-muted leading-[19px]">
							{t("workspace.chat.mcpTool.generation.workingHint", {
								connector: connectorName,
							})}
						</Text>
						{toolName === "personal_clipper_create" ? (
							<Text className="mt-1 text-[13px] text-muted leading-[19px]">
								{t("workspace.chat.mcpTool.generation.clipperLongJobHint")}
							</Text>
						) : null}
						<View
							className="mt-2 flex-row items-center gap-1.5"
							style={{ direction: "ltr" }}
						>
							<View
								className="h-1.5 w-1.5 rounded-full"
								style={{ backgroundColor: accent }}
							/>
							<ElapsedTimer
								key={startedAtIso}
								since={startedAtIso}
								className="font-mono text-[11px]"
								color={accent}
							/>
							{toolName === "personal_clipper_create" ? null : (
								<Text className="font-mono text-[11px] text-muted">
									/ {t("workspace.chat.mcpTool.generation.usually")}
								</Text>
							)}
						</View>
					</View>
					<Text
						className="mt-2.5 font-mono text-[10.5px] text-muted/70"
						style={{ writingDirection: "ltr" }}
					>
						{`${connectorName.toLowerCase()} · ${toolName}`}
					</Text>
				</View>
			</View>
		);
	}

	if (attempt.status === "failed") {
		const failure = readAiErrorData(attempt);
		if (failure) {
			return (
				<AiFailureGenerationCard
					config={config}
					failure={failure}
					kind="connector"
					onPrefill={onPrefill}
					prompt={originalPrompt}
				/>
			);
		}
		return (
			<GenerationCardFrame
				config={config}
				detail={attempt.error ?? undefined}
				headline={config.failed}
				titleOverride={title}
				tone="danger"
			/>
		);
	}

	const media = attempt.media.map((item, index) => ({
		key: `${attempt.id}:${index}`,
		kind: item.kind,
		url: item.url,
		label: title ?? config.title,
	}));

	return (
		<GenerationCardFrame
			config={config}
			detail={media.length === 0 ? config.noMedia : undefined}
			headline={config.ready}
			titleOverride={title}
			tone="success"
		>
			{media.length > 0 ? (
				<View className="mt-2">
					<ChatMediaGallery items={media} />
				</View>
			) : null}
		</GenerationCardFrame>
	);
}

/** "Generating the video · 6s · 9:16" — enriched from the call's own args. */
function titleLine(title: string, args: unknown): string {
	const params = readParams(args);
	const duration =
		typeof params?.duration === "number" && params.duration > 0
			? `${params.duration}s`
			: typeof params?.duration === "string" && params.duration.trim()
				? `${params.duration.trim()}s`
				: null;
	const aspect =
		typeof params?.aspect_ratio === "string" && params.aspect_ratio.trim()
			? params.aspect_ratio.trim()
			: null;

	return [title, duration, aspect]
		.filter((piece): piece is string => Boolean(piece))
		.join(" · ");
}

// Higgsfield nests its real arguments as `params` (object or JSON string).
function readParams(args: unknown): Record<string, unknown> | null {
	if (typeof args !== "object" || args === null) {
		return null;
	}

	const params = (args as { params?: unknown }).params;

	if (typeof params === "object" && params !== null && !Array.isArray(params)) {
		return params as Record<string, unknown>;
	}

	if (typeof params === "string") {
		try {
			const parsed: unknown = JSON.parse(params);

			return typeof parsed === "object" &&
				parsed !== null &&
				!Array.isArray(parsed)
				? (parsed as Record<string, unknown>)
				: null;
		} catch {
			return null;
		}
	}

	return null;
}

function MissingAttemptCard({
	config,
	message,
}: {
	config: ToolConfig;
	message: string;
}) {
	return (
		<GenerationCardFrame config={config} headline={message} tone="muted" />
	);
}

function AiFailureGenerationCard({
	failure,
	config,
	kind,
	onPrefill,
	prompt,
}: {
	failure: AiErrorData;
	config: ToolConfig;
	kind?: AsyncGenerationKind;
	onPrefill?: (prompt: string) => void;
	prompt?: string;
}) {
	const { t } = useTranslation();
	const presentation = chatErrorPresentation(null, failure, t);
	const prefillKind = kind ? prefillKindFor(kind) : undefined;

	return (
		<GenerationCardFrame
			config={config}
			titleOverride={presentation.kicker}
			tone="danger"
		>
			<Text
				className="text-[12px] text-muted leading-[17px]"
				style={{ writingDirection: "auto" }}
			>
				{presentation.body}
			</Text>
			{presentation.attribution ? (
				<Text
					className="text-[11.5px] text-muted/80 leading-[17px]"
					style={{ writingDirection: "auto" }}
				>
					{presentation.attribution}
				</Text>
			) : null}
			{presentation.retryable && prefillKind && prompt && onPrefill ? (
				<GenerationPrefillButton
					kind={prefillKind}
					onPrefill={onPrefill}
					prompt={prompt}
				/>
			) : null}
		</GenerationCardFrame>
	);
}

function GenerationPrefillButton({
	kind,
	onPrefill,
	prompt,
}: {
	kind: PrefillGenerationKind;
	onPrefill: (prompt: string) => void;
	prompt: string;
}) {
	const { t } = useTranslation();
	const label = t(
		kind === "image"
			? "native.workspace.chat.aiError.tryAgainPrefill.image"
			: kind === "marketing"
				? "native.workspace.chat.aiError.tryAgainPrefill.marketing"
				: "native.workspace.chat.aiError.tryAgainPrefill.connector",
	);

	return (
		<View className="mt-2 items-start gap-1">
			<Pressable
				accessibilityRole="button"
				onPress={() => onPrefill(prompt)}
				className="min-h-9 items-center justify-center rounded-lg border border-border px-3 active:bg-surface-secondary"
			>
				<Text className="font-sans-semibold text-[12px] text-foreground">
					{label}
				</Text>
			</Pressable>
			<Text className="text-[10.5px] text-muted leading-[15px]">
				{t("native.workspace.chat.aiError.tryAgainPrefill.hint")}
			</Text>
		</View>
	);
}

function QueryFailureCard({
	config,
	onRetry,
	titleOverride,
}: {
	config: ToolConfig;
	onRetry: () => unknown;
	titleOverride?: string;
}) {
	return (
		<GenerationCardFrame
			config={config}
			headline={config.loadError}
			titleOverride={titleOverride}
			tone="danger"
		>
			<Pressable
				accessibilityRole="button"
				className="mt-2 self-start rounded-lg border border-border px-2.5 py-1.5 active:bg-surface-secondary"
				onPress={() => {
					void onRetry();
				}}
			>
				<Text className="font-sans-semibold text-[12px] text-foreground">
					{config.retry}
				</Text>
			</Pressable>
		</GenerationCardFrame>
	);
}

function GenerationCardFrame({
	config,
	headline,
	detail,
	detailWritingDirection = "auto",
	tone = "working",
	isWorking = false,
	readyBadge,
	titleOverride,
	children,
}: {
	config: ToolConfig;
	headline?: string;
	detail?: string;
	detailWritingDirection?: "auto" | "ltr";
	tone?: CardTone;
	isWorking?: boolean;
	readyBadge?: string;
	titleOverride?: string;
	children?: ReactNode;
}) {
	const accent = useThemeColor("accent");
	const danger = useThemeColor("danger");
	const muted = useThemeColor("muted");
	const success = useThemeColor("success");
	const toneColor =
		tone === "danger"
			? danger
			: tone === "success"
				? success
				: tone === "muted"
					? muted
					: accent;
	const iconClassName =
		tone === "danger"
			? "bg-danger/12"
			: tone === "success"
				? "bg-success/12"
				: tone === "muted"
					? "bg-surface-tertiary"
					: "bg-accent/12";
	const headlineClassName =
		tone === "danger"
			? "text-danger"
			: tone === "success"
				? "text-success"
				: "text-muted";

	return (
		<Card
			animation="disable-all"
			className="rounded-[16px] border border-border bg-surface p-3.5"
			variant="transparent"
		>
			<View className="flex-row gap-3">
				<Card.Header
					className={`h-9 w-9 items-center justify-center rounded-xl ${iconClassName}`}
				>
					<WanditIcon name={config.icon} size={16} color={toneColor} />
				</Card.Header>
				<Card.Body className="min-w-0 flex-1 gap-1">
					<View className="flex-row items-center gap-2">
						<Card.Title
							numberOfLines={1}
							className="min-w-0 flex-1 font-sans-semibold text-[13.5px] text-foreground"
						>
							{titleOverride ?? config.title}
						</Card.Title>
						{readyBadge ? (
							<View className="shrink-0 rounded-full border border-success/35 bg-success/8 px-2 py-0.5">
								<Text className="text-[11px] text-success">{readyBadge}</Text>
							</View>
						) : null}
						{isWorking ? <SpinnerArc size={15} /> : null}
					</View>
					{headline ? (
						<Card.Description
							className={`text-[12.5px] leading-[18px] ${headlineClassName}`}
						>
							{headline}
						</Card.Description>
					) : null}
					{detail ? (
						// Detail carries server-relayed prose (error messages, tool
						// notes) that can be RTL — per-line base direction, not the
						// layout's (web parity with the dir="auto" error paragraphs).
						<Text
							className="text-[12px] text-muted leading-[17px]"
							style={{ writingDirection: detailWritingDirection }}
						>
							{detail}
						</Text>
					) : null}
					{children}
				</Card.Body>
			</View>
		</Card>
	);
}

function normalizeOutput(
	kind: AsyncGenerationKind,
	value: unknown,
): NormalizedOutput | null {
	switch (kind) {
		case "page": {
			const parsed = generatePageOutputSchema.safeParse(value);
			return parsed.success ? parsed.data : null;
		}
		case "marketing": {
			const parsed = generateMarketingAssetOutputSchema.safeParse(value);
			return parsed.success ? parsed.data : null;
		}
		case "image": {
			const parsed = generateImageOutputSchema.safeParse(value);
			return parsed.success ? parsed.data : null;
		}
		case "leads": {
			const parsed = scrapeLeadsOutputSchema.safeParse(value);
			return parsed.success ? parsed.data : null;
		}
		case "connector": {
			const parsed = connectorGenerationQueuedOutputSchema.safeParse(value);
			return parsed.success
				? {
						attemptId: parsed.data.attemptId,
						connector: parsed.data.connector,
						message: parsed.data.note,
						realtime: parsed.data.realtime,
						status: parsed.data.status,
						tool: parsed.data.tool,
					}
				: null;
		}
	}
}

function isErrorOutput(value: unknown): boolean {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		(value as Record<string, unknown>).isError === true
	);
}

function prefillKindFor(
	kind: AsyncGenerationKind,
): PrefillGenerationKind | undefined {
	switch (kind) {
		case "image":
			return "image";
		case "marketing":
			return "marketing";
		case "connector":
			return "connector";
		case "page":
		case "leads":
			return undefined;
	}
}

function useToolConfig(kind: AsyncGenerationKind): ToolConfig {
	const { t } = useTranslation();
	const noMedia = t("workspace.chat.mcpTool.generation.noMedia");
	const retry = t("workspace.assets.retry");

	switch (kind) {
		case "marketing":
			return {
				title: t("workspace.marketing.title"),
				icon: "megaphone",
				preparing: t("workspace.chat.marketingAsset.preparing"),
				queueing: t("workspace.chat.marketingAsset.queueing"),
				failedToStart: t("workspace.chat.marketingAsset.failedToStart"),
				queued: t("workspace.marketing.queued"),
				building: t("workspace.chat.marketingAsset.buildingKicker"),
				ready: t("workspace.chat.marketingAsset.readyKicker"),
				failed: t("workspace.chat.marketingAsset.failedKicker"),
				loadError: t("workspace.marketing.loadError"),
				retry: t("workspace.marketing.retry"),
				noMedia,
				missing: t("workspace.chat.marketingAsset.missing"),
			};
		case "image":
			return {
				title: t("workspace.assets.filterImages"),
				icon: "image",
				preparing: t("workspace.chat.generateImage.preparing"),
				queueing: t("workspace.chat.generateImage.queueing"),
				failedToStart: t("workspace.chat.generateImage.failedToStart"),
				queued: t("workspace.chat.generateImage.queuedTitle"),
				building: t("workspace.chat.generateImage.generatingTitle"),
				ready: t("workspace.chat.generateImage.readyTitle"),
				failed: t("workspace.chat.generateImage.failedTitle"),
				loadError: t("workspace.chat.generateImage.statusLoadError"),
				retry: t("workspace.chat.generateImage.retry"),
				noMedia,
				missing: t("workspace.chat.generateImage.statusLoadError"),
			};
		case "connector":
			return {
				title: t("workspace.chat.mcpTool.generation.working"),
				icon: "spark",
				preparing: t("workspace.chat.mcpTool.generation.working"),
				queueing: t("workspace.chat.mcpTool.generation.statusQueued"),
				failedToStart: t("workspace.chat.mcpTool.generation.failed"),
				queued: t("workspace.chat.mcpTool.generation.statusQueued"),
				building: t("workspace.chat.mcpTool.generation.working"),
				ready: t("workspace.chat.mcpTool.generation.ready"),
				failed: t("workspace.chat.mcpTool.generation.failed"),
				loadError: t("workspace.chat.mcpTool.generation.statusLoadError"),
				retry,
				noMedia,
				missing: t("workspace.chat.mcpTool.generation.statusLoadError"),
			};
		case "leads":
			return {
				title: t("leads.title"),
				icon: "users",
				preparing: t("workspace.marketing.generating"),
				queueing: t("workspace.marketing.queued"),
				failedToStart: t("workspace.marketing.failed"),
				queued: t("workspace.marketing.queued"),
				building: t("workspace.marketing.generating"),
				ready: t("workspace.chat.mcpTool.generation.ready"),
				failed: t("workspace.marketing.failed"),
				loadError: t("workspace.assets.loadError"),
				retry,
				noMedia,
				missing: t("workspace.assets.loadError"),
			};
		case "page":
			return {
				title: t("workspace.chat.versionCardKind"),
				icon: "page",
				preparing: t("workspace.marketing.generating"),
				queueing: t("workspace.marketing.queued"),
				failedToStart: t("workspace.marketing.failed"),
				queued: t("workspace.marketing.queued"),
				building: t("workspace.marketing.generating"),
				ready: t("workspace.chat.mcpTool.generation.ready"),
				failed: t("workspace.marketing.failed"),
				loadError: t("workspace.assets.loadError"),
				retry,
				noMedia,
				missing: t("workspace.assets.loadError"),
			};
	}
}

function readStringField(value: unknown, key: string): string | undefined {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return undefined;
	}

	const field = (value as Record<string, unknown>)[key];
	return typeof field === "string" && field.trim() ? field : undefined;
}

function joinToolTitle(
	connector: string | undefined,
	tool: string | undefined,
): string | undefined {
	const values = [connector, tool?.replaceAll("_", " ")].filter(
		(value): value is string => Boolean(value),
	);
	return values.length > 0 ? values.join(" · ") : undefined;
}

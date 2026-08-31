// In-thread card for a scrape_leads call — the native port of the web's
// scrape-leads part. Live progress arrives over Trigger Realtime (the
// Electric long-poll in use-live-run — zero interval polling): the checklist
// walks searching → extracting → verifying → exporting with a found-count
// badge, and on settle ONE refetch of the durable attempt row swaps in the
// result card (file header, 3-row preview table, Download .xlsx). Messages
// without a realtime handle (old history) keep the legacy poll — the durable
// row is their only transport.

import { useQueryClient } from "@tanstack/react-query";
import type {
	LeadScrapeAttempt,
	LeadScrapeStage,
	TriggerRealtimeHandle,
} from "@wandit/contracts";
import { leadScrapesRoutes } from "@wandit/contracts";
import { useTranslation } from "@wandit/internationalization/react";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useThemeColor } from "heroui-native";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { WanditIcon } from "@/components/wandit-icon";
import { leadScrapeKeys } from "@/features/workspace/api/generation.keys";
import { useLeadScrapeAttemptQuery } from "@/features/workspace/api/generation.queries";
import {
	ProgressBar,
	StepRow,
} from "@/features/workspace/components/page-build-card";
import { useLiveRun } from "@/features/workspace/lib/use-live-run";
import { authClient } from "@/lib/auth-client";
import { getServerUrl } from "@/shared/lib/server-url";
import { AppButton } from "@/shared/ui/button";
import { chatErrorPresentation, readAiErrorData } from "../lib/ai-error-copy";

const SOURCE_LABELS: Record<string, string> = {
	"google-maps": "Google Maps",
};

/** Subscribes to the scrape run and picks the progress / result / failed view. */
export function LeadScrapeCard({
	attemptId,
	realtime,
	fallbackQuery,
	fallbackLocation,
}: {
	attemptId: string;
	realtime: TriggerRealtimeHandle | undefined;
	fallbackQuery: string | undefined;
	fallbackLocation: string | undefined;
}) {
	const { t } = useTranslation();
	const queryClient = useQueryClient();

	// Legacy poll only when there is no stream to ride — a healthy realtime
	// subscription makes the attempt row a one-shot fetch + settle refetch.
	const query = useLeadScrapeAttemptQuery(attemptId, realtime === undefined);
	const attempt = query.data;
	const attemptSettled =
		attempt?.status === "succeeded" || attempt?.status === "failed";

	const live = useLiveRun({
		enabled: !attemptSettled,
		handle: realtime,
		onSettled: () => {
			// The run is terminal — ONE refetch of the durable row brings the
			// result (or failure reason) in. No interval anywhere.
			void queryClient.invalidateQueries({
				queryKey: leadScrapeKeys.attempt(attemptId),
			});
		},
	});

	// A dead subscription (expired token, fatal 4xx) gets one durable
	// re-check so the card lands on truth; app re-foregrounding retries the
	// stream itself (use-live-run's AppState hook).
	const reportedDead = useRef(false);
	useEffect(() => {
		if (!live.failed) {
			reportedDead.current = false;
			return;
		}
		if (reportedDead.current) return;
		reportedDead.current = true;
		void queryClient.invalidateQueries({
			queryKey: leadScrapeKeys.attempt(attemptId),
		});
	}, [live.failed, attemptId, queryClient]);

	if (query.isError) {
		return (
			<View className="rounded-[16px] border border-border bg-surface p-3.5">
				<Text className="text-[12.5px] text-muted leading-[18px]">
					{t("workspace.chat.leadScrape.loadError")}
				</Text>
				<Pressable
					accessibilityRole="button"
					className="mt-2 self-start rounded-full border border-border px-3 py-1.5 active:opacity-75"
					onPress={() => void query.refetch()}
				>
					<Text className="text-[12px] text-foreground">
						{t("workspace.assets.retry")}
					</Text>
				</Pressable>
			</View>
		);
	}

	if (attempt?.status === "failed") {
		const failure = readAiErrorData(attempt);
		const presentation = failure
			? chatErrorPresentation(null, failure, t)
			: null;
		return (
			<View className="rounded-[16px] border border-border bg-surface p-3.5">
				<Text className="font-sans-semibold text-[13.5px] text-danger">
					{presentation?.kicker ?? t("workspace.chat.leadScrape.failedTitle")}
				</Text>
				<Text
					className="pt-1 text-[12.5px] text-muted leading-[18px]"
					style={{ writingDirection: "auto" }}
				>
					{presentation?.body ??
						attempt.error ??
						t("workspace.chat.leadScrape.failedDetail")}
				</Text>
				{presentation?.attribution ? (
					<Text
						className="pt-1 text-[11.5px] text-muted/80 leading-[17px]"
						style={{ writingDirection: "auto" }}
					>
						{presentation.attribution}
					</Text>
				) : null}
			</View>
		);
	}

	if (attempt?.status === "succeeded") {
		return <LeadScrapeResultCard attempt={attempt} />;
	}

	// queued / running / first fetch in flight. A dead subscription's last
	// pushed metadata must not shadow the fresher durable row.
	return (
		<LeadScrapeProgressCard
			attempt={attempt}
			live={live.failed ? undefined : live.metadata}
			animationLive={!live.failed}
			fallbackQuery={fallbackQuery}
			fallbackLocation={fallbackLocation}
		/>
	);
}

/* ---------- progress card ---------- */

// Checklist rows 2..5 map onto the pipeline stages in order; row 1 (the
// parsed brief) is done the moment the attempt exists.
const STAGE_ORDER: LeadScrapeStage[] = [
	"queued",
	"searching",
	"extracting",
	"verifying",
	"exporting",
];

const STAGE_KEYS = [
	"searching",
	"extracting",
	"verifying",
	"exporting",
] as const;

function LeadScrapeProgressCard({
	attempt,
	live,
	animationLive,
	fallbackQuery,
	fallbackLocation,
}: {
	attempt: LeadScrapeAttempt | undefined;
	/** Run metadata pushed over Realtime — fresher than the one-shot row. */
	live: Record<string, unknown> | undefined;
	/** False freezes the active spinner (dead subscription). */
	animationLive: boolean;
	fallbackQuery: string | undefined;
	fallbackLocation: string | undefined;
}) {
	const { t } = useTranslation();

	const liveProgress =
		typeof live?.progress === "number" ? live.progress : null;
	const liveFound = typeof live?.found === "number" ? live.found : null;
	const liveStage =
		typeof live?.stage === "string" &&
		STAGE_ORDER.includes(live.stage as LeadScrapeStage)
			? (live.stage as LeadScrapeStage)
			: null;

	const query = attempt?.query || fallbackQuery;
	const location = attempt?.location ?? fallbackLocation;
	const percent = liveProgress ?? attempt?.progress ?? 0;
	const sources = attempt?.sources.length ? attempt.sources : ["google-maps"];
	// While the row still says "queued" the search is about to start — show
	// its row as active rather than an all-pending dead card.
	const stageIndex = Math.max(
		1,
		STAGE_ORDER.indexOf(liveStage ?? attempt?.stage ?? "queued"),
	);
	const foundCount = liveFound ?? attempt?.foundCount ?? 0;

	return (
		<View className="rounded-[16px] border border-border bg-surface p-3.5">
			<View className="flex-row items-center gap-2">
				<Text
					numberOfLines={1}
					className="min-w-0 flex-1 font-sans-semibold text-[13.5px] text-foreground"
				>
					{t("workspace.chat.leadScrape.title")}
				</Text>
				<Text className="font-mono text-[11px] text-accent">
					{Math.round(percent)}%
				</Text>
			</View>
			<ProgressBar percent={percent} />
			<View className="flex-row flex-wrap gap-1.5 pt-2.5">
				{sources.map((source) => (
					<View
						key={source}
						className="flex-row items-center gap-1.5 rounded-full border border-border px-2.5 py-1"
					>
						<View className="h-1.5 w-1.5 rounded-full bg-success" />
						<Text className="text-[11px] text-muted">
							{SOURCE_LABELS[source] ?? source}
						</Text>
					</View>
				))}
			</View>
			<View className="gap-[9px] pt-2.5">
				<StepRow state="done" live={animationLive}>
					{t("workspace.chat.leadScrape.steps.brief")}
					{query ? (
						<Text className="text-muted">
							{" "}
							· {query}
							{location ? ` · ${location}` : ""}
						</Text>
					) : null}
				</StepRow>
				{STAGE_KEYS.map((stage, index) => {
					// Row index within the stage pipeline: searching is 1.
					const rowStage = index + 1;
					const state =
						stageIndex > rowStage
							? "done"
							: stageIndex === rowStage
								? "active"
								: "pending";

					return (
						<StepRow
							key={stage}
							state={state}
							live={animationLive}
							badge={
								stage === "extracting" && foundCount > 0
									? t("workspace.chat.leadScrape.foundBadge", {
											count: foundCount,
										})
									: undefined
							}
						>
							{state === "done"
								? t(`workspace.chat.leadScrape.steps.${stage}Done`)
								: t(`workspace.chat.leadScrape.steps.${stage}Active`)}
						</StepRow>
					);
				})}
			</View>
		</View>
	);
}

/* ---------- result card ---------- */

function LeadScrapeResultCard({ attempt }: { attempt: LeadScrapeAttempt }) {
	const { t } = useTranslation();
	const success = useThemeColor("success");

	const moreRows = Math.max(
		0,
		(attempt.rowCount ?? 0) - attempt.previewRows.length,
	);
	const meta = [
		t("workspace.chat.leadScrape.rowsCount", { count: attempt.rowCount ?? 0 }),
		t("workspace.chat.leadScrape.columnsCount", {
			count: attempt.columnCount ?? 6,
		}),
		formatFileSize(attempt.fileSize),
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<View className="rounded-[16px] border border-border bg-surface p-3.5">
			<View className="flex-row items-center gap-3">
				<View className="h-10 w-10 items-center justify-center rounded-[10px] bg-success/15">
					<WanditIcon name="page" size={18} color={success} />
				</View>
				<View className="min-w-0 flex-1">
					<Text
						numberOfLines={1}
						className="font-sans-semibold text-[13.5px] text-foreground"
						style={{ writingDirection: "ltr" }}
					>
						{attempt.fileName ?? "leads.xlsx"}
					</Text>
					<Text className="pt-0.5 text-[12px] text-muted">{meta}</Text>
				</View>
				<View className="rounded-full border border-success/40 bg-success/10 px-2.5 py-1">
					<Text className="text-[11px] text-success">
						{t("workspace.chat.leadScrape.ready")}
					</Text>
				</View>
			</View>
			{attempt.previewRows.length > 0 ? (
				<View className="mt-3 overflow-hidden rounded-[10px] border border-border">
					<View className="flex-row bg-surface-secondary px-2.5 py-1.5">
						<Text className="w-5 text-center font-mono text-[10px] text-muted uppercase">
							#
						</Text>
						<Text className="flex-1 ps-2 font-mono text-[10px] text-muted uppercase tracking-[1px]">
							{t("workspace.chat.leadScrape.columnBusiness")}
						</Text>
						<Text className="w-[88px] ps-2 font-mono text-[10px] text-muted uppercase tracking-[1px]">
							{t("workspace.chat.leadScrape.columnPhone")}
						</Text>
						<Text className="flex-1 ps-2 font-mono text-[10px] text-muted uppercase tracking-[1px]">
							{t("workspace.chat.leadScrape.columnEmail")}
						</Text>
					</View>
					{attempt.previewRows.map((row, index) => (
						<View
							// biome-ignore lint/suspicious/noArrayIndexKey: preview rows are an immutable ordered snapshot with no ids
							key={`${row.business}-${index}`}
							className="flex-row items-center border-border border-t px-2.5 py-1.5"
						>
							<Text className="w-5 text-center font-mono text-[10px] text-muted/60">
								{index + 1}
							</Text>
							<Text
								numberOfLines={1}
								className="flex-1 ps-2 text-[12px] text-foreground"
								style={{ writingDirection: "auto" }}
							>
								{row.business}
							</Text>
							<Text
								numberOfLines={1}
								className="w-[88px] ps-2 font-mono text-[10.5px] text-muted"
								style={{ writingDirection: "ltr" }}
							>
								{row.phone}
							</Text>
							<Text
								numberOfLines={1}
								className="flex-1 ps-2 text-[11.5px] text-muted"
								style={{ writingDirection: "ltr" }}
							>
								{row.email}
							</Text>
						</View>
					))}
					{moreRows > 0 ? (
						<View className="border-border border-t py-1.5">
							<Text className="text-center text-[11.5px] text-muted">
								{t("workspace.chat.leadScrape.moreRows", { count: moreRows })}
							</Text>
						</View>
					) : null}
				</View>
			) : null}
			<DownloadButton attempt={attempt} />
		</View>
	);
}

/** Downloads the workbook with the session cookie (the phone has no cookie
 * jar) into the cache directory, then hands it to the iOS share sheet. */
function DownloadButton({ attempt }: { attempt: LeadScrapeAttempt }) {
	const { t } = useTranslation();
	const [downloading, setDownloading] = useState(false);
	const [failed, setFailed] = useState(false);

	const handleDownload = async () => {
		setDownloading(true);
		setFailed(false);
		try {
			const url = `${getServerUrl().replace(/\/$/, "")}${leadScrapesRoutes.download(attempt.id)}`;
			const directory = new Directory(Paths.cache, "lead-scrapes");
			directory.create({ idempotent: true, intermediates: true });
			const target = new File(directory, attempt.fileName ?? "leads.xlsx");
			const cookie = authClient.getCookie();
			const file = await File.downloadFileAsync(url, target, {
				headers: cookie ? { Cookie: cookie } : undefined,
				idempotent: true,
			});
			await Sharing.shareAsync(file.uri, {
				dialogTitle: attempt.fileName ?? "leads.xlsx",
				mimeType:
					"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			});
		} catch {
			setFailed(true);
		} finally {
			setDownloading(false);
		}
	};

	return (
		<View className="pt-3">
			{failed ? (
				<Text className="pb-2 text-[12px] text-danger leading-[17px]">
					{t("workspace.chat.leadScrape.downloadError")}
				</Text>
			) : null}
			<AppButton
				isDisabled={downloading}
				size="sm"
				onPress={() => void handleDownload()}
			>
				{downloading
					? t("workspace.chat.leadScrape.downloading")
					: t("workspace.chat.leadScrape.download")}
			</AppButton>
		</View>
	);
}

function formatFileSize(bytes: number | null): string {
	if (!bytes || bytes <= 0) return "";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

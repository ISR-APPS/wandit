// In-thread status card for a generate_marketing_asset call. The document
// itself NEVER renders in chat — generation runs in a background task and the
// finished card lands in the Marketing tab. This part follows the durable
// asset row through the shared Marketing list poll, with Trigger Realtime as
// the instant push on top, so it concludes — ready or failed — without a
// page refresh. (The tool output alone is frozen at "queued" forever.)

import { useQueryClient } from "@tanstack/react-query";
import type { TriggerRealtimeHandle } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { AlertTriangle, ArrowRight, Check } from "lucide-react";
import { useEffect, useRef } from "react";

import { invalidateBalanceAfterGenerationTerminal } from "@/features/credits/lib/terminal-balance-invalidation";
import { useTranslation } from "@/lib/i18n";
import {
	marketingAssetKeys,
	useMarketingAssetsQuery,
} from "../../../api/marketing-assets.queries";
import { useSharedAiChat } from "../../../lib/ai-chat-context";
import {
	durableAiErrorPresentation,
	findToolAiError,
	toolOutputAiError,
} from "../../../lib/ai-error-copy";
import { useWorkspace } from "../../../lib/store";
import type { WanditUIMessage } from "../../../lib/use-ai-chat";
import { useLiveRun } from "../../../lib/use-live-run";
import { SpinnerArc } from "../request-tray/tray-signals";
import { StatusMessageHeader } from "../status-message-header";

type GenerateMarketingAssetToolPart = Extract<
	WanditUIMessage["parts"][number],
	{ type: "tool-generate_marketing_asset" }
>;

export function GenerateMarketingAssetPart({
	part,
	messageParts,
}: {
	part: GenerateMarketingAssetToolPart;
	messageParts?: WanditUIMessage["parts"];
}) {
	const { t } = useTranslation();
	const { prefillComposer } = useSharedAiChat();
	const { projectId } = useWorkspace();
	const queryClient = useQueryClient();

	const queued =
		part.state === "output-available" && part.output.status === "queued";

	// Wake the Marketing tab's list the moment work is queued: the shared list
	// query may be idle (interval off), and the fresh row is what both the tab
	// and this card's live states read from.
	useEffect(() => {
		if (!queued) return;
		void queryClient.invalidateQueries({
			queryKey: marketingAssetKeys.list(projectId),
		});
	}, [queued, projectId, queryClient]);

	if (part.state === "input-streaming" || part.state === "input-available") {
		return (
			<WorkingLine
				text={
					part.state === "input-streaming"
						? t("workspace.chat.marketingAsset.preparing")
						: t("workspace.chat.marketingAsset.queueing")
				}
			/>
		);
	}

	if (part.state === "output-error") {
		const failure = findToolAiError(messageParts, part.toolCallId);
		if (failure) {
			const copy = durableAiErrorPresentation(failure, t);
			return (
				<MarketingFailure
					attribution={copy.attribution}
					body={copy.body}
					onPrefill={prefillComposer}
					prompt={part.input?.brief}
					showPrefill={copy.showRetry}
					title={copy.kicker}
				/>
			);
		}

		return (
			<div>
				<StatusMessageHeader
					avatarClass="border-destructive/38 bg-destructive/14 text-destructive"
					kickerClass="text-destructive"
					kicker={t("workspace.chat.marketingAsset.failedToStart")}
				>
					<AlertTriangle className="size-3" aria-hidden />
				</StatusMessageHeader>
				<p
					dir="auto"
					className="text-[13px] text-muted-foreground leading-[1.5]"
				>
					{t("workspace.chat.marketingAsset.failedBody")}
				</p>
			</div>
		);
	}

	if (part.state !== "output-available") return null;
	const outputFailure = toolOutputAiError(part.output);
	if (outputFailure) {
		const copy = durableAiErrorPresentation(outputFailure, t);
		return (
			<MarketingFailure
				attribution={copy.attribution}
				body={copy.body}
				onPrefill={prefillComposer}
				prompt={part.input?.brief}
				showPrefill={copy.showRetry}
				title={copy.kicker}
			/>
		);
	}

	if (part.output.status === "queued" && part.output.assetId) {
		return (
			<MarketingAssetLiveCard
				assetId={part.output.assetId}
				realtime={part.output.realtime}
				fallbackTitle={part.input?.title}
				fallbackPrompt={part.input?.brief}
				onPrefill={prefillComposer}
			/>
		);
	}

	// "unavailable" — relay the tool's honest message.
	return (
		<p dir="auto" className="text-[13px] text-muted-foreground leading-[1.5]">
			{part.output.message}
		</p>
	);
}

/** The queued card's live lifecycle: building → ready | failed | missing. */
function MarketingAssetLiveCard({
	assetId,
	realtime,
	fallbackTitle,
	fallbackPrompt,
	onPrefill,
}: {
	assetId: string;
	realtime: TriggerRealtimeHandle | undefined;
	fallbackTitle: string | undefined;
	fallbackPrompt: string | undefined;
	onPrefill: (prompt: string) => void;
}) {
	const { t } = useTranslation();
	const { projectId, setTab } = useWorkspace();
	const queryClient = useQueryClient();

	// Shared with the Marketing tab: one list, one poll (2.5s while any asset
	// is working, silent when idle). This is the guarantee under Realtime.
	const {
		data: assets,
		dataUpdatedAt,
		isFetching,
	} = useMarketingAssetsQuery(projectId);
	const asset = assets?.find((row) => row.id === assetId);
	const settled = asset?.status === "succeeded" || asset?.status === "failed";
	const terminalStatus = settled ? asset.status : null;
	// A cached list from BEFORE this card mounted may legitimately miss a
	// just-inserted row — only a fetch completed after mount proves absence.
	const mountedAtRef = useRef(Date.now());
	const absenceConfirmed =
		assets !== undefined &&
		!asset &&
		!isFetching &&
		dataUpdatedAt >= mountedAtRef.current;

	useEffect(() => {
		if (!terminalStatus) return;
		invalidateBalanceAfterGenerationTerminal(queryClient, terminalStatus);
	}, [queryClient, terminalStatus]);

	useLiveRun({
		handle: realtime,
		enabled: !settled,
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: marketingAssetKeys.list(projectId),
			});
		},
	});

	const title = asset?.name ?? fallbackTitle;

	if (asset?.status === "succeeded") {
		return (
			<div>
				<StatusMessageHeader
					avatarClass="border-success/38 bg-success/14 text-success"
					kickerClass="text-success"
					kicker={t("workspace.chat.marketingAsset.readyKicker")}
				>
					<Check className="size-3" aria-hidden />
				</StatusMessageHeader>
				<p
					dir="auto"
					className="text-[13px] text-muted-foreground leading-[1.5]"
				>
					{title
						? t("workspace.chat.marketingAsset.readyNamed", { title })
						: t("workspace.chat.marketingAsset.ready")}
				</p>
				<OpenMarketingTabButton onOpen={() => setTab("marketing")} />
			</div>
		);
	}

	if (asset?.status === "failed") {
		if (asset.failure) {
			const copy = durableAiErrorPresentation(asset.failure, t);
			return (
				<MarketingFailure
					attribution={copy.attribution}
					body={copy.body}
					onPrefill={onPrefill}
					prompt={fallbackPrompt}
					showPrefill={copy.showRetry}
					title={copy.kicker}
				/>
			);
		}

		return (
			<div>
				<StatusMessageHeader
					avatarClass="border-destructive/38 bg-destructive/14 text-destructive"
					kickerClass="text-destructive"
					kicker={t("workspace.chat.marketingAsset.failedKicker")}
				>
					<AlertTriangle className="size-3" aria-hidden />
				</StatusMessageHeader>
				<p
					dir="auto"
					className="text-[13px] text-muted-foreground leading-[1.5]"
				>
					{asset.error ?? t("workspace.chat.marketingAsset.failedBody")}
				</p>
			</div>
		);
	}

	// A post-mount fetch answered without our row (asset deleted): say so
	// instead of a spinner that can never conclude.
	if (absenceConfirmed) {
		return (
			<p dir="auto" className="text-[13px] text-muted-foreground leading-[1.5]">
				{t("workspace.chat.marketingAsset.missing")}
			</p>
		);
	}

	// queued / generating / first fetch still in flight.
	return (
		<div>
			<StatusMessageHeader
				avatarClass="border-primary/38 bg-primary/12 text-ember-text"
				kickerClass="text-ember-text"
				kicker={t("workspace.chat.marketingAsset.buildingKicker")}
			>
				<SpinnerArc className="size-3" />
			</StatusMessageHeader>
			<p dir="auto" className="text-[13px] text-muted-foreground leading-[1.5]">
				{title
					? t("workspace.chat.marketingAsset.buildingNamed", { title })
					: t("workspace.chat.marketingAsset.building")}
			</p>
			<OpenMarketingTabButton onOpen={() => setTab("marketing")} />
		</div>
	);
}

function MarketingFailure({
	title,
	body,
	attribution,
	onPrefill,
	prompt,
	showPrefill,
}: {
	title: string;
	body: string;
	attribution: string | null;
	onPrefill: (prompt: string) => void;
	prompt: string | undefined;
	showPrefill: boolean;
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
			{showPrefill && prompt ? (
				<div className="mt-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-7 rounded-lg px-2.5 text-xs"
						onClick={() => onPrefill(prompt)}
					>
						{t("workspace.chat.aiError.tryAgainPrefill.marketing")}
					</Button>
					<p className="mt-1 text-[10.5px] text-muted-foreground">
						{t("workspace.chat.aiError.tryAgainPrefill.hint")}
					</p>
				</div>
			) : null}
		</div>
	);
}

function OpenMarketingTabButton({ onOpen }: { onOpen: () => void }) {
	const { t } = useTranslation();

	return (
		<Button
			type="button"
			variant="outline"
			size="sm"
			className="mt-2 h-7 rounded-lg px-2.5 text-xs"
			onClick={onOpen}
		>
			{t("workspace.chat.marketingAsset.openTab")}
			<ArrowRight className="size-3" aria-hidden />
		</Button>
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

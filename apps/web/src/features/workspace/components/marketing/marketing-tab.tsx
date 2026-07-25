// Marketing tab: every AI-generated marketing deliverable (ad copy sets,
// strategies, video scripts, creative briefs, custom HTML assets) as a card
// grid, newest first. Clicking a finished card opens the document in a
// sandboxed iframe inside the tab. Data is real (marketing-assets API) and
// the list polls only while something is generating. Header controls live in
// marketing-controls.tsx via shell/main-pane-header.tsx.

import type { MarketingAsset, MarketingAssetType } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@wandit/ui/components/empty";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";
import {
	AlertTriangle,
	ArrowLeft,
	ChevronRight,
	Clapperboard,
	Download,
	FileText,
	LayoutTemplate,
	type LucideIcon,
	Megaphone,
	RefreshCw,
	Route,
} from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@/lib/i18n";
import { relativeTime } from "@/lib/relative-time";
import {
	useMarketingAssetHtmlQuery,
	useMarketingAssetsQuery,
} from "../../api/marketing-assets.queries";
import { marketingAssetDownloadUrl } from "../../api/marketing-assets.services";
import { useWorkspace } from "../../lib/store";
import { SpinnerArc } from "../chat/request-tray/tray-signals";

type TypeLabelKey =
	| "workspace.marketing.types.adCopy"
	| "workspace.marketing.types.marketingStrategy"
	| "workspace.marketing.types.videoScript"
	| "workspace.marketing.types.creativeBrief"
	| "workspace.marketing.types.htmlAsset";

const TYPE_META: Record<
	MarketingAssetType,
	{ icon: LucideIcon; labelKey: TypeLabelKey }
> = {
	"ad-copy": { icon: Megaphone, labelKey: "workspace.marketing.types.adCopy" },
	"marketing-strategy": {
		icon: Route,
		labelKey: "workspace.marketing.types.marketingStrategy",
	},
	"video-script": {
		icon: Clapperboard,
		labelKey: "workspace.marketing.types.videoScript",
	},
	"creative-brief": {
		icon: FileText,
		labelKey: "workspace.marketing.types.creativeBrief",
	},
	"html-asset": {
		icon: LayoutTemplate,
		labelKey: "workspace.marketing.types.htmlAsset",
	},
};

const SKELETON_KEYS = ["a", "b", "c", "d", "e", "f"];

export function MarketingTab() {
	const { projectId } = useWorkspace();
	const assetsQuery = useMarketingAssetsQuery(projectId);
	const [openAssetId, setOpenAssetId] = useState<string | null>(null);

	const assets = assetsQuery.data ?? [];
	const openAsset = assets.find((asset) => asset.id === openAssetId) ?? null;

	if (openAsset) {
		return (
			<MarketingAssetDetail
				asset={openAsset}
				onBack={() => setOpenAssetId(null)}
			/>
		);
	}

	return (
		<div className="h-full overflow-y-auto">
			<div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 md:px-8">
				{assetsQuery.isPending ? (
					<CardGrid>
						{SKELETON_KEYS.map((key) => (
							<Skeleton key={key} className="h-36 rounded-xl" />
						))}
					</CardGrid>
				) : assetsQuery.isError ? (
					<ListError
						onRetry={() => void assetsQuery.refetch()}
						retrying={assetsQuery.isFetching}
					/>
				) : assets.length === 0 ? (
					<MarketingEmptyState />
				) : (
					<CardGrid>
						{assets.map((asset) => (
							<MarketingAssetCard
								key={asset.id}
								asset={asset}
								onOpen={() => setOpenAssetId(asset.id)}
							/>
						))}
					</CardGrid>
				)}
			</div>
		</div>
	);
}

function CardGrid({ children }: { children: React.ReactNode }) {
	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{children}
		</div>
	);
}

function MarketingEmptyState() {
	const { t } = useTranslation();
	const { chatOpen, toggleChat } = useWorkspace();

	return (
		<Empty className="rounded-xl border border-dashed">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<Megaphone />
				</EmptyMedia>
				<EmptyTitle>{t("workspace.marketing.emptyTitle")}</EmptyTitle>
				<EmptyDescription>
					{t("workspace.marketing.emptyBody")}
				</EmptyDescription>
			</EmptyHeader>
			<Button
				size="sm"
				className="mt-1 rounded-lg"
				onClick={() => {
					if (!chatOpen) toggleChat();
				}}
			>
				{t("workspace.marketing.emptyCta")}
			</Button>
		</Empty>
	);
}

function ListError({
	onRetry,
	retrying,
}: {
	onRetry: () => void;
	retrying: boolean;
}) {
	const { t } = useTranslation();

	return (
		<div className="rounded-xl border border-destructive/25 bg-destructive/[0.035] p-4">
			<div className="flex items-start gap-2.5">
				<span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
					<AlertTriangle className="size-3.5" aria-hidden />
				</span>
				<div className="min-w-0 flex-1">
					<p className="font-medium text-[13.5px] text-foreground">
						{t("workspace.marketing.loadError")}
					</p>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="-ms-2 mt-1 h-7 px-2 text-muted-foreground text-xs"
						disabled={retrying}
						onClick={onRetry}
					>
						{retrying ? (
							<SpinnerArc className="size-3" />
						) : (
							<RefreshCw className="size-3" aria-hidden />
						)}
						{t("workspace.marketing.retry")}
					</Button>
				</div>
			</div>
		</div>
	);
}

function MarketingAssetCard({
	asset,
	onOpen,
}: {
	asset: MarketingAsset;
	onOpen: () => void;
}) {
	const { t } = useTranslation();
	const meta = TYPE_META[asset.assetType];
	const Icon = meta.icon;
	const working = asset.status === "queued" || asset.status === "generating";
	const failed = asset.status === "failed";
	const openable = asset.status === "succeeded";

	return (
		<button
			type="button"
			disabled={!openable}
			onClick={onOpen}
			className={cn(
				"group flex flex-col items-stretch rounded-xl border bg-card p-4 text-start transition-shadow",
				openable && "cursor-pointer hover:shadow-md",
				failed && "border-destructive/30 bg-destructive/[0.03]",
				working && "animate-pulse [animation-duration:2.4s]",
			)}
		>
			<div className="flex items-start gap-3">
				<span
					className={cn(
						"grid size-9 shrink-0 place-items-center rounded-lg",
						failed
							? "bg-destructive/10 text-destructive"
							: "bg-primary/10 text-primary",
					)}
				>
					{working ? (
						<SpinnerArc className="size-4" />
					) : (
						<Icon className="size-4" aria-hidden />
					)}
				</span>
				<div className="min-w-0 flex-1">
					<p className="line-clamp-2 font-medium text-[14px] leading-snug">
						{asset.name}
					</p>
					<p className="mt-1 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
						{t(meta.labelKey)}
					</p>
				</div>
				{openable ? (
					<ChevronRight
						className="mt-1 size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5"
						aria-hidden
					/>
				) : null}
			</div>
			<div className="mt-3 flex items-center justify-between gap-2 border-t pt-2.5">
				<span className="font-mono text-[10px] text-muted-foreground">
					{relativeTime(asset.createdAt)}
				</span>
				{working ? (
					<span className="text-[11px] text-muted-foreground">
						{asset.status === "generating"
							? t("workspace.marketing.generating")
							: t("workspace.marketing.queued")}
					</span>
				) : failed ? (
					<span className="line-clamp-1 text-[11px] text-destructive">
						{t("workspace.marketing.failed")}
					</span>
				) : null}
			</div>
		</button>
	);
}

function MarketingAssetDetail({
	asset,
	onBack,
}: {
	asset: MarketingAsset;
	onBack: () => void;
}) {
	const { t } = useTranslation();
	const htmlQuery = useMarketingAssetHtmlQuery(asset.id);
	const meta = TYPE_META[asset.assetType];

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex shrink-0 items-center gap-2 border-b px-4 py-2.5 md:px-6">
				<Button
					variant="ghost"
					size="sm"
					className="h-8 rounded-lg px-2"
					onClick={onBack}
				>
					<ArrowLeft className="size-4" aria-hidden />
					<span className="hidden sm:inline">
						{t("workspace.marketing.back")}
					</span>
				</Button>
				<div className="min-w-0 flex-1">
					<p className="truncate font-medium text-sm">{asset.name}</p>
					<p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
						{t(meta.labelKey)}
					</p>
				</div>
				<Button asChild size="sm" variant="outline" className="h-8 rounded-lg">
					<a href={marketingAssetDownloadUrl(asset.id)}>
						<Download className="size-3.5" aria-hidden />
						<span className="hidden sm:inline">
							{t("workspace.marketing.download")}
						</span>
					</a>
				</Button>
			</div>
			<div className="min-h-0 flex-1 p-3 md:p-4">
				{htmlQuery.isPending ? (
					<Skeleton className="h-full w-full rounded-xl" />
				) : htmlQuery.isError ? (
					<ListError
						onRetry={() => void htmlQuery.refetch()}
						retrying={htmlQuery.isFetching}
					/>
				) : (
					<iframe
						srcDoc={htmlQuery.data.html}
						sandbox="allow-scripts"
						title={asset.name}
						className="h-full w-full rounded-xl border bg-white"
					/>
				)}
			</div>
		</div>
	);
}

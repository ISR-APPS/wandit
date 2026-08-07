// Assets tab: every media file the AI generated for this project — standalone
// image generations, image animations, and the images/videos produced inside
// page builds — in one downloadable grid, newest first. Data comes from the
// project-assets endpoint; a tile click opens a lightbox with the full media.

import type { ProjectAsset } from "@wandit/contracts";
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
	Download,
	Images,
	Play,
	RefreshCw,
	X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useTranslation } from "@/lib/i18n";
import { relativeTime } from "@/lib/relative-time";
import { useProjectAssetsQuery } from "../../api/project-assets.queries";
import { projectAssetDownloadUrl } from "../../api/project-assets.services";
import { useWorkspace } from "../../lib/store";
import { SpinnerArc } from "../chat/request-tray/tray-signals";

type AssetFilter = "all" | "image" | "video";

type SourceLabelKey =
	| "workspace.assets.sourceGeneration"
	| "workspace.assets.sourceAnimation"
	| "workspace.assets.sourceVideo"
	| "workspace.assets.sourceBuild";

const SOURCE_LABEL_KEYS: Record<ProjectAsset["source"], SourceLabelKey> = {
	"image-generation": "workspace.assets.sourceGeneration",
	"image-animation": "workspace.assets.sourceAnimation",
	"video-generation": "workspace.assets.sourceVideo",
	"page-build": "workspace.assets.sourceBuild",
};

const SKELETON_KEYS = ["a", "b", "c", "d", "e", "f", "g", "h"];

export function AssetsTab() {
	const { t } = useTranslation();
	const { projectId } = useWorkspace();
	const assetsQuery = useProjectAssetsQuery(projectId);
	const [filter, setFilter] = useState<AssetFilter>("all");
	const [openAssetId, setOpenAssetId] = useState<string | null>(null);

	const assets = assetsQuery.data ?? [];
	const filtered = useMemo(
		() =>
			filter === "all"
				? assets
				: assets.filter((asset) => asset.kind === filter),
		[assets, filter],
	);
	const openAsset = assets.find((asset) => asset.id === openAssetId) ?? null;

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2.5 md:px-6">
				<div className="flex items-center gap-1">
					<FilterChip
						active={filter === "all"}
						label={t("workspace.assets.filterAll")}
						onClick={() => setFilter("all")}
					/>
					<FilterChip
						active={filter === "image"}
						label={t("workspace.assets.filterImages")}
						onClick={() => setFilter("image")}
					/>
					<FilterChip
						active={filter === "video"}
						label={t("workspace.assets.filterVideos")}
						onClick={() => setFilter("video")}
					/>
				</div>
				<div className="flex items-center gap-2">
					{!assetsQuery.isPending && filtered.length > 0 ? (
						<span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
							{t("workspace.assets.metaCount", { count: filtered.length })}
						</span>
					) : null}
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label={t("workspace.assets.refresh")}
						onClick={() => void assetsQuery.refetch()}
						disabled={assetsQuery.isFetching}
					>
						{assetsQuery.isFetching ? (
							<SpinnerArc className="size-3.5" />
						) : (
							<RefreshCw className="size-3.5" />
						)}
					</Button>
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
				<div className="mx-auto w-full max-w-6xl">
					{assetsQuery.isPending ? (
						<TileGrid>
							{SKELETON_KEYS.map((key) => (
								<Skeleton key={key} className="aspect-square rounded-xl" />
							))}
						</TileGrid>
					) : assetsQuery.isError ? (
						<AssetsError
							onRetry={() => void assetsQuery.refetch()}
							retrying={assetsQuery.isFetching}
						/>
					) : filtered.length === 0 ? (
						<AssetsEmptyState />
					) : (
						<TileGrid>
							{filtered.map((asset) => (
								<AssetTile
									key={asset.id}
									asset={asset}
									projectId={projectId}
									onOpen={() => setOpenAssetId(asset.id)}
								/>
							))}
						</TileGrid>
					)}
				</div>
			</div>

			{openAsset ? (
				<AssetLightbox
					asset={openAsset}
					projectId={projectId}
					onClose={() => setOpenAssetId(null)}
				/>
			) : null}
		</div>
	);
}

function TileGrid({ children }: { children: React.ReactNode }) {
	return (
		<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
			{children}
		</div>
	);
}

function FilterChip({
	active,
	label,
	onClick,
}: {
	active: boolean;
	label: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"rounded-full px-2.5 py-1 text-[12px] transition-colors",
				active
					? "bg-foreground text-background"
					: "text-muted-foreground hover:bg-muted hover:text-foreground",
			)}
		>
			{label}
		</button>
	);
}

function AssetsEmptyState() {
	const { t } = useTranslation();
	return (
		<Empty className="rounded-xl border border-dashed">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<Images />
				</EmptyMedia>
				<EmptyTitle>{t("workspace.assets.emptyTitle")}</EmptyTitle>
				<EmptyDescription>{t("workspace.assets.emptyBody")}</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}

function AssetsError({
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
						{t("workspace.assets.loadError")}
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
						{t("workspace.assets.retry")}
					</Button>
				</div>
			</div>
		</div>
	);
}

function AssetTile({
	asset,
	projectId,
	onOpen,
}: {
	asset: ProjectAsset;
	projectId: string;
	onOpen: () => void;
}) {
	const { t } = useTranslation();

	return (
		<div className="group relative overflow-hidden rounded-xl border bg-card">
			<button
				type="button"
				onClick={onOpen}
				className="block w-full cursor-pointer"
				aria-label={asset.name}
			>
				<div className="relative aspect-square bg-secondary">
					{asset.kind === "image" ? (
						<img
							src={asset.url}
							alt={asset.name}
							loading="lazy"
							className="absolute inset-0 size-full object-cover"
						/>
					) : (
						<>
							<video
								src={asset.url}
								preload="metadata"
								muted
								playsInline
								className="absolute inset-0 size-full object-cover"
							/>
							<span className="absolute inset-0 grid place-items-center">
								<span className="grid size-10 place-items-center rounded-full bg-background/80 text-foreground shadow-sm">
									<Play className="ms-0.5 size-4" aria-hidden />
								</span>
							</span>
						</>
					)}
				</div>
			</button>
			<div className="flex items-center gap-2 p-2.5">
				<div className="min-w-0 flex-1">
					<p className="truncate text-[12.5px]" title={asset.name}>
						{asset.name}
					</p>
					<p className="mt-0.5 font-mono text-[9.5px] text-muted-foreground uppercase tracking-wider">
						{t(SOURCE_LABEL_KEYS[asset.source])}
						{asset.createdAt ? ` · ${relativeTime(asset.createdAt)}` : null}
					</p>
				</div>
				<Button
					asChild
					variant="ghost"
					size="icon-sm"
					className="shrink-0 text-muted-foreground"
				>
					<a
						href={projectAssetDownloadUrl(projectId, asset.key)}
						aria-label={t("workspace.assets.download")}
					>
						<Download className="size-3.5" aria-hidden />
					</a>
				</Button>
			</div>
		</div>
	);
}

function AssetLightbox({
	asset,
	projectId,
	onClose,
}: {
	asset: ProjectAsset;
	projectId: string;
	onClose: () => void;
}) {
	const { t } = useTranslation();

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [onClose]);

	return (
		<div
			className="fixed inset-0 z-50 flex flex-col bg-foreground/70 backdrop-blur-sm"
			role="dialog"
			aria-modal="true"
			aria-label={asset.name}
		>
			{/* Full-surface backdrop button: click anywhere outside the content
			    closes, and it stays keyboard/screen-reader reachable. */}
			<button
				type="button"
				className="absolute inset-0 cursor-default"
				aria-label={t("workspace.assets.close")}
				onClick={onClose}
			/>
			<div className="pointer-events-none relative z-10 flex min-h-0 flex-1 flex-col">
				<div className="flex items-center justify-between gap-3 px-4 py-3">
					<p className="min-w-0 truncate font-medium text-[13.5px] text-background">
						{asset.name}
					</p>
					<div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
						<Button
							asChild
							size="sm"
							variant="secondary"
							className="h-8 rounded-lg"
						>
							<a href={projectAssetDownloadUrl(projectId, asset.key)}>
								<Download className="size-3.5" aria-hidden />
								{t("workspace.assets.download")}
							</a>
						</Button>
						<Button
							size="sm"
							variant="secondary"
							className="h-8 rounded-lg"
							aria-label={t("workspace.assets.close")}
							onClick={onClose}
						>
							<X className="size-4" aria-hidden />
						</Button>
					</div>
				</div>
				<div className="grid min-h-0 flex-1 place-items-center p-4 pt-0">
					{asset.kind === "image" ? (
						<img
							src={asset.url}
							alt={asset.name}
							className="pointer-events-auto max-h-full max-w-full rounded-lg object-contain shadow-2xl"
						/>
					) : (
						<video
							src={asset.url}
							controls
							autoPlay
							playsInline
							className="pointer-events-auto max-h-full max-w-full rounded-lg shadow-2xl"
						>
							<track kind="captions" />
						</video>
					)}
				</div>
			</div>
		</div>
	);
}

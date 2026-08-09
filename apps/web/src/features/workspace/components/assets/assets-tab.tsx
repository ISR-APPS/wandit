// Assets tab: every media file the AI generated for this project — standalone
// image generations, image animations, and the images/videos produced inside
// page builds — in one downloadable grid, newest first. Data comes from the
// project-assets endpoint; a tile click opens a lightbox with the full media.
// The grid/tile/lightbox pieces are shared with the dashboard Assets page
// (asset-tiles.tsx).

import { Button } from "@wandit/ui/components/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@wandit/ui/components/empty";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { Images, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

import { useTranslation } from "@/lib/i18n";
import { useProjectAssetsQuery } from "../../api/project-assets.queries";
import { projectAssetDownloadUrl } from "../../api/project-assets.services";
import { useWorkspace } from "../../lib/store";
import { SpinnerArc } from "../chat/request-tray/tray-signals";
import {
	AssetLightbox,
	AssetsError,
	AssetTile,
	FilterChip,
	TileGrid,
} from "./asset-tiles";

type AssetFilter = "all" | "image" | "video";

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
									downloadHref={projectAssetDownloadUrl(projectId, asset.key)}
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
					downloadHref={projectAssetDownloadUrl(projectId, openAsset.key)}
					onClose={() => setOpenAssetId(null)}
				/>
			) : null}
		</div>
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

// Dashboard Assets page — every AI-generated image and video across all of
// the workspace's projects in one grid, newest first, filterable by project
// and by kind. Reuses the workspace Assets tab's tiles and lightbox; each
// tile is labeled with (and downloads through) its own project.

import type { WorkspaceAsset } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@wandit/ui/components/empty";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@wandit/ui/components/select";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { Images, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

import { DashboardShell } from "@/features/projects/components/shell/dashboard-shell";
import { projectAssetDownloadUrl } from "@/features/workspace/api/project-assets.services";
import {
	AssetLightbox,
	AssetsError,
	AssetTile,
	FilterChip,
	TileGrid,
} from "@/features/workspace/components/assets/asset-tiles";
import { SpinnerArc } from "@/features/workspace/components/chat/request-tray/tray-signals";
import { useTranslation } from "@/lib/i18n";
import { useWorkspaceAssetsQuery } from "../api/workspace-assets.queries";

type AssetFilter = "all" | "image" | "video";

const SKELETON_KEYS = ["a", "b", "c", "d", "e", "f", "g", "h"];

export default function WorkspaceAssetsPage() {
	const { t } = useTranslation();
	const assetsQuery = useWorkspaceAssetsQuery();
	const [filter, setFilter] = useState<AssetFilter>("all");
	const [projectFilter, setProjectFilter] = useState<string>("all");
	const [openAssetId, setOpenAssetId] = useState<string | null>(null);

	const assets = assetsQuery.data?.assets ?? [];

	// The project filter is client-side over the loaded slice — one fetch,
	// instant narrowing, options derived from the assets themselves.
	const projectOptions = useMemo(() => {
		const seen = new Map<string, string>();
		for (const asset of assets) {
			if (!seen.has(asset.projectId)) {
				seen.set(asset.projectId, asset.projectName);
			}
		}
		return [...seen.entries()].map(([id, name]) => ({ id, name }));
	}, [assets]);

	const filtered = useMemo(
		() =>
			assets.filter(
				(asset) =>
					(filter === "all" || asset.kind === filter) &&
					(projectFilter === "all" || asset.projectId === projectFilter),
			),
		[assets, filter, projectFilter],
	);
	const openAsset = assets.find((asset) => asset.id === openAssetId) ?? null;

	return (
		<DashboardShell titleKey="projects.nav.assets">
			<div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-16 md:px-6">
				<div className="mt-8 flex flex-wrap items-start justify-between gap-3">
					<div>
						<h2 className="font-display font-semibold text-lg tracking-tight">
							{t("projects.nav.assets")}
						</h2>
						<p className="mt-0.5 text-muted-foreground text-xs">
							{t("projects.assetsPage.subtitle")}
						</p>
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

				<div className="mt-4 flex flex-wrap items-center gap-2">
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
					{projectOptions.length > 1 ? (
						<Select value={projectFilter} onValueChange={setProjectFilter}>
							<SelectTrigger size="sm" className="ms-auto w-44">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">
									{t("projects.assetsPage.allProjects")}
								</SelectItem>
								{projectOptions.map((project) => (
									<SelectItem key={project.id} value={project.id}>
										<span className="max-w-44 truncate">{project.name}</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					) : null}
				</div>

				<div className="mt-5">
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
						<Empty className="rounded-xl border border-dashed">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<Images />
								</EmptyMedia>
								<EmptyTitle className="font-display">
									{t("projects.assetsPage.emptyTitle")}
								</EmptyTitle>
								<EmptyDescription>
									{t("projects.assetsPage.emptyBody")}
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					) : (
						<>
							<TileGrid>
								{filtered.map((asset: WorkspaceAsset) => (
									<AssetTile
										key={asset.id}
										asset={asset}
										downloadHref={projectAssetDownloadUrl(
											asset.projectId,
											asset.key,
										)}
										projectName={asset.projectName}
										onOpen={() => setOpenAssetId(asset.id)}
									/>
								))}
							</TileGrid>
							{assetsQuery.data?.truncated ? (
								<p className="mt-4 text-center font-mono text-[11px] text-muted-foreground">
									{t("projects.assetsPage.truncatedNote")}
								</p>
							) : null}
						</>
					)}
				</div>

				{openAsset ? (
					<AssetLightbox
						asset={openAsset}
						downloadHref={projectAssetDownloadUrl(
							openAsset.projectId,
							openAsset.key,
						)}
						onClose={() => setOpenAssetId(null)}
					/>
				) : null}
			</div>
		</DashboardShell>
	);
}

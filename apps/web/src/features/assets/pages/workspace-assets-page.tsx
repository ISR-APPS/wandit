/**
 * Dashboard Assets page at `/assets`. It shows every AI-generated image and
 * video of the active workspace, newest first. The user filters them by kind
 * and by project. The route file imports it by path. It calls the workspace
 * assets query. It reuses the tiles and the lightbox of asset-tiles.tsx.
 */

import { ArrowClockwiseIcon } from "@phosphor-icons/react/ArrowClockwise";
import { FunnelSimpleXIcon } from "@phosphor-icons/react/FunnelSimpleX";
import { ImagesSquareIcon } from "@phosphor-icons/react/ImagesSquare";
import type { WorkspaceAsset } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@wandit/ui/components/select";
import { Tabs, TabsList, TabsTrigger } from "@wandit/ui/components/tabs";
import { cn } from "@wandit/ui/lib/utils";
import { useMemo, useState } from "react";

import { DashboardShell } from "@/features/projects/components/shell/dashboard-shell";
import { projectAssetDownloadUrl } from "@/features/workspace/api/project-assets.services";
import {
	AssetLightbox,
	AssetsError,
	AssetTile,
	AssetTileSkeleton,
	TileGrid,
} from "@/features/workspace/components/assets/asset-tiles";
import { useActiveWorkspaceId } from "@/features/workspaces/lib/workspace-provider";
import { useTranslation } from "@/lib/i18n";
import { useWorkspaceAssetsQuery } from "../api/workspace-assets.queries";

type AssetFilter = "all" | "image" | "video";

/** The kind tabs of the toolbar: the filter value, then the dictionary key of its label. */
const KIND_TABS = [
	["all", "workspace.assets.filterAll"],
	["image", "workspace.assets.filterImages"],
	["video", "workspace.assets.filterVideos"],
] as const satisfies ReadonlyArray<readonly [AssetFilter, string]>;

const SKELETON_KEYS = ["a", "b", "c", "d", "e", "f", "g", "h"];

/** The workspace has no asset yet: a night app tile with the images glyph. */
function EmptyState() {
	const { t } = useTranslation();
	return (
		<div className="flex flex-col items-center justify-center rounded-[2rem] border-2 border-night/15 border-dashed px-6 py-16 text-center dark:border-white/15">
			<span
				aria-hidden
				className="grid size-16 -rotate-6 place-items-center rounded-[28%] bg-night shadow-[0_12px_22px_-12px_rgb(11_16_51/0.55)] dark:ring-1 dark:ring-white/10"
			>
				<ImagesSquareIcon weight="duotone" className="size-7 text-spark" />
			</span>
			<h3 className="mt-6 font-bold font-grotesk text-2xl text-night tracking-[-0.03em] dark:text-foreground">
				{t("projects.assetsPage.emptyTitle")}
			</h3>
			<p className="mt-2 max-w-xs text-night/60 text-sm dark:text-foreground/60">
				{t("projects.assetsPage.emptyBody")}
			</p>
		</div>
	);
}

/** The filters hide every asset. Same dashed frame as the empty state, smaller. */
function NoResultsState({ onClear }: { onClear: () => void }) {
	const { t } = useTranslation();
	return (
		<div className="flex flex-col items-center justify-center rounded-[2rem] border-2 border-night/15 border-dashed px-6 py-14 text-center dark:border-white/15">
			<span
				aria-hidden
				className="grid size-12 place-items-center rounded-full bg-white text-night/70 shadow-[0_1px_0_rgb(11_16_51/0.1)] dark:bg-white/10 dark:text-foreground/70"
			>
				<FunnelSimpleXIcon weight="duotone" className="size-5" />
			</span>
			<h3 className="mt-4 font-bold font-grotesk text-lg text-night dark:text-foreground">
				{t("projects.assetsPage.noResultsTitle")}
			</h3>
			<p className="mt-1 max-w-xs text-night/60 text-sm dark:text-foreground/60">
				{t("projects.assetsPage.noResultsBody")}
			</p>
			<Button
				variant="outline"
				size="sm"
				onClick={onClear}
				className="mt-4 rounded-full font-grotesk"
			>
				{t("projects.assetsPage.clearFilters")}
			</Button>
		</div>
	);
}

export default function WorkspaceAssetsPage() {
	// Keyed by the active workspace so a switch remounts the grid: the kind
	// tab and project filter belong to the old scope and must not survive
	// into the new one (a stale project id would filter everything away).
	const activeWorkspaceId = useActiveWorkspaceId();

	return (
		<DashboardShell titleKey="projects.nav.assets">
			<WorkspaceAssetsContent key={activeWorkspaceId ?? "personal"} />
		</DashboardShell>
	);
}

function WorkspaceAssetsContent() {
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

	const handleClearFilters = () => {
		setFilter("all");
		setProjectFilter("all");
	};

	return (
		<div className="mx-auto w-full max-w-6xl px-4 pb-16 md:px-6">
			<div className="mt-6 flex items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="flex items-center gap-2.5">
						<h2 className="font-bold font-grotesk text-[1.75rem] text-night tracking-[-0.035em] dark:text-foreground">
							{t("projects.nav.assets")}
						</h2>
						{assetsQuery.isSuccess ? (
							<span className="rounded-full bg-night/[0.06] px-2 py-0.5 font-grotesk font-semibold text-night/60 text-xs tabular-nums dark:bg-white/[0.08] dark:text-foreground/60">
								{filtered.length}
							</span>
						) : null}
					</div>
					<p className="mt-1 text-night/60 text-sm dark:text-foreground/60">
						{t("projects.assetsPage.subtitle")}
					</p>
				</div>
				<Button
					variant="ghost"
					size="icon"
					aria-label={t("workspace.assets.refresh")}
					onClick={() => void assetsQuery.refetch()}
					disabled={assetsQuery.isFetching}
					className="shrink-0 rounded-full text-night/70 hover:bg-night/[0.06] hover:text-night dark:text-foreground/70 dark:hover:bg-white/[0.06] dark:hover:text-foreground"
				>
					<ArrowClockwiseIcon
						aria-hidden
						weight="bold"
						className={cn(
							"size-4",
							assetsQuery.isFetching &&
								"animate-spin motion-reduce:animate-none",
						)}
					/>
				</Button>
			</div>

			<div className="mt-5 flex flex-wrap items-center gap-2">
				<Tabs
					value={filter}
					// SAFETY: each TabsTrigger value comes from KIND_TABS, and KIND_TABS satisfies AssetFilter.
					onValueChange={(value) => setFilter(value as AssetFilter)}
				>
					{/* The selected kind is a night pill, like the status filter of the dashboard. */}
					<TabsList className="h-9 rounded-full border-0 bg-night/[0.05] p-1 dark:bg-white/[0.06]">
						{KIND_TABS.map(([value, labelKey]) => (
							<TabsTrigger
								key={value}
								value={value}
								className="rounded-full px-3 font-grotesk font-semibold text-night/60 text-xs hover:text-night data-[state=active]:bg-night data-[state=active]:text-paper data-[state=active]:hover:text-paper dark:text-foreground/60 dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-spark dark:data-[state=active]:text-night dark:hover:text-foreground dark:data-[state=active]:hover:text-night"
							>
								{t(labelKey)}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
				{projectOptions.length > 1 ? (
					<Select value={projectFilter} onValueChange={setProjectFilter}>
						<SelectTrigger className="ms-auto h-9 w-44 rounded-full border-night/10 bg-white font-grotesk font-medium text-[13px] text-night dark:border-border dark:bg-card dark:text-foreground">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">
								{t("projects.assetsPage.allProjects")}
							</SelectItem>
							{projectOptions.map((project) => (
								<SelectItem key={project.id} value={project.id}>
									<span dir="auto" className="max-w-44 truncate">
										{project.name}
									</span>
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
							<AssetTileSkeleton key={key} />
						))}
					</TileGrid>
				) : assetsQuery.isError ? (
					<AssetsError
						onRetry={() => void assetsQuery.refetch()}
						retrying={assetsQuery.isFetching}
					/>
				) : filtered.length === 0 && assets.length > 0 ? (
					// Filters produced the emptiness, not the workspace — never show
					// onboarding copy over a filtered-away grid.
					<NoResultsState onClear={handleClearFilters} />
				) : filtered.length === 0 ? (
					<EmptyState />
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
							<p className="mt-4 text-center text-night/60 text-xs dark:text-foreground/60">
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
	);
}

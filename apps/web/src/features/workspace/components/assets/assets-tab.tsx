// Assets tab: every generated page version (soon images/video too), newest
// first. Library is the strict grid; Canvas is the same set as a freeform
// mood board. The view toggle lives in the main card's header (see
// shell/main-pane-header.tsx) — this tab only renders the chosen view under
// a slim meta strip.

import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@wandit/ui/components/empty";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { Images } from "lucide-react";
import { useMemo } from "react";

import { useTranslation } from "@/lib/i18n";
import type { AssetsView } from "../../lib/helpers";
import { useWorkspace } from "../../lib/store";
import { AssetCard } from "./asset-card";
import { AssetsCanvasBoard } from "./assets-canvas";

const SKELETON_KEYS = ["a", "b", "c", "d"];

function AssetCardSkeleton() {
	return (
		<div className="overflow-hidden rounded-xl border bg-card">
			<Skeleton className="aspect-[4/3] w-full rounded-none" />
			<div className="space-y-2 p-3.5">
				<Skeleton className="h-4 w-3/4" />
				<Skeleton className="h-3 w-1/2" />
			</div>
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

export function AssetsTab({ view }: { view: AssetsView }) {
	const { t } = useTranslation();
	const { versions, versionsPending } = useWorkspace();
	const ordered = useMemo(() => [...versions].reverse(), [versions]);

	return (
		<div className="flex h-full min-h-0 flex-col">
			{!versionsPending && ordered.length > 0 ? (
				<div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2.5 font-mono text-[11px] text-muted-foreground md:px-6">
					<span>
						{t("workspace.assets.metaCount", { count: ordered.length })}
					</span>
					<span className="hidden truncate sm:block">
						{t("workspace.assets.subtitle")}
					</span>
				</div>
			) : null}

			<div className="min-h-0 flex-1">
				{versionsPending ? (
					<div className="h-full overflow-y-auto px-4 py-6 md:px-6">
						<div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
							{SKELETON_KEYS.map((key) => (
								<AssetCardSkeleton key={key} />
							))}
						</div>
					</div>
				) : ordered.length === 0 ? (
					<div className="h-full overflow-y-auto px-4 py-6 md:px-6">
						<div className="mx-auto w-full max-w-6xl">
							<AssetsEmptyState />
						</div>
					</div>
				) : view === "library" ? (
					<div className="h-full overflow-y-auto px-4 py-5 md:px-6">
						<div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
							{ordered.map((version) => (
								<AssetCard key={version.id} version={version} />
							))}
						</div>
					</div>
				) : (
					<AssetsCanvasBoard versions={ordered} />
				)}
			</div>
		</div>
	);
}

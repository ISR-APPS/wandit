// Assets tab: gallery of every generated page version, newest first, with
// skeleton cards while the workspace loads and an empty state for fresh
// projects.

import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@wandit/ui/components/empty";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { Images } from "lucide-react";

import { WORKSPACE_COPY } from "../../lib/constants";
import { useWorkspace } from "../../lib/store";
import { AssetCard } from "./asset-card";

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

export function AssetsTab() {
	const { versions, statePending } = useWorkspace();
	const ordered = [...versions].reverse();

	return (
		<div className="h-full overflow-y-auto">
			<div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8">
				<h2 className="font-display font-semibold text-lg">
					{WORKSPACE_COPY.assets.title}
				</h2>
				<p className="text-muted-foreground text-sm">
					{WORKSPACE_COPY.assets.subtitle}
				</p>

				{statePending ? (
					<div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{SKELETON_KEYS.map((key) => (
							<AssetCardSkeleton key={key} />
						))}
					</div>
				) : ordered.length === 0 ? (
					<Empty className="mt-6 rounded-xl border border-dashed">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<Images />
							</EmptyMedia>
							<EmptyTitle>{WORKSPACE_COPY.assets.emptyTitle}</EmptyTitle>
							<EmptyDescription>
								{WORKSPACE_COPY.assets.emptyBody}
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					<div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{ordered.map((version) => (
							<AssetCard key={version.id} version={version} />
						))}
					</div>
				)}
			</div>
		</div>
	);
}

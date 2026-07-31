import {
	ExternalLinkIcon,
	FileBoxIcon,
	ImagesIcon,
	PlayIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { AdminProjectAsset } from "@/features/projects/api/projects.dto";
import {
	formatProjectDate,
	isImageAsset,
	isVideoAsset,
	titleCase,
} from "@/features/projects/lib/project-detail-helpers";

import { ProjectSectionEmpty } from "./project-section-empty";

type ProjectAssetsCardProps = {
	assets: AdminProjectAsset[];
};

export function ProjectAssetsCard({ assets }: ProjectAssetsCardProps) {
	return (
		<Card className="shadow-none">
			<CardHeader>
				<CardTitle>Assets</CardTitle>
				<CardDescription>
					All generated images, videos, and site-build media for this project.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{assets.length > 0 ? (
					<div className="max-h-[52rem] overflow-y-auto overscroll-contain pr-2">
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
							{assets.map((asset) => (
								<AssetTile key={asset.id} asset={asset} />
							))}
						</div>
						<p className="mt-4 text-muted-foreground text-xs">
							Showing all {assets.length} assets. Scroll this section to review
							the full library.
						</p>
					</div>
				) : (
					<ProjectSectionEmpty
						icon={<ImagesIcon aria-hidden="true" />}
						title="No assets yet"
						description="Generated images, videos, and build files will appear here."
					/>
				)}
			</CardContent>
		</Card>
	);
}

function AssetTile({ asset }: { asset: AdminProjectAsset }) {
	return (
		<figure className="min-w-0 overflow-hidden rounded-lg border bg-muted/30">
			<div className="relative aspect-square overflow-hidden bg-muted">
				{isImageAsset(asset) ? (
					<a href={asset.url} target="_blank" rel="noreferrer">
						<img
							src={asset.url}
							alt={asset.name}
							loading="lazy"
							className="size-full object-cover transition-transform duration-300 hover:scale-[1.02]"
						/>
					</a>
				) : isVideoAsset(asset) ? (
					<div className="relative size-full">
						<video
							src={asset.url}
							preload="metadata"
							controls
							playsInline
							aria-label={asset.name}
							className="size-full object-cover"
						>
							<track kind="captions" />
						</video>
						<div className="pointer-events-none absolute top-2 left-2 flex size-7 items-center justify-center rounded-full bg-background/85 text-foreground shadow-xs">
							<PlayIcon className="size-3.5 fill-current" aria-hidden="true" />
						</div>
					</div>
				) : (
					<a
						href={asset.url}
						target="_blank"
						rel="noreferrer"
						className="flex size-full flex-col items-center justify-center gap-2 p-4 text-center text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
					>
						<FileBoxIcon className="size-8" aria-hidden="true" />
						<span className="line-clamp-2 text-xs">{asset.name}</span>
					</a>
				)}
			</div>
			<figcaption className="flex min-w-0 flex-col gap-2 p-3">
				<div className="flex min-w-0 flex-wrap items-center gap-1.5">
					<Badge variant="outline">{titleCase(asset.kind)}</Badge>
					<Badge variant="secondary" className="min-w-0">
						<span className="truncate">{titleCase(asset.source)}</span>
					</Badge>
					<Button
						asChild
						variant="ghost"
						size="icon-xs"
						className="ml-auto text-muted-foreground"
					>
						<a
							href={asset.url}
							target="_blank"
							rel="noreferrer"
							aria-label={`Open ${asset.name}`}
						>
							<ExternalLinkIcon aria-hidden="true" />
						</a>
					</Button>
				</div>
				<p className="truncate font-medium text-xs" title={asset.name}>
					{asset.name}
				</p>
				<time
					dateTime={asset.createdAt ?? undefined}
					className="text-[11px] text-muted-foreground tabular-nums"
				>
					{formatProjectDate(asset.createdAt)}
				</time>
			</figcaption>
		</figure>
	);
}

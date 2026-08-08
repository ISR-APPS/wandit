import { ExternalLinkIcon, Globe2Icon, RefreshCwIcon } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminProjectVersionListItem } from "@/features/projects/api/projects.dto";
import {
	useAdminProjectVersionHtmlQuery,
	useAdminProjectVersionsQuery,
} from "@/features/projects/api/projects.queries";
import {
	formatProjectDateTime,
	statusBadgeVariant,
	titleCase,
} from "@/features/projects/lib/project-detail-helpers";

import { ProjectDetailPagination } from "./project-detail-pagination";

export const PROJECT_VARIATIONS_PAGE_SIZE = 8;

const PREVIEW_VIEWPORT_WIDTH = 1440;
const VARIATION_SKELETON_KEYS = [
	"variation-1",
	"variation-2",
	"variation-3",
	"variation-4",
	"variation-5",
	"variation-6",
] as const;

type ProjectLandingPageVariationsCardProps = {
	projectId: string;
	projectName: string;
	liveUrl: string | null;
};

export function ProjectLandingPageVariationsCard({
	projectId,
	projectName,
	liveUrl,
}: ProjectLandingPageVariationsCardProps) {
	const [page, setPage] = useState(1);
	const [previewVersion, setPreviewVersion] =
		useState<AdminProjectVersionListItem | null>(null);
	const versionsQuery = useAdminProjectVersionsQuery({
		projectId,
		page,
		pageSize: PROJECT_VARIATIONS_PAGE_SIZE,
	});
	const total = versionsQuery.data?.total;
	const pageCount = Math.max(
		1,
		Math.ceil((total ?? 0) / PROJECT_VARIATIONS_PAGE_SIZE),
	);

	// Clamp only against a fetched total: on a failed page fetch `data` is
	// undefined, and clamping then would silently snap back to page 1 and
	// hide the error state before the admin can retry.
	useEffect(() => {
		if (total !== undefined && page > pageCount) {
			setPage(pageCount);
		}
	}, [page, pageCount, total]);

	// Radix keeps the dialog mounted through its exit animation; hold the last
	// previewed version so the closing render keeps its content instead of
	// flashing the "Preview unavailable" fallback.
	const lastPreviewedRef = useRef<AdminProjectVersionListItem | null>(null);
	const handlePreview = useCallback((version: AdminProjectVersionListItem) => {
		lastPreviewedRef.current = version;
		setPreviewVersion(version);
	}, []);
	const handlePreviewOpenChange = useCallback((open: boolean) => {
		if (!open) {
			setPreviewVersion(null);
		}
	}, []);

	return (
		<>
			<Card className="shadow-none">
				<CardHeader>
					<CardTitle>Landing page variations</CardTitle>
					<CardDescription>
						Generated landing page versions, rendered as live previews.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{versionsQuery.isPending ? (
						<VariationsGridSkeleton />
					) : versionsQuery.isError || !versionsQuery.data ? (
						<VariationsErrorState
							error={versionsQuery.error}
							onRetry={() => void versionsQuery.refetch()}
						/>
					) : versionsQuery.data.total === 0 ? (
						<Empty className="min-h-56 border-0 p-6">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<Globe2Icon aria-hidden="true" />
								</EmptyMedia>
								<EmptyTitle>No versions yet</EmptyTitle>
								<EmptyDescription>
									Generated landing page versions will appear here.
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					) : (
						<div
							className="flex flex-col gap-4"
							aria-busy={versionsQuery.isFetching}
						>
							<div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
								{versionsQuery.data.items.map((version) => (
									<VariationCard
										key={version.id}
										projectId={projectId}
										version={version}
										onPreview={handlePreview}
									/>
								))}
							</div>
							<ProjectDetailPagination
								page={page}
								pageSize={versionsQuery.data.pageSize}
								total={versionsQuery.data.total}
								onPageChange={setPage}
							/>
						</div>
					)}
				</CardContent>
			</Card>

			<VariationPreviewDialog
				projectId={projectId}
				projectName={projectName}
				version={previewVersion ?? lastPreviewedRef.current}
				liveUrl={liveUrl}
				open={previewVersion !== null}
				onOpenChange={handlePreviewOpenChange}
			/>
		</>
	);
}

const VariationCard = memo(function VariationCard({
	projectId,
	version,
	onPreview,
}: {
	projectId: string;
	version: AdminProjectVersionListItem;
	onPreview: (version: AdminProjectVersionListItem) => void;
}) {
	const [cardRef, shouldLoadPreview] = useNearViewportOnce<HTMLElement>();
	const htmlQuery = useAdminProjectVersionHtmlQuery({
		projectId,
		versionId: version.id,
		enabled: shouldLoadPreview,
	});

	return (
		<article
			ref={cardRef}
			className="group relative min-w-0 overflow-hidden rounded-lg border bg-background transition-colors hover:border-foreground/25"
		>
			<div className="flex min-w-0 flex-col gap-3 p-4">
				<div className="flex min-w-0 flex-wrap items-center gap-2">
					<p className="font-semibold text-sm tabular-nums">
						v{version.number}
					</p>
					<VersionBadges version={version} />
				</div>
				<div className="min-w-0">
					<p
						className="truncate font-medium text-sm"
						title={version.label ?? undefined}
					>
						{version.label ?? "Untitled variation"}
					</p>
					<div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
						<span>{versionSourceLabel(version)}</span>
						<span aria-hidden="true">·</span>
						<time dateTime={version.createdAt}>
							{formatProjectDateTime(version.createdAt)}
						</time>
					</div>
				</div>
			</div>

			<VersionThumbnail
				versionNumber={version.number}
				html={htmlQuery.data?.html}
				isPending={htmlQuery.isPending}
				isError={htmlQuery.isError}
				error={htmlQuery.error}
				onRetry={() => void htmlQuery.refetch()}
			/>

			<button
				type="button"
				className="absolute inset-0 z-10 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
				aria-label={`Preview version ${version.number}`}
				onClick={() => onPreview(version)}
			/>
		</article>
	);
});

function VersionThumbnail({
	versionNumber,
	html,
	isPending,
	isError,
	error,
	onRetry,
}: {
	versionNumber: number;
	html: string | undefined;
	isPending: boolean;
	isError: boolean;
	error: unknown;
	onRetry: () => void;
}) {
	if (html) {
		return <ScaledHtmlThumbnail html={html} versionNumber={versionNumber} />;
	}

	if (isPending) {
		return (
			<div
				className="aspect-[16/10] overflow-hidden border-t bg-muted"
				role="status"
				aria-label={`Loading preview for version ${versionNumber}`}
			>
				<Skeleton className="size-full rounded-none" />
			</div>
		);
	}

	if (isError) {
		return (
			<div
				className="flex aspect-[16/10] flex-col items-center justify-center gap-2 border-t bg-muted p-4 text-center"
				role="alert"
			>
				<p className="font-medium text-xs">Preview could not be loaded</p>
				<p className="line-clamp-2 text-muted-foreground text-xs">
					{errorMessage(error, "Retry the preview request.")}
				</p>
				<Button
					type="button"
					variant="outline"
					size="xs"
					className="relative z-20"
					onClick={onRetry}
				>
					<RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
					Retry
				</Button>
			</div>
		);
	}

	return (
		<div className="flex aspect-[16/10] items-center justify-center border-t bg-muted p-4 text-center">
			<p className="text-muted-foreground text-xs">Preview unavailable</p>
		</div>
	);
}

const ScaledHtmlThumbnail = memo(function ScaledHtmlThumbnail({
	html,
	versionNumber,
}: {
	html: string;
	versionNumber: number;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [containerSize, setContainerSize] = useState({ height: 0, width: 0 });

	useEffect(() => {
		const container = containerRef.current;
		if (!container) {
			return;
		}

		const measure = () => {
			const { height, width } = container.getBoundingClientRect();
			setContainerSize((current) =>
				current.height === height && current.width === width
					? current
					: { height, width },
			);
		};

		measure();
		if (typeof ResizeObserver === "undefined") {
			return;
		}

		const observer = new ResizeObserver(measure);
		observer.observe(container);

		return () => observer.disconnect();
	}, []);

	const scale = containerSize.width / PREVIEW_VIEWPORT_WIDTH;
	const frameHeight = scale > 0 ? containerSize.height / scale : 0;

	return (
		<div
			ref={containerRef}
			className="relative aspect-[16/10] overflow-hidden border-t bg-muted"
		>
			{scale > 0 ? (
				<iframe
					srcDoc={html}
					sandbox=""
					referrerPolicy="no-referrer"
					tabIndex={-1}
					title={`Version ${versionNumber} landing page thumbnail`}
					className="pointer-events-none absolute top-0 left-0 border-0 bg-white"
					style={{
						height: `${frameHeight}px`,
						transform: `scale(${scale})`,
						transformOrigin: "top left",
						width: `${PREVIEW_VIEWPORT_WIDTH}px`,
					}}
				/>
			) : (
				<Skeleton className="size-full rounded-none" />
			)}
		</div>
	);
});

function VariationPreviewDialog({
	projectId,
	projectName,
	version,
	liveUrl,
	open,
	onOpenChange,
}: {
	projectId: string;
	projectName: string;
	version: AdminProjectVersionListItem | null;
	liveUrl: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const htmlQuery = useAdminProjectVersionHtmlQuery({
		projectId,
		versionId: version?.id,
		enabled: open && version !== null,
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[calc(100vh-2rem)] grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden p-4 sm:max-w-5xl sm:p-6">
				<DialogHeader>
					<div className="flex min-w-0 items-start justify-between gap-3 pr-8">
						<div className="min-w-0">
							<DialogTitle className="truncate">
								{version ? `v${version.number} · ${projectName}` : projectName}
							</DialogTitle>
							<DialogDescription className="mt-1 truncate">
								{version
									? `${version.label ?? "Untitled variation"} · ${versionSourceLabel(version)} · ${formatProjectDateTime(version.createdAt)}`
									: "Landing page version preview"}
							</DialogDescription>
							{version ? (
								<div className="mt-2 flex flex-wrap gap-2">
									<VersionBadges version={version} />
								</div>
							) : null}
						</div>
						{version?.isLive && liveUrl ? (
							<Button asChild variant="outline" size="sm">
								<a href={liveUrl} target="_blank" rel="noreferrer">
									<ExternalLinkIcon
										data-icon="inline-start"
										aria-hidden="true"
									/>
									Open site
								</a>
							</Button>
						) : null}
					</div>
				</DialogHeader>
				<div className="h-[65vh] min-h-72 overflow-hidden rounded-lg border bg-muted">
					<FullSizePreviewContent
						projectName={projectName}
						version={version}
						html={htmlQuery.data?.html}
						isPending={htmlQuery.isPending}
						isError={htmlQuery.isError}
						error={htmlQuery.error}
						onRetry={() => void htmlQuery.refetch()}
					/>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function FullSizePreviewContent({
	projectName,
	version,
	html,
	isPending,
	isError,
	error,
	onRetry,
}: {
	projectName: string;
	version: AdminProjectVersionListItem | null;
	html: string | undefined;
	isPending: boolean;
	isError: boolean;
	error: unknown;
	onRetry: () => void;
}) {
	if (!version) {
		return <PreviewUnavailable />;
	}

	if (html) {
		return (
			<FullSizePreviewIframe
				html={html}
				title={`${projectName} version ${version.number} preview`}
			/>
		);
	}

	if (isPending) {
		return (
			<div
				className="size-full"
				role="status"
				aria-label="Loading page preview"
			>
				<Skeleton className="size-full rounded-none" />
			</div>
		);
	}

	if (isError) {
		return (
			<div
				className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center"
				role="alert"
			>
				<div className="flex flex-col gap-1">
					<p className="font-medium text-sm">Preview could not be loaded</p>
					<p className="text-muted-foreground text-xs">
						{errorMessage(error, "Retry the preview request.")}
					</p>
				</div>
				<Button type="button" variant="outline" size="sm" onClick={onRetry}>
					<RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
					Retry
				</Button>
			</div>
		);
	}

	return <PreviewUnavailable />;
}

const FullSizePreviewIframe = memo(function FullSizePreviewIframe({
	html,
	title,
}: {
	html: string;
	title: string;
}) {
	return (
		<iframe
			srcDoc={html}
			sandbox="allow-scripts"
			referrerPolicy="no-referrer"
			title={title}
			className="size-full border-0 bg-white"
		/>
	);
});

function PreviewUnavailable() {
	return (
		<div className="flex size-full flex-col items-center justify-center gap-2 p-6 text-center">
			<p className="font-medium text-sm">Preview unavailable</p>
			<p className="text-muted-foreground text-xs">
				This version does not have previewable HTML.
			</p>
		</div>
	);
}

function VersionBadges({ version }: { version: AdminProjectVersionListItem }) {
	return (
		<>
			{version.isActive ? (
				<Badge variant={statusBadgeVariant("active")}>Current</Badge>
			) : null}
			{version.isLive ? (
				<Badge variant={statusBadgeVariant("published")}>Published</Badge>
			) : null}
		</>
	);
}

function versionSourceLabel(version: AdminProjectVersionListItem) {
	if (version.source) {
		return titleCase(version.source);
	}

	return version.isBuilderOrigin ? "Builder" : "Unknown source";
}

function VariationsGridSkeleton() {
	return (
		<div
			className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3"
			role="status"
			aria-label="Loading landing page variations"
		>
			{VARIATION_SKELETON_KEYS.map((key) => (
				<div key={key} className="overflow-hidden rounded-lg border">
					<div className="flex flex-col gap-3 p-4">
						<div className="flex gap-2">
							<Skeleton className="h-5 w-8" />
							<Skeleton className="h-5 w-16" />
						</div>
						<Skeleton className="h-4 w-40 max-w-full" />
						<Skeleton className="h-3 w-56 max-w-full" />
					</div>
					<Skeleton className="aspect-[16/10] w-full rounded-none" />
				</div>
			))}
		</div>
	);
}

function VariationsErrorState({
	error,
	onRetry,
}: {
	error: unknown;
	onRetry: () => void;
}) {
	return (
		<Empty className="min-h-56 border-0 p-6">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<Globe2Icon aria-hidden="true" />
				</EmptyMedia>
				<EmptyTitle>Landing page variations could not be loaded</EmptyTitle>
				<EmptyDescription>
					{errorMessage(
						error,
						"Retry the request to see this page's versions.",
					)}
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button type="button" size="sm" onClick={onRetry}>
					<RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
					Retry
				</Button>
			</EmptyContent>
		</Empty>
	);
}

function useNearViewportOnce<TElement extends Element>() {
	const elementRef = useRef<TElement>(null);
	const [hasBeenNearViewport, setHasBeenNearViewport] = useState(
		() => typeof IntersectionObserver === "undefined",
	);

	useEffect(() => {
		if (hasBeenNearViewport) {
			return;
		}

		const element = elementRef.current;
		if (!element) {
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					setHasBeenNearViewport(true);
					observer.disconnect();
				}
			},
			{ rootMargin: "400px 0px" },
		);
		observer.observe(element);

		return () => observer.disconnect();
	}, [hasBeenNearViewport]);

	return [elementRef, hasBeenNearViewport] as const;
}

function errorMessage(error: unknown, fallback: string) {
	return error instanceof Error && error.message ? error.message : fallback;
}

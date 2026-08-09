import { Link } from "@tanstack/react-router";
import { adminRoutes } from "@wandit/contracts";
import {
	ExternalLinkIcon,
	EyeIcon,
	GlobeIcon,
	RefreshCwIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { statusBadgeVariant } from "@/features/projects/lib/project-detail-helpers";
import type { UserLandingPage } from "@/features/users/api/users.dto";
import {
	useProjectVersionHtmlQuery,
	useUserPagesQuery,
} from "@/features/users/api/users.queries";
import { formatAdminDate } from "@/features/users/lib/formatters";
import { buildApiUrl } from "@/lib/api-client";

import { DetailPagination } from "./detail-pagination";

export const LANDING_PAGES_PAGE_SIZE = 10;

const LANDING_PAGE_SKELETON_KEYS = [
	"landing-page-1",
	"landing-page-2",
	"landing-page-3",
	"landing-page-4",
] as const;

type UserLandingPagesProps = {
	userId: string;
};

export function UserLandingPages({ userId }: UserLandingPagesProps) {
	const [page, setPage] = useState(1);
	const [previewPage, setPreviewPage] = useState<UserLandingPage | null>(null);
	const pagesQuery = useUserPagesQuery({
		userId,
		page,
		pageSize: LANDING_PAGES_PAGE_SIZE,
		sort: "recently_updated",
	});
	const pageCount = Math.max(
		1,
		Math.ceil((pagesQuery.data?.total ?? 0) / LANDING_PAGES_PAGE_SIZE),
	);

	useEffect(() => {
		if (page > pageCount) {
			setPage(pageCount);
		}
	}, [page, pageCount]);

	if (pagesQuery.isPending) {
		return <LandingPagesSkeleton />;
	}

	if (pagesQuery.isError || !pagesQuery.data) {
		return (
			<Empty className="min-h-56 border-0 p-6">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<GlobeIcon aria-hidden="true" />
					</EmptyMedia>
					<EmptyTitle>Landing pages could not be loaded</EmptyTitle>
					<EmptyDescription>
						{errorMessage(
							pagesQuery.error,
							"Retry the request to see this user's pages.",
						)}
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button
						type="button"
						size="sm"
						onClick={() => void pagesQuery.refetch()}
					>
						<RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
						Retry
					</Button>
				</EmptyContent>
			</Empty>
		);
	}

	if (pagesQuery.data.items.length === 0) {
		return (
			<Empty className="min-h-56 border-0 p-6">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<GlobeIcon aria-hidden="true" />
					</EmptyMedia>
					<EmptyTitle>No landing pages yet</EmptyTitle>
					<EmptyDescription>
						Generated landing pages will appear here.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<>
			<div className="flex flex-col" aria-busy={pagesQuery.isFetching}>
				<ul className="flex flex-col divide-y">
					{pagesQuery.data.items.map((item) => (
						<LandingPageRow
							key={item.project.id}
							item={item}
							userId={userId}
							onPreview={setPreviewPage}
						/>
					))}
				</ul>
				<DetailPagination
					page={page}
					pageSize={LANDING_PAGES_PAGE_SIZE}
					total={pagesQuery.data.total}
					onPageChange={setPage}
				/>
			</div>
			<PagePreviewDialog
				page={previewPage}
				open={previewPage !== null}
				onOpenChange={(open) => {
					if (!open) {
						setPreviewPage(null);
					}
				}}
			/>
		</>
	);
}

function LandingPageRow({
	item,
	userId,
	onPreview,
}: {
	item: UserLandingPage;
	userId: string;
	onPreview: (page: UserLandingPage) => void;
}) {
	const canPreview =
		item.deployment.published || item.page.activeVersion !== null;
	const publicUrl = item.deployment.published
		? item.deployment.publicUrl
		: null;
	const draftUrl =
		!item.deployment.published && item.page.activeVersion
			? buildApiUrl(
					adminRoutes.projectVersionPreview(
						item.project.id,
						item.page.activeVersion.id,
					),
				)
			: null;
	const openUrl = publicUrl ?? draftUrl;
	const publicHost = getHost(publicUrl);
	const generationFailed = item.page.latestGeneration?.status === "failed";

	return (
		<li className="flex min-w-0 items-center gap-2 py-3 first:pt-0 last:pb-0">
			<Link
				to="/users/$userId/projects/$projectId"
				params={{ userId, projectId: item.project.id }}
				className="-m-1 flex min-w-0 flex-1 items-center gap-3 rounded-md p-1 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
			>
				<PageThumbnail page={item} />
				<div className="min-w-0 flex-1">
					<div className="flex min-w-0 items-center gap-2">
						<p className="truncate font-medium text-sm">{item.project.name}</p>
						{generationFailed ? (
							<Badge
								variant={statusBadgeVariant(
									item.page.latestGeneration?.status ?? "failed",
								)}
							>
								Generation failed
							</Badge>
						) : null}
					</div>
					<p
						className="mt-0.5 truncate text-muted-foreground text-xs"
						title={publicUrl ?? undefined}
					>
						{publicHost ?? "Not published"}
					</p>
					<div className="mt-1 flex flex-wrap gap-x-3 text-muted-foreground text-xs md:hidden">
						<time dateTime={item.project.updatedAt}>
							Updated {formatAdminDate(item.project.updatedAt)}
						</time>
						{item.deployment.publishedAt ? (
							<time dateTime={item.deployment.publishedAt}>
								Published {formatAdminDate(item.deployment.publishedAt)}
							</time>
						) : null}
					</div>
				</div>
				<div className="hidden shrink-0 flex-col items-end gap-1 text-muted-foreground text-xs md:flex">
					<time dateTime={item.project.updatedAt}>
						Updated {formatAdminDate(item.project.updatedAt)}
					</time>
					{item.deployment.publishedAt ? (
						<time dateTime={item.deployment.publishedAt}>
							Published {formatAdminDate(item.deployment.publishedAt)}
						</time>
					) : null}
				</div>
			</Link>
			<div className="flex shrink-0 items-center gap-1">
				<Tooltip>
					<TooltipTrigger asChild>
						<span className="inline-flex">
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								disabled={!canPreview}
								aria-label={`Preview ${item.project.name}`}
								className="text-muted-foreground"
								onClick={() => onPreview(item)}
							>
								<EyeIcon aria-hidden="true" />
							</Button>
						</span>
					</TooltipTrigger>
					<TooltipContent side="top" sideOffset={6}>
						Preview page
					</TooltipContent>
				</Tooltip>
				{openUrl ? (
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								asChild
								variant="ghost"
								size="icon-sm"
								className="text-muted-foreground"
							>
								<a
									href={openUrl}
									target="_blank"
									rel="noreferrer"
									aria-label={
										publicUrl
											? `Open ${item.project.name} live site`
											: `Open ${item.project.name} draft page`
									}
								>
									<ExternalLinkIcon aria-hidden="true" />
								</a>
							</Button>
						</TooltipTrigger>
						<TooltipContent side="top" sideOffset={6}>
							{publicUrl ? "Open live site" : "Open draft page"}
						</TooltipContent>
					</Tooltip>
				) : null}
			</div>
		</li>
	);
}

function PageThumbnail({ page }: { page: UserLandingPage }) {
	return (
		<div className="flex aspect-[16/10] w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground sm:w-28">
			{page.project.previewImageUrl ? (
				<img
					src={page.project.previewImageUrl}
					alt=""
					loading="lazy"
					className="size-full object-cover"
				/>
			) : (
				<GlobeIcon aria-hidden="true" />
			)}
		</div>
	);
}

function PagePreviewDialog({
	page,
	open,
	onOpenChange,
}: {
	page: UserLandingPage | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const activeVersionId = page?.page.activeVersion?.id;
	const isDraft = page !== null && !page.deployment.published;
	const htmlQuery = useProjectVersionHtmlQuery({
		projectId: page?.project.id,
		versionId: activeVersionId,
		enabled: open && isDraft && Boolean(activeVersionId),
	});
	const publicUrl = page?.deployment.published
		? page.deployment.publicUrl
		: null;
	const draftUrl =
		page && !page.deployment.published && activeVersionId
			? buildApiUrl(
					adminRoutes.projectVersionPreview(page.project.id, activeVersionId),
				)
			: null;
	const openUrl = publicUrl ?? draftUrl;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[calc(100vh-2rem)] grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden p-4 sm:max-w-5xl sm:p-6">
				<DialogHeader>
					<div className="flex min-w-0 items-start justify-between gap-3 pr-8">
						<div className="min-w-0">
							<DialogTitle className="truncate">
								{page?.project.name ?? "Page preview"}
							</DialogTitle>
							<DialogDescription
								className="mt-1 truncate"
								title={publicUrl ?? undefined}
							>
								{getHost(publicUrl) ?? "Not published"}
							</DialogDescription>
						</div>
						{openUrl ? (
							<Button asChild variant="outline" size="sm">
								<a href={openUrl} target="_blank" rel="noreferrer">
									<ExternalLinkIcon
										data-icon="inline-start"
										aria-hidden="true"
									/>
									{publicUrl ? "Open site" : "Open page"}
								</a>
							</Button>
						) : null}
					</div>
				</DialogHeader>
				<div className="h-[65vh] min-h-72 overflow-hidden rounded-lg border bg-muted">
					<PreviewContent page={page} htmlQuery={htmlQuery} />
				</div>
			</DialogContent>
		</Dialog>
	);
}

function PreviewContent({
	page,
	htmlQuery,
}: {
	page: UserLandingPage | null;
	htmlQuery: ReturnType<typeof useProjectVersionHtmlQuery>;
}) {
	if (!page) {
		return null;
	}

	if (page.deployment.published && page.deployment.liveUrl) {
		return (
			<iframe
				src={page.deployment.liveUrl}
				sandbox="allow-scripts allow-forms allow-same-origin"
				title={`${page.project.name} preview`}
				className="size-full border-0 bg-white"
			/>
		);
	}

	if (page.deployment.published || !page.page.activeVersion) {
		return (
			<div className="flex size-full flex-col items-center justify-center gap-2 p-6 text-center">
				<p className="font-medium text-sm">Preview unavailable</p>
				<p className="text-muted-foreground text-xs">
					This page does not have a previewable version.
				</p>
			</div>
		);
	}

	if (htmlQuery.isPending) {
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

	if (htmlQuery.isError || !htmlQuery.data) {
		return (
			<div
				className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center"
				role="alert"
			>
				<div className="flex flex-col gap-1">
					<p className="font-medium text-sm">Preview could not be loaded</p>
					<p className="text-muted-foreground text-xs">
						{errorMessage(htmlQuery.error, "Retry the preview request.")}
					</p>
				</div>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => void htmlQuery.refetch()}
				>
					<RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
					Retry
				</Button>
			</div>
		);
	}

	return (
		<iframe
			srcDoc={htmlQuery.data.html}
			sandbox="allow-scripts allow-forms"
			title={`${page.project.name} draft preview`}
			className="size-full border-0 bg-white"
		/>
	);
}

function LandingPagesSkeleton() {
	return (
		<div
			className="flex flex-col divide-y"
			role="status"
			aria-label="Loading landing pages"
		>
			{LANDING_PAGE_SKELETON_KEYS.map((key) => (
				<div
					key={key}
					className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
				>
					<Skeleton className="aspect-[16/10] w-20 shrink-0 sm:w-28" />
					<div className="flex min-w-0 flex-1 flex-col gap-2">
						<Skeleton className="h-4 w-44 max-w-full" />
						<Skeleton className="h-3 w-32 max-w-full" />
					</div>
					<Skeleton className="hidden h-8 w-24 md:block" />
					<Skeleton className="size-8 shrink-0" />
				</div>
			))}
		</div>
	);
}

function getHost(url: string | null): string | null {
	if (!url) {
		return null;
	}

	try {
		return new URL(url).host;
	} catch {
		return url;
	}
}

function errorMessage(error: unknown, fallback: string) {
	return error instanceof Error && error.message ? error.message : fallback;
}

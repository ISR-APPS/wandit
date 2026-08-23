import { Link } from "@tanstack/react-router";
import { RefreshCwIcon, UserPlusIcon } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationControls } from "@/features/affiliates/components/affiliate-ui";
import {
	formatOverviewDate,
	formatOverviewUsdMinor,
	formatOverviewWholeNumber,
} from "@/features/overview/lib/formatters";
import type {
	StoryLinkRecentSignup,
	StoryLinkSignupsResponse,
	StoryLinkStatsResponse,
	StoryLinksQuery,
} from "@/features/story-links/api/story-links.dto";
import {
	useStoryLinkSignupsQuery,
	useStoryLinkStatsQuery,
} from "@/features/story-links/api/story-links.queries";
import { StoryLinkClicksChart } from "@/features/story-links/components/story-link-clicks-chart";
import { StoryLinkShortUrl } from "@/features/story-links/components/story-link-short-url";
import { formatStoryLinkConversionRate } from "@/features/story-links/lib/story-link-helpers";
import { getInitials } from "@/features/users/components/table/users-table-utils";
import { formatAdminDateRangeLabel } from "@/lib/admin-date-range";
import { isApiClientError } from "@/lib/api-client";

type StoryLinkDetailSheetProps = {
	storyLinkId: string | null;
	query: StoryLinksQuery;
	onClose: () => void;
};

const PAGE_SIZE = 10;
const signupLoadingRows = ["one", "two", "three", "four"] as const;

function StoryLinkDetailSheet(props: StoryLinkDetailSheetProps) {
	return (
		<StoryLinkDetailSheetContent
			key={props.storyLinkId ?? "no-story-link"}
			{...props}
		/>
	);
}

function StoryLinkDetailSheetContent({
	storyLinkId,
	query,
	onClose,
}: StoryLinkDetailSheetProps) {
	const open = storyLinkId !== null;
	const [page, setPage] = useState(1);
	const statsQuery = useStoryLinkStatsQuery(storyLinkId, query);
	const signupsQuery = useStoryLinkSignupsQuery(
		storyLinkId,
		{ ...query, page, pageSize: PAGE_SIZE },
		{ enabled: open },
	);
	const stats = statsQuery.data;

	useEffect(() => {
		const data = signupsQuery.data;
		if (
			signupsQuery.isPlaceholderData ||
			!data ||
			data.page !== page ||
			data.items.length > 0 ||
			data.total === 0 ||
			page <= 1
		) {
			return;
		}

		setPage((currentPage) => Math.max(1, currentPage - 1));
	}, [page, signupsQuery.data, signupsQuery.isPlaceholderData]);

	return (
		<Sheet
			open={open}
			onOpenChange={(next) => {
				if (!next) {
					onClose();
				}
			}}
		>
			<SheetContent className="w-full gap-0 sm:max-w-2xl">
				{statsQuery.isPending ? (
					<StoryLinkDetailLoading />
				) : statsQuery.isError || !stats ? (
					<StoryLinkDetailError
						error={statsQuery.error}
						onRetry={() => void statsQuery.refetch()}
					/>
				) : (
					<StoryLinkDetailContent
						stats={stats}
						query={query}
						signupsData={signupsQuery.data}
						signupsError={signupsQuery.error}
						signupsIsError={signupsQuery.isError}
						signupsIsPending={signupsQuery.isPending}
						onPageChange={setPage}
						onRetrySignups={() => void signupsQuery.refetch()}
					/>
				)}
			</SheetContent>
		</Sheet>
	);
}

function StoryLinkDetailContent({
	stats,
	query,
	signupsData,
	signupsError,
	signupsIsError,
	signupsIsPending,
	onPageChange,
	onRetrySignups,
}: {
	stats: StoryLinkStatsResponse;
	query: StoryLinksQuery;
	signupsData: StoryLinkSignupsResponse | undefined;
	signupsError: unknown;
	signupsIsError: boolean;
	signupsIsPending: boolean;
	onPageChange: (page: number) => void;
	onRetrySignups: () => void;
}) {
	const { clicks, conversion, link, signups } = stats;
	const rangeLabel = formatAdminDateRangeLabel(query);

	return (
		<>
			<SheetHeader className="gap-3 border-b p-5 pe-12">
				<div className="flex min-w-0 flex-wrap items-center gap-2">
					<SheetTitle className="min-w-0 truncate text-lg">
						{link.name}
					</SheetTitle>
					{link.archivedAt ? <ArchivedBadge /> : null}
				</div>
				<SheetDescription>
					Performance and attribution · {rangeLabel.toLowerCase()}
				</SheetDescription>
				<StoryLinkShortUrl link={link} mobile pathOnly />
				<div className="flex flex-wrap gap-1.5">
					<AttributionBadge label="Source" value={link.utmSource} />
					<AttributionBadge label="Medium" value={link.utmMedium} />
					<AttributionBadge label="Campaign" value={link.utmCampaign} />
					{link.utmContent ? (
						<AttributionBadge label="Content" value={link.utmContent} />
					) : null}
				</div>
				<dl className="grid min-w-0 gap-3 text-left sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-5">
					<div className="min-w-0">
						<dt className="text-muted-foreground text-xs">Destination</dt>
						<dd
							className="mt-1 line-clamp-2 break-all font-mono text-xs"
							title={link.destinationPath}
						>
							{link.destinationPath}
						</dd>
					</div>
					<div>
						<dt className="text-muted-foreground text-xs">Created</dt>
						<dd className="mt-1 text-sm tabular-nums">
							{formatOverviewDate(link.createdAt)}
						</dd>
					</div>
				</dl>
			</SheetHeader>

			<div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
				<StatSection title="In selected range">
					<div className="grid grid-cols-3 gap-2">
						<StatTile
							label="Clicks"
							value={formatOverviewWholeNumber(clicks.inRange)}
						/>
						<StatTile
							label="Unique visitors"
							value={formatOverviewWholeNumber(clicks.uniqueInRange)}
						/>
						<StatTile
							label="Signups"
							value={formatOverviewWholeNumber(signups.inRange)}
						/>
					</div>
				</StatSection>

				<StatSection title="All time">
					<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
						<StatTile
							label="Clicks"
							value={formatOverviewWholeNumber(clicks.allTime)}
						/>
						<StatTile
							label="Signups"
							value={formatOverviewWholeNumber(signups.allTime)}
						/>
						<StatTile
							label="Activated"
							value={formatOverviewWholeNumber(conversion.activatedUsers)}
						/>
						<StatTile
							label="Paid customers"
							value={formatOverviewWholeNumber(conversion.convertedToPaid)}
						/>
						<StatTile
							label="Live subscriptions"
							value={formatOverviewWholeNumber(conversion.liveSubscriptions)}
						/>
						<StatTile
							label="Revenue"
							value={formatOverviewUsdMinor(conversion.revenueUsdCents)}
						/>
					</div>
				</StatSection>

				<section className="space-y-3">
					<div>
						<h3 className="font-medium text-sm">Conversion rates</h3>
						<p className="mt-1 text-muted-foreground text-xs">
							Based on all-time totals
						</p>
					</div>
					<dl className="grid grid-cols-2 divide-x rounded-lg border bg-muted/20">
						<RateMetric
							label="Click → signup"
							value={formatStoryLinkConversionRate(
								signups.allTime,
								clicks.allTime,
							)}
						/>
						<RateMetric
							label="Signup → paid"
							value={formatStoryLinkConversionRate(
								conversion.convertedToPaid,
								signups.allTime,
							)}
						/>
					</dl>
				</section>

				<StoryLinkClicksChart
					points={stats.clicksByDay}
					rangeLabel={rangeLabel}
					scope="link"
				/>

				<Signups
					data={signupsData}
					error={signupsError}
					isError={signupsIsError}
					isPending={signupsIsPending}
					onPageChange={onPageChange}
					onRetry={onRetrySignups}
				/>

				<p className="border-t pt-4 text-muted-foreground text-xs leading-relaxed">
					Signups are matched by attribution cookie; visitors who cleared
					cookies or signed up after 30 days are not counted.
				</p>
			</div>
		</>
	);
}

function StoryLinkDetailLoading() {
	return (
		<>
			<SheetHeader className="gap-3 border-b p-5 pe-12">
				<SheetTitle className="sr-only">Story link details</SheetTitle>
				<SheetDescription className="sr-only">
					Loading story-link performance and attribution.
				</SheetDescription>
				<Skeleton className="h-6 w-52" />
				<Skeleton className="h-4 w-40" />
				<Skeleton className="h-7 w-44" />
				<div className="flex flex-wrap gap-2">
					<Skeleton className="h-5 w-20" />
					<Skeleton className="h-5 w-24" />
					<Skeleton className="h-5 w-28" />
				</div>
				<Skeleton className="h-10 w-full" />
			</SheetHeader>
			<div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
				<SkeletonSection
					tileKeys={["range-clicks", "range-unique", "range-signups"]}
				/>
				<SkeletonSection
					responsive
					tileKeys={[
						"all-clicks",
						"all-signups",
						"all-activated",
						"all-paid",
						"all-live",
						"all-revenue",
					]}
				/>
				<div className="space-y-3">
					<Skeleton className="h-4 w-32" />
					<Skeleton className="h-20 w-full" />
				</div>
				<Skeleton className="h-[390px] w-full" />
				<div className="space-y-3">
					<Skeleton className="h-4 w-28" />
					<Skeleton className="h-20 w-full" />
					<Skeleton className="h-20 w-full" />
				</div>
			</div>
		</>
	);
}

function SkeletonSection({
	tileKeys,
	responsive = false,
}: {
	tileKeys: readonly string[];
	responsive?: boolean;
}) {
	return (
		<div className="space-y-3">
			<Skeleton className="h-4 w-28" />
			<div
				className={
					responsive
						? "grid grid-cols-2 gap-2 sm:grid-cols-3"
						: "grid grid-cols-3 gap-2"
				}
			>
				{tileKeys.map((key) => (
					<Skeleton key={key} className="h-20 w-full" />
				))}
			</div>
		</div>
	);
}

function StoryLinkDetailError({
	error,
	onRetry,
}: {
	error: unknown;
	onRetry: () => void;
}) {
	return (
		<>
			<SheetHeader className="border-b p-5 pe-12">
				<SheetTitle>Story link details</SheetTitle>
				<SheetDescription>
					Performance and attribution for this link.
				</SheetDescription>
			</SheetHeader>
			<div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
				<p className="font-medium">Story-link details could not be loaded</p>
				<p className="max-w-sm text-muted-foreground text-sm">
					{isApiClientError(error)
						? error.message
						: "Retry the request to restore this link's statistics."}
				</p>
				<Button type="button" onClick={onRetry}>
					<RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
					Retry
				</Button>
			</div>
		</>
	);
}

function StatSection({
	title,
	children,
}: {
	title: string;
	children: ReactNode;
}) {
	return (
		<section className="space-y-3">
			<h3 className="font-medium text-sm">{title}</h3>
			{children}
		</section>
	);
}

function StatTile({ label, value }: { label: string; value: string }) {
	return (
		<div className="min-w-0 rounded-lg border bg-muted/20 p-3">
			<p className="text-muted-foreground text-xs">{label}</p>
			<p className="mt-2 break-words font-semibold text-xl tabular-nums">
				{value}
			</p>
		</div>
	);
}

function RateMetric({ label, value }: { label: string; value: string }) {
	return (
		<div className="min-w-0 p-3">
			<dt className="text-muted-foreground text-xs">{label}</dt>
			<dd className="mt-2 font-semibold text-lg tabular-nums">{value}</dd>
		</div>
	);
}

function Signups({
	data,
	error,
	isError,
	isPending,
	onPageChange,
	onRetry,
}: {
	data: StoryLinkSignupsResponse | undefined;
	error: unknown;
	isError: boolean;
	isPending: boolean;
	onPageChange: (page: number) => void;
	onRetry: () => void;
}) {
	return (
		<section className="space-y-3">
			<div className="flex items-center gap-2">
				<h3 className="font-medium text-sm">Signups</h3>
				{data ? (
					<Badge variant="secondary" className="tabular-nums">
						{formatOverviewWholeNumber(data.total)}
					</Badge>
				) : null}
			</div>
			{isPending ? (
				<SignupsLoading />
			) : isError || !data ? (
				<div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-5 py-8 text-center">
					<div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
						<UserPlusIcon className="size-5" aria-hidden="true" />
					</div>
					<p className="font-medium text-sm">Signups could not be loaded</p>
					<p className="max-w-sm text-muted-foreground text-xs leading-relaxed">
						{isApiClientError(error)
							? error.message
							: "Retry the request to restore this signup list."}
					</p>
					<Button type="button" size="sm" onClick={onRetry}>
						<RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
						Retry
					</Button>
				</div>
			) : data.items.length === 0 ? (
				<div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-5 py-8 text-center">
					<div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
						<UserPlusIcon className="size-5" aria-hidden="true" />
					</div>
					<p className="font-medium text-sm">No attributed signups yet</p>
					<p className="max-w-sm text-muted-foreground text-xs leading-relaxed">
						Signups will appear here when visitors from this link create an
						account.
					</p>
				</div>
			) : (
				<div className="overflow-hidden rounded-lg border">
					<ul className="divide-y">
						{data.items.map((signup) => (
							<RecentSignupRow key={signup.userId} signup={signup} />
						))}
					</ul>
					<PaginationControls
						page={data.page}
						pageSize={data.pageSize}
						total={data.total}
						onPageChange={onPageChange}
					/>
				</div>
			)}
		</section>
	);
}

function SignupsLoading() {
	return (
		<div className="divide-y overflow-hidden rounded-lg border">
			{signupLoadingRows.map((row) => (
				<div key={row} className="flex items-center gap-3 p-3">
					<Skeleton className="size-10 shrink-0 rounded-full" />
					<div className="min-w-0 flex-1 space-y-2">
						<Skeleton className="h-4 w-40 max-w-full" />
						<Skeleton className="h-3 w-56 max-w-full" />
					</div>
					<div className="shrink-0 space-y-2">
						<Skeleton className="h-5 w-12" />
						<Skeleton className="h-3 w-20" />
					</div>
				</div>
			))}
		</div>
	);
}

function RecentSignupRow({ signup }: { signup: StoryLinkRecentSignup }) {
	const displayName = signup.name || "Unnamed user";

	return (
		<li className="flex min-w-0 items-center gap-3 p-3">
			<Avatar size="lg" className="border">
				<AvatarImage src={signup.image ?? undefined} alt="" />
				<AvatarFallback className="font-medium">
					{getInitials(displayName)}
				</AvatarFallback>
			</Avatar>
			<div className="min-w-0 flex-1">
				<Link
					to="/users/$userId"
					params={{ userId: signup.userId }}
					className="block truncate font-medium text-foreground text-sm outline-none hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring"
				>
					{displayName}
				</Link>
				<p className="truncate text-muted-foreground text-xs">{signup.email}</p>
			</div>
			<div className="shrink-0 text-right">
				{signup.convertedToPaid ? (
					<Badge
						variant="outline"
						className="border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300"
					>
						Paid
					</Badge>
				) : null}
				<p className="mt-1 text-muted-foreground text-xs tabular-nums">
					<time dateTime={signup.signedUpAt}>
						{formatOverviewDate(signup.signedUpAt)}
					</time>
				</p>
			</div>
		</li>
	);
}

function AttributionBadge({ label, value }: { label: string; value: string }) {
	return (
		<Badge
			variant="outline"
			className="max-w-full gap-1 bg-muted/30 px-1.5 font-normal text-muted-foreground"
			title={value}
		>
			<span className="text-foreground/60">{label}:</span>
			<span className="truncate">{value}</span>
		</Badge>
	);
}

function ArchivedBadge() {
	return (
		<Badge
			variant="outline"
			className="border-border bg-muted/60 text-muted-foreground"
		>
			Archived
		</Badge>
	);
}

export type { StoryLinkDetailSheetProps };
export { StoryLinkDetailSheet };

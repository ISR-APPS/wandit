// The detail page of one listing: the header with the status, the facts, the market activity,
// the enquiries, the viewings, and a rail with the people and the history.
// The /app/listings/$listingId route renders it after its loader. The route also uses the skeleton below.
// An unknown id shows a not-found block with a link back to the list.
import { HouseLineIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { addressOf, ListingStatusBadge } from "~/features/agency";
import { PageHeader } from "~/features/app-shell";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { CaretLeftIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import { listingQueryOptions } from "../api/listings.queries";
import { ListingActivityCard } from "./listing-activity-card";
import { ListingEnquiriesCard } from "./listing-enquiries-card";
import { ListingFactsCard } from "./listing-facts-card";
import { ListingPeopleCard } from "./listing-people-card";
import { ListingTimelineCard } from "./listing-timeline-card";
import { ListingViewingsCard } from "./listing-viewings-card";

type ListingDetailPageProps = {
	/** The `$listingId` param of the URL, for example "KS-4770". The query treats an unknown id as not found. */
	listingId: string;
};

/** The detail page. A 2/3 main column and a 1/3 rail from the 5xl container width. */
export function ListingDetailPage({ listingId }: ListingDetailPageProps) {
	const { t } = useT();
	const { data: detail } = useSuspenseQuery(listingQueryOptions(listingId));
	const now = Date.now();

	const backLink = (
		<Button
			asChild
			variant="ghost"
			size="sm"
			className="-ms-3 justify-self-start max-sm:h-11"
		>
			<Link to="/app/listings">
				<CaretLeftIcon className="rtl:rotate-180" />
				{t("listings.allListings")}
			</Link>
		</Button>
	);
	if (!detail) {
		return (
			<div className="grid gap-4">
				{backLink}
				<Card>
					<CardContent className="grid justify-items-center gap-3 py-12 text-center">
						<HouseLineIcon className="size-8 text-muted-foreground" />
						<p className="max-w-sm text-muted-foreground text-sm">
							{t("listings.notFound")}
						</p>
						<Button asChild variant="outline" className="max-sm:h-11">
							<Link to="/app/listings">{t("listings.seeAll")}</Link>
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}
	const { listing } = detail;

	return (
		<div className="grid gap-6">
			{backLink}
			<PageHeader
				title={addressOf(listing)}
				description={
					<span className="flex flex-wrap items-center gap-2">
						<ListingStatusBadge status={listing.status} />
						<span>
							{`${listing.neighborhood} · ${t(`agency.propertyTypes.${listing.type}`)} · ${listing.id}`}
						</span>
					</span>
				}
			/>
			<div className="grid @4xl/main:grid-cols-3 grid-cols-1 items-start gap-6">
				<div className="@4xl/main:col-span-2 grid min-w-0 gap-6">
					<ListingFactsCard listing={listing} />
					<ListingActivityCard listing={listing} />
					<ListingEnquiriesCard enquiries={detail.enquiries} now={now} />
					<ListingViewingsCard
						viewings={detail.viewings}
						listingAgentId={detail.agent.id}
					/>
				</div>
				{/* The rail is short, so from 56rem it stays in view while the user reads the enquiries and the viewings. */}
				<div className="@4xl/main:sticky @4xl/main:top-20 grid min-w-0 gap-6">
					<ListingPeopleCard
						listing={listing}
						agent={detail.agent}
						buyer={detail.buyer}
					/>
					<ListingTimelineCard steps={detail.timeline} />
				</div>
			</div>
		</div>
	);
}

/** Placeholder while the detail loader runs. The route sets it as pendingComponent. */
export function ListingDetailPageSkeleton() {
	return (
		<div className="grid gap-6">
			<Skeleton className="h-8 w-28" />
			<div className="grid gap-2">
				<Skeleton className="h-8 w-72 max-w-full" />
				<Skeleton className="h-5 w-56" />
			</div>
			<div className="grid @4xl/main:grid-cols-3 grid-cols-1 items-start gap-6">
				<div className="@4xl/main:col-span-2 grid gap-6">
					<Skeleton className="h-72" />
					<Skeleton className="h-32" />
					<Skeleton className="h-64" />
				</div>
				<div className="grid gap-6">
					<Skeleton className="h-36" />
					<Skeleton className="h-64" />
				</div>
			</div>
		</div>
	);
}

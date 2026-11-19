// The page of one shipment, in the kit profile layout: the header, three tabs, then a 1/3 and a 2/3 column.
// Start column: the profile card, the delivery progress, the handling marks. End column: the timeline, then the
// related shipments beside the contacts. The /app/shipments/$shipmentId route renders it after its loader.
// An unknown id shows a not-found block with a link back to the list.
import { PhoneIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { ShipmentStatusBadge, telHref } from "~/features/logistics";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { CaretLeftIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { shipmentQueryOptions } from "../api/shipments.queries";
import { ContactsCard } from "./contacts-card";
import { DeliveryProgressCard } from "./delivery-progress-card";
import { HandlingCard } from "./handling-card";
import { RelatedShipmentsCard } from "./related-shipments-card";
import { ShipmentProfileCard } from "./shipment-profile-card";
import { ShipmentTimeline } from "./shipment-timeline";

/** The tabs of the page. Overview shows every card; the other two show one card at full width. */
const DETAIL_TABS = ["overview", "timeline", "related"] as const;
type DetailTab = (typeof DETAIL_TABS)[number];

// The Overview timeline shows the newest events. "View all" opens the Timeline tab with every event.
const OVERVIEW_EVENTS = 3;

type ShipmentDetailPageProps = {
	/** The `$shipmentId` param of the URL. The query answers null for an unknown id. */
	shipmentId: string;
};

/** The two columns stack below the 4xl container width, the start column first. */
export function ShipmentDetailPage({ shipmentId }: ShipmentDetailPageProps) {
	const { t } = useT();
	const { data: shipment } = useSuspenseQuery(shipmentQueryOptions(shipmentId));
	const [tab, setTab] = useState<DetailTab>("overview");

	const backLink = (
		<Button
			asChild
			variant="ghost"
			size="sm"
			className="-ms-3 justify-self-start max-md:min-h-11"
		>
			<Link to="/app/shipments">
				<CaretLeftIcon className="rtl:rotate-180" />
				{t("shipments.title")}
			</Link>
		</Button>
	);
	if (!shipment) {
		return (
			<div className="grid gap-4">
				{backLink}
				<Card className="max-w-xl">
					<CardHeader>
						<CardTitle>{t("shipments.notFoundTitle")}</CardTitle>
					</CardHeader>
					<CardContent className="grid justify-items-start gap-4">
						<p className="text-muted-foreground text-sm">
							{t("shipments.notFound")}
						</p>
						<Button asChild className="max-md:min-h-11">
							<Link to="/app/shipments">{t("shipments.backToList")}</Link>
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	const timelineCard = (limit?: number) => (
		<Card>
			<CardHeader>
				<CardTitle>{t("shipment.timeline")}</CardTitle>
				{limit !== undefined && shipment.events.length > limit ? (
					<CardAction>
						<Button
							type="button"
							variant="link"
							size="sm"
							className="h-auto px-0 text-muted-foreground"
							onClick={() => setTab("timeline")}
						>
							{t("common.viewAll")}
						</Button>
					</CardAction>
				) : null}
			</CardHeader>
			<CardContent className="ps-8">
				<ShipmentTimeline shipment={shipment} limit={limit} />
			</CardContent>
		</Card>
	);

	return (
		<div className="grid gap-4">
			{backLink}
			<PageHeader
				title={shipment.reference}
				description={
					<span className="flex flex-wrap items-center gap-2">
						<ShipmentStatusBadge status={shipment.status} />
						<span>{shipment.customerName}</span>
					</span>
				}
				actions={
					<Button asChild>
						<a href={telHref(shipment.recipient.phone)}>
							<PhoneIcon />
							{t("shipment.callRecipient")}
						</a>
					</Button>
				}
			/>
			<Tabs
				value={tab}
				onValueChange={(next) =>
					setTab(DETAIL_TABS.find((value) => value === next) ?? "overview")
				}
				className="max-w-full overflow-x-auto"
			>
				<TabsList>
					{DETAIL_TABS.map((value) => (
						<TabsTrigger key={value} value={value}>
							{t(`shipment.tabs.${value}`)}
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>
			{tab === "timeline" ? (
				timelineCard()
			) : tab === "related" ? (
				<RelatedShipmentsCard shipment={shipment} />
			) : (
				<div className="grid @4xl/main:grid-cols-3 items-start gap-4">
					<div className="grid gap-4">
						<ShipmentProfileCard shipment={shipment} />
						<DeliveryProgressCard shipment={shipment} />
						<HandlingCard shipment={shipment} />
					</div>
					<div className="@4xl/main:col-span-2 grid gap-4">
						{timelineCard(OVERVIEW_EVENTS)}
						<div className="grid @5xl/main:grid-cols-2 gap-4">
							<RelatedShipmentsCard shipment={shipment} />
							<ContactsCard shipment={shipment} />
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

/** Placeholder while the detail loader runs. The route sets it as pendingComponent. */
export function ShipmentDetailPageSkeleton() {
	return (
		<div className="grid gap-4">
			<Skeleton className="h-8 w-28" />
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-44" />
					<Skeleton className="h-5 w-64 max-w-full" />
				</div>
				<Skeleton className="h-9 w-40" />
			</div>
			<Skeleton className="h-9 w-72 max-w-full" />
			<div className="grid @4xl/main:grid-cols-3 items-start gap-4">
				<div className="grid gap-4">
					<Skeleton className="h-128" />
					<Skeleton className="h-28" />
				</div>
				<div className="@4xl/main:col-span-2 grid gap-4">
					<Skeleton className="h-80" />
					<Skeleton className="h-72" />
				</div>
			</div>
		</div>
	);
}

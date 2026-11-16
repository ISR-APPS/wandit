// The page of one shipment: its header and status, the progress path, the facts, the timeline, and the related shipments.
// The side column shows the recipient, the driver, and the vehicle. The /app/shipments/$shipmentId route renders it after its loader.
// An unknown id shows a not-found block with a link back to the list.
import { ArrowRightIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import {
	capitalize,
	DueLabel,
	dayCountFormat,
	distanceFormat,
	fillMessage,
	formatRelativeDay,
	isOpenStatus,
	ShipmentStatusBadge,
} from "~/features/logistics";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { CaretLeftIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import { shipmentQueryOptions } from "../api/shipments.queries";
import { CrewCard } from "./crew-card";
import { LoadText } from "./load-text";
import { RecipientCard } from "./recipient-card";
import { RelatedShipmentsCard } from "./related-shipments-card";
import { ShipmentProgress } from "./shipment-progress";
import { ShipmentTimeline } from "./shipment-timeline";

type ShipmentDetailPageProps = {
	/** The `$shipmentId` param of the URL. The query answers null for an unknown id. */
	shipmentId: string;
};

/** The detail page. A 2/3 main column and a 1/3 side column from the 4xl container width. */
export function ShipmentDetailPage({ shipmentId }: ShipmentDetailPageProps) {
	const { t, locale } = useT();
	const { data: shipment } = useSuspenseQuery(shipmentQueryOptions(shipmentId));

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

	const isOpen = isOpenStatus(shipment.status);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const dateTime = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	});

	return (
		<div className="grid gap-6">
			{backLink}
			<PageHeader
				title={shipment.reference}
				description={
					<span className="flex flex-wrap items-center gap-x-3 gap-y-2">
						<ShipmentStatusBadge status={shipment.status} />
						<span>{shipment.customerName}</span>
						{isOpen && shipment.lateDays > 0 ? (
							<DueLabel
								dueAt={shipment.dueAt}
								lateDays={shipment.lateDays}
								isOpen
							/>
						) : null}
					</span>
				}
			/>
			<div className="grid @4xl/main:grid-cols-3 grid-cols-1 items-start @3xl/main:gap-6 gap-4">
				{/* In one column, "contents" lets the recipient sit right under the progress card, so the phone number is near the top. */}
				<div className="@4xl/main:col-span-2 @4xl/main:grid contents @3xl/main:gap-6 gap-4">
					<Card className="-order-2">
						<CardHeader>
							<CardTitle className="flex flex-wrap items-center gap-x-2 gap-y-1">
								<span>{shipment.depotName}</span>
								<ArrowRightIcon className="size-4 text-muted-foreground rtl:rotate-180" />
								<span>{shipment.destination}</span>
							</CardTitle>
						</CardHeader>
						<CardContent>
							<ShipmentProgress shipment={shipment} />
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle>{t("shipment.details")}</CardTitle>
						</CardHeader>
						<CardContent>
							<dl className="grid @xl/main:grid-cols-3 grid-cols-2 gap-x-4 gap-y-5 text-sm">
								<div className="grid gap-1">
									<dt className="text-muted-foreground text-xs">
										{t("shipment.service")}
									</dt>
									<dd className="font-medium">
										{t(`serviceLevel.${shipment.service}`)}
									</dd>
								</div>
								<div className="grid gap-1">
									<dt className="text-muted-foreground text-xs">
										{t("shipment.load")}
									</dt>
									<dd className="font-medium">
										<LoadText
											pallets={shipment.pallets}
											weightKg={shipment.weightKg}
										/>
									</dd>
								</div>
								<div className="grid gap-1">
									<dt className="text-muted-foreground text-xs">
										{t("shipment.distance")}
									</dt>
									<dd className="font-medium tabular-nums">
										{distanceFormat(locale).format(
											shipment.recipient.distanceKm,
										)}
									</dd>
								</div>
								<div className="grid gap-1">
									<dt className="text-muted-foreground text-xs">
										{t("shipment.booked")}
									</dt>
									<dd className="font-medium tabular-nums">
										{date.format(new Date(shipment.bookedAt))}
									</dd>
								</div>
								<div className="grid gap-1">
									<dt className="text-muted-foreground text-xs">
										{t("shipments.due")}
									</dt>
									<dd className="font-medium tabular-nums">
										{date.format(new Date(shipment.dueAt))}
										{isOpen ? (
											<span className="font-normal text-muted-foreground">
												{` · ${capitalize(formatRelativeDay(shipment.dueAt, Date.now(), locale), locale)}`}
											</span>
										) : shipment.lateDays > 0 ? (
											// A closed shipment keeps its late mark, so the delay stays visible after delivery.
											<span className="font-normal text-muted-foreground">
												{` · ${fillMessage(t("due.late"), { days: dayCountFormat(locale).format(shipment.lateDays) })}`}
											</span>
										) : null}
									</dd>
								</div>
								<div className="grid gap-1">
									<dt className="text-muted-foreground text-xs">
										{t(
											shipment.status === "failed"
												? "shipment.failedAt"
												: "shipment.deliveredAt",
										)}
									</dt>
									<dd className="font-medium tabular-nums">
										{shipment.closedAt
											? dateTime.format(new Date(shipment.closedAt))
											: t("shipment.notYet")}
									</dd>
								</div>
								{shipment.exceptionReason ? (
									<div className="grid gap-1">
										<dt className="text-muted-foreground text-xs">
											{t(
												shipment.status === "failed"
													? "shipment.failureReason"
													: "shipment.delayReason",
											)}
										</dt>
										<dd className="font-medium">
											{t(`exceptionReason.${shipment.exceptionReason}`)}
										</dd>
									</div>
								) : null}
							</dl>
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle>{t("shipment.timeline")}</CardTitle>
						</CardHeader>
						<CardContent>
							<ShipmentTimeline shipment={shipment} />
						</CardContent>
					</Card>
					<RelatedShipmentsCard shipment={shipment} />
				</div>
				{/* top-20 is the sticky header (h-14) plus a 24 px gap. The contact stays in view beside a long timeline. */}
				<div className="@4xl/main:sticky @4xl/main:top-20 -order-1 @4xl/main:order-none grid @3xl/main:gap-6 gap-4">
					<RecipientCard shipment={shipment} />
					<CrewCard shipment={shipment} />
				</div>
			</div>
		</div>
	);
}

/** Placeholder while the detail loader runs. The route sets it as pendingComponent. */
export function ShipmentDetailPageSkeleton() {
	return (
		<div className="grid gap-6">
			<Skeleton className="h-8 w-28" />
			<div className="grid gap-2">
				<Skeleton className="h-8 w-44" />
				<Skeleton className="h-5 w-64 max-w-full" />
			</div>
			<div className="grid @4xl/main:grid-cols-3 grid-cols-1 items-start @3xl/main:gap-6 gap-4">
				<div className="@4xl/main:col-span-2 grid @3xl/main:gap-6 gap-4">
					<Skeleton className="h-36" />
					<Skeleton className="h-44" />
					<Skeleton className="h-64" />
				</div>
				<div className="grid @3xl/main:gap-6 gap-4">
					<Skeleton className="h-64" />
					<Skeleton className="h-56" />
				</div>
			</div>
		</div>
	);
}

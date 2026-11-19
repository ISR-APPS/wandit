// The detail page of one reservation. The /app/reservations/$reservationId route renders it after its loader.
// It follows the profile page of the kit: the header with its actions, the Overview | Folio | Timeline tabs,
// then a start column (guest card, payment, stay facts) and a wide column (latest activity, folio lines,
// other stays). The Folio and Timeline tabs show the full folio and the full timeline.
// An unknown id shows a not-found block with a link back to the list. The route also uses the skeleton below.
import { ArrowLeftIcon, DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { dayToDate, downloadCsv, toCsv } from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { reservationQueryOptions } from "../api/reservations.queries";
import { FolioCard } from "./folio-card";
import { FolioLinesCard } from "./folio-lines-card";
import { GuestCard } from "./guest-card";
import { LatestStepsCard } from "./latest-steps-card";
import { OtherStaysCard } from "./other-stays-card";
import { PaymentCard } from "./payment-card";
import { StayFactsCard } from "./stay-facts-card";
import { StayTimeline } from "./stay-timeline";

/** The tabs of the page. Each one shows real content. */
const DETAIL_TABS = ["overview", "folio", "timeline"] as const;

/** One tab of the page. */
type DetailTab = (typeof DETAIL_TABS)[number];

type ReservationDetailPageProps = {
	/** The `$reservationId` param of the URL, for example "inn-4127". The query treats an unknown id as not found. */
	reservationId: string;
};

/** A 1/3 column and a 2/3 column from the @4xl width of the page column. */
export function ReservationDetailPage({
	reservationId,
}: ReservationDetailPageProps) {
	const { t, locale } = useT();
	const { data: detail } = useSuspenseQuery(
		reservationQueryOptions(reservationId),
	);
	const [tab, setTab] = useState<DetailTab>("overview");

	const backLink = (
		<Button asChild variant="outline">
			<Link to="/app/reservations" search={{ view: "list" }}>
				<ArrowLeftIcon className="rtl:rotate-180" />
				{t("reservations.backToList")}
			</Link>
		</Button>
	);
	if (!detail) {
		return (
			<div className="grid justify-items-start gap-4">
				{backLink}
				<p className="text-muted-foreground text-sm">
					{t("reservations.notFound")}
				</p>
			</div>
		);
	}

	const { reservation, guest } = detail;
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

	return (
		<div className="grid gap-4">
			<PageHeader
				title={guest.fullName}
				description={`${reservation.code} · ${date.formatRange(dayToDate(reservation.checkIn), dayToDate(reservation.checkOut))}`}
				actions={
					<>
						{backLink}
						<Button
							type="button"
							aria-label={t("reservations.exportFolio")}
							disabled={detail.charges.length === 0}
							onClick={() =>
								downloadCsv(
									`folio-${reservation.code}.csv`,
									toCsv(detail.charges, [
										{
											header: t("folio.item"),
											value: (row) => t(`folio.kinds.${row.kind}`),
										},
										{
											header: t("folio.date"),
											value: (row) => date.format(dayToDate(row.postedOn)),
										},
										{
											header: t("folio.quantity"),
											value: (row) => String(row.quantity),
										},
										{
											header: t("folio.unitPrice"),
											value: (row) => String(row.unitPrice),
										},
										{
											header: t("folio.amount"),
											value: (row) => String(row.amount),
										},
									]),
								)
							}
						>
							<DownloadSimpleIcon />
							<span className="hidden lg:inline">
								{t("reservations.exportFolio")}
							</span>
						</Button>
					</>
				}
			/>
			<Tabs
				value={tab}
				onValueChange={(value) =>
					setTab(DETAIL_TABS.find((option) => option === value) ?? "overview")
				}
			>
				<TabsList>
					{DETAIL_TABS.map((option) => (
						<TabsTrigger key={option} value={option}>
							{t(`reservations.tabs.${option}`)}
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>
			{tab === "overview" ? (
				<div className="grid @4xl/main:grid-cols-3 items-start gap-4">
					<div className="grid gap-4">
						<GuestCard detail={detail} />
						<PaymentCard reservation={reservation} />
						<StayFactsCard detail={detail} />
					</div>
					<div className="@4xl/main:col-span-2 grid gap-4">
						<LatestStepsCard
							detail={detail}
							onViewAll={() => setTab("timeline")}
						/>
						<div className="grid @3xl/main:grid-cols-2 items-start gap-4">
							<FolioLinesCard charges={detail.charges} />
							<OtherStaysCard guestId={guest.id} stays={detail.otherStays} />
						</div>
					</div>
				</div>
			) : tab === "folio" ? (
				<FolioCard
					reservation={reservation}
					charges={detail.charges}
					payments={detail.payments}
				/>
			) : (
				<Card>
					<CardHeader>
						<CardTitle>{t("timeline.title")}</CardTitle>
					</CardHeader>
					<CardContent>
						<StayTimeline steps={detail.timeline} />
					</CardContent>
				</Card>
			)}
		</div>
	);
}

/** Placeholder while the detail loader runs. The route sets it as pendingComponent. */
export function ReservationDetailPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-56" />
					<Skeleton className="h-4 w-72 max-w-full" />
				</div>
				<Skeleton className="h-9 w-64" />
			</div>
			<Skeleton className="h-9 w-64" />
			<div className="grid @4xl/main:grid-cols-3 gap-4">
				<div className="grid gap-4">
					<Skeleton className="h-96 rounded-surface" />
					<Skeleton className="h-28 rounded-surface" />
				</div>
				<div className="@4xl/main:col-span-2 grid gap-4">
					<Skeleton className="h-80 rounded-surface" />
					<Skeleton className="h-72 rounded-surface" />
				</div>
			</div>
		</div>
	);
}

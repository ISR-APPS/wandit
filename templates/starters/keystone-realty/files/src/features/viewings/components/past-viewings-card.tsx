// The table of the viewings with an outcome: completed, no-show, and cancelled, newest first.
// ViewingsPage renders it with the rows of the viewings query. The tabs filter by outcome.
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	addressOf,
	InterestBadge,
	PersonAvatar,
	VIEWING_STATUSES,
	type ViewingRow,
	type ViewingStatus,
	ViewingStatusBadge,
} from "~/features/agency";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";

// On a phone the status tabs scroll sideways. The end fades, so the user sees that more tabs follow.
// pe-12 lets the last tab leave the faded end when the strip is at the end of its scroll.
const SCROLL_TABS =
	"max-w-full overflow-x-auto max-sm:pe-12 max-sm:[mask-image:linear-gradient(to_right,var(--foreground)_80%,transparent)] max-sm:rtl:[mask-image:linear-gradient(to_left,var(--foreground)_80%,transparent)]";

// The columns hide by the width of the page panel, also when the sidebar closes.
// The numbers are the places of the columns in `columns` below. Keep them in that order.
// Under 36rem (a phone): the home and the time stay. Under 56rem: the agent hides.
const COLUMN_WIDTHS =
	"@max-xl/main:[&_:is(th,td):is(:nth-child(2),:nth-child(3))]:hidden @max-4xl/main:[&_:is(th,td):nth-child(5)]:hidden";

type PastViewingsCardProps = {
	/** The viewings with the status "completed", "no_show", or "cancelled", newest first. */
	pastViewings: ViewingRow[];
};

/** The outcome tab filters the rows; then DataTable searches, sorts, and pages them. */
export function PastViewingsCard({ pastViewings }: PastViewingsCardProps) {
	const { t, locale } = useT();
	const [status, setStatus] = useState<ViewingStatus | "all">("all");
	const number = new Intl.NumberFormat(locale);
	const dateTime = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		hour: "numeric",
		minute: "2-digit",
	});
	// A tab shows only for an outcome that has rows.
	const tabs = VIEWING_STATUSES.map((value) => ({
		value,
		count: pastViewings.filter((row) => row.status === value).length,
	})).filter((tab) => tab.count > 0);
	const activeStatus = tabs.some((tab) => tab.value === status)
		? status
		: "all";
	const rows =
		activeStatus === "all"
			? pastViewings
			: pastViewings.filter((row) => row.status === activeStatus);

	// The outcome, plus the interest of the lead after a completed visit.
	const badgesOf = (row: ViewingRow) => (
		<div className="flex items-center gap-1.5">
			<ViewingStatusBadge status={row.status} />
			{row.interest === null ? null : <InterestBadge interest={row.interest} />}
		</div>
	);

	const columns: DataTableColumn<ViewingRow>[] = [
		{
			id: "home",
			header: t("viewings.home"),
			sortValue: (row) => row.listingStreet,
			cell: (row) => (
				<div className="grid justify-items-start gap-0.5 whitespace-normal">
					<Link
						to="/app/listings/$listingId"
						params={{ listingId: row.listingId }}
						className="font-medium hover:underline"
					>
						{addressOf({ street: row.listingStreet, unit: row.listingUnit })}
					</Link>
					{/* On a phone the lead name joins the district line, and the badges come under it. */}
					<span className="text-muted-foreground text-xs">
						{row.neighborhood}
						<span className="@xl/main:hidden" dir="auto">
							{` · ${row.leadName}`}
						</span>
					</span>
					<div className="@xl/main:hidden">{badgesOf(row)}</div>
				</div>
			),
		},
		// On a phone the outcome and the lead sit in the home cell.
		{
			id: "outcome",
			header: t("viewings.outcome"),
			sortValue: (row) => VIEWING_STATUSES.indexOf(row.status),
			cell: (row) => badgesOf(row),
		},
		{
			id: "lead",
			header: t("viewings.lead"),
			sortValue: (row) => row.leadName,
			cell: (row) => <span dir="auto">{row.leadName}</span>,
		},
		{
			id: "when",
			header: t("viewings.when"),
			align: "end",
			sortValue: (row) => Date.parse(row.startsAt),
			cell: (row) => dateTime.format(new Date(row.startsAt)),
		},
		{
			id: "agent",
			header: t("viewings.agent"),
			sortValue: (row) => row.agentName,
			cell: (row) => (
				<div className="flex items-center gap-2">
					<PersonAvatar fullName={row.agentName} className="size-7" />
					<span>{row.agentName}</span>
				</div>
			),
		},
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("viewings.pastTitle")}</CardTitle>
				<CardDescription>{t("viewings.pastDescription")}</CardDescription>
			</CardHeader>
			<CardContent className={COLUMN_WIDTHS}>
				{pastViewings.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("viewings.pastEmpty")}
					</p>
				) : (
					<DataTable
						rows={rows}
						columns={columns}
						searchText={(row) =>
							`${row.listingStreet} ${row.neighborhood} ${row.leadName} ${row.agentName}`
						}
						noResults={t("viewings.noResults")}
						toolbar={
							<Tabs
								value={activeStatus}
								onValueChange={(value) =>
									setStatus(
										VIEWING_STATUSES.find((option) => option === value) ??
											"all",
									)
								}
								className={SCROLL_TABS}
							>
								<TabsList>
									<TabsTrigger value="all">
										{t("viewings.all")}
										<span className="text-muted-foreground tabular-nums">
											{number.format(pastViewings.length)}
										</span>
									</TabsTrigger>
									{tabs.map((tab) => (
										<TabsTrigger key={tab.value} value={tab.value}>
											{t(`agency.viewingStatuses.${tab.value}`)}
											<span className="text-muted-foreground tabular-nums">
												{number.format(tab.count)}
											</span>
										</TabsTrigger>
									))}
								</TabsList>
							</Tabs>
						}
					/>
				)}
			</CardContent>
		</Card>
	);
}

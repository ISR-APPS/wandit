// The guests page behind login: the page header, the presence tabs, and the searchable table.
// The /app/guests route renders it after its loader. The route also uses the skeleton and the error below.
// The `guest` search param of the URL opens the side panel of one guest.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { initialsOf, moneyFormat } from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { guestsQueryOptions } from "../api/guests.queries";
import { GUEST_PRESENCES, type GuestRow } from "../lib/guest-rows";
import { GuestPresenceBadge } from "./guest-presence-badge";
import { GuestSheet } from "./guest-sheet";

/** The tabs of the table. `returning` holds the guests with 2 stays or more. */
const GUEST_TABS = ["all", "in_house", "arriving", "returning"] as const;
type GuestTab = (typeof GUEST_TABS)[number];
// From 2 stays, a guest is a returning guest.
const RETURNING_STAYS = 2;
// From 5 stays, the desk greets a guest as a regular. The name gets a badge.
const REGULAR_STAYS = 5;

type GuestsPageProps = {
	/** The guest id in the `guest` search param, for example "guest-012". undefined when no panel is open. */
	openGuestId: string | undefined;
};

/** The list page. The tab filters the rows; then DataTable searches, sorts, and pages them. */
export function GuestsPage({ openGuestId }: GuestsPageProps) {
	const { t, locale } = useT();
	const navigate = useNavigate();
	const { data: guests } = useSuspenseQuery(guestsQueryOptions());
	const [tab, setTab] = useState<GuestTab>("all");
	// The last open guest stays in the panel while it slides out. It is view state, not server data.
	const [shownGuestId, setShownGuestId] = useState(openGuestId);
	if (openGuestId !== undefined && openGuestId !== shownGuestId) {
		setShownGuestId(openGuestId);
	}
	const shownGuest = guests.find((guest) => guest.id === shownGuestId);

	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const country = new Intl.DisplayNames(locale, { type: "region" });
	const rowsOf = (value: GuestTab) =>
		value === "all"
			? guests
			: value === "returning"
				? guests.filter((guest) => guest.stayCount >= RETURNING_STAYS)
				: guests.filter((guest) => guest.presence === value);
	// A tab shows only when it has rows.
	const tabs = GUEST_TABS.map((value) => ({
		value,
		count: rowsOf(value).length,
	})).filter((item) => item.value === "all" || item.count > 0);
	const activeTab = tabs.some((item) => item.value === tab) ? tab : "all";

	const columns: DataTableColumn<GuestRow>[] = [
		{
			id: "guest",
			header: t("guests.guest"),
			sortValue: (row) => row.fullName,
			cell: (row) => (
				<div className="flex items-center gap-3">
					<Avatar>
						<AvatarFallback className="text-xs">
							{initialsOf(row.fullName)}
						</AvatarFallback>
					</Avatar>
					<div className="grid justify-items-start">
						<span className="flex items-center gap-2">
							<Link
								to="/app/guests"
								search={{ guest: row.id }}
								className="font-medium hover:underline"
								dir="auto"
							>
								{row.fullName}
							</Link>
							{row.stayCount >= REGULAR_STAYS ? (
								<Badge variant="outline">{t("guests.regular")}</Badge>
							) : null}
						</span>
						<span className="text-muted-foreground text-xs">{row.email}</span>
					</div>
				</div>
			),
		},
		// The status is the second column: at 375 px it shows beside the name with no sideways scroll.
		{
			id: "presence",
			header: t("guests.status"),
			sortValue: (row) => GUEST_PRESENCES.indexOf(row.presence),
			cell: (row) => <GuestPresenceBadge guest={row} />,
		},
		{
			id: "home",
			header: t("guests.home"),
			sortValue: (row) => row.countryCode,
			cell: (row) => (
				<div className="grid">
					<span>{row.city}</span>
					<span className="text-muted-foreground text-xs">
						{country.of(row.countryCode) ?? row.countryCode}
					</span>
				</div>
			),
		},
		{
			id: "stays",
			header: t("guests.stays"),
			align: "end",
			sortValue: (row) => row.stayCount,
			cell: (row) => number.format(row.stayCount),
		},
		{
			id: "spend",
			header: t("guests.spend"),
			align: "end",
			sortValue: (row) => row.lifetimeSpend,
			cell: (row) => money.format(row.lifetimeSpend),
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("guests.title")}
				description={t("guests.description")}
			/>
			<Card>
				<CardContent>
					<DataTable
						rows={rowsOf(activeTab)}
						columns={columns}
						searchText={(row) =>
							`${row.fullName} ${row.email} ${row.city} ${row.phone}`
						}
						noResults={t("guests.noResults")}
						toolbar={
							<Tabs
								value={activeTab}
								onValueChange={(value) =>
									setTab(GUEST_TABS.find((option) => option === value) ?? "all")
								}
								className="max-w-full overflow-x-auto"
							>
								<TabsList>
									{tabs.map((item) => (
										<TabsTrigger key={item.value} value={item.value}>
											{t(`guests.tabs.${item.value}`)}
											<span className="text-muted-foreground tabular-nums">
												{number.format(item.count)}
											</span>
										</TabsTrigger>
									))}
								</TabsList>
							</Tabs>
						}
					/>
				</CardContent>
			</Card>
			<GuestSheet
				guest={shownGuest}
				open={openGuestId !== undefined && shownGuest?.id === openGuestId}
				onClose={() => navigate({ to: "/app/guests", search: {} })}
			/>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function GuestsPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-72 max-w-full" />
			</div>
			<Card>
				<CardContent className="grid gap-3">
					<Skeleton className="h-9 w-full sm:max-w-xs" />
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-12 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the list when the loader fails. Try again runs the loader again. */
export function GuestsPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("guests.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}

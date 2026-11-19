// The guests page behind login: the page header with its export, and the guest table.
// The /app/guests route renders it after its loader. The route also uses the skeleton and the error below.
// It follows the users page of the kit: a filter field, three filter buttons, a column menu, checkboxes,
// sortable heads, a row menu, and pages. The `guest` search param of the URL opens the side panel of one guest.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	type CsvColumn,
	copyToClipboard,
	downloadCsv,
	initialsOf,
	toCsv,
} from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { guestsQueryOptions } from "../api/guests.queries";
import {
	GUEST_KINDS,
	GUEST_PRESENCES,
	type GuestRow,
	guestKindOf,
} from "../lib/guest-rows";
import { GuestPresenceBadge } from "./guest-presence-badge";
import { GuestSheet } from "./guest-sheet";

type GuestsPageProps = {
	/** The guest id in the `guest` search param, for example "guest-012". undefined when no panel is open. */
	openGuestId: string | undefined;
};

/** The filter buttons cut the rows. Then RecordTable searches, sorts, selects, and pages them, 10 per page. */
export function GuestsPage({ openGuestId }: GuestsPageProps) {
	const { t, locale } = useT();
	const navigate = useNavigate();
	const { data: guests } = useSuspenseQuery(guestsQueryOptions());
	const [presence, setPresence] = useState<string | null>(null);
	const [kind, setKind] = useState<string | null>(null);
	const [countryCode, setCountryCode] = useState<string | null>(null);
	// The last open guest stays in the panel while it slides out. It is view state, not server data.
	const [shownGuestId, setShownGuestId] = useState(openGuestId);
	if (openGuestId !== undefined && openGuestId !== shownGuestId) {
		setShownGuestId(openGuestId);
	}
	const shownGuest = guests.find((guest) => guest.id === shownGuestId);

	const country = new Intl.DisplayNames(locale, { type: "region" });
	const countryName = (code: string) => country.of(code) ?? code;
	const rows = guests.filter(
		(guest) =>
			(presence === null || guest.presence === presence) &&
			(kind === null || guestKindOf(guest) === kind) &&
			(countryCode === null || guest.countryCode === countryCode),
	);
	// One choice per country of the guest list, in name order.
	const countries = [...new Set(guests.map((guest) => guest.countryCode))]
		.map((code) => ({ value: code, label: countryName(code) }))
		.sort((first, second) => first.label.localeCompare(second.label, locale));

	const columns: RecordColumn<GuestRow>[] = [
		{
			id: "guest",
			header: t("guests.guest"),
			sortValue: (row) => row.fullName,
			cell: (row) => (
				<div className="flex items-center gap-3">
					<Avatar className="size-8">
						<AvatarFallback className="bg-muted text-xs">
							{initialsOf(row.fullName)}
						</AvatarFallback>
					</Avatar>
					<Link
						to="/app/guests"
						search={{ guest: row.id }}
						className="font-medium hover:underline"
						dir="auto"
					>
						{row.fullName}
					</Link>
				</div>
			),
		},
		{
			id: "city",
			header: t("guests.city"),
			sortValue: (row) => row.city,
			hideable: true,
			cell: (row) => row.city,
		},
		{
			id: "kind",
			header: t("guests.kind"),
			sortValue: (row) => GUEST_KINDS.indexOf(guestKindOf(row)),
			hideable: true,
			cell: (row) => t(`guests.kinds.${guestKindOf(row)}`),
		},
		{
			id: "email",
			header: t("guests.email"),
			sortValue: (row) => row.email,
			hideable: true,
			cell: (row) => row.email,
		},
		{
			id: "country",
			header: t("guests.country"),
			sortValue: (row) => countryName(row.countryCode),
			hideable: true,
			cell: (row) => countryName(row.countryCode),
		},
		{
			id: "presence",
			header: t("guests.status"),
			sortValue: (row) => GUEST_PRESENCES.indexOf(row.presence),
			cell: (row) => <GuestPresenceBadge guest={row} />,
		},
	];
	const csvColumns: CsvColumn<GuestRow>[] = [
		{ header: t("guests.guest"), value: (row) => row.fullName },
		{ header: t("guests.email"), value: (row) => row.email },
		{ header: t("guests.phone"), value: (row) => row.phone },
		{ header: t("guests.city"), value: (row) => row.city },
		{
			header: t("guests.country"),
			value: (row) => countryName(row.countryCode),
		},
		{
			header: t("guests.kind"),
			value: (row) => t(`guests.kinds.${guestKindOf(row)}`),
		},
		{ header: t("guests.stays"), value: (row) => String(row.stayCount) },
		{ header: t("guests.spend"), value: (row) => String(row.lifetimeSpend) },
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("guests.title")}
				actions={
					<Button
						type="button"
						aria-label={t("common.exportCsv")}
						onClick={() => downloadCsv("guests.csv", toCsv(rows, csvColumns))}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">{t("common.exportCsv")}</span>
					</Button>
				}
			/>
			<RecordTable
				rows={rows}
				columns={columns}
				searchText={(row) =>
					`${row.fullName} ${row.email} ${row.city} ${row.phone}`
				}
				searchPlaceholder={t("guests.search")}
				toolbar={
					<>
						<RecordFilter
							label={t("guests.status")}
							options={GUEST_PRESENCES.map((value) => ({
								value,
								label: t(`guests.presences.${value}`),
							}))}
							value={presence}
							onValueChange={setPresence}
						/>
						<RecordFilter
							label={t("guests.kind")}
							options={GUEST_KINDS.map((value) => ({
								value,
								label: t(`guests.kinds.${value}`),
							}))}
							value={kind}
							onValueChange={setKind}
						/>
						<RecordFilter
							label={t("guests.country")}
							options={countries}
							value={countryCode}
							onValueChange={setCountryCode}
						/>
					</>
				}
				rowMenu={(row) => (
					<>
						<DropdownMenuItem asChild>
							<Link to="/app/guests" search={{ guest: row.id }}>
								{t("guests.open")}
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() =>
								copyToClipboard(row.email, {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							{t("guests.copyEmail")}
						</DropdownMenuItem>
					</>
				)}
				selectable
				bulkActions={(selected) => (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-9"
						onClick={() =>
							downloadCsv("guests-selected.csv", toCsv(selected, csvColumns))
						}
					>
						{t("table.exportSelected")}
					</Button>
				)}
				pageSize={10}
				noResults={t("guests.noResults")}
			/>
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
		<div className="grid gap-4">
			<div className="flex items-end justify-between gap-3">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-9 w-32" />
			</div>
			<div className="flex flex-wrap gap-2">
				<Skeleton className="h-9 w-full sm:max-w-sm" />
				<Skeleton className="h-9 w-56" />
			</div>
			<div className="grid gap-3">
				{SKELETON_ROWS.map((key) => (
					<Skeleton key={key} className="h-12 w-full" />
				))}
			</div>
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

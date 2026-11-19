// The people table of the Contacts page: one row per person, with a company filter and a row menu.
// ContactsPage renders it in the "People" tab and passes the cached contacts. A name opens the contact panel.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import {
	copyToClipboard,
	downloadCsv,
	formatRelativeTime,
	PersonAvatar,
	toCsv,
} from "~/features/crm";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import type { Contact } from "../api/contacts.queries";
import { contactCsvColumns } from "../lib/contact-csv";

type PeopleTableProps = {
	/** Every contact, in name order. */
	contacts: Contact[];
	/** The id of the company of the filter, or null. ContactsPage holds it, so the companies table can set it. */
	companyId: string | null;
	/** Runs when the user picks or clears a company in the filter. */
	onCompanyChange: (companyId: string | null) => void;
	/** Runs when the user clicks a person or picks "View contact". It opens the contact panel. */
	onOpenContact: (contact: Contact) => void;
	/** The current time in milliseconds since 1970. The relative times count from it. */
	now: number;
};

/** The company filter cuts the rows; then RecordTable filters, sorts, and pages them. */
export function PeopleTable({
	contacts,
	companyId,
	onCompanyChange,
	onOpenContact,
	now,
}: PeopleTableProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	// One entry per company that has a contact, in name order.
	const companies = [
		...new Map(contacts.map((row) => [row.companyId, row.companyName])),
	]
		.sort((first, second) => first[1].localeCompare(second[1], locale))
		.map(([value, label]) => ({ value, label }));
	const rows =
		companyId === null
			? contacts
			: contacts.filter((row) => row.companyId === companyId);

	const columns: RecordColumn<Contact>[] = [
		{
			id: "name",
			header: t("contacts.name"),
			sortValue: (row) => row.name,
			cell: (row) => (
				// The avatar, the name, and the title are one button. A finger hits it more easily than the name alone.
				<button
					type="button"
					className="group flex items-center gap-3 rounded-control text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
					onClick={() => onOpenContact(row)}
				>
					<PersonAvatar name={row.name} className="size-9 text-xs" />
					<span className="grid justify-items-start">
						<span className="font-medium group-hover:underline" dir="auto">
							{row.name}
						</span>
						<span className="text-muted-foreground text-xs" dir="auto">
							{row.title}
						</span>
					</span>
				</button>
			),
		},
		{
			id: "company",
			header: t("contacts.company"),
			sortValue: (row) => row.companyName,
			cell: (row) => (
				<div className="grid justify-items-start">
					<span dir="auto">{row.companyName}</span>
					<span className="text-muted-foreground text-xs">{row.city}</span>
				</div>
			),
		},
		{
			id: "email",
			header: t("contacts.email"),
			hideable: true,
			sortValue: (row) => row.email,
			cell: (row) => (
				<a
					href={`mailto:${row.email}`}
					className="underline decoration-border underline-offset-4 hover:decoration-ring"
					dir="ltr"
				>
					{row.email}
				</a>
			),
		},
		{
			id: "phone",
			header: t("contacts.phone"),
			hideable: true,
			sortValue: (row) => row.phone,
			cell: (row) => (
				<span className="tabular-nums" dir="ltr">
					{row.phone}
				</span>
			),
		},
		{
			id: "openDeals",
			header: t("contacts.openDeals"),
			hideable: true,
			align: "end",
			sortValue: (row) => row.openDealCount,
			cell: (row) =>
				row.openDealCount === 0 ? (
					<span className="text-muted-foreground">{number.format(0)}</span>
				) : (
					<span className="font-medium">
						{number.format(row.openDealCount)}
					</span>
				),
		},
		{
			id: "lastContacted",
			header: t("contacts.lastContacted"),
			hideable: true,
			align: "end",
			// A person with no activity sorts as the oldest.
			sortValue: (row) =>
				row.lastContactedAt ? Date.parse(row.lastContactedAt) : 0,
			cell: (row) => (
				<span className="text-muted-foreground">
					{row.lastContactedAt
						? formatRelativeTime(row.lastContactedAt, now, locale)
						: t("contacts.never")}
				</span>
			),
		},
	];

	return (
		<RecordTable
			rows={rows}
			columns={columns}
			searchText={(row) =>
				`${row.name} ${row.title} ${row.companyName} ${row.email} ${row.city}`
			}
			searchPlaceholder={t("contacts.filterPeople")}
			toolbar={
				<RecordFilter
					label={t("contacts.company")}
					options={companies}
					value={companyId}
					onValueChange={onCompanyChange}
				/>
			}
			pageSize={20}
			noResults={t("contacts.noPeople")}
			selectable
			bulkActions={(selectedRows) => (
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-9"
					onClick={() =>
						downloadCsv(
							"contacts-selected.csv",
							toCsv(selectedRows, contactCsvColumns(t)),
						)
					}
				>
					<DownloadSimpleIcon />
					{t("table.exportSelected")}
				</Button>
			)}
			rowMenu={(row) => (
				<>
					<DropdownMenuItem onSelect={() => onOpenContact(row)}>
						{t("contacts.viewContact")}
					</DropdownMenuItem>
					<DropdownMenuItem asChild>
						<a href={`mailto:${row.email}`}>{t("contacts.sendEmail")}</a>
					</DropdownMenuItem>
					<DropdownMenuItem
						onSelect={() =>
							copyToClipboard(row.email, {
								done: t("table.copied"),
								failed: t("table.copyFailed"),
							})
						}
					>
						{t("contacts.copyEmail")}
					</DropdownMenuItem>
				</>
			)}
		/>
	);
}

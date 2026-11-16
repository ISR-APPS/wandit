// The people table of the contacts page: one row per person, with a company filter.
// ContactsPage renders it in the "People" tab and passes the cached contacts. A person cell opens the contact panel.
import { formatRelativeTime, PersonAvatar } from "~/features/crm";
import { useT } from "~/shared/i18n";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import type { Contact } from "../api/contacts.queries";

type PeopleTableProps = {
	/** Every contact, in name order. */
	contacts: Contact[];
	/** The id of the company of the filter, or "all". ContactsPage holds it, so the companies table can set it. */
	companyId: string;
	/** Runs when the user picks a company in the filter. */
	onCompanyChange: (companyId: string) => void;
	/** Runs when the user clicks the avatar, the name, or the title of a person. It opens the contact panel. */
	onOpenContact: (contact: Contact) => void;
	/** The current time in milliseconds since 1970. The relative times count from it. */
	now: number;
};

/** The company filter cuts the rows; then DataTable searches, sorts, and pages them. */
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
	].sort((first, second) => first[1].localeCompare(second[1], locale));
	const rows =
		companyId === "all"
			? contacts
			: contacts.filter((row) => row.companyId === companyId);

	const columns: DataTableColumn<Contact>[] = [
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
					<PersonAvatar name={row.name} />
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
		<DataTable
			rows={rows}
			columns={columns}
			searchText={(row) =>
				`${row.name} ${row.title} ${row.companyName} ${row.email} ${row.city}`
			}
			noResults={t("contacts.noPeople")}
			toolbar={
				<Select value={companyId} onValueChange={onCompanyChange}>
					<SelectTrigger
						aria-label={t("contacts.company")}
						className="w-full sm:w-60"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">{t("contacts.allCompanies")}</SelectItem>
						{companies.map(([id, name]) => (
							<SelectItem key={id} value={id}>
								{name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			}
		/>
	);
}

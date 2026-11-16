// The companies table of the contacts page: one row per customer company, with its people and deal totals.
// ContactsPage renders it in the "Companies" tab and passes the cached companies.
// A company name shows the people of that company in the "People" tab.
import { fillMessage, moneyFormat } from "~/features/crm";
import { useT } from "~/shared/i18n";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import type { Company } from "../api/companies.queries";

type CompaniesTableProps = {
	/** Every company, in name order. */
	companies: Company[];
	/** Runs when the user clicks a company name. ContactsPage then filters the people table by this company id. */
	onShowPeople: (companyId: string) => void;
};

/** DataTable searches, sorts, and pages the rows. Amounts of 0 show in muted text. */
export function CompaniesTable({
	companies,
	onShowPeople,
}: CompaniesTableProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);

	const amountCell = (amount: number) =>
		amount === 0 ? (
			<span className="text-muted-foreground">{money.format(0)}</span>
		) : (
			<span className="font-medium">{money.format(amount)}</span>
		);

	const columns: DataTableColumn<Company>[] = [
		{
			id: "company",
			header: t("contacts.company"),
			sortValue: (row) => row.name,
			cell: (row) => (
				<div className="grid justify-items-start">
					<button
						type="button"
						className="rounded-sm font-medium outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
						dir="auto"
						title={fillMessage(t("contacts.showPeopleOf"), {
							company: row.name,
						})}
						onClick={() => onShowPeople(row.id)}
					>
						{row.name}
					</button>
					<span className="text-muted-foreground text-xs">{row.industry}</span>
				</div>
			),
		},
		{
			id: "city",
			header: t("contacts.city"),
			sortValue: (row) => row.city,
			cell: (row) => row.city,
		},
		{
			id: "employees",
			header: t("contacts.employees"),
			align: "end",
			sortValue: (row) => row.employees,
			cell: (row) => number.format(row.employees),
		},
		{
			id: "contacts",
			header: t("contacts.people"),
			align: "end",
			sortValue: (row) => row.contactCount,
			cell: (row) => number.format(row.contactCount),
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
			id: "openAmount",
			header: t("contacts.openPipeline"),
			align: "end",
			sortValue: (row) => row.openAmount,
			cell: (row) => amountCell(row.openAmount),
		},
		{
			id: "wonAmount",
			header: t("contacts.won"),
			align: "end",
			sortValue: (row) => row.wonAmount,
			cell: (row) => amountCell(row.wonAmount),
		},
	];

	return (
		<DataTable
			rows={companies}
			columns={columns}
			searchText={(row) => `${row.name} ${row.industry} ${row.city}`}
			noResults={t("contacts.noCompanies")}
		/>
	);
}

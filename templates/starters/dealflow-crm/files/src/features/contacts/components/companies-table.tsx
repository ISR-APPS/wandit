// The companies table of the Contacts page: one row per customer company, with its people and deal totals.
// ContactsPage renders it in the "Companies" tab and passes the cached companies.
// A company name, or "Show people" in the row menu, shows the people of that company in the "People" tab.
import { BuildingsIcon, DownloadSimpleIcon } from "@phosphor-icons/react";
import { downloadCsv, fillMessage, moneyFormat, toCsv } from "~/features/crm";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import { type RecordColumn, RecordTable } from "~/shared/ui/record-table";
import type { Company } from "../api/companies.queries";
import { companyCsvColumns } from "../lib/contact-csv";

type CompaniesTableProps = {
	/** Every company, in name order. */
	companies: Company[];
	/** Runs when the user asks for the people of a company. ContactsPage then filters the people table by this id. */
	onShowPeople: (companyId: string) => void;
};

/** RecordTable filters, sorts, and pages the rows. Amounts of 0 show in muted text. */
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

	const columns: RecordColumn<Company>[] = [
		{
			id: "company",
			header: t("contacts.company"),
			sortValue: (row) => row.name,
			cell: (row) => (
				<div className="flex items-center gap-3">
					<span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
						<BuildingsIcon className="size-4" />
					</span>
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
						<span className="text-muted-foreground text-xs">
							{row.industry}
						</span>
					</div>
				</div>
			),
		},
		{
			id: "city",
			header: t("contacts.city"),
			hideable: true,
			sortValue: (row) => row.city,
			cell: (row) => row.city,
		},
		{
			id: "employees",
			header: t("contacts.employees"),
			hideable: true,
			align: "end",
			sortValue: (row) => row.employees,
			cell: (row) => number.format(row.employees),
		},
		{
			id: "contacts",
			header: t("contacts.people"),
			hideable: true,
			align: "end",
			sortValue: (row) => row.contactCount,
			cell: (row) => number.format(row.contactCount),
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
			id: "openAmount",
			header: t("contacts.openPipeline"),
			align: "end",
			sortValue: (row) => row.openAmount,
			cell: (row) => amountCell(row.openAmount),
		},
		{
			id: "wonAmount",
			header: t("contacts.won"),
			hideable: true,
			align: "end",
			sortValue: (row) => row.wonAmount,
			cell: (row) => amountCell(row.wonAmount),
		},
	];

	return (
		<RecordTable
			rows={companies}
			columns={columns}
			searchText={(row) => `${row.name} ${row.industry} ${row.city}`}
			searchPlaceholder={t("contacts.filterCompanies")}
			pageSize={20}
			noResults={t("contacts.noCompanies")}
			selectable
			bulkActions={(selectedRows) => (
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-9"
					onClick={() =>
						downloadCsv(
							"companies-selected.csv",
							toCsv(selectedRows, companyCsvColumns(t)),
						)
					}
				>
					<DownloadSimpleIcon />
					{t("table.exportSelected")}
				</Button>
			)}
			rowMenu={(row) => (
				<DropdownMenuItem onSelect={() => onShowPeople(row.id)}>
					{t("contacts.showPeople")}
				</DropdownMenuItem>
			)}
		/>
	);
}

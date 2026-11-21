// The contacts page behind login: the people at customer companies and the companies, in two tabs of one table card.
// The /app/contacts route renders it after its loader. The route also uses the skeleton and the error below.
// A person cell of the people table opens the contact panel. A company name filters the people table.
// "Export CSV" in the header downloads every row of the open tab.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { downloadCsv, toCsv } from "~/features/crm";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { companiesQueryOptions } from "../api/companies.queries";
import { type Contact, contactsQueryOptions } from "../api/contacts.queries";
import { companyCsvColumns, contactCsvColumns } from "../lib/contact-csv";
import { CompaniesTable } from "./companies-table";
import { ContactSheet } from "./contact-sheet";
import { PeopleTable } from "./people-table";

/** The two tabs of the page. */
const CONTACT_VIEWS = ["people", "companies"] as const;
type ContactView = (typeof CONTACT_VIEWS)[number];

/** The page holds the tab, the company filter, and the open contact, so the two tables can set them. */
export function ContactsPage() {
	const { t, locale } = useT();
	const { data: contacts } = useSuspenseQuery(contactsQueryOptions());
	const { data: companies } = useSuspenseQuery(companiesQueryOptions());
	const [view, setView] = useState<ContactView>("people");
	const [companyId, setCompanyId] = useState<string | null>(null);
	const [sheetContact, setSheetContact] = useState<Contact | null>(null);
	const [isSheetOpen, setIsSheetOpen] = useState(false);
	const number = new Intl.NumberFormat(locale);
	const counts = { people: contacts.length, companies: companies.length };

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("contacts.title")}
				description={t("contacts.description")}
				actions={
					<Button
						type="button"
						aria-label={t("common.exportCsv")}
						onClick={() =>
							view === "people"
								? downloadCsv(
										"contacts.csv",
										toCsv(contacts, contactCsvColumns(t)),
									)
								: downloadCsv(
										"companies.csv",
										toCsv(companies, companyCsvColumns(t)),
									)
						}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">{t("common.exportCsv")}</span>
					</Button>
				}
			/>
			<div className="grid gap-2">
				<Tabs
					value={view}
					onValueChange={(value) =>
						setView(
							CONTACT_VIEWS.find((option) => option === value) ?? "people",
						)
					}
				>
					<TabsList>
						{CONTACT_VIEWS.map((option) => (
							<TabsTrigger key={option} value={option}>
								{t(`contacts.${option}`)}
								<span className="text-muted-foreground tabular-nums">
									{number.format(counts[option])}
								</span>
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
				<Card>
					<CardContent>
						{view === "people" ? (
							<PeopleTable
								contacts={contacts}
								companyId={companyId}
								onCompanyChange={setCompanyId}
								onOpenContact={(contact) => {
									setSheetContact(contact);
									setIsSheetOpen(true);
								}}
								now={Date.now()}
							/>
						) : (
							<CompaniesTable
								companies={companies}
								onShowPeople={(id) => {
									setCompanyId(id);
									setView("people");
								}}
							/>
						)}
					</CardContent>
				</Card>
			</div>
			<ContactSheet
				contact={sheetContact}
				open={isSheetOpen}
				onOpenChange={setIsSheetOpen}
			/>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function ContactsPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-36" />
					<Skeleton className="h-4 w-72 max-w-full" />
				</div>
				<Skeleton className="h-9 w-32" />
			</div>
			<div className="grid gap-2">
				<Skeleton className="h-9 w-56" />
				<Card>
					<CardContent className="grid gap-3">
						<Skeleton className="h-9 w-full sm:max-w-xs" />
						{SKELETON_ROWS.map((key) => (
							<Skeleton key={key} className="h-12 w-full" />
						))}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

/** Error state when the loader fails. Try again runs the loader again. */
export function ContactsPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("contacts.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}

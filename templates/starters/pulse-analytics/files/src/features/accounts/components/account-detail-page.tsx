// The page of one account, in the anatomy of the kit profile page: the title and the export button,
// the tabs Overview, Users, and Timeline, then a 1/3 column of profile cards beside a 2/3 column of activity cards.
// The /app/accounts/$accountId route renders it after its loader. The route also uses the skeleton below.
// An unknown id shows a not-found block with a link back to the list.
import { ArrowLeftIcon, DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	copyToClipboard,
	downloadCsv,
	formatRelativeTime,
	initialsOf,
	toCsv,
} from "~/features/tracking";
import { useT } from "~/shared/i18n";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import { type RecordColumn, RecordTable } from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import {
	type AccountDetail,
	type AccountPerson,
	accountQueryOptions,
} from "../api/accounts.queries";
import { AccountEventsCard } from "./account-events-card";
import { AccountPeopleCard } from "./account-people-card";
import { AccountProfileCard } from "./account-profile-card";
import { AccountTimelineCard } from "./account-timeline-card";
import { FeaturesUsedCard } from "./features-used-card";
import { SeatsCard } from "./seats-card";

// The Overview tab shows the 3 newest milestones, as the kit card shows 3 steps.
const OVERVIEW_STEPS = 3;

// The Users tab pages the people of a large account.
const PEOPLE_PAGE_SIZE = 20;

/** The tabs of the page. Each one shows real content of the account. */
type AccountTab = "overview" | "users" | "timeline";

type AccountDetailPageProps = {
	/** The `$accountId` param of the URL. The query treats an unknown id as not found. */
	accountId: string;
};

/** The tab is state of the page, so the "View all" buttons of the cards can open another tab. */
export function AccountDetailPage({ accountId }: AccountDetailPageProps) {
	const { t } = useT();
	const { data: account } = useSuspenseQuery(accountQueryOptions(accountId));
	const [tab, setTab] = useState<AccountTab>("overview");

	if (!account) {
		return (
			<div className="grid justify-items-start gap-4">
				<p className="text-muted-foreground text-sm">
					{t("accounts.notFound")}
				</p>
				<Button asChild variant="outline">
					<Link to="/app/accounts">
						<ArrowLeftIcon className="rtl:rotate-180" />
						{t("accounts.backToList")}
					</Link>
				</Button>
			</div>
		);
	}

	return (
		<div className="grid gap-4">
			<PageHeader
				title={account.name}
				description={
					<Link
						to="/app/accounts"
						className="inline-flex items-center gap-1.5 hover:text-foreground"
					>
						<ArrowLeftIcon className="size-3.5 rtl:rotate-180" />
						{t("accounts.backToList")}
					</Link>
				}
				actions={
					<Button
						type="button"
						onClick={() =>
							downloadCsv(
								`${account.id}-users.csv`,
								toCsv(account.people, [
									{
										header: t("accounts.people.name"),
										value: (row) => row.name,
									},
									{
										header: t("accounts.people.email"),
										value: (row) => row.email,
									},
									{
										header: t("accounts.people.role"),
										value: (row) => t(`roles.${row.role}`),
									},
									{
										header: t("accounts.people.events"),
										value: (row) => String(row.events),
									},
								]),
							)
						}
					>
						<DownloadSimpleIcon />
						{t("accounts.exportUsers")}
					</Button>
				}
			/>
			<Tabs
				value={tab}
				onValueChange={(value) => {
					if (
						value === "overview" ||
						value === "users" ||
						value === "timeline"
					) {
						setTab(value);
					}
				}}
			>
				<TabsList>
					<TabsTrigger value="overview">
						{t("accounts.tabs.overview")}
					</TabsTrigger>
					<TabsTrigger value="users">{t("accounts.tabs.users")}</TabsTrigger>
					<TabsTrigger value="timeline">
						{t("accounts.tabs.timeline")}
					</TabsTrigger>
				</TabsList>
				<TabsContent value="overview" className="mt-2">
					<AccountOverview account={account} onOpenTab={setTab} />
				</TabsContent>
				<TabsContent value="users" className="mt-2">
					<Card>
						<CardContent>
							<PeopleTable people={account.people} />
						</CardContent>
					</Card>
				</TabsContent>
				<TabsContent value="timeline" className="mt-2">
					<AccountTimelineCard
						timeline={account.timeline}
						plan={account.plan}
					/>
				</TabsContent>
			</Tabs>
		</div>
	);
}

type AccountOverviewProps = {
	account: AccountDetail;
	/** Opens another tab of the page. */
	onOpenTab: (tab: AccountTab) => void;
};

// The Overview tab: 1/3 + 2/3 from the 4xl container width, one column below.
function AccountOverview({ account, onOpenTab }: AccountOverviewProps) {
	return (
		<div className="grid @4xl/main:grid-cols-3 items-start gap-4">
			<div className="grid gap-4">
				<AccountProfileCard account={account} />
				<SeatsCard members={account.members} seats={account.seats} />
				<FeaturesUsedCard features={account.features} />
			</div>
			<div className="@4xl/main:col-span-2 grid gap-4">
				<AccountTimelineCard
					timeline={account.timeline}
					plan={account.plan}
					limit={OVERVIEW_STEPS}
					onViewAll={() => onOpenTab("timeline")}
				/>
				<div className="grid @4xl/main:grid-cols-2 items-start gap-4">
					<AccountEventsCard events={account.topEvents} />
					<AccountPeopleCard
						people={account.people}
						onViewAll={() => onOpenTab("users")}
					/>
				</div>
			</div>
		</div>
	);
}

type PeopleTableProps = {
	/** Every person of the account, the most events first. */
	people: AccountPerson[];
};

// The Users tab: every person of the account with a filter field and pages.
function PeopleTable({ people }: PeopleTableProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const now = Date.now();
	const columns: RecordColumn<AccountPerson>[] = [
		{
			id: "name",
			header: t("accounts.people.name"),
			cell: (row) => (
				<span className="flex items-center gap-3 font-medium">
					<Avatar className="size-8">
						<AvatarFallback className="text-xs">
							{initialsOf(row.name)}
						</AvatarFallback>
					</Avatar>
					<span className="truncate">{row.name}</span>
				</span>
			),
		},
		{
			id: "email",
			header: t("accounts.people.email"),
			cell: (row) => row.email,
			sortValue: (row) => row.email,
			hideable: true,
		},
		{
			id: "role",
			header: t("accounts.people.role"),
			cell: (row) => t(`roles.${row.role}`),
			sortValue: (row) => t(`roles.${row.role}`),
			hideable: true,
		},
		{
			id: "events",
			header: t("accounts.people.events"),
			cell: (row) => number.format(row.events),
			sortValue: (row) => row.events,
			align: "end",
			hideable: true,
		},
		{
			id: "last-seen",
			header: t("accounts.people.lastSeen"),
			cell: (row) =>
				row.lastSeenAt === null
					? t("accounts.neverSeen")
					: formatRelativeTime(row.lastSeenAt, now, locale),
			sortValue: (row) => row.lastSeenAt ?? "",
			align: "end",
			hideable: true,
		},
	];
	return (
		<RecordTable
			rows={people}
			columns={columns}
			searchText={(row) => `${row.name} ${row.email}`}
			searchPlaceholder={t("accounts.people.search")}
			rowMenu={(row) => (
				<DropdownMenuItem
					onSelect={() =>
						copyToClipboard(row.email, {
							done: t("table.copied"),
							failed: t("table.copyFailed"),
						})
					}
				>
					{t("accounts.people.copyEmail")}
				</DropdownMenuItem>
			)}
			pageSize={PEOPLE_PAGE_SIZE}
			noResults={t("accounts.people.noResults")}
		/>
	);
}

/** Placeholder while the detail loader runs. The route sets it as pendingComponent. */
export function AccountDetailPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-64 max-w-full" />
				<Skeleton className="h-4 w-28" />
			</div>
			<Skeleton className="h-9 w-64 max-w-full" />
			<div className="grid @4xl/main:grid-cols-3 gap-4">
				<Skeleton className="h-128" />
				<Skeleton className="@4xl/main:col-span-2 h-128" />
			</div>
		</div>
	);
}

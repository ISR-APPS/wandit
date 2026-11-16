// The deal list behind login: the page header, the stage tabs, and the searchable table with an owner filter.
// The /app/deals route renders it after its loader. The route also uses the skeleton and the error below.
// The stage tab lives in the URL (?stage=), so the board can link to one stage.
import { FlagPennantIcon, WarningIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	DEAL_STAGES,
	DealStageBadge,
	fillMessage,
	formatAge,
	formatRelativeTime,
	isOpenStage,
	moneyFormat,
	PersonAvatar,
} from "~/features/crm";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { type Deal, dealsQueryOptions } from "../api/deals.queries";
import { isPastCloseDate, isStalled } from "../lib/deal-attention";

const routeApi = getRouteApi("/app/deals/");

/** The list page. The stage tab and the owner filter cut the rows; then DataTable searches, sorts, and pages them. */
export function DealsPage() {
	const { t, locale } = useT();
	const { data: deals } = useSuspenseQuery(dealsQueryOptions());
	const { stage } = routeApi.useSearch();
	const navigate = routeApi.useNavigate();
	const [ownerId, setOwnerId] = useState("all");

	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const compactMoney = moneyFormat(locale, "compact");
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const now = Date.now();

	// One entry per rep that owns a deal, in name order.
	const owners = [
		...new Map(deals.map((deal) => [deal.ownerId, deal.ownerName])),
	].sort((first, second) => first[1].localeCompare(second[1], locale));
	const ofOwner =
		ownerId === "all"
			? deals
			: deals.filter((deal) => deal.ownerId === ownerId);
	// A tab shows only for a stage that has rows of the chosen owner.
	const tabs = DEAL_STAGES.map((value) => ({
		value,
		count: ofOwner.filter((deal) => deal.stage === value).length,
	})).filter((tab) => tab.count > 0);
	// The owner filter can empty the stage of the URL. Its tab then disappears, so the list shows all stages.
	const activeStage = tabs.some((tab) => tab.value === stage)
		? stage
		: undefined;
	const rows = activeStage
		? ofOwner.filter((deal) => deal.stage === activeStage)
		: ofOwner;
	const openDeals = deals.filter((deal) => isOpenStage(deal.stage));

	const columns: DataTableColumn<Deal>[] = [
		{
			id: "deal",
			header: t("deals.deal"),
			sortValue: (row) => row.name,
			// justify-items-start: each line is as wide as its text, so dir="auto" text sits at the start side.
			cell: (row) => (
				<div className="grid justify-items-start">
					<Link
						to="/app/deals/$dealId"
						params={{ dealId: row.id }}
						className="font-medium hover:underline"
						dir="auto"
					>
						{row.name}
					</Link>
					<span className="text-muted-foreground text-xs" dir="auto">
						{row.companyName}
					</span>
				</div>
			),
		},
		{
			id: "stage",
			header: t("deals.stage"),
			sortValue: (row) => DEAL_STAGES.indexOf(row.stage),
			cell: (row) => (
				<span className="flex items-center gap-2">
					<DealStageBadge stage={row.stage} />
					{isStalled(row, now) ? (
						<span className="inline-flex items-center gap-1 font-medium text-warning text-xs tabular-nums">
							<FlagPennantIcon className="size-3.5" />
							<span className="sr-only">{t("deals.stalled")}</span>
							{formatAge(row.stageChangedAt, now, locale)}
						</span>
					) : null}
				</span>
			),
		},
		{
			id: "owner",
			header: t("deals.owner"),
			sortValue: (row) => row.ownerName,
			cell: (row) => (
				<span className="flex items-center gap-2">
					<PersonAvatar
						name={row.ownerName}
						className="size-6 text-[0.625rem]"
					/>
					<bdi>{row.ownerName}</bdi>
				</span>
			),
		},
		{
			id: "close",
			header: t("deals.closeDate"),
			// A closed deal sorts by its real close day, an open deal by the expected day.
			sortValue: (row) => Date.parse(row.closedAt ?? row.expectedCloseAt),
			cell: (row) =>
				isPastCloseDate(row, now) ? (
					<span className="inline-flex items-center gap-1 text-destructive tabular-nums">
						<WarningIcon className="size-3.5" />
						<span className="sr-only">{t("deals.pastCloseDate")}</span>
						{date.format(new Date(row.expectedCloseAt))}
					</span>
				) : (
					<span className="tabular-nums">
						{date.format(new Date(row.closedAt ?? row.expectedCloseAt))}
					</span>
				),
		},
		{
			id: "lastActivity",
			header: t("deals.lastActivity"),
			sortValue: (row) => Date.parse(row.lastActivityAt),
			cell: (row) => (
				<span className="text-muted-foreground">
					{formatRelativeTime(row.lastActivityAt, now, locale)}
				</span>
			),
		},
		{
			id: "amount",
			header: t("deals.amount"),
			align: "end",
			sortValue: (row) => row.amount,
			cell: (row) => (
				<span className="font-medium">{money.format(row.amount)}</span>
			),
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("deals.title")}
				description={fillMessage(t("deals.description"), {
					amount: compactMoney.format(
						openDeals.reduce((sum, deal) => sum + deal.amount, 0),
					),
				})}
			/>
			<div className="grid gap-4">
				<Tabs
					value={activeStage ?? "all"}
					onValueChange={(value) =>
						navigate({
							search: { stage: DEAL_STAGES.find((option) => option === value) },
							replace: true,
						})
					}
					className="max-w-full overflow-x-auto"
				>
					<TabsList>
						<TabsTrigger value="all">
							{t("deals.all")}
							<span className="text-muted-foreground tabular-nums">
								{number.format(ofOwner.length)}
							</span>
						</TabsTrigger>
						{tabs.map((tab) => (
							<TabsTrigger key={tab.value} value={tab.value}>
								{t(`stages.${tab.value}`)}
								<span className="text-muted-foreground tabular-nums">
									{number.format(tab.count)}
								</span>
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
				<Card>
					<CardContent>
						<DataTable
							rows={rows}
							columns={columns}
							searchText={(row) =>
								`${row.name} ${row.companyName} ${row.contactName} ${row.ownerName}`
							}
							noResults={t("deals.noResults")}
							toolbar={
								<Select value={ownerId} onValueChange={setOwnerId}>
									<SelectTrigger
										aria-label={t("deals.owner")}
										className="w-full sm:w-48"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">{t("deals.allOwners")}</SelectItem>
										{owners.map(([id, name]) => (
											<SelectItem key={id} value={id}>
												{name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							}
						/>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function DealsPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-4 w-64 max-w-full" />
			</div>
			<div className="grid gap-4">
				<Skeleton className="h-9 w-full max-w-xl" />
				<Card>
					<CardContent className="grid gap-3">
						<Skeleton className="h-9 w-full sm:max-w-xs" />
						{SKELETON_ROWS.map((key) => (
							<Skeleton key={key} className="h-10 w-full" />
						))}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

/** Error state of the list and of the deal page when a loader fails. Try again runs the loader again. */
export function DealsPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("deals.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}

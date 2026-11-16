// The Shared page behind login: every share of a team file, with state tabs, an audience filter, and a search.
// The /app/shared route renders it after its loader. The route also uses the skeleton and the error below.
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	FileNameCell,
	fillCount,
	formatRelativeTime,
	MemberAvatar,
	pluralForm,
	SHARE_ACCESS_BADGE,
	SHARE_STATUS_BADGE,
	SHARE_STATUSES,
	ShareAudience,
	type ShareItem,
	type ShareStatus,
} from "~/features/workspace";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
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
import { sharesQueryOptions } from "../api/shares.queries";

// One status band of the Status sort. It is larger than any end date in ms, so the bands never mix.
const STATUS_SORT_STEP = 10 ** 14;

/** The audience filter: every share, public links only, or invitations only. */
const AUDIENCES = ["all", "link", "people"] as const;

/** The list page. The audience Select filters first; then the state tab; then DataTable searches and pages. */
export function SharedPage() {
	const { t, locale } = useT();
	const { data: shares } = useSuspenseQuery(sharesQueryOptions());
	const [status, setStatus] = useState<ShareStatus | "all">("all");
	const [audience, setAudience] = useState<(typeof AUDIENCES)[number]>("all");

	const number = new Intl.NumberFormat(locale);
	const now = Date.now();
	const inAudience =
		audience === "all"
			? shares
			: shares.filter((share) => share.mode === audience);
	// A tab shows only for a state that has rows. Its count follows the audience filter.
	const tabs = SHARE_STATUSES.map((value) => ({
		value,
		count: inAudience.filter((share) => share.status === value).length,
	})).filter((tab) => tab.count > 0);
	const activeStatus = tabs.some((tab) => tab.value === status)
		? status
		: "all";
	const rows =
		activeStatus === "all"
			? inAudience
			: inAudience.filter((share) => share.status === activeStatus);
	const liveCount = shares.filter((share) => share.status !== "expired").length;
	const expiringCount = shares.filter(
		(share) => share.status === "expiring",
	).length;

	// Status first after the file, so a phone shows the state of each share without a side scroll.
	const columns: DataTableColumn<ShareItem>[] = [
		{
			id: "file",
			header: t("shares.columns.file"),
			sortValue: (row) => row.fileName,
			cell: (row) => (
				<FileNameCell
					fileId={row.fileId}
					name={row.fileName}
					kind={row.fileKind}
					path={row.path}
				/>
			),
		},
		{
			id: "status",
			header: t("shares.columns.status"),
			// The status order of SHARE_STATUSES first, then the nearest end date inside one status.
			sortValue: (row) =>
				SHARE_STATUSES.indexOf(row.status) * STATUS_SORT_STEP +
				(row.expiresAt === null
					? STATUS_SORT_STEP - 1
					: Date.parse(row.expiresAt)),
			cell: (row) => (
				<span className="grid justify-items-start gap-1 whitespace-nowrap">
					<Badge variant={SHARE_STATUS_BADGE[row.status]}>
						{t(`shares.statuses.${row.status}`)}
					</Badge>
					<span className="text-muted-foreground text-xs">
						{row.expiresAt === null
							? t("shares.noExpiry")
							: `${t(row.status === "expired" ? "shares.expired" : "shares.expires")} ${formatRelativeTime(row.expiresAt, now, locale)}`}
					</span>
				</span>
			),
		},
		{
			id: "audience",
			header: t("shares.columns.audience"),
			// A link has no person, so links sort before the first name.
			sortValue: (row) =>
				row.mode === "link" ? "" : (row.recipients[0]?.name ?? ""),
			cell: (row) => (
				// A wide table puts the access on the audience line, so each row keeps two lines of text.
				<div className="@5xl/main:flex grid @5xl/main:max-w-none max-w-64 @5xl/main:items-center @5xl/main:justify-between justify-items-start @5xl/main:gap-4 gap-1.5">
					<ShareAudience share={row} />
					<Badge variant={SHARE_ACCESS_BADGE[row.access]}>
						{t(`shares.access.${row.access}`)}
					</Badge>
				</div>
			),
		},
		{
			id: "sharedBy",
			header: t("shares.columns.sharedBy"),
			sortValue: (row) => row.sharedByName,
			cell: (row) => (
				<span className="flex items-center gap-2 whitespace-nowrap">
					<MemberAvatar name={row.sharedByName} />
					<span className="grid">
						{/* Below 56rem the name hides, so all five columns fit at 1024 px. Screen readers still read it. */}
						<span className="sr-only @4xl/main:not-sr-only">
							{row.sharedByName}
						</span>
						<span className="text-muted-foreground text-xs">
							{formatRelativeTime(row.createdAt, now, locale)}
						</span>
					</span>
				</span>
			),
		},
		{
			id: "views",
			header: t("shares.columns.views"),
			align: "end",
			sortValue: (row) => row.views,
			cell: (row) => number.format(row.views),
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("shares.title")}
				description={[
					fillCount(
						t(`shares.liveCount.${pluralForm(liveCount, locale)}`),
						liveCount,
						locale,
					),
					fillCount(
						t(`shares.expiringCount.${pluralForm(expiringCount, locale)}`),
						expiringCount,
						locale,
					),
				].join(" · ")}
			/>
			<Card>
				<CardContent>
					<DataTable
						rows={rows}
						columns={columns}
						searchText={(row) =>
							`${row.fileName} ${row.recipients.map((contact) => `${contact.name} ${contact.organization}`).join(" ")} ${row.sharedByName}`
						}
						noResults={t("shares.noResults")}
						toolbar={
							<>
								<Tabs
									value={activeStatus}
									onValueChange={(value) =>
										setStatus(
											SHARE_STATUSES.find((option) => option === value) ??
												"all",
										)
									}
									className="max-w-full"
								>
									{/* A phone keeps one row of 44 px tall tabs. The row scrolls sideways when it is wider than the card. */}
									<TabsList className="max-sm:max-w-full max-sm:justify-start max-sm:overflow-x-auto max-sm:group-data-[orientation=horizontal]/tabs:h-auto max-sm:[scrollbar-width:none]">
										<TabsTrigger value="all" className="max-sm:min-h-11">
											{t("shares.all")}
											<span className="text-muted-foreground tabular-nums">
												{number.format(inAudience.length)}
											</span>
										</TabsTrigger>
										{tabs.map((tab) => (
											<TabsTrigger
												key={tab.value}
												value={tab.value}
												className="max-sm:min-h-11"
											>
												{t(`shares.statuses.${tab.value}`)}
												<span className="text-muted-foreground tabular-nums">
													{number.format(tab.count)}
												</span>
											</TabsTrigger>
										))}
									</TabsList>
								</Tabs>
								<Select
									value={audience}
									onValueChange={(value) =>
										setAudience(
											AUDIENCES.find((option) => option === value) ?? "all",
										)
									}
								>
									<SelectTrigger
										className="w-auto min-w-40"
										aria-label={t("shares.audienceFilter")}
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{AUDIENCES.map((option) => (
											<SelectItem key={option} value={option}>
												{t(`shares.audiences.${option}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</>
						}
					/>
				</CardContent>
			</Card>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function SharedPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-4 w-64" />
			</div>
			<Card>
				<CardContent className="grid gap-3">
					<Skeleton className="h-9 w-full sm:max-w-lg" />
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-12 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state when the loader fails. Try again runs the loader again. */
export function SharedPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("shares.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}

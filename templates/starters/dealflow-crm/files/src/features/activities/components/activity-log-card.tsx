// The log card of the activities page: the activities of the last ACTIVITY_DEFAULT_DAYS days in a searchable table.
// ActivitiesPage renders it and passes the cached rows. The type tabs filter the rows before the table gets them.
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	ACTIVITY_TYPE_ICON,
	ACTIVITY_TYPES,
	type ActivityType,
	dayCountFormat,
	fillMessage,
	formatRelativeTime,
	PersonAvatar,
} from "~/features/crm";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import {
	ACTIVITY_DEFAULT_DAYS,
	type Activity,
} from "../api/activities.queries";

type ActivityLogCardProps = {
	/** The activities of the last ACTIVITY_DEFAULT_DAYS days, newest first. */
	activities: Activity[];
	/** The current time in milliseconds since 1970. The relative times count from it. */
	now: number;
};

/** The type tab filters the rows; then DataTable searches, sorts, and pages them. */
export function ActivityLogCard({ activities, now }: ActivityLogCardProps) {
	const { t, locale } = useT();
	const [type, setType] = useState<ActivityType | "all">("all");
	const number = new Intl.NumberFormat(locale);
	// A tab shows only for a type that has rows.
	const tabs = ACTIVITY_TYPES.map((value) => ({
		value,
		count: activities.filter((row) => row.type === value).length,
	})).filter((tab) => tab.count > 0);
	const rows =
		type === "all" ? activities : activities.filter((row) => row.type === type);

	const columns: DataTableColumn<Activity>[] = [
		{
			id: "activity",
			header: t("activities.activity"),
			sortValue: (row) => row.subject,
			cell: (row) => {
				const TypeIcon = ACTIVITY_TYPE_ICON[row.type];
				return (
					<div className="flex items-center gap-3">
						<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
							<TypeIcon
								className="size-4"
								role="img"
								aria-hidden={false}
								aria-label={t(`activityTypes.${row.type}`)}
							/>
						</span>
						{/* A fixed width: a truncated line has no width of its own, so the column would not hold it. */}
						{/* It is narrow while the page has one column, so the four columns fit a 1024 px screen. */}
						<div className="grid @5xl/main:w-56 w-36">
							<span className="truncate font-medium">{row.subject}</span>
							<span
								className="truncate text-muted-foreground text-xs"
								dir="auto"
							>
								{row.note}
							</span>
						</div>
					</div>
				);
			},
		},
		{
			id: "related",
			header: t("activities.related"),
			sortValue: (row) => row.deal?.name ?? row.contactName,
			// justify-items-start: each line is as wide as its text, so dir="auto" text sits at the start side.
			cell: (row) => (
				<div className="grid justify-items-start">
					{row.deal ? (
						<Link
							to="/app/deals/$dealId"
							params={{ dealId: row.deal.id }}
							className="font-medium hover:underline"
							dir="auto"
						>
							{row.deal.name}
						</Link>
					) : (
						<span dir="auto">{row.contactName}</span>
					)}
					<span className="text-muted-foreground text-xs" dir="auto">
						{row.companyName}
					</span>
				</div>
			),
		},
		{
			id: "rep",
			header: t("activities.rep"),
			sortValue: (row) => row.repName,
			cell: (row) => (
				<span className="flex items-center gap-2">
					<PersonAvatar name={row.repName} className="size-6 text-[0.625rem]" />
					<bdi>{row.repName}</bdi>
				</span>
			),
		},
		{
			id: "when",
			header: t("activities.when"),
			align: "end",
			sortValue: (row) => Date.parse(row.occurredAt),
			cell: (row) => (
				<time dateTime={row.occurredAt} className="text-muted-foreground">
					{formatRelativeTime(row.occurredAt, now, locale)}
				</time>
			),
		},
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("activities.logTitle")}</CardTitle>
				<CardDescription>
					{fillMessage(t("activities.lastPeriod"), {
						period: dayCountFormat(locale).format(ACTIVITY_DEFAULT_DAYS),
					})}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<DataTable
					rows={rows}
					columns={columns}
					searchText={(row) =>
						`${row.subject} ${row.note} ${row.deal?.name ?? ""} ${row.companyName} ${row.contactName} ${row.repName}`
					}
					noResults={t("activities.noResults")}
					toolbar={
						<Tabs
							value={type}
							onValueChange={(value) =>
								setType(
									ACTIVITY_TYPES.find((option) => option === value) ?? "all",
								)
							}
							className="max-w-full overflow-x-auto"
						>
							<TabsList>
								<TabsTrigger value="all">
									{t("activities.all")}
									<span className="text-muted-foreground tabular-nums">
										{number.format(activities.length)}
									</span>
								</TabsTrigger>
								{tabs.map((tab) => (
									<TabsTrigger key={tab.value} value={tab.value}>
										{t(`activityTypes.${tab.value}`)}
										<span className="text-muted-foreground tabular-nums">
											{number.format(tab.count)}
										</span>
									</TabsTrigger>
								))}
							</TabsList>
						</Tabs>
					}
				/>
			</CardContent>
		</Card>
	);
}

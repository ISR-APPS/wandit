// The detail page of one deal: its header and value, the stage path, the key facts, the activity timeline,
// the main contact, and the open follow-up tasks.
// The /app/deals/$dealId route renders it after its loader. The route also uses the skeleton below.
// An unknown id shows a not-found block with a link back to the list.
import { FlagPennantIcon, WarningIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
	dealActivitiesQueryOptions,
	dealTasksQueryOptions,
	TaskList,
} from "~/features/activities";
import { PageHeader } from "~/features/app-shell";
import {
	DAY_MS,
	DealStageBadge,
	dayCountFormat,
	fillMessage,
	formatRelativeTime,
	isOpenStage,
	moneyFormat,
	PersonAvatar,
	STAGE_PROBABILITY,
	STALLED_AFTER_DAYS,
} from "~/features/crm";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { CaretLeftIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import { dealQueryOptions } from "../api/deals.queries";
import { isPastCloseDate, isStalled } from "../lib/deal-attention";
import { DealActivityCard } from "./deal-activity-card";
import { DealContactCard } from "./deal-contact-card";
import { DealStagePath } from "./deal-stage-path";

type DealDetailPageProps = {
	/** The `$dealId` param of the URL. The query answers null for an id that does not exist. */
	dealId: string;
};

/** One fact of the details list: a label and its value. */
type Fact = { label: string; value: ReactNode };

/** The detail page. A 2/3 main column and a 1/3 rail from the 5xl container width. */
export function DealDetailPage({ dealId }: DealDetailPageProps) {
	const { t, locale } = useT();
	const { data: deal } = useSuspenseQuery(dealQueryOptions(dealId));
	const { data: activities } = useSuspenseQuery(
		dealActivitiesQueryOptions(dealId),
	);
	const { data: tasks } = useSuspenseQuery(dealTasksQueryOptions(dealId));

	const backLink = (
		<Button
			asChild
			variant="ghost"
			size="sm"
			className="-ms-3 justify-self-start"
		>
			<Link to="/app/deals">
				<CaretLeftIcon className="rtl:rotate-180" />
				{t("deals.title")}
			</Link>
		</Button>
	);
	if (!deal) {
		return (
			<div className="grid gap-4">
				{backLink}
				<p className="text-muted-foreground text-sm">{t("deals.notFound")}</p>
			</div>
		);
	}

	const money = moneyFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const dayCount = dayCountFormat(locale);
	const now = Date.now();
	const isOpen = isOpenStage(deal.stage);
	const probability = STAGE_PROBABILITY[deal.stage];
	const pastCloseDate = isPastCloseDate(deal, now);

	const closedAt = deal.closedAt ?? deal.stageChangedAt;
	const ownerFact: Fact = {
		label: t("deals.owner"),
		value: (
			<span className="flex items-center gap-2">
				<PersonAvatar
					name={deal.ownerName}
					className="size-6 text-[0.625rem]"
				/>
				<bdi>{deal.ownerName}</bdi>
			</span>
		),
	};
	// An open deal shows its forecast. A closed deal shows how it ended.
	const facts: Fact[] = isOpen
		? [
				{
					label: t("deals.expectedClose"),
					value: (
						<span
							className={
								pastCloseDate
									? "inline-flex flex-wrap items-center gap-x-1.5 text-destructive"
									: undefined
							}
						>
							{pastCloseDate ? <WarningIcon className="size-4" /> : null}
							{date.format(new Date(deal.expectedCloseAt))}
							<span
								className={pastCloseDate ? undefined : "text-muted-foreground"}
							>
								{` · ${formatRelativeTime(deal.expectedCloseAt, now, locale)}`}
							</span>
						</span>
					),
				},
				{
					label: t("deals.probability"),
					value: (
						<span className="tabular-nums">{percent.format(probability)}</span>
					),
				},
				{
					label: t("deals.weighted"),
					value: (
						<span className="tabular-nums">
							{money.format(deal.amount * probability)}
						</span>
					),
				},
				ownerFact,
				{ label: t("deals.source"), value: t(`deals.sources.${deal.source}`) },
				{
					label: t("deals.created"),
					value: date.format(new Date(deal.createdAt)),
				},
			]
		: [
				{
					label: t(deal.stage === "won" ? "deals.wonOn" : "deals.lostOn"),
					value: date.format(new Date(closedAt)),
				},
				{
					label: t("deals.salesCycle"),
					value: (
						<span className="tabular-nums">
							{dayCount.format(
								Math.round(
									(Date.parse(closedAt) - Date.parse(deal.createdAt)) / DAY_MS,
								),
							)}
						</span>
					),
				},
				deal.lostReason
					? {
							label: t("deals.lostReason"),
							value: t(`deals.lostReasons.${deal.lostReason}`),
						}
					: {
							label: t("deals.lastActivity"),
							value: formatRelativeTime(deal.lastActivityAt, now, locale),
						},
				ownerFact,
				{ label: t("deals.source"), value: t(`deals.sources.${deal.source}`) },
				{
					label: t("deals.created"),
					value: date.format(new Date(deal.createdAt)),
				},
			];

	return (
		<div className="grid gap-6">
			{backLink}
			<PageHeader
				title={deal.name}
				description={
					<span className="flex flex-wrap items-center gap-2">
						<DealStageBadge stage={deal.stage} />
						<span dir="auto">{deal.companyName}</span>
					</span>
				}
				actions={
					// 100cqw is the width of the page column: on a phone the value takes its own row under the title.
					<div className="grid @xl/main:w-auto w-[100cqw] justify-items-start @xl/main:justify-items-end gap-0.5">
						<span className="label-text text-muted-foreground text-xs">
							{t("deals.value")}
						</span>
						<span className="font-numeric font-semibold text-3xl tabular-nums leading-none">
							{money.format(deal.amount)}
						</span>
					</div>
				}
			/>
			<div className="grid @5xl/main:grid-cols-3 grid-cols-1 items-start gap-6">
				<div className="@5xl/main:col-span-2 grid gap-6">
					<Card>
						<CardHeader>
							<CardTitle>{t("deals.stagePath")}</CardTitle>
							{isStalled(deal, now) ? (
								<CardDescription className="flex items-center gap-1.5 text-warning">
									<FlagPennantIcon className="size-4 shrink-0" />
									{fillMessage(t("deals.stalledHint"), {
										days: dayCount.format(STALLED_AFTER_DAYS),
									})}
								</CardDescription>
							) : null}
						</CardHeader>
						<CardContent>
							<DealStagePath deal={deal} now={now} />
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle>{t("deals.details")}</CardTitle>
						</CardHeader>
						<CardContent>
							<dl className="grid @3xl/main:grid-cols-3 grid-cols-2 gap-x-4 gap-y-5 text-sm">
								{facts.map((fact) => (
									<div key={fact.label} className="grid content-start gap-1">
										<dt className="text-muted-foreground text-xs">
											{fact.label}
										</dt>
										<dd className="font-medium">{fact.value}</dd>
									</div>
								))}
							</dl>
						</CardContent>
					</Card>
					<DealActivityCard activities={activities} now={now} />
				</div>
				<div className="grid gap-6">
					<DealContactCard deal={deal} />
					<Card>
						<CardHeader>
							<CardTitle>{t("tasks.title")}</CardTitle>
						</CardHeader>
						<CardContent>
							{tasks.length === 0 ? (
								<p className="text-muted-foreground text-sm">
									{t(isOpen ? "deals.noTasks" : "deals.noTasksClosed")}
								</p>
							) : (
								<TaskList tasks={tasks} now={now} showDeal={false} showState />
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}

/** Placeholder while the detail loader runs. The route sets it as pendingComponent. */
export function DealDetailPageSkeleton() {
	return (
		<div className="grid gap-6">
			<Skeleton className="h-8 w-24" />
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-64 max-w-full" />
					<Skeleton className="h-5 w-48" />
				</div>
				<Skeleton className="h-12 w-36" />
			</div>
			<div className="grid @5xl/main:grid-cols-3 grid-cols-1 items-start gap-6">
				<div className="@5xl/main:col-span-2 grid gap-6">
					<Skeleton className="h-36" />
					<Skeleton className="h-40" />
					<Skeleton className="h-96" />
				</div>
				<div className="grid gap-6">
					<Skeleton className="h-64" />
					<Skeleton className="h-40" />
				</div>
			</div>
		</div>
	);
}

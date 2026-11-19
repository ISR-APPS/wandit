// The page of one deal: a back link, the title row with the stage and the contact actions,
// then a facts column (1/3) and a work column (2/3) with the stage path and the Activity | Follow-ups tabs.
// The /app/deals/$dealId route renders it after its loader. The route also uses the skeleton below.
// It follows the profile page anatomy of the kit. An unknown id shows a not-found block with a link back.
import {
	ArrowLeftIcon,
	BuildingsIcon,
	EnvelopeSimpleIcon,
	FlagPennantIcon,
	PhoneIcon,
	WarningIcon,
} from "@phosphor-icons/react";
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
	isStalledDeal,
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
import { Separator } from "~/shared/ui/separator";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { dealQueryOptions } from "../api/deals.queries";
import { daysInStage, isPastCloseDate } from "../lib/deal-attention";
import { DealActivityCard } from "./deal-activity-card";
import { DealContactCard } from "./deal-contact-card";
import { DealStagePath } from "./deal-stage-path";

type DealDetailPageProps = {
	/** The `$dealId` param of the URL. The query answers null for an id that does not exist. */
	dealId: string;
};

/** One fact of the facts list: a label and its value. */
type Fact = { label: string; value: ReactNode };

/** One cell of the stat strip of the facts card: a short value over its label. */
type Stat = { label: string; value: string };

/** The detail page. One column on a phone; 1/3 and 2/3 from the 4xl container width. */
export function DealDetailPage({ dealId }: DealDetailPageProps) {
	const { t, locale } = useT();
	const { data: deal } = useSuspenseQuery(dealQueryOptions(dealId));
	const { data: activities } = useSuspenseQuery(
		dealActivitiesQueryOptions(dealId),
	);
	const { data: tasks } = useSuspenseQuery(dealTasksQueryOptions(dealId));
	const number = new Intl.NumberFormat(locale);

	const backLink = (
		<Button
			asChild
			variant="ghost"
			size="sm"
			className="-ms-3 justify-self-start"
		>
			<Link to="/app/deals">
				<ArrowLeftIcon className="rtl:rotate-180" />
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
	const compactMoney = moneyFormat(locale, "compact");
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const dayCount = dayCountFormat(locale);
	const now = Date.now();
	const isOpen = isOpenStage(deal.stage);
	const probability = STAGE_PROBABILITY[deal.stage];
	const pastCloseDate = isPastCloseDate(deal, now);
	const closedAt = deal.closedAt ?? deal.stageChangedAt;
	const salesCycleDays = Math.round(
		(Date.parse(closedAt) - Date.parse(deal.createdAt)) / DAY_MS,
	);

	const stats: Stat[] = [
		{ label: t("deals.value"), value: compactMoney.format(deal.amount) },
		{ label: t("deals.probability"), value: percent.format(probability) },
		isOpen
			? {
					label: t("deals.inStage"),
					value: dayCount.format(daysInStage(deal, now)),
				}
			: {
					label: t("deals.salesCycle"),
					value: dayCount.format(salesCycleDays),
				},
	];
	// An open deal shows its forecast. A closed deal shows how it ended.
	const facts: Fact[] = [
		isOpen
			? {
					label: t("deals.expectedClose"),
					value: (
						<span
							className={
								pastCloseDate
									? "inline-flex flex-wrap items-center gap-x-1 text-destructive"
									: undefined
							}
						>
							{pastCloseDate ? <WarningIcon className="size-4" /> : null}
							{pastCloseDate ? (
								<span className="sr-only">{t("deals.pastCloseDate")}</span>
							) : null}
							{date.format(new Date(deal.expectedCloseAt))}
						</span>
					),
				}
			: {
					label: t(deal.stage === "won" ? "deals.wonOn" : "deals.lostOn"),
					value: date.format(new Date(closedAt)),
				},
		isOpen
			? {
					label: t("deals.weighted"),
					value: (
						<span className="tabular-nums">
							{money.format(deal.amount * probability)}
						</span>
					),
				}
			: deal.lostReason
				? {
						label: t("deals.lostReason"),
						value: t(`deals.lostReasons.${deal.lostReason}`),
					}
				: { label: t("deals.amount"), value: money.format(deal.amount) },
		{
			label: t("deals.owner"),
			value: (
				<span className="flex items-center gap-2">
					<PersonAvatar name={deal.ownerName} className="size-6 text-xs" />
					<bdi>{deal.ownerName}</bdi>
				</span>
			),
		},
		{ label: t("deals.source"), value: t(`deals.sources.${deal.source}`) },
		{ label: t("deals.created"), value: date.format(new Date(deal.createdAt)) },
		{
			label: t("deals.lastActivity"),
			value: formatRelativeTime(deal.lastActivityAt, now, locale),
		},
	];

	return (
		<div className="grid gap-4">
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
					<>
						<Button asChild variant="outline">
							<a href={`tel:${deal.contact.phone.replace(/[^\d+]/g, "")}`}>
								<PhoneIcon />
								{t("deals.call")}
							</a>
						</Button>
						<Button asChild>
							<a href={`mailto:${deal.contact.email}`}>
								<EnvelopeSimpleIcon />
								{t("deals.email")}
							</a>
						</Button>
					</>
				}
			/>
			<div className="grid @4xl/main:grid-cols-3 items-start gap-4">
				<div className="grid gap-4">
					<Card>
						<CardContent className="grid gap-6">
							<div className="flex items-center gap-3">
								<span className="flex size-12 shrink-0 items-center justify-center rounded-full border bg-muted">
									<BuildingsIcon className="size-5" />
								</span>
								<div className="grid min-w-0 justify-items-start gap-0.5">
									<span className="font-display font-semibold" dir="auto">
										{deal.companyName}
									</span>
									<span className="text-muted-foreground text-sm">
										{`${deal.company.industry} · ${deal.company.city}`}
									</span>
									<span className="text-muted-foreground text-xs tabular-nums">
										{fillMessage(t("deals.employees"), {
											count: number.format(deal.company.employees),
										})}
									</span>
								</div>
							</div>
							<dl className="grid grid-cols-3 divide-x rounded-md border rtl:divide-x-reverse">
								{stats.map((stat) => (
									// flex-col-reverse: the value shows over its label, and the dt stays first for screen readers.
									<div
										key={stat.label}
										className="flex flex-col-reverse items-center gap-0.5 px-2 py-3 text-center"
									>
										<dt className="text-muted-foreground text-xs">
											{stat.label}
										</dt>
										<dd className="font-numeric font-semibold text-lg tabular-nums">
											{stat.value}
										</dd>
									</div>
								))}
							</dl>
							<Separator />
							<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
								{facts.map((fact) => (
									<div key={fact.label} className="contents">
										<dt className="text-muted-foreground">{fact.label}</dt>
										<dd className="justify-self-end text-end font-medium">
											{fact.value}
										</dd>
									</div>
								))}
							</dl>
						</CardContent>
					</Card>
					<DealContactCard deal={deal} />
				</div>
				<div className="@4xl/main:col-span-2 grid gap-4">
					<Card>
						<CardHeader>
							<CardTitle>{t("deals.stagePath")}</CardTitle>
							{isStalledDeal(deal, now) ? (
								<CardDescription className="flex items-center gap-1.5 text-warning">
									<FlagPennantIcon className="size-4 shrink-0" />
									{fillMessage(t("deals.stalledHint"), {
										days: dayCount.format(STALLED_AFTER_DAYS),
									})}
								</CardDescription>
							) : (
								<CardDescription>{t("deals.stagePathHint")}</CardDescription>
							)}
						</CardHeader>
						<CardContent>
							<DealStagePath deal={deal} now={now} />
						</CardContent>
					</Card>
					<Tabs defaultValue="activity">
						<TabsList>
							<TabsTrigger value="activity">
								{t("deals.activity")}
								<span className="text-muted-foreground tabular-nums">
									{number.format(activities.length)}
								</span>
							</TabsTrigger>
							<TabsTrigger value="tasks">
								{t("tasks.title")}
								<span className="text-muted-foreground tabular-nums">
									{number.format(tasks.length)}
								</span>
							</TabsTrigger>
						</TabsList>
						<TabsContent value="activity">
							<DealActivityCard activities={activities} now={now} />
						</TabsContent>
						<TabsContent value="tasks">
							<Card>
								<CardHeader>
									<CardTitle>{t("tasks.title")}</CardTitle>
									<CardDescription>{t("deals.tasksHint")}</CardDescription>
								</CardHeader>
								<CardContent>
									{tasks.length === 0 ? (
										<p className="py-6 text-center text-muted-foreground text-sm">
											{t(isOpen ? "deals.noTasks" : "deals.noTasksClosed")}
										</p>
									) : (
										<TaskList
											tasks={tasks}
											now={now}
											showDeal={false}
											showState
										/>
									)}
								</CardContent>
							</Card>
						</TabsContent>
					</Tabs>
				</div>
			</div>
		</div>
	);
}

/** Placeholder while the detail loader runs. The route sets it as pendingComponent. */
export function DealDetailPageSkeleton() {
	return (
		<div className="grid gap-4">
			<Skeleton className="h-8 w-24" />
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-64 max-w-full" />
					<Skeleton className="h-5 w-48" />
				</div>
				<Skeleton className="h-9 w-48" />
			</div>
			<div className="grid @4xl/main:grid-cols-3 items-start gap-4">
				<div className="grid gap-4">
					<Skeleton className="h-96" />
					<Skeleton className="h-56" />
				</div>
				<div className="@4xl/main:col-span-2 grid gap-4">
					<Skeleton className="h-36" />
					<Skeleton className="h-96" />
				</div>
			</div>
		</div>
	);
}

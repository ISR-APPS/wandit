// The day report behind login, in the band layout of the kit e-commerce page.
// Band 1: the busiest-hour card (4/12) and 3 figure cards (8/12). Band 2: two hour charts. Band 3: categories,
// payments, and serve times. Band 4: the recent checks (7/12) and the best sellers (5/12) from @5xl/main.
// The /app/report route renders it after its loader. The route also uses the skeleton and the error below.
import { ArrowRightIcon, DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import { buildMenuRows } from "~/features/menu";
import {
	changeFormat,
	countLabel,
	downloadCsv,
	fillMessage,
	formatCents,
	formatClock,
	isGoodChange,
	menuQueryOptions,
	moneyFormat,
	orderCsvColumns,
	ordersQueryOptions,
	toCsv,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { dayReportQueryOptions } from "../api/day-report.queries";
import { busiestHour, type ReportFigure } from "../lib/day-report";
import { CategorySalesCard } from "./category-sales-card";
import { DishSalesCard } from "./dish-sales-card";
import { HourGuestsCard, HourSalesCard } from "./hour-cards";
import { PaymentsCard } from "./payments-card";
import { RecentChecksCard } from "./recent-checks-card";
import { ServeTimesCard } from "./serve-times-card";

// "View more" of each figure opens the page that lists what the figure counts.
const FIGURE_LINK = {
	grossSales: "/app/orders",
	checks: "/app/orders",
	averageCheck: "/app/menu",
} as const satisfies Record<ReportFigure["id"], string>;

/** The page reads the cached queries of its loader. The best sellers join the menu with the checks of the day. */
export function ReportPage() {
	const { t, locale } = useT();
	const { data: report } = useSuspenseQuery(dayReportQueryOptions());
	const { data: menu } = useSuspenseQuery(menuQueryOptions());
	const { data: orders } = useSuspenseQuery(ordersQueryOptions());
	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const hourFormat = new Intl.DateTimeFormat(locale, { hour: "numeric" });
	const dateFormat = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
	});
	const busiest = busiestHour(report.hours);
	const busiestCents = busiest ? busiest.kitchenCents + busiest.barCents : 0;
	const dishes = buildMenuRows(menu, orders)
		.filter((row) => row.soldToday > 0)
		.sort((first, second) => second.salesTodayCents - first.salesTodayCents);

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("report.title")}
				description={
					report.openedAt
						? fillMessage(t("report.description"), {
								date: dateFormat.format(new Date()),
								time: formatClock(report.openedAt, locale),
							})
						: dateFormat.format(new Date())
				}
				actions={
					<Button
						type="button"
						aria-label={t("report.download")}
						onClick={() =>
							downloadCsv(
								"day-report.csv",
								toCsv(orders, orderCsvColumns(t, locale)),
							)
						}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">{t("report.download")}</span>
					</Button>
				}
			/>
			<div className="grid @4xl/main:grid-cols-12 gap-4">
				<Card className="@4xl/main:col-span-4 bg-muted">
					<CardHeader>
						<CardTitle className="text-2xl">
							{busiest
								? fillMessage(t("report.busiestHour"), {
										hour: hourFormat.format(new Date(busiest.hourStart)),
									})
								: t("report.noSalesYet")}
						</CardTitle>
						<CardDescription>
							{t("report.busiestHourDescription")}
						</CardDescription>
					</CardHeader>
					<CardContent>
						{/* The amount column grows from 0, so the button stays beside it until the amount itself needs the room. */}
						<div className="flex flex-wrap items-center justify-between gap-4">
							<div className="grid flex-1 gap-1">
								<span className="font-numeric @5xl/main:text-3xl text-2xl tabular-nums">
									{formatCents(money, busiestCents)}
								</span>
								<span className="text-muted-foreground text-xs">
									{fillMessage(t("report.shareOfDay"), {
										share: percent.format(
											report.grossCents === 0
												? 0
												: busiestCents / report.grossCents,
										),
										checks: countLabel(
											busiest?.checks ?? 0,
											t("counts.checks.one"),
											t("counts.checks.other"),
											locale,
										),
									})}
								</span>
							</div>
							<Button asChild variant="outline">
								<Link to="/app/orders">{t("report.viewChecks")}</Link>
							</Button>
						</div>
					</CardContent>
				</Card>
				<div className="@4xl/main:col-span-8 grid @xl/main:grid-cols-3 gap-4">
					{report.figures.map((figure) => (
						<Card key={figure.id} className="gap-0 py-0">
							<CardContent className="grid flex-1 content-start gap-4 p-6">
								<div className="flex items-start justify-between gap-2">
									<span className="truncate text-muted-foreground text-sm">
										{t(`report.${figure.id}`)}
									</span>
									{figure.change === null ? null : (
										<span
											className={cn(
												"font-medium text-sm",
												isGoodChange(figure.change, "up")
													? "text-success"
													: "text-destructive",
											)}
										>
											{/* dir="ltr" keeps "+3.6%" in this order in an Arabic page. */}
											<bdi dir="ltr">
												{changeFormat(locale).format(figure.change)}
											</bdi>
										</span>
									)}
								</div>
								<span className="font-numeric font-semibold text-3xl tabular-nums">
									{figure.isMoney
										? formatCents(money, figure.value)
										: number.format(figure.value)}
								</span>
							</CardContent>
							<CardFooter className="justify-end border-t p-0">
								<Link
									to={FIGURE_LINK[figure.id]}
									className="flex items-center px-6 py-3 font-medium text-primary text-sm hover:text-primary/90"
								>
									{t("report.viewMore")}
									<ArrowRightIcon className="ms-2 size-4 rtl:rotate-180" />
								</Link>
							</CardFooter>
						</Card>
					))}
				</div>
			</div>
			<div className="grid @4xl/main:grid-cols-2 gap-4">
				<HourSalesCard hours={report.hours} />
				<HourGuestsCard
					hours={report.hours}
					covers={report.covers}
					coversChange={report.coversChange}
				/>
			</div>
			<div className="grid @3xl/main:grid-cols-12 gap-4">
				<div className="@3xl/main:col-span-6 @4xl/main:col-span-4">
					<CategorySalesCard
						categories={report.categories}
						grossCents={report.grossCents}
					/>
				</div>
				<div className="@3xl/main:col-span-6 @4xl/main:col-span-3">
					<PaymentsCard rows={report.payments} />
				</div>
				<div className="@3xl/main:col-span-12 @4xl/main:col-span-5">
					<ServeTimesCard serveTimes={report.serveTimes} />
				</div>
			</div>
			{/* The two tables need about 360 px each. Below @5xl/main a 5/12 column is narrower, so the band stacks. */}
			<div className="grid @5xl/main:grid-cols-12 gap-4">
				<div className="@5xl/main:col-span-7 min-w-0">
					<RecentChecksCard orders={orders} />
				</div>
				<div className="@5xl/main:col-span-5 min-w-0">
					<DishSalesCard dishes={dishes} />
				</div>
			</div>
		</div>
	);
}

// Placeholder cards of the skeleton. Fixed keys, because they never reorder.
const SKELETON_FIGURES = ["grossSales", "checks", "averageCheck"];
const SKELETON_BAND_THREE = ["categories", "payments", "serve"];

/** Placeholder while the report loader runs: the header and the 4 bands. */
export function ReportPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-72 max-w-full" />
			</div>
			<div className="grid @4xl/main:grid-cols-12 gap-4">
				<Skeleton className="@4xl/main:col-span-4 h-44 rounded-surface" />
				<div className="@4xl/main:col-span-8 grid @xl/main:grid-cols-3 gap-4">
					{SKELETON_FIGURES.map((key) => (
						<Skeleton key={key} className="h-44 rounded-surface" />
					))}
				</div>
			</div>
			<div className="grid @4xl/main:grid-cols-2 gap-4">
				<Skeleton className="h-80 rounded-surface" />
				<Skeleton className="h-80 rounded-surface" />
			</div>
			<div className="grid @4xl/main:grid-cols-3 gap-4">
				{SKELETON_BAND_THREE.map((key) => (
					<Skeleton key={key} className="h-96 rounded-surface" />
				))}
			</div>
			<div className="grid @5xl/main:grid-cols-12 gap-4">
				<Skeleton className="@5xl/main:col-span-7 h-96 rounded-surface" />
				<Skeleton className="@5xl/main:col-span-5 h-96 rounded-surface" />
			</div>
		</div>
	);
}

/** Error state of the report when its loader fails. Try again runs the loader again. */
export function ReportPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("report.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}

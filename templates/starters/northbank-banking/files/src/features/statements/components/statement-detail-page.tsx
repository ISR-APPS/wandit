// The page of one monthly statement: the balance through the month against the month before,
// the sum of the statement, and every line with its running balance.
// The /app/statements/$statementId route renders it after its loader. An unknown id shows a not-found block.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import {
	accountOf,
	addMonths,
	dayFormat,
	dayToDate,
	MoneyTrendCard,
	monthFormat,
} from "~/features/bank";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { CaretLeftIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import { statementDetailQueryOptions } from "../api/statements.queries";
import { StatementLinesCard } from "./statement-lines-card";
import { StatementStatusBadge } from "./statement-status-badge";
import { StatementSummaryCard } from "./statement-summary-card";

type StatementDetailPageProps = {
	/** The `$statementId` param of the URL, for example "operating-2026-10". */
	statementId: string;
};

/** The chart spans 2 columns and the sum takes the rail from the 4xl container width. */
export function StatementDetailPage({ statementId }: StatementDetailPageProps) {
	const { t, locale } = useT();
	const { data: detail } = useSuspenseQuery(
		statementDetailQueryOptions(statementId),
	);

	const backLink = (
		<Button
			asChild
			variant="ghost"
			size="sm"
			className="-ms-3 justify-self-start max-md:h-11"
		>
			<Link to="/app/statements">
				<CaretLeftIcon className="rtl:rotate-180" />
				{t("statements.title")}
			</Link>
		</Button>
	);
	if (!detail) {
		return (
			<div className="grid gap-4">
				{backLink}
				<p className="text-muted-foreground text-sm">
					{t("statements.notFound")}
				</p>
			</div>
		);
	}

	const { statement, lines, points } = detail;
	const account = accountOf(statement.accountId);
	const month = monthFormat(locale);
	const monthName = new Intl.DateTimeFormat(locale, {
		month: "long",
		timeZone: "UTC",
	});
	const longDay = dayFormat(locale, "long");
	const shortDay = dayFormat(locale);

	return (
		<div className="grid gap-6">
			{backLink}
			<PageHeader
				title={month.format(dayToDate(statement.month))}
				description={
					<span className="flex flex-wrap items-center gap-2">
						<StatementStatusBadge status={statement.status} />
						<span className="tabular-nums">
							{`${t(`accounts.${account.id}`)} ••${account.numberEnding} · ${shortDay.format(dayToDate(statement.month))} – ${longDay.format(dayToDate(statement.endDay))}`}
						</span>
					</span>
				}
			/>
			<div className="grid @4xl/main:grid-cols-3 items-start gap-6">
				<div className="@4xl/main:col-span-2">
					<MoneyTrendCard
						title={t("statements.balanceTitle")}
						description={t("statements.balanceDescription")}
						points={points}
						currentLabel={monthName.format(dayToDate(statement.month))}
						previousLabel={monthName.format(
							dayToDate(addMonths(statement.month, -1)),
						)}
						emptyText={t("statements.noLines")}
						yFromZero={false}
					/>
				</div>
				<StatementSummaryCard statement={statement} points={points} />
			</div>
			<StatementLinesCard lines={lines} />
		</div>
	);
}

/** Placeholder while the statement loader runs. The route sets it as pendingComponent. */
export function StatementDetailPageSkeleton() {
	return (
		<div className="grid gap-6">
			<Skeleton className="h-8 w-32" />
			<div className="grid gap-2">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-5 w-72 max-w-full" />
			</div>
			<div className="grid @4xl/main:grid-cols-3 items-start gap-6">
				<Skeleton className="@4xl/main:col-span-2 h-80" />
				<Skeleton className="h-56" />
			</div>
			<Skeleton className="h-96" />
		</div>
	);
}

// The activity card of the account page: three figures of a period, and the active people of each day.
// AccountDetailPage renders it. The card holds its period and reads the series itself,
// because the period changes after a click.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
	ChangePill,
	changeRatio,
	DailyAreaChart,
	DEFAULT_DAYS,
	PanelError,
	type PeriodDays,
	PeriodTabs,
	STACKING_ACTION,
	STACKING_HEADER,
	shareFormat,
	shareOf,
} from "~/features/tracking";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { accountActivityQueryOptions } from "../api/accounts.queries";

type AccountActivityCardProps = {
	/** The URL id of the account. */
	accountId: string;
	/** How many people the account has. The card shows the active share of them. */
	members: number;
};

/** The first period is 30 days: the period of the account list, so the two pages show the same figure. */
export function AccountActivityCard({
	accountId,
	members,
}: AccountActivityCardProps) {
	const { t, locale } = useT();
	const [days, setDays] = useState<PeriodDays>(DEFAULT_DAYS);
	const activity = useQuery({
		...accountActivityQueryOptions(accountId, days),
		placeholderData: keepPreviousData,
	});
	const number = new Intl.NumberFormat(locale);
	const share = shareFormat(locale);
	const data = activity.data;
	const peopleChange = data
		? changeRatio(data.people.current, data.people.previous)
		: null;
	const eventsChange = data
		? changeRatio(data.events.current, data.events.previous)
		: null;

	return (
		<Card>
			<CardHeader className={STACKING_HEADER}>
				<CardTitle>{t("accounts.activity.title")}</CardTitle>
				<CardDescription>{t("accounts.activity.description")}</CardDescription>
				<CardAction className={STACKING_ACTION}>
					<PeriodTabs days={days} onDaysChange={setDays} />
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-6">
				{activity.isError ? (
					<PanelError
						message={t("accounts.activity.error")}
						onRetry={() => activity.refetch()}
						className="h-80"
					/>
				) : !data ? (
					<Skeleton className="h-80 w-full" />
				) : (
					<>
						<dl className="grid grid-cols-3 @xl/main:gap-x-8 gap-x-4">
							<div className="grid gap-1.5">
								<dt className="label-text text-muted-foreground text-xs">
									{t("accounts.activity.activePeople")}
								</dt>
								<dd className="flex flex-wrap items-center gap-2">
									<span className="font-numeric font-semibold @xl/main:text-2xl text-xl tabular-nums leading-none">
										{number.format(data.people.current)}
									</span>
									{peopleChange === null ? null : (
										<ChangePill change={peopleChange} goodWhen="up" />
									)}
								</dd>
							</div>
							<div className="grid gap-1.5">
								<dt className="label-text text-muted-foreground text-xs">
									{t("accounts.activity.teamShare")}
								</dt>
								<dd className="font-numeric font-semibold @xl/main:text-2xl text-xl tabular-nums leading-none">
									{share.format(shareOf(data.people.current, members))}
								</dd>
							</div>
							<div className="grid gap-1.5">
								<dt className="label-text text-muted-foreground text-xs">
									{t("accounts.activity.events")}
								</dt>
								<dd className="flex flex-wrap items-center gap-2">
									<span className="font-numeric font-semibold @xl/main:text-2xl text-xl tabular-nums leading-none">
										{number.format(data.events.current)}
									</span>
									{eventsChange === null ? null : (
										<ChangePill change={eventsChange} goodWhen="up" />
									)}
								</dd>
							</div>
						</dl>
						{data.people.current === 0 ? (
							// A flat line with a Y axis of 0 to 4 says nothing. The plot stays as a frame under one sentence.
							<div className="relative">
								<DailyAreaChart
									points={data.points}
									seriesLabel={t("accounts.activity.series")}
									className="h-64"
									showYAxis={false}
								/>
								<p className="pointer-events-none absolute inset-0 grid content-center px-6 text-center text-muted-foreground text-sm">
									{t("accounts.activity.empty")}
								</p>
							</div>
						) : (
							<DailyAreaChart
								points={data.points}
								seriesLabel={t("accounts.activity.series")}
								className="h-64"
							/>
						)}
					</>
				)}
			</CardContent>
		</Card>
	);
}

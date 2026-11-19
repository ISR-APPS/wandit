// The sign-up weeks card of the home: the sign-ups of the last 6 weeks with their change,
// stacked bars per week, and two rows that compare the invites and the self-serve sign-ups with the 6 weeks before.
// OverviewPage renders it in the second row of three. It does not follow the period of the page.
import {
	CaretDownIcon,
	CaretUpIcon,
	EnvelopeSimpleIcon,
	UserPlusIcon,
} from "@phosphor-icons/react";
import { lazy, Suspense } from "react";
import { changeRatio, type PeriodTotals } from "~/features/tracking";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import type { SignUpWeek } from "../api/overview.queries";
import { ChangeText } from "./change-text";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const SignUpWeekBars = lazy(() =>
	import("./sign-up-week-bars").then((module) => ({
		default: module.SignUpWeekBars,
	})),
);

type SignUpWeeksCardProps = {
	/** The last 6 weeks, the oldest first. */
	weeks: SignUpWeek[];
	/** The invites and the self-serve sign-ups of those weeks, and of the 6 weeks before. */
	totals: { invited: PeriodTotals; selfServe: PeriodTotals };
};

/** The badge compares all sign-ups. Each row gives the difference in users, in green or red. */
export function SignUpWeeksCard({ weeks, totals }: SignUpWeeksCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const signed = new Intl.NumberFormat(locale, { signDisplay: "exceptZero" });
	const current = totals.invited.current + totals.selfServe.current;
	const previous = totals.invited.previous + totals.selfServe.previous;
	const change = changeRatio(current, previous);
	const rows = [
		{
			key: "invited",
			label: t("overview.signUps.invited"),
			hint: t("overview.signUps.invitedHint"),
			totals: totals.invited,
			icon: EnvelopeSimpleIcon,
		},
		{
			key: "self-serve",
			label: t("overview.signUps.selfServe"),
			hint: t("overview.signUps.selfServeHint"),
			totals: totals.selfServe,
			icon: UserPlusIcon,
		},
	];

	return (
		<Card className="h-full">
			<CardHeader>
				<CardDescription>{t("overview.signUps.title")}</CardDescription>
				<CardAction>
					<Badge variant="outline">
						{change !== null && change < 0 ? (
							<CaretDownIcon className="text-destructive" />
						) : (
							<CaretUpIcon className="text-success" />
						)}
						<ChangeText change={change} />
						<span className="sr-only">{t("overview.signUps.vsBefore")}</span>
					</Badge>
				</CardAction>
				<p className="font-numeric font-semibold @4xl/main:text-3xl text-2xl tabular-nums">
					{number.format(current)}
				</p>
			</CardHeader>
			<CardContent>
				<Suspense fallback={<Skeleton className="aspect-21/9 w-full" />}>
					<SignUpWeekBars weeks={weeks} />
				</Suspense>
				<ul className="mt-5 grid gap-4">
					{rows.map((row) => {
						const difference = row.totals.current - row.totals.previous;
						return (
							<li key={row.key} className="flex items-center gap-3">
								<span className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted">
									<row.icon className="size-4" />
								</span>
								<div className="min-w-0">
									<p className="truncate font-medium">{row.label}</p>
									<p className="truncate text-muted-foreground text-xs">
										{row.hint}
									</p>
								</div>
								<bdi
									dir="ltr"
									className={cn(
										"ms-auto text-sm tabular-nums",
										difference > 0
											? "text-success"
											: difference < 0
												? "text-destructive"
												: "text-muted-foreground",
									)}
								>
									{signed.format(difference)}
								</bdi>
							</li>
						);
					})}
				</ul>
			</CardContent>
		</Card>
	);
}

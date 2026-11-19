// The sign-ups card of the home: the new members of the period with the delta, weekly bars, and the top plans.
// DashboardPage renders it at the end of the second row.
// It follows recipe 3.8 of the kit system (the kit "Subscriptions" bar spark) with the 3-cell footer of the kit tracking card.
// The footer shows the 2 largest plans and "Other plans", so the 3 cells add up to the total.
import { lazy, Suspense } from "react";
import {
	ChangeLine,
	dayCountFormat,
	fillMessage,
	planOf,
} from "~/features/gym";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { type DashboardSummary, SIGN_UP_WEEKS } from "../lib/summary";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const SignUpsBars = lazy(() =>
	import("./sign-ups-bars").then((module) => ({ default: module.SignUpsBars })),
);

type SignUpsCardProps = {
	signUps: DashboardSummary["signUps"];
	/** The period of the page, in days. */
	days: number;
};

/** The total follows the period. The bars always show the last SIGN_UP_WEEKS weeks, and the description says so. */
export function SignUpsCard({ signUps, days }: SignUpsCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const signed = new Intl.NumberFormat(locale, { signDisplay: "exceptZero" });
	const footer = [
		...signUps.byPlan.map((slice) => ({
			key: slice.planId,
			label: planOf(slice.planId).name,
			members: slice.members,
		})),
		{
			key: "other",
			label: t("dashboard.otherPlans"),
			members:
				signUps.total -
				signUps.byPlan.reduce((sum, slice) => sum + slice.members, 0),
		},
	];
	return (
		<Card className="gap-4">
			<CardHeader>
				<CardTitle>{t("dashboard.signUpsTitle")}</CardTitle>
				<CardDescription>
					{fillMessage(t("dashboard.signUpsDescription"), {
						count: number.format(SIGN_UP_WEEKS),
					})}
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-1">
				<p className="font-numeric font-semibold text-3xl tabular-nums">
					{signed.format(signUps.total)}
				</p>
				<div className="flex flex-wrap items-center gap-x-1.5 text-muted-foreground text-sm">
					<ChangeLine change={signUps.change} goodWhen="up" />
					{signUps.change === null ? null : (
						<span>
							{fillMessage(t("dashboard.vsBefore"), {
								period: dayCountFormat(locale).format(days),
							})}
						</span>
					)}
				</div>
			</CardContent>
			{/* The bars take the free height, so the card ends level with its row. */}
			<CardContent className="flex flex-1 flex-col">
				<Suspense fallback={<Skeleton className="min-h-36 w-full flex-1" />}>
					<SignUpsBars weeks={signUps.weekly} />
				</Suspense>
			</CardContent>
			<dl className="grid grid-cols-3 divide-x border-t rtl:divide-x-reverse">
				{footer.map((cell) => (
					<div key={cell.key} className="grid min-w-0 gap-1 px-6 pt-4">
						{/* A long plan name wraps to 2 lines. The fixed height keeps the 3 numbers on one level. */}
						<dt className="line-clamp-2 min-h-8 text-balance text-muted-foreground text-xs leading-4">
							{cell.label}
						</dt>
						<dd className="font-numeric font-semibold text-lg tabular-nums">
							{number.format(cell.members)}
						</dd>
					</div>
				))}
			</dl>
		</Card>
	);
}

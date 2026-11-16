// The funnel card of the Reports page: how many new people reach each step toward a working team.
// ReportsPage renders it. The card holds its period and reads the steps itself, because the period changes after a click.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
	EventName,
	fillMessage,
	PanelError,
	PeriodTabs,
	ShareBar,
	shareFormat,
	shareOf,
} from "~/features/tracking";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	DEFAULT_FUNNEL_DAYS,
	FUNNEL_PERIODS,
	type FunnelDays,
	funnelQueryOptions,
} from "../api/reports.queries";

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5"];

/** Each step: its number, its name and event, the people, the share of the sign-ups, and the share of the step before. */
export function FunnelCard() {
	const { t, locale } = useT();
	const [days, setDays] = useState<FunnelDays>(DEFAULT_FUNNEL_DAYS);
	const funnel = useQuery({
		...funnelQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const number = new Intl.NumberFormat(locale);
	const share = shareFormat(locale);
	const steps = funnel.data ?? [];
	const signUps = steps[0]?.people ?? 0;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("reports.funnel.title")}</CardTitle>
				<CardDescription>{t("reports.funnel.description")}</CardDescription>
				{/* The card is a narrow rail on a desktop, so the control sits under the description, not beside the title. */}
				<div className="mt-2 justify-self-start">
					<PeriodTabs
						days={days}
						choices={FUNNEL_PERIODS}
						onDaysChange={(next) =>
							setDays(
								FUNNEL_PERIODS.find((option) => option === next) ??
									DEFAULT_FUNNEL_DAYS,
							)
						}
					/>
				</div>
			</CardHeader>
			<CardContent>
				{funnel.isError ? (
					<PanelError
						message={t("reports.funnel.error")}
						onRetry={() => funnel.refetch()}
						className="h-80"
					/>
				) : funnel.data === undefined ? (
					<div className="grid gap-5">
						{SKELETON_ROWS.map((key) => (
							<Skeleton key={key} className="h-12 w-full" />
						))}
					</div>
				) : (
					<ol className="grid gap-5">
						{steps.map((step, index) => {
							const before = steps[index - 1]?.people ?? 0;
							return (
								<li key={step.eventKey} className="grid gap-2">
									<div className="flex items-start gap-3">
										<span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent font-medium text-accent-foreground text-xs tabular-nums">
											{number.format(index + 1)}
										</span>
										<div className="grid min-w-0 flex-1 justify-items-start gap-1">
											<span className="font-medium text-sm">
												{t(`reports.funnel.steps.${step.eventKey}`)}
											</span>
											<EventName eventKey={step.eventKey} />
										</div>
										<div className="grid justify-items-end gap-1">
											<span className="font-numeric font-semibold text-lg tabular-nums leading-none">
												{number.format(step.people)}
											</span>
											<span className="text-muted-foreground text-xs tabular-nums">
												{share.format(shareOf(step.people, signUps))}
											</span>
										</div>
									</div>
									<ShareBar
										share={shareOf(step.people, signUps)}
										className="h-2"
									/>
									{/* Step 2 compares with step 1, the sign-ups, so its line repeats the share above. */}
									{index < 2 ? null : (
										<p className="text-muted-foreground text-xs">
											{fillMessage(t("reports.funnel.fromStepBefore"), {
												share: share.format(shareOf(step.people, before)),
											})}
										</p>
									)}
								</li>
							);
						})}
					</ol>
				)}
			</CardContent>
		</Card>
	);
}

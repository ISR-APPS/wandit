// The grading card of the home: the share of graded work in the running courses, two meters of the 5-day promise,
// and the "to grade" and "graded" counts in boxed rows. DashboardPage renders it in the middle band.
import {
	CheckCircleIcon,
	HourglassMediumIcon,
	type Icon,
} from "@phosphor-icons/react";
import {
	dayCountFormat,
	fillMessage,
	GRADING_TARGET_DAYS,
	shareFormat,
} from "~/features/school";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import type { DashboardSummary } from "../api/dashboard.queries";

type GradingCardProps = {
	/** The work counts of the running courses, from the summary query. */
	grading: DashboardSummary["grading"];
};

/** Each meter has its share at the end and its name under it, so the color is never the only mark. */
export function GradingCard({ grading }: GradingCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const share = shareFormat(locale);
	const target = dayCountFormat(locale).format(GRADING_TARGET_DAYS);
	// A share of an empty count shows a dash, never "0%".
	const shareOf = (part: number, whole: number) =>
		whole === 0 ? "–" : share.format(part / whole);
	const meters = [
		{
			key: "onTime",
			label: fillMessage(t("dashboard.gradedWithin"), { target }),
			value: grading.gradedOnTime,
			max: grading.graded,
			tint: "[&>[data-slot=progress-indicator]]:bg-success",
		},
		{
			key: "overdue",
			label: fillMessage(t("dashboard.waitingOver"), { target }),
			value: grading.overdue,
			max: grading.toGrade,
			tint: "[&>[data-slot=progress-indicator]]:bg-warning",
		},
	];
	const counts: {
		key: string;
		icon: Icon;
		value: number;
		label: string;
		variant: "warning" | "success";
	}[] = [
		{
			key: "toGrade",
			icon: HourglassMediumIcon,
			value: grading.toGrade,
			label: t("assignments.statuses.to_grade"),
			variant: "warning",
		},
		{
			key: "graded",
			icon: CheckCircleIcon,
			value: grading.graded,
			label: t("assignments.statuses.graded"),
			variant: "success",
		},
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("dashboard.gradingTitle")}</CardTitle>
				<CardDescription>{t("dashboard.gradingDescription")}</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-6">
				<div className="grid gap-3 text-center">
					<p>{t("dashboard.workGraded")}</p>
					<p className="font-numeric @4xl/main:text-4xl text-3xl tabular-nums">
						{shareOf(grading.graded, grading.submitted)}
					</p>
				</div>
				<div className="grid grid-cols-2 gap-6">
					{meters.map((meter) => (
						<div key={meter.key} className="grid gap-1.5">
							<div className="flex items-center gap-2">
								<Progress
									value={meter.value}
									max={meter.max}
									aria-label={meter.label}
									className={meter.tint}
								/>
								<span className="text-muted-foreground text-sm tabular-nums">
									{shareOf(meter.value, meter.max)}
								</span>
							</div>
							<span className="text-muted-foreground text-xs">
								{meter.label}
							</span>
						</div>
					))}
				</div>
				<div className="grid gap-4">
					{counts.map((count) => (
						<div
							key={count.key}
							className="flex items-center justify-between gap-3 rounded-md border p-4"
						>
							<div className="flex items-center gap-4">
								<span
									aria-hidden="true"
									className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground"
								>
									<count.icon className="size-4" />
								</span>
								<span className="font-numeric font-semibold text-2xl tabular-nums">
									{number.format(count.value)}
								</span>
							</div>
							<Badge variant={count.variant} className="px-3 py-1 text-sm">
								{count.label}
							</Badge>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

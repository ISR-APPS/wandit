// The pass rate card of the home: the share of graded work at or above the pass mark in the last 30 days,
// its change against the 30 days before, and the graded and passed counts.
// DashboardPage renders it first in the middle band. It reads only its props.
import {
	ArrowDownIcon,
	ArrowUpIcon,
	CheckCircleIcon,
	ClipboardTextIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	dayCountFormat,
	FLAT_CHANGE,
	fillMessage,
	PASS_POINTS,
	shareFormat,
} from "~/features/school";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import {
	type DashboardSummary,
	SUMMARY_WINDOW_DAYS,
} from "../api/dashboard.queries";

type PassRateCardProps = {
	/** The pass figures of the summary query. */
	passRate: DashboardSummary["passRate"];
};

/** The big share, a bar, the earlier share, then the two counts. "View assignments" opens the work list. */
export function PassRateCard({ passRate }: PassRateCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const share = shareFormat(locale);
	const delta = new Intl.NumberFormat(locale, {
		style: "percent",
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
		signDisplay: "exceptZero",
	});
	const change =
		passRate.current === null || passRate.previous === null
			? null
			: passRate.current - passRate.previous;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("dashboard.passRate")}</CardTitle>
				<CardDescription>
					{fillMessage(t("dashboard.gradedIn"), {
						period: dayCountFormat(locale).format(SUMMARY_WINDOW_DAYS),
					})}
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-6">
				<div className="flex items-center justify-between gap-3">
					<span className="font-numeric @4xl/main:text-4xl text-3xl tabular-nums">
						{passRate.current === null ? "–" : share.format(passRate.current)}
					</span>
					{/* No earlier work, or a change that rounds to 0: a word, never "0%". */}
					{change === null || Math.abs(change) < FLAT_CHANGE ? (
						<span className="text-muted-foreground text-sm">
							{t(
								change === null
									? "dashboard.noEarlierData"
									: "dashboard.noChange",
							)}
						</span>
					) : (
						<span
							className={cn(
								"flex items-center gap-1 font-medium text-sm",
								change > 0 ? "text-success" : "text-destructive",
							)}
						>
							{change > 0 ? (
								<ArrowUpIcon className="size-4" />
							) : (
								<ArrowDownIcon className="size-4" />
							)}
							<bdi dir="ltr">{delta.format(change)}</bdi>
						</span>
					)}
				</div>
				<div className="grid gap-2">
					<Progress
						value={(passRate.current ?? 0) * 100}
						aria-label={t("dashboard.passRate")}
					/>
					<div className="flex justify-between gap-2 text-muted-foreground text-sm">
						<span>
							{fillMessage(t("dashboard.previousShare"), {
								share:
									passRate.previous === null
										? "–"
										: share.format(passRate.previous),
							})}
						</span>
						<span>
							{fillMessage(t("dashboard.passMark"), {
								points: number.format(PASS_POINTS),
							})}
						</span>
					</div>
				</div>
				<div className="flex items-center justify-between gap-3">
					<span className="flex items-center gap-2 font-medium">
						<ClipboardTextIcon
							aria-hidden="true"
							className="size-5 text-info"
						/>
						{t("dashboard.gradedWork")}
					</span>
					<span className="font-semibold tabular-nums">
						{number.format(passRate.graded)}
					</span>
				</div>
				<div className="grid gap-2">
					<div className="flex items-center justify-between gap-3">
						<span className="flex items-center gap-2 font-medium">
							<CheckCircleIcon
								aria-hidden="true"
								className="size-5 text-success"
							/>
							{t("dashboard.passed")}
						</span>
						<span className="font-semibold tabular-nums">
							{number.format(passRate.passed)}
						</span>
					</div>
					<Progress
						value={passRate.passed}
						max={passRate.graded}
						aria-label={t("dashboard.passed")}
					/>
					<p className="text-muted-foreground text-sm">
						{fillMessage(t("dashboard.ofGraded"), {
							share:
								passRate.graded === 0
									? "–"
									: share.format(passRate.passed / passRate.graded),
						})}
					</p>
				</div>
				<Button variant="outline" className="w-full" asChild>
					<Link to="/app/assignments">{t("dashboard.viewAssignments")}</Link>
				</Button>
			</CardContent>
		</Card>
	);
}

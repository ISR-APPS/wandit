// The behind-the-pace card of the targets page: the 3 reps with the largest shortfall, as boxed items
// with a severity badge and the missing amount. TargetsPage renders it in the middle grid.
// Each item links to the rep page. "All reps" opens the reps list. For a closed quarter it lists missed targets.
import { WarningCircleIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { fillMessage, moneyFormat, percentFormat } from "~/features/sales";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { RepShortfall } from "../api/targets.queries";

// 3 items keep the card as tall as the donut card beside it.
const SHOWN_REPS = 3;

/** How far a rep is from the pace. The words are `targets.severity.<level>`. */
type Severity = "high" | "medium" | "low";

// The badge look of each level: red, amber, and green tints. The badge text also names the level.
const SEVERITY_BADGE = {
	high: "border-destructive/25 bg-destructive/12 text-destructive",
	medium: "border-warning/25 bg-warning/12 text-warning",
	low: "border-success/25 bg-success/12 text-success",
} satisfies Record<Severity, string>;

// A rep under 75 % of the expected amount is far behind; under 85 % is behind; the rest is close to the pace.
function severityOf(attainment: number, pace: number): Severity {
	const ratio = pace > 0 ? attainment / pace : 1;
	return ratio < 0.75 ? "high" : ratio < 0.85 ? "medium" : "low";
}

type BehindPaceCardProps = {
	/** The reps that are behind, the largest shortfall first. */
	shortfalls: RepShortfall[];
	/** The share of the quarter that has passed, 0 to 1. 1 for a closed quarter. */
	pace: number;
	/** True for a quarter that ended before today: the items are missed targets. */
	isClosed: boolean;
};

/** No rep behind shows one sentence. */
export function BehindPaceCard({
	shortfalls,
	pace,
	isClosed,
}: BehindPaceCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const percent = percentFormat(locale);

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					{t(isClosed ? "targets.missedTitle" : "targets.shortfallTitle")}
				</CardTitle>
				<CardDescription>
					{t(
						isClosed
							? "targets.missedDescription"
							: "targets.shortfallDescription",
					)}
				</CardDescription>
				<CardAction>
					<Button variant="outline" asChild>
						<Link to="/app/reps">{t("targets.allReps")}</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-3">
				{shortfalls.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("targets.noShortfall")}
					</p>
				) : (
					shortfalls.slice(0, SHOWN_REPS).map((rep) => {
						const severity = severityOf(rep.attainment, pace);
						return (
							<Link
								key={rep.id}
								to="/app/reps/$repId"
								params={{ repId: rep.id }}
								className="flex items-start gap-3 rounded-md border p-3 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
							>
								<WarningCircleIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
								<span className="grid min-w-0 gap-1">
									<span className="font-medium text-sm leading-none">
										{rep.name}
									</span>
									<span className="text-muted-foreground text-xs">
										{fillMessage(t("targets.repLine"), {
											territory: rep.territoryName,
											value: percent.format(rep.attainment),
										})}
									</span>
									<span className="flex flex-wrap items-center gap-2 pt-1">
										<Badge
											variant="outline"
											className={SEVERITY_BADGE[severity]}
										>
											{t(`targets.severity.${severity}`)}
										</Badge>
										<span className="text-muted-foreground text-xs tabular-nums">
											{fillMessage(t("targets.short"), {
												amount: money.format(rep.shortfall),
											})}
										</span>
									</span>
								</span>
							</Link>
						);
					})
				)}
			</CardContent>
		</Card>
	);
}

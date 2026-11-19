// The top reps card of the home: the 6 best reps of the quarter as boxed rows with their quota progress.
// OverviewPage renders it in the second band, beside the order status card. Each row links to the rep page.
// The rows come from the reps board (repsQueryOptions), so the list page shows the same attainments.
import { Link } from "@tanstack/react-router";
import type { RepSummary } from "~/features/reps";
import {
	fillMessage,
	initialsOf,
	PACE_TEXT,
	percentFormat,
} from "~/features/sales";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { CaretRightIcon } from "~/shared/ui/icons";
import { Progress } from "~/shared/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/shared/ui/tooltip";

type TopRepsCardProps = {
	/** The best reps of the quarter, the best attainment first. The card shows them all. */
	reps: RepSummary[];
	/** "Q4 2026". */
	quarterLabel: string;
};

/** The attainment text takes the color of the pace status. The pace word under it keeps the meaning without color. */
export function TopRepsCard({ reps, quarterLabel }: TopRepsCardProps) {
	const { t, locale } = useT();
	const percent = percentFormat(locale);

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("overview.topReps.title")}</CardTitle>
				<CardDescription>
					{fillMessage(t("overview.topReps.description"), {
						quarter: quarterLabel,
					})}
				</CardDescription>
				<CardAction>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant="outline" size="icon" asChild>
								<Link to="/app/reps" aria-label={t("overview.topReps.viewAll")}>
									<CaretRightIcon className="rtl:rotate-180" />
								</Link>
							</Button>
						</TooltipTrigger>
						<TooltipContent>{t("overview.topReps.viewAll")}</TooltipContent>
					</Tooltip>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-4">
				{reps.map((rep) => (
					<Link
						key={rep.id}
						to="/app/reps/$repId"
						params={{ repId: rep.id }}
						className="flex items-center gap-4 rounded-md border px-4 py-3 outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
					>
						<span
							aria-hidden="true"
							className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted font-medium text-sm"
						>
							{initialsOf(rep.name)}
						</span>
						<span className="grid min-w-0 flex-1 gap-1.5">
							<span className="truncate font-medium">{rep.name}</span>
							<Progress
								value={rep.attainment * 100}
								className="h-1.5"
								aria-label={fillMessage(t("overview.topReps.ofQuota"), {
									value: percent.format(rep.attainment),
								})}
							/>
						</span>
						<span
							className={cn(
								"shrink-0 text-end text-sm tabular-nums",
								PACE_TEXT[rep.status],
							)}
						>
							{fillMessage(t("overview.topReps.ofQuota"), {
								value: percent.format(rep.attainment),
							})}
							<span className="block text-muted-foreground text-xs">
								{t(`pace.${rep.status}`)}
							</span>
						</span>
					</Link>
				))}
			</CardContent>
		</Card>
	);
}

// The territories card of the targets page: a stacked bar of the bookings by territory,
// then one row per territory with its reps, its amount, a small bar of its attainment, and the percent.
// TargetsPage renders it last in the middle grid.
import {
	fillMessage,
	moneyFormat,
	percentFormat,
	pluralOf,
} from "~/features/sales";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/shared/ui/tooltip";
import type { TerritoryTarget } from "../api/targets.queries";

// One chart series per territory, in the order of the rows. The team has 5 territories.
const TERRITORY_DOTS = [
	"bg-chart-1",
	"bg-chart-2",
	"bg-chart-3",
	"bg-chart-4",
	"bg-chart-5",
];

type TerritoryPipelineCardProps = {
	/** The best attainment first. */
	territories: TerritoryTarget[];
};

/** Each segment of the stacked bar has a tooltip, and each territory has a named row, so color is never alone. */
export function TerritoryPipelineCard({
	territories,
}: TerritoryPipelineCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const percent = percentFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const totalBooked = territories.reduce((sum, row) => sum + row.booked, 0);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("targets.territoriesTitle")}</CardTitle>
				<CardDescription>{t("targets.territoriesDescription")}</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="mb-6 flex h-3 w-full overflow-hidden rounded-full bg-muted">
					{totalBooked > 0
						? territories.map((territory, index) => (
								<Tooltip key={territory.id}>
									<TooltipTrigger asChild>
										<div
											className={`h-full ${TERRITORY_DOTS[index % TERRITORY_DOTS.length]}`}
											style={{
												width: `${(territory.booked / totalBooked) * 100}%`,
											}}
										/>
									</TooltipTrigger>
									<TooltipContent>
										{`${territory.name} · ${money.format(territory.booked)}`}
									</TooltipContent>
								</Tooltip>
							))
						: null}
				</div>
				<ul className="grid gap-4">
					{territories.map((territory, index) => (
						<li key={territory.id} className="flex items-center gap-4">
							<span
								aria-hidden="true"
								className={`size-3 shrink-0 rounded-full ${TERRITORY_DOTS[index % TERRITORY_DOTS.length]}`}
							/>
							<span className="grid min-w-0 flex-1 gap-0.5">
								<span className="truncate font-medium text-sm">
									{territory.name}
								</span>
								<span className="truncate text-muted-foreground text-xs tabular-nums">
									{`${fillMessage(
										t(
											`targets.territoryReps.${pluralOf(locale, territory.reps.length)}`,
										),
										{ count: number.format(territory.reps.length) },
									)} · ${money.format(territory.booked)}`}
								</span>
							</span>
							<Progress
								value={territory.attainment * 100}
								className="h-1.5 w-16 shrink-0"
								aria-label={territory.name}
							/>
							<span className="w-10 shrink-0 text-end text-muted-foreground text-xs tabular-nums">
								{percent.format(territory.attainment)}
							</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}

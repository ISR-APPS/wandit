// The territories of the targets page: one row per territory with its attainment bar, its amounts,
// and its reps as small links to their pages. TargetsPage renders it in the 2/3 column.
import { Link } from "@tanstack/react-router";
import {
	AttainmentBar,
	fillMessage,
	moneyFormat,
	PaceBadge,
	percentFormat,
	pluralOf,
	RepAvatar,
} from "~/features/sales";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { TerritoryTarget } from "../api/targets.queries";

type TerritoryTargetsCardProps = {
	/** The best attainment first. */
	territories: TerritoryTarget[];
	/** The pace of the quarter, 0 to 1. 1 for a closed quarter. */
	pace: number;
};

/** A list, not a table: each territory needs two lines and its reps. */
export function TerritoryTargetsCard({
	territories,
	pace,
}: TerritoryTargetsCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale, { compact: true });
	const percent = percentFormat(locale);
	const number = new Intl.NumberFormat(locale);
	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("targets.territoriesTitle")}</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col gap-5">
				{/* The card stretches to the height of the rail. Equal rows share that height, so no gap stays at the end. */}
				<ul className="grid flex-1 @4xl/main:auto-rows-fr divide-y divide-border">
					{territories.map((territory) => (
						<li
							key={territory.id}
							className="grid content-center gap-3 py-5 first:pt-0 last:pb-0"
						>
							<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
								<div className="flex items-center gap-2">
									<span className="font-semibold">{territory.name}</span>
									<span className="text-muted-foreground text-xs">
										{fillMessage(
											t(
												`targets.territoryReps.${pluralOf(locale, territory.reps.length)}`,
											),
											{
												count: number.format(territory.reps.length),
											},
										)}
									</span>
								</div>
								<div className="flex items-center gap-3 text-sm">
									<span className="text-muted-foreground tabular-nums">
										{`${money.format(territory.booked)} / ${money.format(territory.target)}`}
									</span>
									<span className="w-11 text-end font-semibold tabular-nums">
										{percent.format(territory.attainment)}
									</span>
									<PaceBadge status={territory.status} />
								</div>
							</div>
							<AttainmentBar
								attainment={territory.attainment}
								pace={pace}
								status={territory.status}
								label={fillMessage(t("reps.ofTarget"), {
									value: percent.format(territory.attainment),
								})}
							/>
							{/* On a phone: one rep per row, with a 44 px touch target. */}
							<div className="@2xl/main:flex grid @2xl/main:flex-wrap @2xl/main:gap-x-4 @2xl/main:gap-y-2">
								{territory.reps.map((rep) => (
									<Link
										key={rep.id}
										to="/app/reps/$repId"
										params={{ repId: rep.id }}
										className="inline-flex @2xl/main:min-h-8 min-h-11 items-center gap-2 text-sm hover:underline"
									>
										<RepAvatar name={rep.name} className="size-6" />
										<bdi>{rep.name}</bdi>
										<span className="text-muted-foreground tabular-nums">
											{percent.format(rep.attainment)}
										</span>
									</Link>
								))}
							</div>
						</li>
					))}
				</ul>
				{/* A closed quarter has no pace mark, so it needs no legend. */}
				{pace < 1 ? (
					<p className="mt-auto flex items-center gap-2 border-t pt-4 text-muted-foreground text-xs">
						<span className="h-3 w-0.5 rounded-full bg-muted-foreground" />
						{fillMessage(t("reps.paceNote"), { value: percent.format(pace) })}
					</p>
				) : null}
			</CardContent>
		</Card>
	);
}

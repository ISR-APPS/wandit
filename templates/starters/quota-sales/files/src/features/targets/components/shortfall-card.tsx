// Every rep with the "behind" pace status, with the amount missing against the pace of today.
// TargetsPage renders it in the rail under the monthly plan. Each name opens the page of the rep.
import { Link } from "@tanstack/react-router";
import { moneyFormat, percentFormat, RepAvatar } from "~/features/sales";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { RepShortfall } from "../api/targets.queries";

type ShortfallCardProps = {
	/** The largest shortfall first. */
	shortfalls: RepShortfall[];
	/** True for a past quarter: the shortfall is then the miss against the full target. */
	isClosed: boolean;
};

/** A list of the behind reps, the same reps as the "Behind" tab of the reps list. No behind rep shows one sentence. */
export function ShortfallCard({ shortfalls, isClosed }: ShortfallCardProps) {
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
			</CardHeader>
			<CardContent>
				{shortfalls.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("targets.noShortfall")}
					</p>
				) : (
					<ul className="grid divide-y divide-border">
						{shortfalls.map((rep) => (
							<li
								key={rep.id}
								className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
							>
								<RepAvatar name={rep.name} />
								<div className="grid min-w-0 flex-1 justify-items-start">
									<Link
										to="/app/reps/$repId"
										params={{ repId: rep.id }}
										className="truncate font-medium text-sm hover:underline"
									>
										<bdi>{rep.name}</bdi>
									</Link>
									<span className="text-muted-foreground text-xs">
										{`${rep.territoryName} · ${percent.format(rep.attainment)}`}
									</span>
								</div>
								{/* dir="ltr" keeps the minus sign in front in an Arabic page. */}
								<bdi
									dir="ltr"
									className="font-medium text-sm text-warning tabular-nums"
								>
									{`−${money.format(rep.shortfall)}`}
								</bdi>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}

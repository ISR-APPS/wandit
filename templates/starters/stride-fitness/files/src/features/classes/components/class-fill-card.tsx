// The rail of the classes page: the fill of each class type over the last 30 days, the fullest first.
// ClassesPage renders it with the rows of classFillQueryOptions.
// Each line shows the share of spots booked, a bar, the coach, and how many booked members came.

import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import type { ClassFill } from "../lib/class-fill";

type ClassFillCardProps = {
	/** One row per class type, the fullest first. */
	rows: ClassFill[];
	/** The grid span of the page. */
	className?: string;
};

/** A ruled list. A class type with no ended session in the period has no row. */
export function ClassFillCard({ rows, className }: ClassFillCardProps) {
	const { t, locale } = useT();
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const number = new Intl.NumberFormat(locale);

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle>{t("classes.fillTitle")}</CardTitle>
				<CardDescription>{t("classes.fillDescription")}</CardDescription>
			</CardHeader>
			<CardContent>
				{rows.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("classes.fillEmpty")}
					</p>
				) : (
					<ul className="grid divide-y">
						{rows.map((row) => (
							<li
								key={row.classTypeId}
								className="grid gap-2 py-3 first:pt-0 last:pb-0"
							>
								<div className="flex items-baseline justify-between gap-3">
									<span className="truncate font-medium text-sm">
										{row.className}
									</span>
									<span className="font-numeric text-sm tabular-nums">
										{percent.format(row.booked / row.capacity)}
									</span>
								</div>
								<Progress
									value={row.booked}
									max={row.capacity}
									aria-label={row.className}
								/>
								<p className="text-muted-foreground text-xs">
									{`${row.coachName} · ${number.format(row.sessions)} ${t("classes.sessions")} · `}
									<span className="tabular-nums">
										{percent.format(
											row.booked === 0 ? 0 : row.attended / row.booked,
										)}
									</span>
									{` ${t("classes.showedUp")}`}
								</p>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}

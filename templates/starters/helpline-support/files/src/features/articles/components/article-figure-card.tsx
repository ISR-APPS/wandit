// One figure card of the articles page: the label and a delta badge in one row, the value under them.
// ArticlesPage renders four of them above the table. It follows the KPI cards of the kit product list.
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardDescription, CardHeader } from "~/shared/ui/card";

// One decimal shows 0.05 % and more. A smaller change reads as flat, so it gets no color.
const FLAT_CHANGE = 0.0005;

type ArticleFigureCardProps = {
	label: string;
	/** The formatted value, for example "14,206" or "81%". */
	value: string;
	/** Ratio against the 30 days before: 0.12 is +12 %. null shows "No earlier data". */
	change: number | null;
};

/** Every figure of this page is good news when it goes up, so a rise is green and a fall is red. */
export function ArticleFigureCard({
	label,
	value,
	change,
}: ArticleFigureCardProps) {
	const { t, locale } = useT();
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});
	const isFlat = change !== null && Math.abs(change) < FLAT_CHANGE;
	return (
		<Card>
			<CardHeader className="gap-3">
				<div className="flex items-center justify-between gap-2">
					<CardDescription>{label}</CardDescription>
					{change === null ? (
						<Badge variant="outline">{t("kpi.noComparison")}</Badge>
					) : (
						<Badge
							variant={isFlat ? "outline" : change > 0 ? "success" : "outline"}
							className={
								!isFlat && change < 0
									? "border-destructive/25 bg-destructive/12 text-destructive"
									: undefined
							}
						>
							{/* dir="ltr" keeps "+12%" in this order in an Arabic page. */}
							<bdi dir="ltr" className="tabular-nums">
								{percent.format(change)}
							</bdi>
							<span className="sr-only">{t("kpi.vsPrevious")}</span>
						</Badge>
					)}
				</div>
				<p className="font-numeric font-semibold @4xl/main:text-3xl text-2xl tabular-nums">
					{value}
				</p>
			</CardHeader>
		</Card>
	);
}

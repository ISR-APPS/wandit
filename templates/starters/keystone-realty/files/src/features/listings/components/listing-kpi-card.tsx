// One figure card of the listings page: the label, the value,
// and the delta badge at the end of the head. ListingsPage renders four of them above the table.
import { ChangeBadge } from "~/features/agency";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardAction,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";

type ListingKpiCardProps = {
	label: string;
	/** The raw value, or null when no home counts. null shows a dash. */
	value: number | null;
	/** The formatter of the value: a plain number or a compact price. */
	format: Intl.NumberFormat;
	/** Ratio against 30 days earlier: 0.12 is +12 %. null shows "No earlier data". */
	change: number | null;
	/** "down" for a figure where a fall is good news, for example the days on the market. */
	goodWhen: "up" | "down";
};

/** The card holds only a CardHeader, so the four figure cards stay low above the table. */
export function ListingKpiCard({
	label,
	value,
	format,
	change,
	goodWhen,
}: ListingKpiCardProps) {
	const { t } = useT();
	return (
		<Card>
			<CardHeader>
				<CardDescription>{label}</CardDescription>
				<CardTitle className="font-numeric @4xl/main:text-3xl text-2xl tabular-nums">
					{value === null ? "–" : format.format(value)}
				</CardTitle>
				<CardAction>
					<ChangeBadge
						change={change}
						goodWhen={goodWhen}
						comparison={t("listings.figures.vs30Days")}
					/>
				</CardAction>
			</CardHeader>
		</Card>
	);
}

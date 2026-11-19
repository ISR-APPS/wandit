// The first card of the home: the item with the most units picked in the period, on a muted ground.
// OverviewPage renders it beside the three figure cards. It takes the place of the kit "best seller" card.
// The button opens the item page. A period with no pick shows one sentence.
import { Link } from "@tanstack/react-router";
import { Delta, fillMessage, formatQuantity } from "~/features/stock";
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
import type { TopItem } from "../api/overview.queries";

type TopItemCardProps = {
	/** The most picked item of the period. null when nothing was picked. */
	item: TopItem | null;
	/** The period in words, for example "30 days". */
	period: string;
	/** The grid span classes of the page. */
	className?: string;
};

/** The value is the picked quantity with its unit word. */
export function TopItemCard({ item, period, className }: TopItemCardProps) {
	const { t, locale } = useT();
	return (
		<Card className={cn("bg-muted", className)}>
			<CardHeader>
				<CardTitle
					className="text-balance @4xl/main:text-2xl text-xl"
					dir="auto"
				>
					{item ? item.name : t("overview.topItemEmptyTitle")}
				</CardTitle>
				<CardDescription>
					{fillMessage(t("overview.topItemDescription"), { period })}
				</CardDescription>
			</CardHeader>
			<CardContent>
				{item ? (
					<div className="flex flex-wrap items-end justify-between gap-4">
						<div className="grid gap-1">
							<p className="font-numeric font-semibold text-3xl tabular-nums">
								{formatQuantity(item.units, item.unit, t, locale)}
							</p>
							<p className="flex flex-wrap items-center gap-x-1 text-muted-foreground text-xs">
								<Delta change={item.change} goodWhen="up" className="text-xs" />
								{item.change === null ? null : (
									<span>{t("overview.vsPeriodBefore")}</span>
								)}
							</p>
						</div>
						<Button asChild variant="outline" className="bg-card">
							<Link to="/app/items/$itemId" params={{ itemId: item.id }}>
								{t("overview.viewItem")}
							</Link>
						</Button>
					</div>
				) : (
					<p className="text-muted-foreground text-sm">
						{t("overview.topItemEmpty")}
					</p>
				)}
			</CardContent>
		</Card>
	);
}

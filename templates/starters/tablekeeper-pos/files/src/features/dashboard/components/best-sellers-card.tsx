// The best sellers card of the home: the 6 dishes with the most portions today, in boxed rows.
// DashboardPage renders it at the start of the second band, as the kit "best selling" list.
// Each row shows the icon tile of the dish category, because the app has no food photos.
import { Link } from "@tanstack/react-router";
import { fillMessage, MENU_CATEGORY_ICON } from "~/features/restaurant";
import { useT } from "~/shared/i18n";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "~/shared/ui/tooltip";
import type { TopDish } from "../lib/dashboard";

type BestSellersCardProps = {
	/** The top dishes of today, most portions first. Empty before the first check. */
	dishes: TopDish[];
};

/** The header button opens the menu page, where every dish shows its sales of today. */
export function BestSellersCard({ dishes }: BestSellersCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("dashboard.bestSellers")}</CardTitle>
				<CardDescription>
					{t("dashboard.bestSellersDescription")}
				</CardDescription>
				<CardAction>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button asChild variant="outline" size="icon">
								<Link to="/app/menu" aria-label={t("dashboard.openMenu")}>
									<CaretRightIcon className="rtl:rotate-180" />
								</Link>
							</Button>
						</TooltipTrigger>
						<TooltipContent>{t("dashboard.openMenu")}</TooltipContent>
					</Tooltip>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-4">
				{dishes.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("dashboard.noSales")}
					</p>
				) : (
					dishes.map((dish) => {
						const CategoryIcon = MENU_CATEGORY_ICON[dish.category];
						return (
							<div
								key={dish.id}
								className="flex items-center justify-between gap-4 rounded-md border px-4 py-3"
							>
								<div className="flex min-w-0 items-center gap-4">
									<span
										aria-hidden="true"
										className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
									>
										<CategoryIcon className="size-5" />
									</span>
									<span className="truncate font-medium" dir="auto">
										{dish.name}
									</span>
								</div>
								<span className="shrink-0 text-sm text-success tabular-nums">
									{fillMessage(t("dashboard.soldCount"), {
										count: number.format(dish.sold),
									})}
								</span>
							</div>
						);
					})
				)}
			</CardContent>
		</Card>
	);
}

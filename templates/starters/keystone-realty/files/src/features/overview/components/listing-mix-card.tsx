// The listing overview card of the home: the count of homes, a strip of 30 bars split between
// the homes on the market and the homes sold, and one row per part with its count and share.
// OverviewPage renders it at the end of the third band. The dots menu links to the listings.
import { DotsThreeIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/shared/ui/dropdown-menu";
import type { ListingMix } from "../lib/series";

// The strip always has 30 bars, so its width does not change. Each bar stands for about 1/30 of the homes.
const BAR_COUNT = 30;

type ListingMixCardProps = {
	mix: ListingMix;
};

/** The strip is decorative: the two rows under it give the counts and the shares in words. */
export function ListingMixCard({ mix }: ListingMixCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const total = mix.onMarket + mix.sold;
	const onMarketShare = total === 0 ? 0 : mix.onMarket / total;
	const onMarketBars = Math.round(onMarketShare * BAR_COUNT);
	const rows = [
		{
			id: "onMarket",
			label: t("overview.mix.onMarket"),
			count: mix.onMarket,
			share: onMarketShare,
			dot: "bg-chart-1",
		},
		{
			id: "sold",
			label: t("overview.mix.sold"),
			count: mix.sold,
			share: total === 0 ? 0 : 1 - onMarketShare,
			dot: "bg-chart-2",
		},
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("overview.mix.title")}</CardTitle>
				<CardAction>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="size-8"
								aria-label={t("overview.mix.menu")}
							>
								<DotsThreeIcon className="size-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem asChild>
								<Link to="/app/listings">{t("overview.mix.openListings")}</Link>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-4">
				<p className="flex items-end gap-2">
					<span className="font-numeric font-semibold text-3xl tabular-nums leading-none">
						{number.format(total)}
					</span>
					<span className="text-muted-foreground text-sm leading-none">
						{t("overview.mix.total")}
					</span>
				</p>
				<div aria-hidden="true" className="grid grid-cols-30 gap-1">
					{Array.from({ length: BAR_COUNT }, (_, index) => (
						<span
							// The bars never reorder, so the index is a stable key.
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed list of decorative bars.
							key={index}
							className={cn(
								"h-10 rounded-sm",
								index < onMarketBars ? "bg-chart-1" : "bg-chart-2",
							)}
						/>
					))}
				</div>
				<ul className="grid gap-3">
					{rows.map((row) => (
						<li
							key={row.id}
							className="flex items-center gap-2 rounded-md bg-muted p-4"
						>
							<span
								aria-hidden="true"
								className={cn("size-2 rounded-full", row.dot)}
							/>
							<span className="font-medium text-sm">{row.label}</span>
							<span className="ms-auto text-muted-foreground text-sm tabular-nums">
								{number.format(row.count)}
							</span>
							<Badge variant="success" className="tabular-nums">
								{percent.format(row.share)}
							</Badge>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}

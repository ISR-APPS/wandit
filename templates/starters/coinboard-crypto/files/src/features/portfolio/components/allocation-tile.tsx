// The breakdown tile of the home: the share of each asset category in the portfolio value.
// PortfolioPage renders it with the parts of buildAllocation(). It follows the breakdown part of the chart form "compare".
// Top holdings shows the single assets, so this tile groups them by category.
import {
	type AssetCategory,
	fillMessage,
	moneyFormat,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { AllocationPart } from "../lib/portfolio-value";

// One fill per category. The same chart tokens tint the asset glyphs, so a category keeps one color in the app.
const CATEGORY_FILL = {
	layer1: "bg-chart-1",
	defi: "bg-chart-2",
	stablecoin: "bg-muted-foreground",
	infrastructure: "bg-chart-5",
	payments: "bg-chart-4",
	gaming: "bg-chart-3",
} satisfies Record<AssetCategory, string>;

type AllocationTileProps = {
	/** One part per category with a held asset, largest first. The shares add up to 1000 tenths. */
	parts: AllocationPart[];
	/** The grid span of the tile in the mosaic. */
	className?: string;
};

/** A split bar and one row per category. No part shows an empty track and one sentence. */
export function AllocationTile({ parts, className }: AllocationTileProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale, "compact");
	const number = new Intl.NumberFormat(locale);
	const total = parts.reduce((sum, part) => sum + part.value, 0);
	const share = new Intl.NumberFormat(locale, {
		style: "percent",
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	});

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle>{t("portfolio.allocationTitle")}</CardTitle>
				<CardDescription>
					{t("portfolio.allocationDescription")}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col gap-4">
				{/* The rows repeat every value, so screen readers skip the bar. */}
				<div
					aria-hidden="true"
					className="flex h-3 gap-0.5 overflow-hidden rounded-sm bg-muted"
				>
					{parts.map((part) => (
						<div
							key={part.category}
							className={cn("h-full rounded-sm", CATEGORY_FILL[part.category])}
							// 1000 tenths fill the whole bar.
							style={{ width: `${part.shareTenths / 10}%` }}
						/>
					))}
				</div>
				{parts.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("portfolio.allocationEmpty")}
					</p>
				) : (
					<ul className="grid gap-2.5 text-sm">
						{parts.map((part) => (
							<li key={part.category} className="flex items-center gap-2">
								<span
									aria-hidden="true"
									className={cn(
										"size-2.5 shrink-0 rounded-sm",
										CATEGORY_FILL[part.category],
									)}
								/>
								<span className="flex min-w-0 flex-1 items-baseline gap-2">
									<span className="truncate font-medium">
										{t(`ledger.categories.${part.category}`)}
									</span>
									{/* Between 56rem and 64rem the tile is narrow, so the count gives its room to the category name. */}
									<span className="@4xl/main:@max-5xl/main:hidden shrink-0 text-muted-foreground text-xs tabular-nums">
										{part.assetCount === 1
											? t("portfolio.allocationOneAsset")
											: fillMessage(t("portfolio.allocationAssets"), {
													count: number.format(part.assetCount),
												})}
									</span>
								</span>
								<span className="text-muted-foreground tabular-nums">
									{money.format(part.value)}
								</span>
								{/* A fixed width keeps the shares in one column. */}
								<span className="w-13 text-end font-medium tabular-nums">
									{share.format(part.shareTenths / 1000)}
								</span>
							</li>
						))}
					</ul>
				)}
				{parts.length === 0 ? null : (
					// mt-auto puts the total at the foot of the tile when the row is taller than the list.
					<p className="mt-auto flex items-center gap-2 border-t pt-3 text-sm">
						<span className="flex-1 font-medium">
							{t("portfolio.allocationTotal")}
						</span>
						<span className="font-medium tabular-nums">
							{money.format(total)}
						</span>
						<span className="w-13 text-end font-medium tabular-nums">
							{share.format(1)}
						</span>
					</p>
				)}
			</CardContent>
		</Card>
	);
}

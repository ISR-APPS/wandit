// The KPI row of the front desk home: four tinted tiles for the arrivals, the departures, the guests, and the revenue.
// FrontDeskPage renders it under the page header. It follows the "tinted" KPI variant of the kit page anatomy:
// a chart-color ground, an icon tile at the top start, a menu at the top end, the label, the value, and one line.
import {
	DotsThreeVerticalIcon,
	SignInIcon,
	SignOutIcon,
	UsersIcon,
	WalletIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { fillMessage, moneyFormat } from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/shared/ui/dropdown-menu";
import type { KitIcon } from "~/shared/ui/icons";
import { changeRatio, type FrontDeskKpis } from "../lib/home-figures";

/**
 * The ground and the icon tile of each tile. Chart series 1 to 4, so the four tiles differ and follow the theme.
 * 20 % opacity: at 10 % the warm series of this theme all look like the same beige.
 */
const TINTS = [
	{ card: "bg-chart-1/20", icon: "bg-chart-1" },
	{ card: "bg-chart-2/20", icon: "bg-chart-2" },
	{ card: "bg-chart-3/20", icon: "bg-chart-3" },
	{ card: "bg-chart-4/20", icon: "bg-chart-4" },
] as const;

type KpiTile = {
	id: string;
	label: string;
	icon: KitIcon;
	value: string;
	/** The line under the value: a split of the value, or the change with its color. */
	line: ReactNode;
	/** The list page behind the figure. The menu of the tile opens it. */
	target: "reservations" | "guests";
};

type KpiTilesProps = {
	/** The figures of today, from the summary query. */
	kpis: FrontDeskKpis;
};

/** One column on a phone, two from the @xl width of the page column, four from @4xl. */
export function KpiTiles({ kpis }: KpiTilesProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 1,
		minimumFractionDigits: 1,
		signDisplay: "exceptZero",
	});
	const revenueChange = changeRatio(
		kpis.revenue.current,
		kpis.revenue.previous,
	);

	const tiles: KpiTile[] = [
		{
			id: "arrivals",
			label: t("frontDesk.kpi.arrivals"),
			icon: SignInIcon,
			value: number.format(kpis.arrivals.total),
			line: fillMessage(t("frontDesk.kpi.arrivalsLine"), {
				done: number.format(kpis.arrivals.done),
				left: number.format(kpis.arrivals.total - kpis.arrivals.done),
			}),
			target: "reservations",
		},
		{
			id: "departures",
			label: t("frontDesk.kpi.departures"),
			icon: SignOutIcon,
			value: number.format(kpis.departures.total),
			line: fillMessage(t("frontDesk.kpi.departuresLine"), {
				done: number.format(kpis.departures.done),
				left: number.format(kpis.departures.total - kpis.departures.done),
			}),
			target: "reservations",
		},
		{
			id: "in-house",
			label: t("frontDesk.kpi.inHouse"),
			icon: UsersIcon,
			value: number.format(kpis.inHouse.guests),
			line: fillMessage(t("frontDesk.kpi.inHouseLine"), {
				rooms: number.format(kpis.inHouse.rooms),
				total: number.format(kpis.inHouse.sellableRooms),
			}),
			target: "guests",
		},
		{
			id: "revenue",
			label: t("frontDesk.kpi.revenue"),
			icon: WalletIcon,
			value: money.format(kpis.revenue.current),
			line:
				revenueChange === null ? (
					t("frontDesk.kpi.noEarlierData")
				) : (
					<>
						{/* More revenue is good news. */}
						<bdi
							dir="ltr"
							className={cn(
								"font-medium",
								revenueChange >= 0 ? "text-success" : "text-destructive",
							)}
						>
							{percent.format(revenueChange)}
						</bdi>{" "}
						{t("frontDesk.kpi.revenueLine")}
					</>
				),
			target: "reservations",
		},
	];

	return (
		<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
			{tiles.map((tile, index) => {
				const tint = TINTS[index % TINTS.length] ?? TINTS[0];
				return (
					<Card key={tile.id} className={cn("border-0 shadow-none", tint.card)}>
						<CardContent className="grid gap-1">
							<div className="mb-4 flex items-start justify-between">
								<span
									aria-hidden="true"
									className={cn(
										"flex size-10 items-center justify-center rounded-control text-primary-foreground",
										tint.icon,
									)}
								>
									<tile.icon className="size-5" />
								</span>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											variant="ghost"
											size="icon"
											className="size-8"
											aria-label={fillMessage(t("frontDesk.kpi.actions"), {
												label: tile.label,
											})}
										>
											<DotsThreeVerticalIcon />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem asChild>
											{tile.target === "guests" ? (
												<Link to="/app/guests">
													{t("frontDesk.kpi.openList")}
												</Link>
											) : (
												<Link to="/app/reservations" search={{ view: "list" }}>
													{t("frontDesk.kpi.openList")}
												</Link>
											)}
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
							<p className="text-muted-foreground text-sm">{tile.label}</p>
							<p className="font-numeric font-semibold @4xl/main:text-3xl text-2xl tabular-nums">
								{tile.value}
							</p>
							<p className="text-muted-foreground text-sm">{tile.line}</p>
						</CardContent>
					</Card>
				);
			})}
		</div>
	);
}

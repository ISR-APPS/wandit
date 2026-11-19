// The ticket type card of the home: a donut of the paid tickets per tier role, a legend beside it,
// and the average ticket price under both. OverviewPage renders it at the start of the chart row.
// It follows the kit "reservations" card: donut and side legend, then one large figure with a caption.
import { lazy, Suspense } from "react";
import { BOX_OFFICE_CURRENCY, type TierRole } from "~/features/organiser";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import type { DonutSlice } from "./ticket-type-donut";

// The chart library loads with the card, not with the first script of the app.
const TicketTypeDonut = lazy(() =>
	import("./ticket-type-donut").then((module) => ({
		default: module.TicketTypeDonut,
	})),
);

// One chart color per tier role. The legend names each role, so the color is never the only mark.
const ROLE_COLOR = {
	early: "var(--chart-1)",
	general: "var(--chart-2)",
	premium: "var(--chart-3)",
} satisfies Record<TierRole, string>;

type TicketTypeCardProps = {
	/** Paid tickets of the period per tier role, from the home summary. */
	tierMix: { role: TierRole; tickets: number }[];
	/** Revenue / tickets of the period, in euros. null with no ticket. */
	averageTicket: number | null;
};

/** The donut and the legend share one row. The average ticket is the large figure under them. */
export function TicketTypeCard({
	tierMix,
	averageTicket,
}: TicketTypeCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	// An average has cents, unlike the whole-euro amounts of the orders.
	const money = new Intl.NumberFormat(locale, {
		style: "currency",
		currency: BOX_OFFICE_CURRENCY,
		maximumFractionDigits: 2,
	});
	const slices: DonutSlice[] = tierMix.map((row) => ({
		key: row.role,
		label: t(`overview.tierRoles.${row.role}`),
		value: row.tickets,
		color: ROLE_COLOR[row.role],
	}));
	const total = tierMix.reduce((sum, row) => sum + row.tickets, 0);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("overview.ticketTypes")}</CardTitle>
			</CardHeader>
			<CardContent className="grid flex-1 content-center gap-8">
				<div className="flex items-center justify-center gap-6">
					<Suspense fallback={<Skeleton className="size-48 rounded-full" />}>
						<TicketTypeDonut slices={slices} total={total} />
					</Suspense>
					<ul className="grid gap-3">
						{slices.map((slice) => (
							<li key={slice.key} className="grid gap-0.5">
								<span className="flex items-center gap-2 text-xs">
									<span
										aria-hidden="true"
										className="size-2 shrink-0 rounded-full"
										style={{ backgroundColor: slice.color }}
									/>
									{slice.label}
								</span>
								<span className="ms-4 font-semibold text-sm tabular-nums">
									{number.format(slice.value)}
								</span>
							</li>
						))}
					</ul>
				</div>
				<div className="text-center">
					<p className="font-numeric font-semibold @4xl/main:text-3xl text-2xl tabular-nums">
						{averageTicket === null ? "–" : money.format(averageTicket)}
					</p>
					<p className="mt-1 text-muted-foreground text-sm">
						{t("overview.averageTicket")}
					</p>
				</div>
			</CardContent>
		</Card>
	);
}

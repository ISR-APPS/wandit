// The latest movements card of the item page, in the anatomy of the kit activity timeline:
// a line with an icon per event, the event title with a badge, its time, a sentence, and a link to its order.
// ItemDetailPage renders it at the top of its wide column. "View all" opens the Movements tab.
import {
	ArrowDownIcon,
	ArrowUpIcon,
	ClipboardTextIcon,
	ClockIcon,
	WarningIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	fillMessage,
	formatEventTime,
	formatQuantity,
	type MovementReason,
	type StockUnit,
} from "~/features/stock";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";
import type { ItemMovement } from "../api/items.queries";

// The icon in the dot of each event kind.
const REASON_ICON = {
	receipt: ArrowDownIcon,
	pick: ArrowUpIcon,
	adjustment: ClipboardTextIcon,
	damage: WarningIcon,
} satisfies Record<MovementReason, KitIcon>;

type ItemLatestCardProps = {
	/** The newest events to show, newest first. The page passes 3 receipts, counts, or damage reports. */
	movements: ItemMovement[];
	/** The unit of the item, for the quantities. */
	unit: StockUnit;
	/** The current time in ms, for the relative times. */
	now: number;
	/** Opens the Movements tab of the page. */
	onViewAll: () => void;
};

/** The newest event gets a "Latest" badge. A receipt links to its order. */
export function ItemLatestCard({
	movements,
	unit,
	now,
	onViewAll,
}: ItemLatestCardProps) {
	const { t, locale } = useT();
	const signed = new Intl.NumberFormat(locale, { signDisplay: "exceptZero" });

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("itemDetail.latestTitle")}</CardTitle>
				<CardAction>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="text-muted-foreground"
						onClick={onViewAll}
					>
						{t("itemDetail.viewAll")}
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{movements.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("itemDetail.noMovements")}
					</p>
				) : (
					<ol className="ms-3 grid gap-8 border-s ps-6">
						{movements.map((movement, position) => {
							const Icon = REASON_ICON[movement.reason];
							return (
								<li key={movement.id} className="relative grid gap-1.5">
									{/* The dot sits on the line: 24 px of padding plus half of its 24 px width. */}
									<span className="absolute -start-9 top-0 flex size-6 items-center justify-center rounded-full border bg-muted">
										<Icon className="size-3" />
									</span>
									<p className="flex flex-wrap items-center gap-2 font-semibold">
										{`${t(`movementReasons.${movement.reason}`)} · `}
										<bdi dir="ltr" className="tabular-nums">
											{signed.format(movement.quantity)}
										</bdi>
										{position === 0 ? (
											<Badge variant="outline">{t("itemDetail.latest")}</Badge>
										) : null}
									</p>
									<p className="flex items-center gap-1.5 text-muted-foreground text-sm">
										<ClockIcon className="size-3" />
										<time dateTime={movement.occurredAt}>
											{formatEventTime(movement.occurredAt, now, locale)}
										</time>
									</p>
									<p className="text-muted-foreground text-sm">
										{fillMessage(t("itemDetail.eventText"), {
											reference: movement.reference,
											balance: formatQuantity(
												movement.balanceAfter,
												unit,
												t,
												locale,
											),
										})}
									</p>
									{movement.purchaseOrderId ? (
										<Button
											asChild
											variant="outline"
											size="sm"
											className="mt-1 justify-self-start"
										>
											<Link
												to="/app/purchase-orders"
												search={{ po: movement.purchaseOrderId }}
											>
												<ClipboardTextIcon />
												{t("itemDetail.openOrder")}
											</Link>
										</Button>
									) : null}
								</li>
							);
						})}
					</ol>
				)}
			</CardContent>
		</Card>
	);
}

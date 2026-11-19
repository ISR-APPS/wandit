// The activity card of the order page: a vertical line of the events of the order, the newest first.
// OrderDetailPage renders it in the main column (the last 3 events) and in the Activity tab (every step).
// The steps come from timelineOf of ~/features/shop. The shipped event can copy the tracking number.
import {
	ArrowCounterClockwiseIcon,
	ClockIcon,
	CopyIcon,
	CreditCardIcon,
	HouseLineIcon,
	PackageIcon,
	ProhibitIcon,
	ReceiptIcon,
	TruckIcon,
} from "@phosphor-icons/react";
import {
	copyToClipboard,
	dateTimeFormat,
	fillMessage,
	moneyFormat,
	type TimelineStepId,
	timelineOf,
} from "~/features/shop";
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
import type { OrderDetail } from "../api/orders.queries";

/** The icon of each step: the object that the step moves. */
const STEP_ICONS = {
	placed: ReceiptIcon,
	paid: CreditCardIcon,
	packed: PackageIcon,
	shipped: TruckIcon,
	delivered: HouseLineIcon,
	cancelled: ProhibitIcon,
	refunded: ArrowCounterClockwiseIcon,
} satisfies Record<TimelineStepId, KitIcon>;

type OrderTimelineCardProps = {
	/** The order of the page. The card reads its event times, its amounts, and its delivery facts. */
	order: OrderDetail;
	/** The count of done events to show, the newest first. Absent: every step, waiting steps last. */
	limit?: number;
	/** Opens the Activity tab. The card shows the "View all" link only when the page gives it. */
	onViewAll?: () => void;
};

/** A waiting step has a dashed dot and the word "Waiting". The newest done event has the "Latest" badge. */
export function OrderTimelineCard({
	order,
	limit,
	onViewAll,
}: OrderTimelineCardProps) {
	const { t, locale } = useT();
	const dateTime = dateTimeFormat(locale);
	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const { trackingNumber } = order;
	const steps = timelineOf(order);
	const done = steps.filter((step) => step.at !== null).reverse();
	const waiting = steps.filter((step) => step.at === null);
	const shown =
		limit === undefined ? [...done, ...waiting] : done.slice(0, limit);

	// One line of text under each step. It says what the step changed for this order.
	const detailOf: Record<TimelineStepId, string> = {
		placed: fillMessage(t("orders.activity.placed"), {
			units: number.format(order.unitCount),
			total: money.format(order.total),
		}),
		paid: t(`orders.payment.${order.paymentMethod}`),
		packed: t(`orders.shippingLong.${order.shippingMethod}`),
		shipped: trackingNumber
			? fillMessage(t("orders.activity.shipped"), {
					tracking: trackingNumber,
				})
			: t("orders.noTracking"),
		delivered: fillMessage(t("orders.activity.delivered"), {
			place: order.customerPlace,
		}),
		cancelled: t("orders.activity.cancelled"),
		refunded: fillMessage(t("orders.activity.refunded"), {
			amount: money.format(order.total),
		}),
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("orders.activity.title")}</CardTitle>
				{onViewAll ? (
					<CardAction>
						<button
							type="button"
							onClick={onViewAll}
							className="text-muted-foreground text-sm hover:text-primary hover:underline"
						>
							{t("common.viewAll")}
						</button>
					</CardAction>
				) : null}
			</CardHeader>
			<CardContent className="ps-8">
				<ol className="relative border-s">
					{shown.map((step, index) => {
						const StepIcon = STEP_ICONS[step.id];
						return (
							<li key={step.id} className="ms-6 mb-8 space-y-2 last:mb-0">
								<span
									className={
										step.at
											? "absolute -start-3 flex size-6 items-center justify-center rounded-full border bg-muted"
											: "absolute -start-3 flex size-6 items-center justify-center rounded-full border border-dashed bg-card"
									}
								>
									<StepIcon
										className={
											step.at
												? "size-3 text-primary"
												: "size-3 text-muted-foreground"
										}
									/>
								</span>
								<h3 className="flex flex-wrap items-center gap-2 font-semibold">
									{t(`orders.steps.${step.id}`)}
									{index === 0 && step.at ? (
										<Badge variant="outline">
											{t("orders.activity.latest")}
										</Badge>
									) : null}
								</h3>
								<p className="flex items-center gap-1.5 text-muted-foreground text-sm leading-none">
									<ClockIcon className="size-3" />
									{step.at ? (
										<time dateTime={step.at} className="tabular-nums">
											{dateTime.format(new Date(step.at))}
										</time>
									) : (
										t("orders.waiting")
									)}
								</p>
								<p className="text-muted-foreground text-sm">
									{detailOf[step.id]}
								</p>
								{step.id === "shipped" && step.at && trackingNumber ? (
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() =>
											copyToClipboard(trackingNumber, {
												done: t("orders.trackingCopied"),
												failed: t("orders.trackingCopyError"),
											})
										}
									>
										<CopyIcon />
										{t("orders.copyTracking")}
									</Button>
								) : null}
							</li>
						);
					})}
				</ol>
			</CardContent>
		</Card>
	);
}

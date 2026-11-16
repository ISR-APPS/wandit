// The timeline card of the order page: one step for each event of the order, with its time.
// OrderDetailPage renders it. The steps come from timelineOf, so a step that did not happen yet shows as waiting.
// The steps sit in one row on a wide page and in one column on a phone.
import {
	ArrowCounterClockwiseIcon,
	CreditCardIcon,
	HouseLineIcon,
	PackageIcon,
	ProhibitIcon,
	ReceiptIcon,
	TruckIcon,
} from "@phosphor-icons/react";
import { dateTimeFormat } from "~/features/shop";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";
import type { OrderDetail } from "../api/orders.queries";
import { type TimelineStepId, timelineOf } from "../lib/order-progress";

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
	/** The order of the page. The card reads its event times and its payment method. */
	order: OrderDetail;
};

/** A done step has a filled mark and a time. A waiting step has an empty mark and the word "Waiting". */
export function OrderTimelineCard({ order }: OrderTimelineCardProps) {
	const { t, locale } = useT();
	const dateTime = dateTimeFormat(locale);
	const steps = timelineOf(order);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("orders.timeline")}</CardTitle>
			</CardHeader>
			<CardContent>
				<ol className="flex @2xl/main:flex-row flex-col">
					{steps.map((step, index) => {
						const StepIcon = STEP_ICONS[step.id];
						const isDone = step.at !== null;
						const isEnd = step.id === "cancelled" || step.id === "refunded";
						// The line to the next step is full only when that step is done too.
						const isNextDone = (steps[index + 1]?.at ?? null) !== null;
						return (
							<li
								key={step.id}
								className="relative flex @2xl/main:flex-1 @2xl/main:flex-col gap-3 @2xl/main:pb-0 pb-6 last:pb-0"
							>
								{index < steps.length - 1 ? (
									<span
										aria-hidden="true"
										className={cn(
											"absolute @2xl/main:start-8 start-4 @2xl/main:end-0 @2xl/main:top-4 top-8 @2xl/main:bottom-auto bottom-0 @2xl/main:h-px @2xl/main:w-auto w-px",
											isNextDone ? "bg-primary" : "bg-border",
										)}
									/>
								) : null}
								<span
									className={cn(
										"relative flex size-8 shrink-0 items-center justify-center rounded-full",
										!isDone && "border bg-card text-muted-foreground",
										isDone && isEnd && "bg-secondary text-secondary-foreground",
										isDone && !isEnd && "bg-primary text-primary-foreground",
									)}
								>
									<StepIcon className="size-4" />
								</span>
								<div className="grid content-start gap-0.5 @2xl/main:pe-3">
									<p
										className={cn(
											"font-medium text-sm",
											!isDone && "text-muted-foreground",
										)}
									>
										{t(`orders.steps.${step.id}`)}
									</p>
									<p className="text-muted-foreground text-xs tabular-nums">
										{step.at
											? dateTime.format(new Date(step.at))
											: t("orders.waiting")}
									</p>
									{step.id === "paid" ? (
										<p className="text-muted-foreground text-xs">
											{t(`orders.payment.${order.paymentMethod}`)}
										</p>
									) : null}
								</div>
							</li>
						);
					})}
				</ol>
			</CardContent>
		</Card>
	);
}

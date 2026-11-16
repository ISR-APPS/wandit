// The history of one purchase order as a vertical list: created, sent, each delivery, and the end state.
// The order panel renders it under the lines. An open order ends with its expected day.
import {
	formatRelativeDay,
	isOpenOrderStatus,
	pluralForm,
} from "~/features/stock";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { PurchaseOrder } from "../api/purchase-orders.queries";

type PurchaseOrderTimelineProps = {
	order: PurchaseOrder;
};

/** One step of the history. `isNext` marks a step that has not happened yet. */
type TimelineStep = {
	key: string;
	label: string;
	/** The date line under the label. */
	detail: string;
	isNext: boolean;
	isAlert: boolean;
};

/** Oldest step first. The dots sit on a rule at the start side. */
export function PurchaseOrderTimeline({ order }: PurchaseOrderTimelineProps) {
	const { t, locale } = useT();
	const dateTime = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	});
	const date = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		day: "numeric",
		month: "short",
	});
	const number = new Intl.NumberFormat(locale);
	const now = Date.now();

	const steps: TimelineStep[] = [
		{
			key: "created",
			label: t("purchaseOrders.history.created"),
			detail: dateTime.format(new Date(order.createdAt)),
			isNext: false,
			isAlert: false,
		},
	];
	if (order.orderedAt) {
		steps.push({
			key: "sent",
			label: t("purchaseOrders.history.sent"),
			detail: dateTime.format(new Date(order.orderedAt)),
			isNext: false,
			isAlert: false,
		});
	}
	order.receipts.forEach((receipt, index) => {
		const isLast =
			index === order.receipts.length - 1 && order.status === "received";
		steps.push({
			key: `receipt-${receipt.receivedAt}`,
			label: `${t(isLast ? "purchaseOrders.history.receivedFull" : "purchaseOrders.history.receivedPart")} · ${number.format(receipt.units)} ${t(`purchaseOrders.history.units.${pluralForm(receipt.units, locale)}`)}`,
			detail: dateTime.format(new Date(receipt.receivedAt)),
			isNext: false,
			isAlert: false,
		});
	});
	if (order.cancelledAt) {
		steps.push({
			key: "cancelled",
			label: t("purchaseOrders.history.cancelled"),
			detail: dateTime.format(new Date(order.cancelledAt)),
			isNext: false,
			isAlert: false,
		});
	}
	if (isOpenOrderStatus(order.status)) {
		steps.push({
			key: "expected",
			label: t(
				order.lateDays > 0
					? "purchaseOrders.history.overdue"
					: "purchaseOrders.history.expected",
			),
			detail: `${date.format(new Date(order.expectedOn))} · ${formatRelativeDay(order.expectedOn, now, locale)}`,
			isNext: true,
			isAlert: order.lateDays > 0,
		});
	}
	if (order.status === "draft") {
		steps.push({
			key: "draft",
			label: t("purchaseOrders.history.notSent"),
			detail: t("purchaseOrders.history.notSentDetail"),
			isNext: true,
			isAlert: false,
		});
	}

	return (
		<ol className="grid">
			{steps.map((step, index) => (
				<li
					key={step.key}
					className="relative grid gap-0.5 ps-6 pb-4 last:pb-0"
				>
					{/* The rule joins this dot to the next one. The last step has no rule. */}
					{index < steps.length - 1 ? (
						<span
							aria-hidden="true"
							className="absolute start-[calc(0.375rem-0.5px)] top-3 bottom-0 w-px bg-border"
						/>
					) : null}
					<span
						aria-hidden="true"
						className={cn(
							"absolute start-0 top-1 size-3 rounded-full border",
							step.isAlert
								? "border-destructive bg-destructive"
								: step.isNext
									? "border-foreground/40 bg-card"
									: "border-muted-foreground bg-muted-foreground",
						)}
					/>
					<span
						className={cn(
							"font-medium text-sm",
							step.isAlert && "text-destructive",
						)}
					>
						{step.label}
					</span>
					<span className="text-muted-foreground text-xs">{step.detail}</span>
				</li>
			))}
		</ol>
	);
}

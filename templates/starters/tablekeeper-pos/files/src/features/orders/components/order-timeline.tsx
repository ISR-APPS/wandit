// The timeline of one check: opened, sent to the kitchen, served, bill printed, and paid or voided.
// OrderDetailPage renders it in its rail. Each step shows its clock time and the minutes from the step before.
// An open check ends with a "Now" step, so the floor manager sees how long the table waits.
import {
	fillMessage,
	formatClock,
	formatMinutes,
	minutesSince,
	OPEN_ORDER_STATUSES,
	type Order,
} from "~/features/restaurant";
import { type TranslationKey, useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";

type OrderTimelineProps = {
	order: Order;
	/** Milliseconds since 1970 at render. */
	now: number;
};

/** One step of the timeline. */
type Step = {
	key: string;
	label: string;
	/** ISO time of the step. */
	at: string;
	/** True for the last real step and for "Now". */
	isCurrent: boolean;
};

/** A Card with a vertical list of steps. The dot of the latest step is filled. */
export function OrderTimeline({ order, now }: OrderTimelineProps) {
	const { t, locale } = useT();
	const steps: Step[] = [];
	const add = (key: string, labelKey: TranslationKey, at: string | null) => {
		if (at) {
			steps.push({ key, label: t(labelKey), at, isCurrent: false });
		}
	};
	add("opened", "orderDetail.stepOpened", order.openedAt);
	// A check of drinks only goes to the bar, not to the kitchen.
	const isBarOnly = order.lines.every((line) => line.station === "bar");
	add(
		"sent",
		isBarOnly ? "orderDetail.stepSentBar" : "orderDetail.stepSent",
		order.sentAt,
	);
	add("served", "orderDetail.stepServed", order.servedAt);
	add("bill", "orderDetail.stepBill", order.billAt);
	if (order.paidAt && order.payment) {
		steps.push({
			key: "paid",
			label: fillMessage(t("orderDetail.stepPaid"), {
				method: t(`payments.${order.payment}`).toLocaleLowerCase(locale),
			}),
			at: order.paidAt,
			isCurrent: false,
		});
	}
	if (order.voidedAt && order.voidReason) {
		steps.push({
			key: "void",
			label: fillMessage(t("orderDetail.stepVoided"), {
				reason: t(`voidReasons.${order.voidReason}`),
			}),
			at: order.voidedAt,
			isCurrent: false,
		});
	}
	// An open check ends at the current minute.
	if (OPEN_ORDER_STATUSES.includes(order.status)) {
		steps.push({
			key: "now",
			label: t("orderDetail.stepNow"),
			at: new Date(now).toISOString(),
			isCurrent: true,
		});
	}
	const last = steps.at(-1);
	if (last) {
		last.isCurrent = true;
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("orderDetail.timeline")}</CardTitle>
			</CardHeader>
			<CardContent>
				<ol className="grid">
					{steps.map((step, index) => {
						const previous = steps[index - 1];
						const gap = previous
							? minutesSince(previous.at, Date.parse(step.at))
							: null;
						return (
							<li key={step.key} className="relative flex gap-3 pb-5 last:pb-0">
								{/* The line joins this dot to the next one. The last step has none. */}
								{index < steps.length - 1 ? (
									<span
										aria-hidden="true"
										className="absolute start-[5px] top-4 bottom-0 w-px bg-border"
									/>
								) : null}
								<span
									aria-hidden="true"
									className={cn(
										"relative mt-1 size-[11px] shrink-0 rounded-full border border-primary",
										step.isCurrent ? "bg-primary" : "bg-card",
									)}
								/>
								<span className="grid min-w-0 flex-1 gap-0.5">
									<span className="font-medium text-sm">{step.label}</span>
									<span className="text-muted-foreground text-xs tabular-nums">
										{formatClock(step.at, locale)}
										{gap === null ? null : ` · +${formatMinutes(gap, locale)}`}
									</span>
								</span>
							</li>
						);
					})}
				</ol>
			</CardContent>
		</Card>
	);
}

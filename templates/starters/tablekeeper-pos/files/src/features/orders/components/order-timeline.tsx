// The timeline of one check, the newest step first: opened, sent, served, bill printed, and paid or voided.
// OrderDetailPage renders it in the overview (with a "View all" link to the Timeline tab) and in the Timeline tab.
// Each step has an icon on a start rule, its clock time, and one line of detail. An open check starts with "Now".
import {
	ChairIcon,
	ChefHatIcon,
	ClockIcon,
	CreditCardIcon,
	ForkKnifeIcon,
	HourglassIcon,
	type Icon,
	MoneyIcon,
	ReceiptIcon,
	XCircleIcon,
} from "@phosphor-icons/react";
import {
	countLabel,
	fillMessage,
	formatCents,
	formatClock,
	formatMinutes,
	minutesSince,
	moneyFormat,
	OPEN_ORDER_STATUSES,
	type Order,
	orderItemCount,
	orderSubtotalCents,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";

type OrderTimelineProps = {
	order: Order;
	/** Milliseconds since 1970 at render. */
	now: number;
	/** Opens the Timeline tab. The overview passes it; the Timeline tab itself does not. */
	onViewAll?: () => void;
};

/** One step of the timeline. */
type Step = {
	key: string;
	icon: Icon;
	title: string;
	/** ISO time of the step. */
	at: string;
	detail: string;
};

/** A Card with a vertical list of steps on a start rule. The newest step carries a "Latest" badge. */
export function OrderTimeline({ order, now, onViewAll }: OrderTimelineProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const steps: Step[] = [
		{
			key: "opened",
			icon: ChairIcon,
			title: t("orderDetail.stepOpened"),
			at: order.openedAt,
			detail: fillMessage(t("orderDetail.stepOpenedDetail"), {
				covers: countLabel(
					order.covers,
					t("counts.covers.one"),
					t("counts.covers.other"),
					locale,
				),
				table: order.tableName,
				server: order.serverName,
			}),
		},
	];
	// A check of drinks only goes to the bar, not to the kitchen.
	const isBarOnly = order.lines.every((line) => line.station === "bar");
	steps.push({
		key: "sent",
		icon: ChefHatIcon,
		title: t(isBarOnly ? "orderDetail.stepSentBar" : "orderDetail.stepSent"),
		at: order.sentAt,
		detail: order.lines
			.map((line) => `${line.quantity} × ${line.name}`)
			.join(", "),
	});
	if (order.servedAt) {
		steps.push({
			key: "served",
			icon: ForkKnifeIcon,
			title: t("orderDetail.stepServed"),
			at: order.servedAt,
			detail: fillMessage(t("orderDetail.stepServedDetail"), {
				time: formatMinutes(
					minutesSince(order.sentAt, Date.parse(order.servedAt)),
					locale,
				),
			}),
		});
	}
	if (order.billAt) {
		steps.push({
			key: "bill",
			icon: ReceiptIcon,
			title: t("orderDetail.stepBill"),
			at: order.billAt,
			// The printed bill holds the lines only. The guest adds the tip when they pay.
			detail: fillMessage(t("orderDetail.stepBillDetail"), {
				items: countLabel(
					orderItemCount(order),
					t("counts.items.one"),
					t("counts.items.other"),
					locale,
				),
				amount: formatCents(money, orderSubtotalCents(order)),
			}),
		});
	}
	if (order.paidAt && order.payment) {
		steps.push({
			key: "paid",
			icon: order.payment === "card" ? CreditCardIcon : MoneyIcon,
			title: fillMessage(t("orderDetail.stepPaid"), {
				method: t(`payments.${order.payment}`).toLocaleLowerCase(locale),
			}),
			at: order.paidAt,
			detail:
				order.tipCents > 0
					? fillMessage(t("orderDetail.stepTip"), {
							amount: formatCents(money, order.tipCents),
						})
					: t("orderDetail.stepNoTip"),
		});
	}
	if (order.voidedAt && order.voidReason) {
		steps.push({
			key: "void",
			icon: XCircleIcon,
			title: fillMessage(t("orderDetail.stepVoided"), {
				reason: t(`voidReasons.${order.voidReason}`),
			}),
			at: order.voidedAt,
			detail: t("orderDetail.voided"),
		});
	}
	// An open check ends at the current minute, so the floor manager sees how long the table waits.
	if (OPEN_ORDER_STATUSES.includes(order.status)) {
		const last = steps.at(-1);
		steps.push({
			key: "now",
			icon: HourglassIcon,
			title: t("orderDetail.stepNow"),
			at: new Date(now).toISOString(),
			detail: last
				? fillMessage(t("orderDetail.stepWaiting"), {
						time: formatMinutes(minutesSince(last.at, now), locale),
					})
				: "",
		});
	}
	const newestFirst = steps.reverse();

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("orderDetail.timeline")}</CardTitle>
				{onViewAll ? (
					<CardAction>
						<button
							type="button"
							onClick={onViewAll}
							className="text-muted-foreground text-sm hover:text-primary hover:underline"
						>
							{t("orderDetail.viewAll")}
						</button>
					</CardAction>
				) : null}
			</CardHeader>
			<CardContent className="ps-9">
				<ol className="relative border-s">
					{newestFirst.map((step, index) => (
						<li key={step.key} className="ms-6 grid gap-1.5 pb-8 last:pb-0">
							<span
								aria-hidden="true"
								className="absolute -start-3 flex size-6 items-center justify-center rounded-full border bg-card"
							>
								<step.icon className="size-3 text-primary" />
							</span>
							<h3 className="flex items-center gap-2 font-semibold">
								{step.title}
								{index === 0 ? (
									<Badge variant="outline">{t("orderDetail.latest")}</Badge>
								) : null}
							</h3>
							<time
								dateTime={step.at}
								className="flex items-center gap-1.5 text-muted-foreground text-sm tabular-nums"
							>
								<ClockIcon className="size-3" />
								{formatClock(step.at, locale)}
							</time>
							{step.detail ? (
								<p className="text-muted-foreground text-sm" dir="auto">
									{step.detail}
								</p>
							) : null}
						</li>
					))}
				</ol>
			</CardContent>
		</Card>
	);
}

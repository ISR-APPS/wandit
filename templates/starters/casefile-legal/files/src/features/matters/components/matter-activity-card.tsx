// The latest activity of one matter as a line timeline: stage changes, invoices, and payments, newest first.
// MatterDetailPage renders it at the top of the 2/3 column of the Overview tab, as the kit "latest activity" card.
// It follows the line timeline of recipe 3.5. An invoice event has a button that opens the invoice dialog.
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	fillMessage,
	type InvoiceRow,
	moneyFormat,
	type PaymentRow,
	type StageChangeRow,
} from "~/features/practice";
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

// Five events let the right column end near the profile, fee, and team cards on the left. "View all" shows the rest.
const SHOWN_EVENTS = 5;

/** One event of the timeline. `invoiceId` adds the button that opens the invoice. */
type ActivityEvent = {
	id: string;
	/** ISO time of the event. */
	at: string;
	title: string;
	detail: string;
	invoiceId: string | null;
};

type MatterActivityCardProps = {
	/** Oldest first. */
	stageChanges: StageChangeRow[];
	invoices: InvoiceRow[];
	payments: PaymentRow[];
};

/** The newest event gets a filled dot and a "Latest" badge, as in the kit. */
export function MatterActivityCard({
	stageChanges,
	invoices,
	payments,
}: MatterActivityCardProps) {
	const { t, locale } = useT();
	const [isExpanded, setIsExpanded] = useState(false);
	const money = moneyFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
	const invoiceNumber = new Map(
		invoices.map((invoice) => [invoice.id, invoice.number]),
	);
	const events: ActivityEvent[] = [
		...stageChanges.map((change) => ({
			id: `stage-${change.stage}-${change.changedAt}`,
			at: change.changedAt,
			title: fillMessage(t("matters.activity.stage"), {
				stage: t(`stages.${change.stage}`),
			}),
			detail: t(`stageHints.${change.stage}`),
			invoiceId: null,
		})),
		...invoices.map((invoice) => ({
			id: invoice.id,
			at: invoice.issuedAt,
			title: fillMessage(t("matters.activity.invoice"), {
				number: invoice.number,
			}),
			detail: fillMessage(t("matters.activity.invoiceDetail"), {
				amount: money.format(invoice.amount),
				status: t(`invoiceStatus.${invoice.status}`),
			}),
			invoiceId: invoice.id,
		})),
		...payments.map((payment) => ({
			id: payment.id,
			at: payment.paidAt,
			title: fillMessage(t("matters.activity.payment"), {
				amount: money.format(payment.amount),
			}),
			detail: invoiceNumber.get(payment.invoiceId) ?? "",
			invoiceId: null,
		})),
	].sort((first, second) => second.at.localeCompare(first.at));
	const shown = isExpanded ? events : events.slice(0, SHOWN_EVENTS);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("matters.activity.title")}</CardTitle>
				{events.length > SHOWN_EVENTS ? (
					<CardAction>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							aria-expanded={isExpanded}
							onClick={() => setIsExpanded(!isExpanded)}
						>
							{isExpanded ? t("common.showLess") : t("common.viewAll")}
						</Button>
					</CardAction>
				) : null}
			</CardHeader>
			<CardContent>
				{events.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("matters.activity.empty")}
					</p>
				) : (
					<ol className="relative ms-2 grid gap-6 border-s ps-6">
						{shown.map((event, index) => (
							<li key={event.id} className="relative grid gap-1">
								<span
									aria-hidden="true"
									className={cn(
										"absolute -start-7.5 top-1 size-3 rounded-full border",
										index === 0 ? "bg-primary" : "bg-card",
									)}
								/>
								<p className="flex flex-wrap items-center gap-2 font-medium text-sm">
									{event.title}
									{index === 0 ? (
										<Badge variant="outline">
											{t("matters.activity.latest")}
										</Badge>
									) : null}
								</p>
								<time
									dateTime={event.at}
									className="text-muted-foreground text-xs tabular-nums"
								>
									{date.format(new Date(event.at))}
								</time>
								<p className="text-muted-foreground text-sm">{event.detail}</p>
								{event.invoiceId ? (
									<Button
										asChild
										variant="outline"
										size="sm"
										className="mt-1 justify-self-start"
									>
										<Link
											to="/app/billing"
											search={{ invoice: event.invoiceId }}
										>
											{t("matters.openInvoice")}
										</Link>
									</Button>
								) : null}
							</li>
						))}
					</ol>
				)}
			</CardContent>
		</Card>
	);
}

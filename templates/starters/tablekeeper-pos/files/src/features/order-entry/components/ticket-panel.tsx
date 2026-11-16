// The ticket side of the order screen: the lines with their steppers, the totals, and the two actions.
// OrderEntryPage renders it beside the menu, sticky on a wide screen. Its id is the anchor of the phone bar.
// It shows the cart that the page holds. Preview opens the kitchen ticket; Clear empties the cart.
// The steppers are 44 px on a phone, the touch target of the most tapped screen, and 32 px on a wide screen.
// They draw "−" and "+" as text: the filled icons of the theme draw a square with a cut-out sign.
import { fillMessage, formatCents, moneyFormat } from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { type TicketLine, ticketTotals } from "../lib/cart";

/** The id of the ticket panel. The phone bar of the order screen links to it. */
export const TICKET_ANCHOR = "ticket";

type TicketPanelProps = {
	/** The ticket title: "Ticket" alone, or with the table name. */
	title: string;
	/** One muted line under the title: the covers, or the note about an open check. */
	description: string;
	lines: TicketLine[];
	/** Adds `delta` portions (1 or -1) of one item. */
	onChangeQuantity: (menuItemId: string, delta: number) => void;
	onClear: () => void;
	onPreview: () => void;
	/** False while no table is chosen or the ticket is empty. */
	canPreview: boolean;
	/** The muted line under the actions while canPreview is false: what is still missing. */
	previewHint: string;
};

/** A Card with a list of lines and a totals block at its foot. */
export function TicketPanel({
	title,
	description,
	lines,
	onChangeQuantity,
	onClear,
	onPreview,
	canPreview,
	previewHint,
}: TicketPanelProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const totals = ticketTotals(lines);

	return (
		<Card id={TICKET_ANCHOR} className="scroll-mt-20 gap-4">
			<CardHeader>
				<CardTitle className="text-lg">{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-1">
				{lines.length === 0 ? (
					<p className="rounded-control border border-dashed px-4 py-8 text-center text-muted-foreground text-sm">
						{t("orderEntry.ticketEmpty")}
					</p>
				) : (
					<ul className="grid divide-y">
						{lines.map((line) => (
							<li key={line.item.id} className="flex items-center gap-3 py-2.5">
								<span className="grid min-w-0 flex-1">
									<span className="truncate font-medium text-sm">
										{line.item.name}
									</span>
									<span className="text-muted-foreground text-xs tabular-nums">
										{formatCents(money, line.item.priceCents)}
									</span>
								</span>
								<span className="flex items-center gap-1">
									<Button
										type="button"
										variant="outline"
										size="icon"
										className="@3xl/main:size-8 size-11"
										aria-label={fillMessage(
											t(
												line.quantity === 1
													? "orderEntry.remove"
													: "orderEntry.decrease",
											),
											{ name: line.item.name },
										)}
										onClick={() => onChangeQuantity(line.item.id, -1)}
									>
										<span
											aria-hidden="true"
											className="font-semibold text-lg leading-none"
										>
											−
										</span>
									</Button>
									<span className="w-6 text-center font-medium text-sm tabular-nums">
										{line.quantity}
									</span>
									<Button
										type="button"
										variant="outline"
										size="icon"
										className="@3xl/main:size-8 size-11"
										aria-label={fillMessage(t("orderEntry.increase"), {
											name: line.item.name,
										})}
										onClick={() => onChangeQuantity(line.item.id, 1)}
									>
										<span
											aria-hidden="true"
											className="font-semibold text-lg leading-none"
										>
											+
										</span>
									</Button>
								</span>
								<span className="w-20 text-end font-medium text-sm tabular-nums">
									{formatCents(money, line.totalCents)}
								</span>
							</li>
						))}
					</ul>
				)}
			</CardContent>
			<CardFooter className="grid gap-4 border-t pt-4">
				<dl className="grid gap-1.5 text-sm">
					<div className="flex justify-between gap-4">
						<dt className="text-muted-foreground">
							{fillMessage(t("orderEntry.items"), {
								count: String(totals.itemCount),
							})}
						</dt>
						<dd className="text-muted-foreground tabular-nums">
							{t("orderEntry.vatIncluded")}{" "}
							{formatCents(money, totals.vatCents)}
						</dd>
					</div>
					<div className="flex items-baseline justify-between gap-4">
						<dt className="font-medium">{t("orderEntry.total")}</dt>
						<dd className="font-numeric font-semibold text-2xl tabular-nums">
							{formatCents(money, totals.totalCents)}
						</dd>
					</div>
				</dl>
				<div className="flex gap-2">
					<Button
						type="button"
						variant="outline"
						disabled={lines.length === 0}
						onClick={onClear}
					>
						{t("orderEntry.clear")}
					</Button>
					<Button
						type="button"
						className="flex-1"
						disabled={!canPreview}
						onClick={onPreview}
					>
						{t("orderEntry.preview")}
					</Button>
				</div>
				{canPreview ? null : (
					<p className="text-muted-foreground text-xs">{previewHint}</p>
				)}
			</CardFooter>
		</Card>
	);
}

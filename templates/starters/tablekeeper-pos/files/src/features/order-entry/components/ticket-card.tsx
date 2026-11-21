// The ticket column of the till screen, in the anatomy of the kit POS cart.
// A tall card with the lines (icon tile, remove button, name, amount, stepper), then a muted card with the totals
// and the main action. OrderEntryPage renders it at the end side. Its id is the anchor of the phone bar.
// The steppers draw "−" and "+" as text: the filled icons of the theme draw a square with a cut-out sign.
import { ChefHatIcon, ReceiptIcon, XIcon } from "@phosphor-icons/react";
import {
	fillMessage,
	formatCents,
	MENU_CATEGORY_ICON,
	moneyFormat,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { type TicketLine, ticketTotals } from "../lib/cart";

/** The id of the ticket card. The phone bar of the till screen links to it. */
export const TICKET_ANCHOR = "ticket";

type TicketCardProps = {
	/** The ticket title: "Ticket" alone, or with the table name. */
	title: string;
	/** One muted line under the title: the zone and the covers, or the note about an open check. */
	description: string;
	lines: TicketLine[];
	/** Adds `delta` portions (1 or -1) of one item. A line at 0 leaves the ticket. */
	onChangeQuantity: (menuItemId: string, delta: number) => void;
	/** Removes every portion of one item. */
	onRemove: (menuItemId: string) => void;
	onClear: () => void;
	onPreview: () => void;
	/** False while no table is chosen. The preview then shows a hint instead of the button. */
	hasTable: boolean;
};

/** The totals card shows only while the ticket has a line, as the kit cart. */
export function TicketCard({
	title,
	description,
	lines,
	onChangeQuantity,
	onRemove,
	onClear,
	onPreview,
	hasTable,
}: TicketCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const totals = ticketTotals(lines);

	return (
		<div
			id={TICKET_ANCHOR}
			className="flex @4xl/main:h-full scroll-mt-20 flex-col gap-4"
		>
			<Card className="min-h-64 flex-1 overflow-hidden">
				<CardHeader>
					<CardTitle>{title}</CardTitle>
					<CardDescription>{description}</CardDescription>
				</CardHeader>
				<CardContent className="flex-1 overflow-y-auto">
					{lines.length === 0 ? (
						<div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
							<ReceiptIcon aria-hidden="true" className="size-8" />
							<span>{t("orderEntry.ticketEmpty")}</span>
						</div>
					) : (
						<ul className="grid gap-4">
							{lines.map((line) => {
								const CategoryIcon = MENU_CATEGORY_ICON[line.item.category];
								return (
									<li key={line.item.id} className="flex gap-3">
										<div className="relative size-10 shrink-0">
											<span
												aria-hidden="true"
												className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground"
											>
												<CategoryIcon className="size-5" />
											</span>
											<Button
												type="button"
												variant="destructive"
												size="icon"
												aria-label={fillMessage(t("orderEntry.remove"), {
													name: line.item.name,
												})}
												onClick={() => onRemove(line.item.id)}
												className="absolute -start-1 -bottom-1 size-5 rounded-full p-0"
											>
												<XIcon className="size-3" />
											</Button>
										</div>
										<div className="flex min-w-0 flex-1 flex-col items-start gap-2">
											<div className="grid min-w-0 gap-0.5">
												<span
													className="truncate font-semibold text-sm"
													dir="auto"
												>
													{line.item.name}
												</span>
												<span className="text-sm tabular-nums">
													{formatCents(money, line.totalCents)}
												</span>
											</div>
											<div className="inline-flex overflow-hidden rounded-md border bg-background">
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className="size-8"
													aria-label={fillMessage(t("orderEntry.decrease"), {
														name: line.item.name,
													})}
													onClick={() => onChangeQuantity(line.item.id, -1)}
												>
													<span aria-hidden="true">−</span>
												</Button>
												<span className="flex w-8 items-center justify-center text-sm tabular-nums">
													{line.quantity}
												</span>
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className="size-8"
													aria-label={fillMessage(t("orderEntry.increase"), {
														name: line.item.name,
													})}
													onClick={() => onChangeQuantity(line.item.id, 1)}
												>
													<span aria-hidden="true">+</span>
												</Button>
											</div>
										</div>
									</li>
								);
							})}
						</ul>
					)}
				</CardContent>
			</Card>
			{lines.length > 0 ? (
				<Card className="bg-muted">
					<CardContent className="grid gap-6">
						<dl className="grid gap-2 text-sm">
							<div className="flex justify-between gap-4">
								<dt className="text-muted-foreground">
									{t("orderEntry.itemsLabel")}
								</dt>
								<dd className="font-medium tabular-nums">{totals.itemCount}</dd>
							</div>
							<div className="flex justify-between gap-4">
								<dt className="text-muted-foreground">
									{t("orderEntry.vatIncluded")}
								</dt>
								<dd className="font-medium tabular-nums">
									{formatCents(money, totals.vatCents)}
								</dd>
							</div>
							<div className="flex justify-between gap-4 text-base">
								<dt className="font-semibold">{t("orderEntry.total")}</dt>
								<dd className="font-numeric font-semibold tabular-nums">
									{formatCents(money, totals.totalCents)}
								</dd>
							</div>
						</dl>
						<div className="grid gap-2">
							{hasTable ? (
								<Button
									type="button"
									size="lg"
									className="w-full"
									onClick={onPreview}
								>
									<ChefHatIcon />
									{t("orderEntry.preview")}
								</Button>
							) : (
								<p className="text-muted-foreground text-sm">
									{t("orderEntry.previewHint")}
								</p>
							)}
							<Button
								type="button"
								variant="ghost"
								className="w-full"
								onClick={onClear}
							>
								{t("orderEntry.clear")}
							</Button>
						</div>
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}

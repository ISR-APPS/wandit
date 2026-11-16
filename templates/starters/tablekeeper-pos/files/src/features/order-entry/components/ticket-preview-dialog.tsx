// The kitchen ticket preview: the lines of the order grouped by station, as the kitchen and the bar print them.
// OrderEntryPage opens it from the ticket panel. It sends nothing: the starter has no orders table yet.
// "Clear and start again" empties the cart, so the server can take the next order.
import { fillMessage, type Station } from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/shared/ui/dialog";
import type { TicketLine } from "../lib/cart";

// The kitchen ticket prints first, the bar ticket second.
const STATIONS: Station[] = ["kitchen", "bar"];

type TicketPreviewDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The head line of the ticket: the table, the zone, the covers, and the time. */
	heading: string;
	lines: TicketLine[];
	onStartNew: () => void;
};

/** A controlled dialog that shows the printed ticket on a muted slip. */
export function TicketPreviewDialog({
	open,
	onOpenChange,
	heading,
	lines,
	onStartNew,
}: TicketPreviewDialogProps) {
	const { t } = useT();
	const groups = STATIONS.map((station) => ({
		station,
		lines: lines.filter((line) => line.item.station === station),
	})).filter((group) => group.lines.length > 0);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t("orderEntry.previewTitle")}</DialogTitle>
					<DialogDescription>
						{t("orderEntry.previewDescription")}
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 rounded-control border border-dashed bg-muted p-4">
					<p className="font-semibold text-sm tabular-nums">{heading}</p>
					{groups.map((group) => (
						<section
							key={group.station}
							className="grid gap-2 border-t border-dashed pt-3"
						>
							<h3 className="text-muted-foreground text-xs">
								{fillMessage(t("orderEntry.station"), {
									station: t(`stations.${group.station}`),
									count: String(
										group.lines.reduce((sum, line) => sum + line.quantity, 0),
									),
								})}
							</h3>
							<ul className="grid gap-1.5">
								{group.lines.map((line) => (
									<li key={line.item.id} className="flex gap-3 text-sm">
										<span className="w-6 font-semibold tabular-nums">
											{line.quantity}
										</span>
										<span>{line.item.name}</span>
									</li>
								))}
							</ul>
						</section>
					))}
				</div>
				<DialogFooter>
					<Button type="button" variant="outline" onClick={onStartNew}>
						{t("orderEntry.startNew")}
					</Button>
					<Button type="button" onClick={() => onOpenChange(false)}>
						{t("orderEntry.backToOrder")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

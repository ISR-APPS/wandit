// The dialog that shows one order: its account, its rep, its status, and its lines with the total.
// The orders page and the newest orders panel of the home open it from the order number.
// It only shows data. The app has no order form yet (STARTER.md).

import {
	fillMessage,
	moneyFormat,
	type Order,
	OrderStatusBadge,
} from "~/features/sales";
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
import {
	Table,
	TableBody,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";

type OrderDialogProps = {
	/** The order to show. null keeps the dialog closed. */
	order: Order | null;
	onClose: () => void;
};

/** A controlled dialog. The caller holds the open order in its state. */
export function OrderDialog({ order, onClose }: OrderDialogProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const dateTime = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	});
	return (
		<Dialog open={order !== null} onOpenChange={(open) => !open && onClose()}>
			{order ? (
				<DialogContent className="sm:max-w-xl">
					<DialogHeader>
						<DialogTitle className="flex flex-wrap items-center gap-2">
							<bdi>{order.accountName}</bdi>
							<OrderStatusBadge status={order.status} />
						</DialogTitle>
						<DialogDescription>
							{fillMessage(t("orders.dialogDescription"), {
								rep: order.repName,
								territory: order.territoryName,
							})}
						</DialogDescription>
					</DialogHeader>
					<dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
						<div className="grid gap-1">
							<dt className="text-muted-foreground">{t("orders.order")}</dt>
							<dd className="font-medium tabular-nums">{order.number}</dd>
						</div>
						<div className="grid gap-1">
							<dt className="text-muted-foreground">{t("orders.bookedAt")}</dt>
							<dd>{dateTime.format(new Date(order.bookedAt))}</dd>
						</div>
						<div className="grid gap-1">
							<dt className="text-muted-foreground">{t("orders.segment")}</dt>
							<dd>{t(`segments.${order.segment}`)}</dd>
						</div>
					</dl>
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t("orders.product")}</TableHead>
									<TableHead className="text-end">
										{t("orders.quantity")}
									</TableHead>
									<TableHead className="text-end">
										{t("orders.unitPrice")}
									</TableHead>
									<TableHead className="text-end">
										{t("orders.lineTotal")}
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{order.lines.map((line) => (
									<TableRow key={line.productLine}>
										<TableCell>
											{t(`productLines.${line.productLine}`)}
										</TableCell>
										<TableCell className="text-end tabular-nums">
											{number.format(line.quantity)}
										</TableCell>
										<TableCell className="text-end tabular-nums">
											{money.format(line.unitPrice)}
										</TableCell>
										<TableCell className="text-end tabular-nums">
											{money.format(line.amount)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
							<TableFooter>
								<TableRow>
									<TableCell colSpan={3}>{t("orders.total")}</TableCell>
									<TableCell className="text-end font-semibold tabular-nums">
										{money.format(order.amount)}
									</TableCell>
								</TableRow>
							</TableFooter>
						</Table>
					</div>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={onClose}>
							{t("common.close")}
						</Button>
					</DialogFooter>
				</DialogContent>
			) : null}
		</Dialog>
	);
}

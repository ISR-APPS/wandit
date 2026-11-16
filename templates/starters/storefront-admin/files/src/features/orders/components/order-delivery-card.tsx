// The delivery card of the order page: the address, the delivery choice, the tracking number, and the customer note.
// OrderDetailPage renders it in the side column. The copy button puts the tracking number on the clipboard.
import { CopyIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { OrderDetail } from "../api/orders.queries";

type OrderDeliveryCardProps = {
	/** The order of the page. The card reads its address, its delivery choice, its tracking number, and its note. */
	order: OrderDetail;
};

/** No tracking number shows before the parcel leaves. */
export function OrderDeliveryCard({ order }: OrderDeliveryCardProps) {
	const { t } = useT();

	async function copyTracking(trackingNumber: string) {
		try {
			await navigator.clipboard.writeText(trackingNumber);
			toast.success(t("orders.trackingCopied"));
		} catch (error) {
			// The browser refuses the clipboard on a page with no focus or no permission.
			console.error("clipboard write failed", error);
			toast.error(t("orders.trackingCopyError"));
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("orders.delivery")}</CardTitle>
			</CardHeader>
			<CardContent>
				<dl className="grid gap-4 text-sm">
					<div className="grid gap-1">
						<dt className="text-muted-foreground">{t("orders.address")}</dt>
						<dd className="grid" dir="auto">
							<span>{order.customerName}</span>
							<span>{order.customer.street}</span>
							<span>{`${order.customerPlace} ${order.customer.postalCode}`}</span>
						</dd>
					</div>
					<div className="grid gap-1">
						<dt className="text-muted-foreground">{t("orders.method")}</dt>
						<dd>{t(`orders.shippingLong.${order.shippingMethod}`)}</dd>
					</div>
					<div className="grid gap-1">
						<dt className="text-muted-foreground">{t("orders.tracking")}</dt>
						<dd>
							{order.trackingNumber ? (
								<span className="flex items-center gap-1">
									<span className="tabular-nums">{order.trackingNumber}</span>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="size-8 max-sm:size-11"
										aria-label={t("orders.copyTracking")}
										onClick={() => copyTracking(order.trackingNumber ?? "")}
									>
										<CopyIcon />
									</Button>
								</span>
							) : (
								<span className="text-muted-foreground">
									{t("orders.noTracking")}
								</span>
							)}
						</dd>
					</div>
					{order.note ? (
						<div className="grid gap-1 border-t pt-4">
							<dt className="text-muted-foreground">{t("orders.note")}</dt>
							<dd className="whitespace-pre-line" dir="auto">
								{order.note}
							</dd>
						</div>
					) : null}
				</dl>
			</CardContent>
		</Card>
	);
}

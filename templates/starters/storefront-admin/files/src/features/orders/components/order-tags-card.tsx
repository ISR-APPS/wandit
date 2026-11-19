// The tags card of the order page: outline badges for the categories, the delivery, the payment, and the discount code.
// OrderDetailPage renders it at the end of the side column. The badges are text only, without links.
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { OrderDetail } from "../api/orders.queries";

type OrderTagsCardProps = {
	/** The order of the page. The card reads its categories, its delivery, its payment, and its discount code. */
	order: OrderDetail;
};

/** The category badges come first, in the order of the lines. */
export function OrderTagsCard({ order }: OrderTagsCardProps) {
	const { t } = useT();
	const tags = [
		...order.categories.map((category) => t(`products.categories.${category}`)),
		t(`orders.shipping.${order.shippingMethod}`),
		t(`orders.payment.${order.paymentMethod}`),
		...(order.discountCode ? [order.discountCode] : []),
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("orders.tags")}</CardTitle>
			</CardHeader>
			<CardContent>
				<ul className="flex flex-wrap gap-2">
					{tags.map((tag) => (
						<li key={tag}>
							<Badge variant="outline">{tag}</Badge>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}

// The "same supplier" card of the item page: other items of the supplier with their level and a button,
// in the anatomy of the kit connections card. ItemDetailPage renders it beside the order card.
// The head button opens the item list filtered on the supplier.
import { Link } from "@tanstack/react-router";
import { InitialsTile } from "~/features/stock";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { CaretRightIcon } from "~/shared/ui/icons";
import type { StockItem } from "../api/items.queries";

type ItemSiblingsCardProps = {
	/** The other items of the supplier, the most urgent first. */
	items: StockItem[];
	/** The supplier id, for the link to the filtered item list. */
	supplierId: string;
};

/** A low or empty item gets a filled button, so the eye finds it first. */
export function ItemSiblingsCard({ items, supplierId }: ItemSiblingsCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);

	return (
		<Card className="min-w-0">
			<CardHeader>
				<CardTitle>{t("itemDetail.siblingsTitle")}</CardTitle>
				<CardAction>
					<Button asChild variant="outline" size="icon">
						<Link
							to="/app/items"
							search={{ supplier: supplierId }}
							aria-label={t("itemDetail.allSupplierItems")}
						>
							<CaretRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{items.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("itemDetail.noSiblings")}
					</p>
				) : (
					<ul className="grid gap-4">
						{items.map((item) => (
							<li key={item.id} className="flex items-center gap-3">
								<InitialsTile name={item.name} className="size-10" />
								<div className="grid min-w-0 flex-1">
									<span className="truncate font-medium text-sm" dir="auto">
										{item.name}
									</span>
									<span className="truncate text-muted-foreground text-xs tabular-nums">
										{`${item.sku} · ${number.format(item.onHand)} ${t("itemDetail.onHandShort")}`}
									</span>
								</div>
								<Button
									asChild
									size="sm"
									variant={item.status === "ok" ? "outline" : "default"}
								>
									<Link to="/app/items/$itemId" params={{ itemId: item.id }}>
										{t("itemDetail.view")}
									</Link>
								</Button>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}

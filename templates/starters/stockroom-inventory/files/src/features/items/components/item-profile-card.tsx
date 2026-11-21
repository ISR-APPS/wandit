// The facts card of the item page, in the anatomy of the kit profile card: a centered tile with the name
// and the stock level, a strip of three numbers, and a list of facts with icons.
// ItemDetailPage renders it at the top of its first column.
import {
	BarcodeIcon,
	EnvelopeSimpleIcon,
	MapPinIcon,
	PhoneIcon,
	TagIcon,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";
import {
	InitialsTile,
	moneyFormat,
	StockStatusBadge,
	type SupplierRow,
	unitWord,
} from "~/features/stock";
import { useT } from "~/shared/i18n";
import { Card, CardContent } from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";
import type { StockItem } from "../api/items.queries";

type ItemProfileCardProps = {
	item: StockItem;
	/** The supplier of the item. Its contact email and phone close the fact list. */
	supplier: SupplierRow;
};

/** One row of the fact list: an icon and a value. */
type Fact = { icon: KitIcon; label: string; value: ReactNode };

/** The strip reads value over label, as the kit counts do. */
export function ItemProfileCard({ item, supplier }: ItemProfileCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const days = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "narrow",
		maximumFractionDigits: 0,
	});
	const stats = [
		{ label: t("items.onHand"), value: number.format(item.onHand) },
		{ label: t("items.minimum"), value: number.format(item.minimum) },
		{
			label: t("items.cover"),
			value:
				item.daysOfCover === null
					? t("items.none")
					: days.format(item.daysOfCover),
		},
	];
	const facts: Fact[] = [
		{
			icon: EnvelopeSimpleIcon,
			label: t("itemDetail.supplierEmail"),
			value: (
				<a href={`mailto:${supplier.email}`} className="hover:underline">
					{supplier.email}
				</a>
			),
		},
		{
			icon: PhoneIcon,
			label: t("itemDetail.supplierPhone"),
			value: (
				<a
					href={`tel:${supplier.phone.replace(/[^\d+]/g, "")}`}
					className="tabular-nums hover:underline"
				>
					<bdi dir="ltr">{supplier.phone}</bdi>
				</a>
			),
		},
		{
			icon: MapPinIcon,
			label: t("itemDetail.bin"),
			value: `${t("itemDetail.binPrefix")} ${item.bin}`,
		},
		{ icon: BarcodeIcon, label: t("items.sku"), value: item.sku },
		{
			icon: TagIcon,
			label: t("items.unitCost"),
			value: `${money.format(item.unitCost)} / ${unitWord(1, item.unit, t, locale)}`,
		},
	];

	return (
		<Card>
			<CardContent className="grid gap-8">
				<div className="grid justify-items-center gap-3 text-center">
					<InitialsTile name={item.name} className="size-20 text-xl" />
					<div className="grid justify-items-center gap-1">
						<h2 className="flex flex-wrap items-center justify-center gap-2 font-display font-semibold text-xl">
							<span dir="auto">{item.name}</span>
							<StockStatusBadge status={item.status} />
						</h2>
						<p className="text-muted-foreground text-sm">
							{`${t(`categories.${item.category}`)} · ${item.supplierName}`}
						</p>
					</div>
				</div>
				<dl className="grid grid-cols-3 divide-x rounded-md border bg-muted text-center rtl:divide-x-reverse">
					{stats.map((stat) => (
						// flex-col-reverse: the value shows over its label, and the dt stays first for screen readers.
						<div
							key={stat.label}
							className="flex flex-col-reverse gap-0.5 px-2 py-3"
						>
							<dt className="text-muted-foreground text-sm">{stat.label}</dt>
							<dd className="font-numeric font-semibold text-lg tabular-nums">
								{stat.value}
							</dd>
						</div>
					))}
				</dl>
				<dl className="grid gap-3">
					{facts.map((fact) => (
						<div key={fact.label} className="flex items-center gap-3 text-sm">
							<dt>
								<fact.icon className="size-4 text-muted-foreground" />
								<span className="sr-only">{fact.label}</span>
							</dt>
							<dd className="min-w-0 truncate">{fact.value}</dd>
						</div>
					))}
				</dl>
			</CardContent>
		</Card>
	);
}

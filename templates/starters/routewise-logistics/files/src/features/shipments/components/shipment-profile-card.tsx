// The first card of the shipment page: the customer mark and name, three load figures, and the delivery facts.
// ShipmentDetailPage renders it at the top of its start column. It reads only the shipment detail.
// The phone line is a tel: link, so a click calls the recipient from a phone.
import {
	CalendarBlankIcon,
	MapPinIcon,
	NoteIcon,
	PhoneIcon,
	UserIcon,
	WarehouseIcon,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";
import {
	capitalize,
	distanceFormat,
	fillMessage,
	formatRelativeDay,
	initialsOf,
	isOpenStatus,
	telHref,
	weightFormat,
} from "~/features/logistics";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent } from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";
import type { ShipmentDetail } from "../api/shipments.queries";

type ShipmentProfileCardProps = {
	shipment: ShipmentDetail;
};

/** The figures box divides the width in three equal cells. Each fact row has a muted icon at the start. */
export function ShipmentProfileCard({ shipment }: ShipmentProfileCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const dueText = isOpenStatus(shipment.status)
		? `${date.format(new Date(shipment.dueAt))} · ${capitalize(formatRelativeDay(shipment.dueAt, Date.now(), locale), locale)}`
		: date.format(new Date(shipment.dueAt));
	const figures = [
		{ label: t("shipments.pallets"), value: number.format(shipment.pallets) },
		{
			label: t("shipments.weight"),
			value: weightFormat(locale).format(shipment.weightKg),
		},
		{
			label: t("shipment.distance"),
			value: distanceFormat(locale).format(shipment.recipient.distanceKm),
		},
	];

	return (
		<Card>
			<CardContent className="grid gap-8">
				<div className="flex flex-col items-center gap-4">
					<span
						aria-hidden="true"
						className="flex size-20 items-center justify-center rounded-full bg-muted font-display font-semibold text-2xl"
					>
						{initialsOf(shipment.customerName)}
					</span>
					<div className="grid justify-items-center gap-1 text-center">
						<p className="flex flex-wrap items-center justify-center gap-2 font-semibold text-xl">
							<span dir="auto">{shipment.customerName}</span>
							<Badge variant="info">
								{t(`serviceLevel.${shipment.service}`)}
							</Badge>
						</p>
						<p className="text-muted-foreground text-sm">
							{shipment.destination}
						</p>
					</div>
				</div>
				<dl className="grid grid-cols-3 divide-x rounded-md border bg-muted text-center rtl:divide-x-reverse">
					{figures.map((figure) => (
						<div key={figure.label} className="grid gap-0.5 px-1 py-3">
							{/* The value shows above its label. The order class keeps dt first, as a dl needs. */}
							<dt className="order-2 text-muted-foreground text-sm">
								{figure.label}
							</dt>
							<dd className="order-1 font-semibold text-lg tabular-nums">
								{figure.value}
							</dd>
						</div>
					))}
				</dl>
				<ul className="grid gap-4 text-sm">
					<FactRow icon={UserIcon} label={t("shipment.recipient")}>
						{shipment.recipient.contactName}
					</FactRow>
					<FactRow icon={PhoneIcon} label={t("shipment.phone")}>
						<a
							href={telHref(shipment.recipient.phone)}
							className="tabular-nums hover:underline"
						>
							{shipment.recipient.phone}
						</a>
					</FactRow>
					<FactRow icon={MapPinIcon} label={t("shipment.address")}>
						{`${shipment.recipient.street}, ${shipment.destination}`}
					</FactRow>
					<FactRow icon={WarehouseIcon} label={t("shipments.depot")}>
						{fillMessage(t("shipments.fromDepot"), {
							depot: shipment.depotName,
						})}
					</FactRow>
					<FactRow icon={CalendarBlankIcon} label={t("shipments.due")}>
						{dueText}
					</FactRow>
					<FactRow icon={NoteIcon} label={t("shipment.deliveryNote")}>
						<span className="text-muted-foreground" dir="auto">
							{shipment.recipient.deliveryNote}
						</span>
					</FactRow>
				</ul>
			</CardContent>
		</Card>
	);
}

type FactRowProps = {
	icon: KitIcon;
	/** The name of the fact for screen readers. The icon shows it to sighted users. */
	label: string;
	children: ReactNode;
};

// One fact: a muted icon and the value. The label is for screen readers only.
function FactRow({ icon: Icon, label, children }: FactRowProps) {
	return (
		<li className="flex items-start gap-3">
			<Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
			<span className="sr-only">{`${label}: `}</span>
			<span className="min-w-0">{children}</span>
		</li>
	);
}

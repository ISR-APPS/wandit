// The first card of the matter page: the client initials, the matter name and stage, three figures,
// and a list of facts with an icon each. It follows the profile card of the kit profile page.
// MatterDetailPage renders it at the top of the 1/3 column of the Overview tab.
import {
	BankIcon,
	CalendarBlankIcon,
	EnvelopeSimpleIcon,
	PhoneIcon,
	ScalesIcon,
	UserIcon,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";
import {
	type ClientRow,
	CURRENCY,
	fillMessage,
	hoursFormat,
	MatterStageBadge,
	PersonAvatar,
} from "~/features/practice";
import { useT } from "~/shared/i18n";
import { Card, CardContent } from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";
import type { MatterSummary } from "../lib/matter-joins";

type MatterProfileCardProps = {
	matter: MatterSummary;
	client: ClientRow;
	/** The translated role of the lead, for example "Partner". Empty when the lead is unknown. */
	leadRole: string;
	/** The count of upcoming deadlines of the matter. */
	deadlineCount: number;
};

/** The facts list names each value with an icon and a hidden label, so a screen reader hears what it is. */
export function MatterProfileCard({
	matter,
	client,
	leadRole,
	deadlineCount,
}: MatterProfileCardProps) {
	const { t, locale } = useT();
	// A compact amount ("$59.8K") fits the narrow figure cell at 1024 and 1280 px. The fee card shows the exact sum.
	const compactMoney = new Intl.NumberFormat(locale, {
		style: "currency",
		currency: CURRENCY,
		notation: "compact",
		maximumFractionDigits: 1,
	});
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
	const figures = [
		{
			id: "hours",
			label: t("matters.hours"),
			value: hoursFormat(locale).format(matter.ledger.hours),
		},
		{
			id: "billed",
			label: t("matters.billed"),
			value: compactMoney.format(matter.ledger.billed),
		},
		{
			id: "deadlines",
			label: t("matters.deadlines"),
			value: new Intl.NumberFormat(locale).format(deadlineCount),
		},
	];
	const facts: {
		id: string;
		icon: KitIcon;
		label: string;
		value: ReactNode;
	}[] = [
		{
			id: "email",
			icon: EnvelopeSimpleIcon,
			label: t("clients.email"),
			value: client.email,
		},
		{
			id: "phone",
			icon: PhoneIcon,
			label: t("clients.phone"),
			value: <bdi dir="ltr">{client.phone}</bdi>,
		},
		{
			id: "lead",
			icon: UserIcon,
			label: t("matters.lead"),
			value: leadRole ? `${matter.leadName} · ${leadRole}` : matter.leadName,
		},
		{
			id: "opposing",
			icon: ScalesIcon,
			label: t("matters.opposingParty"),
			value: matter.opposingParty ?? t("matters.noOpposingParty"),
		},
		{
			id: "venue",
			icon: BankIcon,
			label: t("matters.venue"),
			value: matter.venue ?? t("matters.noVenue"),
		},
		{
			id: "opened",
			icon: CalendarBlankIcon,
			label: t("matters.opened"),
			value: fillMessage(t("matters.openedOn"), {
				date: date.format(new Date(matter.openedAt)),
			}),
		},
	];

	return (
		<Card>
			<CardContent className="grid gap-8">
				<div className="grid justify-items-center gap-3 text-center">
					<PersonAvatar name={client.name} className="size-20 text-xl" />
					<div className="grid gap-1">
						<p
							className="flex flex-wrap items-center justify-center gap-2 font-display font-semibold text-xl"
							dir="auto"
						>
							{client.name}
							<MatterStageBadge stage={matter.stage} />
						</p>
						<p className="text-muted-foreground text-sm">
							{`${t(`areas.${matter.area}`)} · ${matter.number}`}
						</p>
					</div>
				</div>
				<dl className="grid grid-cols-3 divide-x rounded-md border bg-muted/40 rtl:divide-x-reverse">
					{figures.map((figure) => (
						<div key={figure.id} className="grid gap-0.5 px-2 py-3 text-center">
							{/* The label comes first for screen readers. The order classes show the value on top, as in the kit. */}
							<dt className="order-2 text-muted-foreground text-sm">
								{figure.label}
							</dt>
							<dd className="order-1 font-numeric font-semibold text-lg tabular-nums">
								{figure.value}
							</dd>
						</div>
					))}
				</dl>
				<dl className="grid gap-3 text-sm">
					{facts.map((fact) => (
						<div key={fact.id} className="flex items-start gap-3">
							<dt>
								<fact.icon className="mt-0.5 size-4 text-muted-foreground" />
								<span className="sr-only">{fact.label}</span>
							</dt>
							<dd className="min-w-0 break-words" dir="auto">
								{fact.value}
							</dd>
						</div>
					))}
				</dl>
			</CardContent>
		</Card>
	);
}

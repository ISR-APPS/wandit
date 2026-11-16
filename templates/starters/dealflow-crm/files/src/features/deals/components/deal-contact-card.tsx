// The contact card of the deal page: the main contact with mail and phone links, then the company facts.
// DealDetailPage renders it in the rail. It reads the contact and the company of the deal.
import {
	BuildingsIcon,
	EnvelopeSimpleIcon,
	PhoneIcon,
} from "@phosphor-icons/react";
import { fillMessage, PersonAvatar } from "~/features/crm";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Separator } from "~/shared/ui/separator";
import type { DealDetail } from "../api/deals.queries";

type DealContactCardProps = {
	deal: DealDetail;
};

/** The mail link opens the mail app, and the phone link starts a call. Both use the sample details of the contact. */
export function DealContactCard({ deal }: DealContactCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("deals.contact")}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-4">
				<div className="flex items-center gap-3">
					<PersonAvatar name={deal.contact.name} className="size-10 text-sm" />
					<div className="grid min-w-0 justify-items-start">
						<span className="font-medium text-sm" dir="auto">
							{deal.contact.name}
						</span>
						<span className="text-muted-foreground text-xs" dir="auto">
							{deal.contact.title}
						</span>
					</div>
				</div>
				<ul className="grid gap-2 text-sm">
					<li className="flex min-w-0 items-center gap-2">
						<EnvelopeSimpleIcon className="size-4 shrink-0 text-muted-foreground" />
						<a
							href={`mailto:${deal.contact.email}`}
							className="truncate underline decoration-border underline-offset-4 hover:decoration-ring"
							dir="ltr"
						>
							{deal.contact.email}
						</a>
					</li>
					<li className="flex items-center gap-2">
						<PhoneIcon className="size-4 shrink-0 text-muted-foreground" />
						<a
							href={`tel:${deal.contact.phone.replace(/[^\d+]/g, "")}`}
							className="tabular-nums underline decoration-border underline-offset-4 hover:decoration-ring"
							dir="ltr"
						>
							{deal.contact.phone}
						</a>
					</li>
				</ul>
				<Separator />
				<div className="flex items-start gap-3">
					<span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-accent text-accent-foreground">
						<BuildingsIcon className="size-5" />
					</span>
					<div className="grid min-w-0 justify-items-start gap-0.5">
						<span className="font-medium text-sm" dir="auto">
							{deal.companyName}
						</span>
						<span className="text-muted-foreground text-xs">
							{`${deal.company.industry} · ${deal.company.city}`}
						</span>
						<span className="text-muted-foreground text-xs tabular-nums">
							{fillMessage(t("deals.employees"), {
								count: number.format(deal.company.employees),
							})}
						</span>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

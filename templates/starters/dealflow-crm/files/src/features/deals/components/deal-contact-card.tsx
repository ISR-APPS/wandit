// The contact card of the deal page: the main contact with mail and phone links.
// DealDetailPage renders it in the facts column, under the facts card that names the company.
import { EnvelopeSimpleIcon, PhoneIcon } from "@phosphor-icons/react";
import { PersonAvatar } from "~/features/crm";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { DealDetail } from "../api/deals.queries";

type DealContactCardProps = {
	deal: DealDetail;
};

/** The mail link opens the mail app, and the phone link starts a call. Both use the sample details of the contact. */
export function DealContactCard({ deal }: DealContactCardProps) {
	const { t } = useT();
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
			</CardContent>
		</Card>
	);
}

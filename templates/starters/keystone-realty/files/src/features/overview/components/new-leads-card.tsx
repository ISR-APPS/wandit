// The new leads card of the home: the four newest leads with their area and a call button.
// OverviewPage renders it at the start of the third band. A name opens the panel of the lead.
// The call button is a tel: link, so the phone or the desktop app of the user places the call.
import { ArrowUpRightIcon, PhoneIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { fillMessage, type LeadRow, PersonAvatar } from "~/features/agency";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";

type NewLeadsCardProps = {
	/** The newest leads, newest first, at most 4. */
	leads: LeadRow[];
};

/** No lead yet: one sentence. */
export function NewLeadsCard({ leads }: NewLeadsCardProps) {
	const { t } = useT();
	return (
		<Card className="gap-2">
			<CardHeader>
				<CardTitle>{t("overview.newLeads.title")}</CardTitle>
				<CardAction>
					<Button
						asChild
						variant="ghost"
						size="icon"
						className="size-8 rounded-full"
					>
						<Link to="/app/leads" aria-label={t("overview.newLeads.all")}>
							<ArrowUpRightIcon className="rtl:-scale-x-100" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-1">
				{leads.length === 0 ? (
					<p className="py-8 text-center text-muted-foreground text-sm">
						{t("overview.newLeads.empty")}
					</p>
				) : (
					leads.map((lead) => (
						<div
							key={lead.id}
							className="flex items-center justify-between gap-2 rounded-lg p-2 hover:bg-muted"
						>
							<div className="flex min-w-0 items-center gap-3">
								<PersonAvatar fullName={lead.fullName} className="size-9" />
								<div className="grid min-w-0 gap-1">
									<Link
										to="/app/leads"
										search={{ lead: lead.id }}
										className="truncate font-medium hover:underline"
										dir="auto"
									>
										{lead.fullName}
									</Link>
									<p className="truncate text-muted-foreground text-xs">
										{lead.listingStreet ?? lead.area}
									</p>
								</div>
							</div>
							<Button
								asChild
								variant="outline"
								size="icon"
								className="size-7 shrink-0 rounded-full"
							>
								<a
									href={`tel:${lead.phone.replaceAll(" ", "")}`}
									aria-label={fillMessage(t("overview.newLeads.call"), {
										name: lead.fullName,
									})}
								>
									<PhoneIcon className="size-3.5" />
								</a>
							</Button>
						</div>
					))
				)}
			</CardContent>
		</Card>
	);
}

// The interested leads card of a listing detail page: the newest leads of the home with their email
// and one email button each. ListingDetailPage renders it beside the offers.
// The arrow button in the head opens the Enquiries tab, which lists every lead of the home.
import { CaretRightIcon } from "@phosphor-icons/react";
import { type LeadRow, PersonAvatar } from "~/features/agency";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/shared/ui/tooltip";

// Five people keep the card short. "Show all enquiries" opens the Enquiries tab.
const SHOWN_LEADS = 5;

type ListingLeadsCardProps = {
	/** The leads of this home, newest first. */
	leads: LeadRow[];
	/** Opens the Enquiries tab of the page. */
	onShowAll: () => void;
};

/** A lead with no answer yet gets the filled "Answer" button: it is the next thing to do. */
export function ListingLeadsCard({ leads, onShowAll }: ListingLeadsCardProps) {
	const { t } = useT();
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("listings.leadsTitle")}</CardTitle>
				<CardAction>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								type="button"
								variant="outline"
								size="icon"
								aria-label={t("listings.allEnquiries")}
								onClick={onShowAll}
							>
								<CaretRightIcon className="rtl:rotate-180" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>{t("listings.allEnquiries")}</TooltipContent>
					</Tooltip>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-4">
				{leads.length === 0 ? (
					<p className="py-8 text-center text-muted-foreground text-sm">
						{t("listings.noEnquiries")}
					</p>
				) : (
					leads.slice(0, SHOWN_LEADS).map((lead) => (
						<div
							key={lead.id}
							className="flex items-center justify-between gap-3"
						>
							<div className="flex min-w-0 items-center gap-4">
								<PersonAvatar fullName={lead.fullName} className="size-9" />
								<div className="grid min-w-0">
									<span className="truncate font-medium" dir="auto">
										{lead.fullName}
									</span>
									<span className="truncate text-muted-foreground text-xs">
										{lead.email}
									</span>
								</div>
							</div>
							<Button
								asChild
								size="sm"
								variant={lead.status === "new" ? "default" : "outline"}
							>
								<a href={`mailto:${lead.email}`}>
									{lead.status === "new"
										? t("listings.answer")
										: t("leads.email")}
								</a>
							</Button>
						</div>
					))
				)}
			</CardContent>
		</Card>
	);
}

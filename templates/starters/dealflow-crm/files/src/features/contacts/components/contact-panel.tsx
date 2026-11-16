// The contact panel: one person, their mail and phone links, their deals, and their last activities.
// ContactSheet renders it inside the side sheet. The sheet parts give the title and the description to screen readers.
// The deals and the activities load after the click, so each list has its own loading and error state.
import { EnvelopeSimpleIcon, PhoneIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
	ActivityTimeline,
	contactActivitiesQueryOptions,
} from "~/features/activities";
import { DealStageBadge, moneyFormat, PersonAvatar } from "~/features/crm";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { SheetDescription, SheetHeader, SheetTitle } from "~/shared/ui/sheet";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	type Contact,
	contactDealsQueryOptions,
} from "../api/contacts.queries";

type ListStateProps = {
	isPending: boolean;
	isError: boolean;
	/** Reads the list again after an error. */
	onRetry: () => void;
	/** The list, shown when the read is done. */
	children: ReactNode;
};

/** The loading and the error state of one list of the panel. */
function ListState({ isPending, isError, onRetry, children }: ListStateProps) {
	const { t } = useT();
	if (isPending) {
		return (
			<div className="grid gap-2">
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-10 w-full" />
			</div>
		);
	}
	if (isError) {
		return (
			<div className="grid justify-items-start gap-2">
				<p className="text-sm" role="alert">
					{t("contacts.panelError")}
				</p>
				<Button type="button" variant="outline" size="sm" onClick={onRetry}>
					{t("common.retry")}
				</Button>
			</div>
		);
	}
	return children;
}

type ContactPanelProps = {
	/** The person of the panel, a row of the contact list. */
	contact: Contact;
};

/** Must sit inside a SheetContent: it uses the sheet title and description parts. */
export function ContactPanel({ contact }: ContactPanelProps) {
	const { t, locale } = useT();
	const deals = useQuery(contactDealsQueryOptions(contact.id));
	const activities = useQuery(contactActivitiesQueryOptions(contact.id));
	const money = moneyFormat(locale);
	const now = Date.now();

	return (
		<>
			<SheetHeader className="gap-4 border-b p-6">
				<div className="flex items-center gap-3 pe-8">
					<PersonAvatar name={contact.name} className="size-12 text-base" />
					<div className="grid min-w-0 justify-items-start gap-0.5">
						<SheetTitle
							className="font-display text-lg leading-tight"
							dir="auto"
						>
							{contact.name}
						</SheetTitle>
						<SheetDescription dir="auto">
							{`${contact.title} · ${contact.companyName}`}
						</SheetDescription>
					</div>
				</div>
				<ul className="grid gap-2 text-sm">
					<li className="flex min-w-0 items-center gap-2">
						<EnvelopeSimpleIcon className="size-4 shrink-0 text-muted-foreground" />
						<a
							href={`mailto:${contact.email}`}
							className="truncate underline decoration-border underline-offset-4 hover:decoration-ring"
							dir="ltr"
						>
							{contact.email}
						</a>
					</li>
					<li className="flex items-center gap-2">
						<PhoneIcon className="size-4 shrink-0 text-muted-foreground" />
						<a
							href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
							className="tabular-nums underline decoration-border underline-offset-4 hover:decoration-ring"
							dir="ltr"
						>
							{contact.phone}
						</a>
					</li>
				</ul>
			</SheetHeader>
			<div className="grid gap-8 p-6">
				<section className="grid gap-3">
					<h3 className="font-sans font-semibold text-sm">
						{t("contacts.dealsOfContact")}
					</h3>
					<ListState
						isPending={deals.isPending}
						isError={deals.isError}
						onRetry={() => deals.refetch()}
					>
						{deals.data?.length ? (
							<ul className="grid divide-y rounded-surface border">
								{deals.data.map((deal) => (
									<li key={deal.id}>
										<Link
											to="/app/deals/$dealId"
											params={{ dealId: deal.id }}
											className="flex items-center justify-between gap-3 px-3 py-2.5 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50"
										>
											<span className="grid min-w-0 justify-items-start gap-1">
												<span
													className="truncate font-medium text-sm"
													dir="auto"
												>
													{deal.name}
												</span>
												<DealStageBadge stage={deal.stage} />
											</span>
											<span className="font-medium text-sm tabular-nums">
												{money.format(deal.amount)}
											</span>
										</Link>
									</li>
								))}
							</ul>
						) : (
							<p className="text-muted-foreground text-sm">
								{t("contacts.noDeals")}
							</p>
						)}
					</ListState>
				</section>
				<section className="grid gap-3">
					<h3 className="font-sans font-semibold text-sm">
						{t("contacts.recentActivity")}
					</h3>
					<ListState
						isPending={activities.isPending}
						isError={activities.isError}
						onRetry={() => activities.refetch()}
					>
						{activities.data?.length ? (
							<ActivityTimeline
								activities={activities.data}
								now={now}
								showDeal
							/>
						) : (
							<p className="text-muted-foreground text-sm">
								{t("contacts.noActivity")}
							</p>
						)}
					</ListState>
				</section>
			</div>
		</>
	);
}

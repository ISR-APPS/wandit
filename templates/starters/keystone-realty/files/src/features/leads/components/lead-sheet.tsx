// The side panel of one lead: the contact actions, the message, the interest, the facts, the viewings, and the history.
// LeadsPage opens it when the URL has a `lead` search param. A lead name in a table sets that param.
// It reads one row of the leads query and the viewings of that lead. The email and call buttons are real links.
import { EnvelopeSimpleIcon, PhoneIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	ANSWER_TARGET_HOURS,
	fillMessage,
	formatDuration,
	formatWaitingTime,
	InterestBadge,
	type LeadRow,
	LeadStatusBadge,
	moneyFormat,
	PersonAvatar,
	PropertyTile,
	type ViewingRow,
	ViewingStatusBadge,
} from "~/features/agency";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import { Separator } from "~/shared/ui/separator";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "~/shared/ui/sheet";
import { describeInterest } from "../lib/lead-interest";

type LeadSheetProps = {
	/** The lead to show. The panel keeps it while it slides out. */
	lead: LeadRow | undefined;
	/** The viewings of this lead, oldest first. */
	viewings: ViewingRow[];
	/** True while the URL names this lead. */
	open: boolean;
	/** Removes the `lead` search param. */
	onClose: () => void;
};

/** A Sheet at the end side. A lead with no answer shows how long it waits, against the target of the agency. */
export function LeadSheet({ lead, viewings, open, onClose }: LeadSheetProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const dateTime = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	});
	const now = Date.now();
	const history = lead
		? [
				{
					id: "received",
					label: t("leads.history.received"),
					at: lead.createdAt,
				},
				...(lead.firstResponseAt === null
					? []
					: [
							{
								id: "answered",
								label: fillMessage(t("leads.history.answered"), {
									agent: lead.agentName,
								}),
								at: lead.firstResponseAt,
							},
						]),
				...viewings
					.filter((viewing) => viewing.status !== "cancelled")
					.map((viewing) => ({
						id: viewing.id,
						label: fillMessage(t("leads.history.viewing"), {
							home: viewing.listingStreet,
						}),
						at: viewing.startsAt,
					})),
				...(lead.offerAt === null || lead.offerAmount === null
					? []
					: [
							{
								id: "offer",
								label: fillMessage(t("leads.history.offer"), {
									amount: money.format(lead.offerAmount),
								}),
								at: lead.offerAt,
							},
						]),
				...(lead.closedAt === null
					? []
					: [
							{
								id: "closed",
								label:
									lead.lostReason === null
										? t(
												lead.interest === "sell"
													? "leads.history.wonSeller"
													: "leads.history.wonBuyer",
											)
										: fillMessage(t("leads.history.lost"), {
												reason: t(`agency.lostReasons.${lead.lostReason}`),
											}),
								at: lead.closedAt,
							},
						]),
			].sort((first, second) => Date.parse(second.at) - Date.parse(first.at))
		: [];

	return (
		<Sheet
			open={open}
			onOpenChange={(next) => {
				if (!next) {
					onClose();
				}
			}}
		>
			<SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
				{lead ? (
					<>
						<SheetHeader className="gap-4 p-6">
							<div className="flex items-center gap-3 pe-8">
								<PersonAvatar fullName={lead.fullName} className="size-12" />
								<div className="grid min-w-0 gap-1">
									<SheetTitle
										className="truncate font-display font-semibold text-2xl leading-tight"
										dir="auto"
									>
										{lead.fullName}
									</SheetTitle>
									<SheetDescription className="flex flex-wrap items-center gap-2">
										<LeadStatusBadge status={lead.status} />
										<span>
											{`${t(`leads.interests.${lead.interest}`)} · ${t(`agency.leadSources.${lead.source}`)}`}
										</span>
									</SheetDescription>
								</div>
							</div>
							{lead.status === "new" ? (
								<p
									className={cn(
										"rounded-md px-3 py-2 text-sm",
										lead.isLate
											? "bg-destructive/10 text-destructive"
											: "bg-warning/12 text-warning",
									)}
								>
									{fillMessage(t("leads.waiting"), {
										time: formatWaitingTime(lead.createdAt, now, locale),
										hours: new Intl.NumberFormat(locale).format(
											ANSWER_TARGET_HOURS,
										),
									})}
								</p>
							) : null}
							<div className="grid grid-cols-2 gap-2">
								<Button asChild>
									<a href={`mailto:${lead.email}`}>
										<EnvelopeSimpleIcon />
										{t("leads.email")}
									</a>
								</Button>
								<Button asChild variant="outline">
									<a href={`tel:${lead.phone}`}>
										<PhoneIcon />
										{t("leads.call")}
									</a>
								</Button>
							</div>
						</SheetHeader>
						<Separator />
						<div className="grid gap-6 p-6">
							<section className="grid gap-2">
								<h3 className="font-sans font-semibold text-sm">
									{t("leads.message")}
								</h3>
								<p
									className="rounded-md bg-muted px-3 py-2.5 text-sm"
									dir="auto"
								>
									{lead.message}
								</p>
							</section>
							<section className="grid gap-2">
								<h3 className="font-sans font-semibold text-sm">
									{t("leads.interest")}
								</h3>
								{lead.listingId !== null && lead.listingType !== null ? (
									<Link
										to="/app/listings/$listingId"
										params={{ listingId: lead.listingId }}
										className="flex items-center gap-3 rounded-md border p-3 outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
									>
										<PropertyTile type={lead.listingType} />
										<span className="grid min-w-0 flex-1">
											<span className="truncate font-medium text-sm">
												{lead.listingStreet}
											</span>
											<span className="text-muted-foreground text-xs">
												{`${lead.area} · ${lead.listingId}`}
											</span>
										</span>
										{lead.listingPrice === null ? null : (
											<span className="font-numeric text-sm tabular-nums">
												{money.format(lead.listingPrice)}
											</span>
										)}
									</Link>
								) : (
									<p className="text-sm">
										{describeInterest(lead, t)}
										{lead.sellType === null
											? null
											: ` · ${t(`agency.propertyTypes.${lead.sellType}`)}`}
									</p>
								)}
							</section>
							<dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
								<div className="col-span-2 grid gap-0.5">
									<dt className="text-muted-foreground text-xs">
										{t("leads.contact")}
									</dt>
									<dd>{lead.email}</dd>
									<dd className="tabular-nums">{lead.phone}</dd>
								</div>
								{lead.budget === null ? null : (
									<div className="grid gap-0.5">
										<dt className="text-muted-foreground text-xs">
											{t("leads.budget")}
										</dt>
										<dd className="tabular-nums">
											{money.format(lead.budget)}
										</dd>
									</div>
								)}
								{lead.financing === null ? null : (
									<div className="grid gap-0.5">
										<dt className="text-muted-foreground text-xs">
											{t("leads.financing")}
										</dt>
										<dd>{t(`agency.financing.${lead.financing}`)}</dd>
									</div>
								)}
								<div className="grid gap-0.5">
									<dt className="text-muted-foreground text-xs">
										{t("leads.agent")}
									</dt>
									<dd>{lead.agentName}</dd>
								</div>
								<div className="grid gap-0.5">
									<dt className="text-muted-foreground text-xs">
										{t("leads.answerTime")}
									</dt>
									<dd className="tabular-nums">
										{lead.answerMinutes === null
											? t("leads.noAnswerYet")
											: formatDuration(lead.answerMinutes, locale)}
									</dd>
								</div>
							</dl>
							{viewings.length === 0 ? null : (
								<section className="grid gap-2">
									<h3 className="font-sans font-semibold text-sm">
										{t("leads.viewings")}
									</h3>
									<ul className="grid gap-3">
										{viewings.map((viewing) => (
											<li key={viewing.id} className="grid gap-1">
												<div className="flex flex-wrap items-center gap-2">
													<span className="font-medium text-sm tabular-nums">
														{dateTime.format(new Date(viewing.startsAt))}
													</span>
													<ViewingStatusBadge status={viewing.status} />
													{viewing.interest === null ? null : (
														<InterestBadge interest={viewing.interest} />
													)}
												</div>
												{viewing.feedback === null ? null : (
													<p className="text-muted-foreground text-sm">
														{viewing.feedback}
													</p>
												)}
											</li>
										))}
									</ul>
								</section>
							)}
							<section className="grid gap-3">
								<h3 className="font-sans font-semibold text-sm">
									{t("leads.history.title")}
								</h3>
								<ol className="ms-1.5 grid gap-4 border-s ps-5">
									{history.map((step, index) => (
										<li key={step.id} className="relative grid gap-0.5">
											{/* The dot sits on the line: half of its width goes over the start edge of the list. */}
											<span
												aria-hidden="true"
												className={cn(
													"absolute -start-6.5 top-1 size-3 rounded-full border bg-background",
													index === 0 && "border-primary bg-primary",
												)}
											/>
											<p className="text-sm">{step.label}</p>
											<p className="text-muted-foreground text-xs tabular-nums">
												{dateTime.format(new Date(step.at))}
											</p>
										</li>
									))}
								</ol>
							</section>
						</div>
					</>
				) : null}
			</SheetContent>
		</Sheet>
	);
}

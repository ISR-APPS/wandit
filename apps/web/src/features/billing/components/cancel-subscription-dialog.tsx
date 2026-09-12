/**
 * Shows the cancellation reason form and the Starter retention offer.
 * The billing page supplies the offer and handles the selected action.
 * Validates cancellation details with the shared billing request parser.
 */
import type {
	BillingCancelRequest,
	CancellationReasonCode,
} from "@wandit/contracts";
import { formatDate, type Locale } from "@wandit/internationalization";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@wandit/ui/components/alert-dialog";
import { Button } from "@wandit/ui/components/button";
import { Textarea } from "@wandit/ui/components/textarea";
import { useState } from "react";
import { useDictionary, useTranslation } from "@/lib/i18n";
import type { StarterCancelOffer } from "../lib/billing-ui-policy";
import { parseBillingCancelRequest } from "../lib/cancel-subscription";
import { formatUsd } from "../lib/plan-pricing";

const CANCELLATION_REASON_CODES = [
	"too_expensive",
	"not_using_enough",
	"missing_features",
	"technical_issues",
	"switching_provider",
	"temporary_pause",
	"other",
] as const satisfies readonly CancellationReasonCode[];

/** Accepting Starter opens the plan picker. Only the reason form requests cancellation. */
export function CancelSubscriptionDialog({
	pending,
	onConfirm,
	starterOffer,
	onAcceptStarterOffer,
	periodEnd,
	locale,
}: {
	pending: boolean;
	onConfirm: (request: BillingCancelRequest) => void;
	starterOffer: StarterCancelOffer | null;
	onAcceptStarterOffer: () => void;
	periodEnd: string;
	locale: Locale;
}) {
	const { t } = useTranslation();
	const billingCopy = useDictionary().billing;
	const copy = billingCopy.page;
	const [open, setOpen] = useState(false);
	const [reason, setReason] = useState<CancellationReasonCode | null>(null);
	const [details, setDetails] = useState("");
	const request = parseBillingCancelRequest(reason, details);
	// The Other reason requires details before the shared request schema accepts it.
	const detailsRequired = reason === "other" && details.trim().length === 0;

	const handleOpenChange = (nextOpen: boolean) => {
		setOpen(nextOpen);
		if (!nextOpen) {
			setReason(null);
			setDetails("");
		}
	};

	return (
		<AlertDialog open={open} onOpenChange={handleOpenChange}>
			<AlertDialogTrigger asChild>
				<Button type="button" variant="ghost" className="text-destructive">
					{copy.cancelPlan}
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
				<AlertDialogHeader>
					<AlertDialogTitle>{copy.cancelTitle}</AlertDialogTitle>
					<AlertDialogDescription>{copy.cancelBody}</AlertDialogDescription>
				</AlertDialogHeader>
				{/* The billing page decides who is eligible; null hides the offer. */}
				{starterOffer ? (
					<>
						<section
							className="space-y-3 rounded-xl border border-primary/30 bg-primary/[0.04] p-4"
							aria-labelledby="starter-cancel-offer-title"
						>
							<h3
								id="starter-cancel-offer-title"
								className="font-semibold text-base"
							>
								{copy.cancelOffer.title}
							</h3>
							<div className="flex flex-wrap items-baseline justify-between gap-2">
								<span className="font-medium">
									{billingCopy.planPicker.starterName}
								</span>
								<p className="text-sm">
									<span className="font-semibold">
										{formatUsd(starterOffer.priceUsd, locale)}
									</span>{" "}
									<span className="text-muted-foreground">
										{starterOffer.interval === "year"
											? billingCopy.planPicker.perYear
											: billingCopy.planPicker.perMonth}
									</span>
								</p>
							</div>
							<p className="text-sm">
								{t("billing.planPicker.creditsEveryMonth", {
									count: starterOffer.tierCredits,
								})}
							</p>
							<p className="text-muted-foreground text-sm">
								{t("billing.page.cancelOffer.body", {
									date: formatDate(periodEnd, locale, { dateStyle: "medium" }),
								})}
							</p>
							<Button
								type="button"
								className="w-full"
								disabled={pending}
								onClick={() => {
									handleOpenChange(false);
									onAcceptStarterOffer();
								}}
							>
								{copy.cancelOffer.cta}
							</Button>
						</section>
						<p className="text-muted-foreground text-sm">
							{copy.cancelOffer.orCancel}
						</p>
					</>
				) : null}
				<fieldset className="space-y-2">
					<legend className="font-medium text-sm">
						{copy.cancelReasonPrompt}
					</legend>
					<div className="grid gap-2">
						{CANCELLATION_REASON_CODES.map((reasonCode) => (
							<label
								key={reasonCode}
								className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-muted/40 has-[:disabled]:cursor-not-allowed has-[:checked]:border-primary/50 has-[:checked]:bg-primary/[0.04] has-[:disabled]:opacity-50"
							>
								<input
									type="radio"
									name="cancellation-reason"
									value={reasonCode}
									checked={reason === reasonCode}
									disabled={pending}
									required
									className="size-4 shrink-0 accent-primary"
									onChange={() => setReason(reasonCode)}
								/>
								<span>{copy.cancelReasons[reasonCode]}</span>
							</label>
						))}
					</div>
				</fieldset>
				<div className="space-y-2">
					<label htmlFor="cancellation-details" className="font-medium text-sm">
						{copy.cancelDetailsLabel}
						{reason === "other" ? null : (
							<span className="ms-1 font-normal text-muted-foreground">
								{copy.cancelDetailsOptional}
							</span>
						)}
					</label>
					{/* Match the request schema limit and keep a compact details field. */}
					<Textarea
						id="cancellation-details"
						value={details}
						disabled={pending}
						required={reason === "other"}
						maxLength={1000}
						rows={3}
						placeholder={copy.cancelDetailsPlaceholder}
						aria-invalid={detailsRequired || undefined}
						aria-describedby={
							detailsRequired ? "cancellation-details-error" : undefined
						}
						onChange={(event) => setDetails(event.target.value)}
					/>
					{detailsRequired ? (
						<p
							id="cancellation-details-error"
							className="text-destructive text-xs"
						>
							{copy.cancelDetailsRequired}
						</p>
					) : null}
				</div>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={pending}>
						{copy.keepPlan}
					</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						disabled={pending || !request.success}
						onClick={() => {
							if (request.success) {
								onConfirm(request.data);
							}
						}}
					>
						{pending ? copy.cancelling : copy.confirmCancel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

import type { BillingInterval, BillingPlanId } from "@wandit/contracts";
import { CalendarPlusIcon, Loader2Icon } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { AdminRenewManualSubscriptionInput } from "@/features/offline-billing/api/offline-billing.dto";
import { useRenewManualSubscriptionMutation } from "@/features/offline-billing/api/offline-billing.mutations";
import {
	computeDefaultRenewalEnd,
	dateTimeLocalToIso,
	type ManualPaymentFormInput,
	mapManualPaymentFormDto,
	toDateTimeLocalValue,
} from "@/features/offline-billing/lib/offline-billing";
import { isApiClientError } from "@/lib/api-client";

import { ManualPaymentFields } from "./manual-payment-fields";

const PLAN_NAMES = {
	starter: "Starter",
	pro: "Pro",
	business: "Business",
} as const satisfies Record<BillingPlanId, string>;

export type RenewableManualSubscription = {
	id: string;
	plan: BillingPlanId;
	interval: BillingInterval;
	/** Current tier, when known — used to warn about change requests. */
	tierCredits?: number;
	currentPeriodEnd: string | null;
	entitled: boolean;
	ownerLabel?: string;
};

/** What an open request asked for, when renewing from a request row. */
export type RequestedManualPlan = {
	plan: BillingPlanId;
	interval: BillingInterval;
	tierCredits: number;
};

type RenewManualSubscriptionDialogProps = {
	subscription: RenewableManualSubscription;
	/** Open renewal/change request to approve and link on success. */
	requestId?: string;
	/** The request's desired plan, to warn when it differs from the current one. */
	requested?: RequestedManualPlan;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function RenewManualSubscriptionDialog(
	props: RenewManualSubscriptionDialogProps,
) {
	if (!props.open) {
		return null;
	}

	return <OpenRenewManualSubscriptionDialog {...props} />;
}

function OpenRenewManualSubscriptionDialog({
	subscription,
	requestId,
	requested,
	onOpenChange,
}: RenewManualSubscriptionDialogProps) {
	// Renew keeps the subscription's EXISTING tier and cycle. A change request
	// that asks for something else needs End + "Approve & grant" instead —
	// warn loudly so the request is not silently approved at the old plan.
	const requestMismatch =
		requested !== undefined &&
		(requested.plan !== subscription.plan ||
			requested.interval !== subscription.interval ||
			(subscription.tierCredits !== undefined &&
				requested.tierCredits !== subscription.tierCredits));
	const now = useRef(new Date()).current;
	const renewalAnchor =
		subscription.entitled &&
		subscription.currentPeriodEnd &&
		new Date(subscription.currentPeriodEnd).getTime() > now.getTime()
			? new Date(subscription.currentPeriodEnd)
			: now;
	const [periodEnd, setPeriodEnd] = useState(
		toDateTimeLocalValue(
			computeDefaultRenewalEnd(
				subscription.currentPeriodEnd,
				subscription.interval,
				now,
				subscription.entitled,
			),
		),
	);
	const [payment, setPayment] = useState<ManualPaymentFormInput>({
		method: "cash_on_delivery",
		majorAmount: "",
		currency: "DZD",
		reference: "",
		note: "",
	});
	const [submitted, setSubmitted] = useState(false);
	const idempotencyRef = useRef<{ key: string; id: string } | null>(null);
	const mutation = useRenewManualSubscriptionMutation();
	const periodEndIso = dateTimeLocalToIso(periodEnd);
	const periodEndIsValid =
		periodEndIso !== null &&
		new Date(periodEndIso).getTime() > renewalAnchor.getTime();
	const paymentDto = mapManualPaymentFormDto(payment);

	function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen && mutation.isPending) {
			return;
		}
		onOpenChange(nextOpen);
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSubmitted(true);

		if (!periodEndIso || !periodEndIsValid || !paymentDto) {
			return;
		}

		const payload: Omit<AdminRenewManualSubscriptionInput, "idempotencyKey"> = {
			periodEnd: periodEndIso,
			payment: paymentDto,
			...(requestId ? { requestId } : {}),
		};
		const payloadKey = JSON.stringify(payload);
		if (idempotencyRef.current?.key !== payloadKey) {
			idempotencyRef.current = {
				key: payloadKey,
				id: crypto.randomUUID(),
			};
		}

		try {
			await mutation.mutateAsync({
				subscriptionId: subscription.id,
				body: {
					...payload,
					idempotencyKey: idempotencyRef.current.id,
				},
			});
			toast.success(
				`Offline subscription renewed${subscription.ownerLabel ? ` for ${subscription.ownerLabel}` : ""}.`,
			);
			onOpenChange(false);
		} catch (error) {
			toast.error(
				isApiClientError(error)
					? error.message
					: "The offline subscription could not be renewed. Please try again.",
			);
		}
	}

	return (
		<Dialog open onOpenChange={handleOpenChange}>
			<DialogContent className="max-h-[min(92vh,50rem)] overflow-y-auto sm:max-w-2xl">
				<form
					onSubmit={handleSubmit}
					className="flex flex-col gap-6"
					noValidate
				>
					<DialogHeader>
						<div className="flex items-center gap-3">
							<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
								<CalendarPlusIcon aria-hidden="true" />
							</div>
							<div>
								<DialogTitle>Renew offline subscription</DialogTitle>
								<DialogDescription className="mt-1">
									Record the renewal payment and fund the next period.
								</DialogDescription>
							</div>
						</div>
					</DialogHeader>

					{requestMismatch && requested ? (
						<div
							role="alert"
							className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm"
						>
							<p className="font-medium">
								This request asks for a different plan.
							</p>
							<p className="mt-1 text-muted-foreground">
								Requested: {PLAN_NAMES[requested.plan]} ·{" "}
								{requested.tierCredits.toLocaleString("en-US")} credits /{" "}
								{requested.interval === "year" ? "yearly" : "monthly"}
								{subscription.tierCredits !== undefined
									? ` — current: ${PLAN_NAMES[subscription.plan]} · ${subscription.tierCredits.toLocaleString("en-US")} credits / ${subscription.interval === "year" ? "yearly" : "monthly"}`
									: ""}
								. Renew keeps the current plan. To change it, end the current
								subscription first, then use “Approve &amp; grant”.
							</p>
						</div>
					) : null}

					<FieldGroup className="gap-6">
						<Field>
							<FieldLabel>Current subscription</FieldLabel>
							<div className="rounded-md border px-3 py-2 text-sm">
								<span className="font-medium">
									{PLAN_NAMES[subscription.plan]}
								</span>
								{subscription.tierCredits !== undefined
									? ` · ${subscription.tierCredits.toLocaleString("en-US")} credits`
									: ""}
								{" · "}
								{subscription.interval === "year" ? "Yearly" : "Monthly"}
							</div>
						</Field>

						<Field data-invalid={submitted && !periodEndIsValid}>
							<FieldLabel htmlFor="manual-renew-period-end">
								New period end
							</FieldLabel>
							<Input
								id="manual-renew-period-end"
								type="datetime-local"
								value={periodEnd}
								onChange={(event) => setPeriodEnd(event.target.value)}
								disabled={mutation.isPending}
								aria-invalid={submitted && !periodEndIsValid}
							/>
							<FieldError>
								{submitted && !periodEndIsValid
									? "The new end must be after the renewal period starts."
									: null}
							</FieldError>
						</Field>

						<div className="space-y-3 border-t pt-5">
							<h3 className="font-medium text-sm">Renewal payment</h3>
							<ManualPaymentFields
								idPrefix="manual-renew-payment"
								value={payment}
								onChange={setPayment}
								submitted={submitted}
								disabled={mutation.isPending}
							/>
						</div>
					</FieldGroup>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => handleOpenChange(false)}
							disabled={mutation.isPending}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={mutation.isPending}>
							{mutation.isPending ? (
								<Loader2Icon
									className="animate-spin"
									data-icon="inline-start"
									aria-hidden="true"
								/>
							) : (
								<CalendarPlusIcon data-icon="inline-start" aria-hidden="true" />
							)}
							{mutation.isPending ? "Renewing…" : "Record renewal"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

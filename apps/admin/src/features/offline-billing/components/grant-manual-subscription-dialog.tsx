import {
	type BillingInterval,
	type BillingPlanId,
	CREDIT_TIERS,
	type CreditTier,
	priceUsdFor,
} from "@wandit/contracts";
import { HandCoinsIcon, Loader2Icon } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
	AdminGrantManualSubscriptionInput,
	ManualBillingUserReference,
} from "@/features/offline-billing/api/offline-billing.dto";
import { useGrantManualSubscriptionMutation } from "@/features/offline-billing/api/offline-billing.mutations";
import {
	computeDefaultPeriod,
	dateTimeLocalToIso,
	type ManualPaymentFormInput,
	mapManualPaymentFormDto,
	toDateTimeLocalValue,
	trimmedOptional,
} from "@/features/offline-billing/lib/offline-billing";
import { isApiClientError } from "@/lib/api-client";

import { ManualBillingUserPicker } from "./manual-billing-user-picker";
import { ManualPaymentFields } from "./manual-payment-fields";

export type GrantManualSubscriptionPrefill = {
	user?: ManualBillingUserReference;
	organization?: { id: string; name: string };
	tierCredits?: number;
	interval?: BillingInterval;
	requestId?: string;
	adminNotes?: string | null;
};

type GrantManualSubscriptionDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	prefill?: GrantManualSubscriptionPrefill;
};

export function GrantManualSubscriptionDialog(
	props: GrantManualSubscriptionDialogProps,
) {
	if (!props.open) {
		return null;
	}

	return <OpenGrantManualSubscriptionDialog {...props} />;
}

function OpenGrantManualSubscriptionDialog({
	onOpenChange,
	prefill = {},
}: GrantManualSubscriptionDialogProps) {
	const plan: BillingPlanId = prefill.organization ? "business" : "pro";
	const prefilledTierIsCatalogued = CREDIT_TIERS.includes(
		prefill.tierCredits as (typeof CREDIT_TIERS)[number],
	);
	const initialTier =
		prefill.tierCredits === undefined
			? CREDIT_TIERS[0]
			: prefilledTierIsCatalogued
				? (prefill.tierCredits as CreditTier)
				: null;
	const initialInterval = prefill.interval ?? "month";
	const initialPeriod = computeDefaultPeriod(new Date(), initialInterval);
	const [user, setUser] = useState<ManualBillingUserReference | null>(
		prefill.user ?? null,
	);
	const [tierCredits, setTierCredits] = useState<CreditTier | null>(
		initialTier,
	);
	const [interval, setInterval] = useState<BillingInterval>(initialInterval);
	const [periodStart, setPeriodStart] = useState(
		toDateTimeLocalValue(initialPeriod.periodStart),
	);
	const [periodEnd, setPeriodEnd] = useState(
		toDateTimeLocalValue(initialPeriod.periodEnd),
	);
	const [payment, setPayment] = useState<ManualPaymentFormInput>({
		method: "cash_on_delivery",
		majorAmount: "",
		currency: "DZD",
		reference: "",
		note: "",
	});
	const [adminNotes, setAdminNotes] = useState(prefill.adminNotes ?? "");
	const [submitted, setSubmitted] = useState(false);
	const idempotencyRef = useRef<{ key: string; id: string } | null>(null);
	const mutation = useGrantManualSubscriptionMutation();
	const periodStartIso = dateTimeLocalToIso(periodStart);
	const periodEndIso = dateTimeLocalToIso(periodEnd);
	const periodIsValid =
		periodStartIso !== null &&
		periodEndIso !== null &&
		new Date(periodEndIso).getTime() > new Date(periodStartIso).getTime();
	const paymentDto = mapManualPaymentFormDto(payment);
	const adminNotesAreValid = adminNotes.trim().length <= 2000;
	const priceUsd = tierCredits
		? priceUsdFor(plan, tierCredits, interval)
		: null;
	const ownerLabel =
		prefill.organization?.name ??
		user?.name ??
		user?.email ??
		user?.id ??
		"user";
	const prefilledUserIsLocked = Boolean(
		prefill.user && (prefill.user.name || prefill.user.email),
	);

	function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen && mutation.isPending) {
			return;
		}
		onOpenChange(nextOpen);
	}

	function updateInterval(nextInterval: BillingInterval) {
		setInterval(nextInterval);
		const startIso = dateTimeLocalToIso(periodStart);
		const start = startIso ? new Date(startIso) : new Date();
		setPeriodEnd(
			toDateTimeLocalValue(computeDefaultPeriod(start, nextInterval).periodEnd),
		);
	}

	function updatePeriodStart(nextPeriodStart: string) {
		setPeriodStart(nextPeriodStart);
		const startIso = dateTimeLocalToIso(nextPeriodStart);
		if (startIso) {
			setPeriodEnd(
				toDateTimeLocalValue(
					computeDefaultPeriod(new Date(startIso), interval).periodEnd,
				),
			);
		}
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSubmitted(true);

		if (
			!user ||
			!tierCredits ||
			!periodStartIso ||
			!periodEndIso ||
			!periodIsValid ||
			!paymentDto ||
			!adminNotesAreValid
		) {
			return;
		}

		const payload: Omit<AdminGrantManualSubscriptionInput, "idempotencyKey"> = {
			userId: user.id,
			organizationId: prefill.organization?.id ?? null,
			plan,
			tierCredits,
			interval,
			periodStart: periodStartIso,
			periodEnd: periodEndIso,
			payment: paymentDto,
			requestId: prefill.requestId,
			adminNotes: trimmedOptional(adminNotes),
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
				...payload,
				idempotencyKey: idempotencyRef.current.id,
			});
			toast.success(`Offline subscription granted to ${ownerLabel}.`);
			onOpenChange(false);
		} catch (error) {
			toast.error(
				isApiClientError(error)
					? error.message
					: "The offline subscription could not be granted. Please try again.",
			);
		}
	}

	return (
		<Dialog open onOpenChange={handleOpenChange}>
			<DialogContent className="max-h-[min(92vh,58rem)] overflow-y-auto sm:max-w-3xl">
				<form
					onSubmit={handleSubmit}
					className="flex flex-col gap-6"
					noValidate
				>
					<DialogHeader>
						<div className="flex items-center gap-3">
							<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
								<HandCoinsIcon aria-hidden="true" />
							</div>
							<div className="min-w-0">
								<DialogTitle>Grant offline subscription</DialogTitle>
								<DialogDescription className="mt-1">
									Record payment and activate a manual subscription.
								</DialogDescription>
							</div>
						</div>
					</DialogHeader>

					<FieldGroup className="gap-6">
						<div className="grid gap-5 sm:grid-cols-2">
							<Field data-invalid={submitted && !user}>
								<FieldLabel
									htmlFor={
										prefilledUserIsLocked ? undefined : "manual-grant-user"
									}
								>
									Billing contact
								</FieldLabel>
								{prefilledUserIsLocked && prefill.user ? (
									<div className="rounded-md border px-3 py-2 text-sm">
										<p className="truncate font-medium">
											{prefill.user.name ?? prefill.user.id}
										</p>
										<p className="truncate text-muted-foreground text-xs">
											{prefill.user.email ?? prefill.user.id}
										</p>
									</div>
								) : (
									<ManualBillingUserPicker
										id="manual-grant-user"
										value={user}
										onChange={setUser}
										disabled={mutation.isPending}
										invalid={submitted && !user}
									/>
								)}
								{prefill.user && !prefilledUserIsLocked ? (
									<FieldDescription>
										The attributed contact could not be resolved. Verify or
										replace the selected user.
									</FieldDescription>
								) : null}
								<FieldError>
									{submitted && !user ? "Select the billing contact." : null}
								</FieldError>
							</Field>

							<Field>
								<FieldLabel>Subscription owner</FieldLabel>
								<div className="flex min-h-9 items-center gap-2 rounded-md border px-3 py-2 text-sm">
									<span className="min-w-0 flex-1 truncate">
										{prefill.organization?.name ?? "Personal account"}
									</span>
									<Badge variant="outline">
										{plan === "business" ? "Business" : "Pro"}
									</Badge>
								</div>
								<FieldDescription>
									The plan follows the subscription owner automatically.
								</FieldDescription>
							</Field>
						</div>

						<div className="grid gap-5 sm:grid-cols-2">
							<Field data-invalid={submitted && !tierCredits}>
								<FieldLabel htmlFor="manual-grant-tier">Credit tier</FieldLabel>
								<Select
									value={tierCredits ? String(tierCredits) : ""}
									onValueChange={(value) =>
										setTierCredits(Number(value) as CreditTier)
									}
									disabled={mutation.isPending}
								>
									<SelectTrigger id="manual-grant-tier" className="w-full">
										<SelectValue placeholder="Choose a current tier" />
									</SelectTrigger>
									<SelectContent>
										{CREDIT_TIERS.map((tier) => (
											<SelectItem key={tier} value={String(tier)}>
												{tier.toLocaleString("en-US")} credits / month
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{!prefilledTierIsCatalogued &&
								prefill.tierCredits !== undefined ? (
									<FieldDescription className="text-destructive">
										The requested {prefill.tierCredits.toLocaleString("en-US")}
										-credit tier is no longer sold. Select its agreed
										replacement.
									</FieldDescription>
								) : null}
								<FieldError>
									{submitted && !tierCredits
										? "Select a current credit tier."
										: null}
								</FieldError>
							</Field>

							<Field>
								<FieldLabel htmlFor="manual-grant-interval">
									Billing interval
								</FieldLabel>
								<Select
									value={interval}
									onValueChange={(value) =>
										updateInterval(value as BillingInterval)
									}
									disabled={mutation.isPending}
								>
									<SelectTrigger id="manual-grant-interval" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="month">Monthly</SelectItem>
										<SelectItem value="year">Yearly</SelectItem>
									</SelectContent>
								</Select>
							</Field>
						</div>

						{priceUsd !== null ? (
							<p className="rounded-md bg-muted/60 px-3 py-2 text-muted-foreground text-sm">
								Catalog reference: ${priceUsd.toLocaleString("en-US")} USD /{" "}
								{interval}. Record the agreed local amount below.
							</p>
						) : null}

						<div className="grid gap-5 sm:grid-cols-2">
							<Field data-invalid={submitted && !periodStartIso}>
								<FieldLabel htmlFor="manual-grant-period-start">
									Period starts
								</FieldLabel>
								<Input
									id="manual-grant-period-start"
									type="datetime-local"
									value={periodStart}
									onChange={(event) => updatePeriodStart(event.target.value)}
									disabled={mutation.isPending}
									aria-invalid={submitted && !periodStartIso}
								/>
							</Field>

							<Field data-invalid={submitted && !periodIsValid}>
								<FieldLabel htmlFor="manual-grant-period-end">
									Period ends
								</FieldLabel>
								<Input
									id="manual-grant-period-end"
									type="datetime-local"
									value={periodEnd}
									onChange={(event) => setPeriodEnd(event.target.value)}
									disabled={mutation.isPending}
									aria-invalid={submitted && !periodIsValid}
								/>
								<FieldError>
									{submitted && !periodIsValid
										? "The period end must be after the start."
										: null}
								</FieldError>
							</Field>
						</div>

						<div className="space-y-3 border-t pt-5">
							<h3 className="font-medium text-sm">Payment record</h3>
							<ManualPaymentFields
								idPrefix="manual-grant-payment"
								value={payment}
								onChange={setPayment}
								submitted={submitted}
								disabled={mutation.isPending}
							/>
						</div>

						<Field data-invalid={submitted && !adminNotesAreValid}>
							<FieldLabel htmlFor="manual-grant-admin-notes">
								Admin notes
								<span className="font-normal text-muted-foreground">
									{" "}
									(optional)
								</span>
							</FieldLabel>
							<Textarea
								id="manual-grant-admin-notes"
								value={adminNotes}
								onChange={(event) => setAdminNotes(event.target.value)}
								disabled={mutation.isPending}
								maxLength={2000}
								className="min-h-24"
								placeholder="Call outcome or fulfillment context"
							/>
							<FieldError>
								{submitted && !adminNotesAreValid
									? "Keep admin notes under 2,000 characters."
									: null}
							</FieldError>
						</Field>
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
								<HandCoinsIcon data-icon="inline-start" aria-hidden="true" />
							)}
							{mutation.isPending ? "Granting…" : "Grant subscription"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

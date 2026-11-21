/**
 * "Record top-up" dialog: an admin records money collected offline, and the API grants wallet credits.
 * Opened from the request queue, the user detail page, and the organization detail page.
 * Calls useRecordTopupMutation. A retry of the same form reuses one idempotency key.
 */
import { HandCoinsIcon, Loader2Icon } from "lucide-react";
import { type FormEvent, type RefObject, useRef, useState } from "react";
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
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type {
	AdminManualRequest,
	AdminStarterPass,
	ManualBillingUserReference,
} from "@/features/offline-billing/api/offline-billing.dto";
import { useRecordTopupMutation } from "@/features/offline-billing/api/offline-billing.mutations";
import {
	apiComputesTopupCredits,
	formatRequestedTopup,
	mapRecordTopupFormDto,
	type RecordTopupFormInput,
	suggestedTopupCredits,
} from "@/features/offline-billing/lib/offline-billing";
import { isApiClientError } from "@/lib/api-client";
import { formatCreditAmount } from "@/lib/credit-format";

import { ManualBillingUserPicker } from "./manual-billing-user-picker";
import { ManualPaymentFields } from "./manual-payment-fields";

/** Values that the opener already knows. Every field is optional. */
export type RecordTopupPrefill = {
	/** Contact user. Without a name or email, the admin confirms it in the picker. */
	user?: ManualBillingUserReference;
	/** Team wallet to fund. Without it, the personal wallet of the user gets the credits. */
	organization?: { id: string; name: string };
	/** Offline request that this money funds. It sets the suggested credits. */
	request?: Pick<
		AdminManualRequest,
		"id" | "amountUsd" | "plan" | "tierCredits" | "interval"
	>;
	/** Live Starter pass of the wallet that gets the credits. Null: no pass. Undefined: the opener does not know. */
	starterPass?: AdminStarterPass | null;
};

type RecordTopupDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	prefill?: RecordTopupPrefill;
};

/** Last submitted form (as JSON) and the idempotency key sent with it. */
type IdempotencyEntry = { key: string; id: string };

/**
 * Renders nothing while closed. The form starts empty on each open,
 * but the idempotency key of an unconfirmed submit survives the close.
 */
export function RecordTopupDialog(props: RecordTopupDialogProps) {
	// The ref lives outside the open form. A response can get lost, the admin closes
	// the dialog and submits the same values again: the API must see the same key.
	const idempotencyRef = useRef<IdempotencyEntry | null>(null);

	if (!props.open) {
		return null;
	}

	return <OpenRecordTopupDialog {...props} idempotencyRef={idempotencyRef} />;
}

function OpenRecordTopupDialog({
	onOpenChange,
	prefill = {},
	idempotencyRef,
}: RecordTopupDialogProps & {
	/** Owned by RecordTopupDialog, so it outlives this component. */
	idempotencyRef: RefObject<IdempotencyEntry | null>;
}) {
	const suggestedCredits = prefill.request
		? suggestedTopupCredits(prefill.request)
		: null;
	const [user, setUser] = useState<ManualBillingUserReference | null>(
		prefill.user ?? null,
	);
	const [form, setForm] = useState<RecordTopupFormInput>({
		method: "cash_on_delivery",
		majorAmount: "",
		currency: "DZD",
		credits: suggestedCredits === null ? "" : String(suggestedCredits),
		reference: "",
		note: "",
	});
	const [submitted, setSubmitted] = useState(false);
	const mutation = useRecordTopupMutation();
	const payload = user
		? mapRecordTopupFormDto(form, {
				userId: user.id,
				organizationId: prefill.organization?.id ?? null,
				requestId: prefill.request?.id,
			})
		: null;
	const creditsAreRequired = !apiComputesTopupCredits(form.currency);
	const ownerLabel =
		prefill.organization?.name ??
		user?.name ??
		user?.email ??
		user?.id ??
		"user";
	const prefilledUserIsLocked = Boolean(
		prefill.user && (prefill.user.name || prefill.user.email),
	);
	// The API grants a pass with every offline top-up. The note shows only while the prefilled wallet still gets the credits.
	const topupGivesStarterPass =
		prefill.starterPass === null &&
		(prefill.organization !== undefined ||
			(prefill.user !== undefined && user?.id === prefill.user.id));

	function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen && mutation.isPending) {
			return;
		}
		onOpenChange(nextOpen);
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSubmitted(true);

		if (!payload) {
			return;
		}

		// A retry of the same values reuses the key, so the API grants once.
		// A changed value is a new top-up and gets a new key.
		const payloadKey = JSON.stringify(payload);
		if (idempotencyRef.current?.key !== payloadKey) {
			idempotencyRef.current = { key: payloadKey, id: crypto.randomUUID() };
		}
		const idempotencyKey = idempotencyRef.current.id;

		try {
			const receipt = await mutation.mutateAsync({
				...payload,
				idempotencyKey,
			});
			toast.success(
				receipt.credits === null
					? `Top-up recorded for ${ownerLabel}.`
					: `${formatCreditAmount(receipt.credits)} credits added to the wallet of ${ownerLabel}.`,
			);
			// The API confirmed this top-up. The same values later are a new top-up.
			idempotencyRef.current = null;
			onOpenChange(false);
		} catch (error) {
			toast.error(
				isApiClientError(error)
					? error.message
					: "The top-up could not be recorded. Please try again.",
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
								<DialogTitle>Record top-up</DialogTitle>
								<DialogDescription className="mt-1">
									Record the money you received. The API adds the credits to the
									wallet{prefill.organization ? " of the team" : ""}.
									{topupGivesStarterPass
										? " This offline top-up also gives the Starter pass."
										: null}
								</DialogDescription>
							</div>
						</div>
					</DialogHeader>

					<FieldGroup className="gap-6">
						<div className="grid gap-5 sm:grid-cols-2">
							<Field data-invalid={submitted && !user}>
								<FieldLabel
									htmlFor={
										prefilledUserIsLocked ? undefined : "record-topup-user"
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
										id="record-topup-user"
										value={user}
										onChange={setUser}
										disabled={mutation.isPending}
										invalid={submitted && !user}
									/>
								)}
								{prefill.user && !prefilledUserIsLocked ? (
									<FieldDescription>
										The contact could not be resolved. Verify or replace the
										selected user.
									</FieldDescription>
								) : null}
								<FieldError>
									{submitted && !user ? "Select the billing contact." : null}
								</FieldError>
							</Field>

							<Field>
								<FieldLabel>Wallet</FieldLabel>
								<p className="flex min-h-9 items-center rounded-md border px-3 py-2 text-sm">
									<span className="truncate">
										{prefill.organization
											? `Team: ${prefill.organization.name}`
											: "Personal wallet of the contact"}
									</span>
								</p>
							</Field>
						</div>

						{prefill.request ? (
							<RequestSummary request={prefill.request} />
						) : null}

						<div className="space-y-3 border-t pt-5">
							<h3 className="font-medium text-sm">Payment received</h3>
							<ManualPaymentFields
								idPrefix="record-topup-payment"
								value={form}
								onChange={setForm}
								submitted={submitted}
								disabled={mutation.isPending}
							/>
						</div>

						<Field data-invalid={submitted && !payload && Boolean(user)}>
							<FieldLabel htmlFor="record-topup-credits">
								Credits to add
								{creditsAreRequired ? null : (
									<span className="font-normal text-muted-foreground">
										{" "}
										(optional)
									</span>
								)}
							</FieldLabel>
							<Input
								id="record-topup-credits"
								type="number"
								inputMode="decimal"
								min={0.01}
								max={1_000_000}
								step={0.01}
								value={form.credits}
								onChange={(event) =>
									setForm({ ...form, credits: event.target.value })
								}
								disabled={mutation.isPending}
								placeholder={creditsAreRequired ? "Required" : "Computed"}
							/>
							<FieldDescription>
								{creditsAreRequired
									? `Type the credits: the API cannot convert ${form.currency} to USD.`
									: "Empty: the API computes the credits from the USD value, volume bonus included. A DZD amount uses the rate in settings."}
							</FieldDescription>
							<FieldError>
								{submitted && user && !payload
									? "Check the amount and the credits (0.01 to 1,000,000)."
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
							{mutation.isPending ? "Recording…" : "Record top-up"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

/** What the customer asked for: an amount, or a plan for a request from before pricing v8. */
function RequestSummary({
	request,
}: {
	request: NonNullable<RecordTopupPrefill["request"]>;
}) {
	const suggestedCredits = suggestedTopupCredits(request);

	return (
		<p className="rounded-md bg-muted/60 px-3 py-2 text-muted-foreground text-sm">
			Request: {formatRequestedTopup(request)}.{" "}
			{suggestedCredits === null
				? "No USD value is known. Type the credits."
				: `Suggested: ${formatCreditAmount(suggestedCredits)} credits, bonus included.`}
		</p>
	);
}

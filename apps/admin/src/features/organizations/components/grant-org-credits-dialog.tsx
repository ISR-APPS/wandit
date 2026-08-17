import { Loader2Icon, WalletCardsIcon } from "lucide-react";
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
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { OrganizationSummary } from "@/features/organizations/api/organizations.dto";
import { useGrantOrganizationCreditsMutation } from "@/features/organizations/api/organizations.mutations";
import { isApiClientError } from "@/lib/api-client";
import {
	formatCreditAmount,
	formatCreditBalance,
	roundCreditAmount,
} from "@/lib/credit-format";

const CREDIT_PRESETS = [100, 500, 1_000, 5_000] as const;

type GrantOrgCreditsDialogProps = {
	organization: OrganizationSummary;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function GrantOrgCreditsDialog({
	organization,
	open,
	onOpenChange,
}: GrantOrgCreditsDialogProps) {
	const [amount, setAmount] = useState("");
	const [reason, setReason] = useState("");
	const [submitted, setSubmitted] = useState(false);
	// Keyed by the submitted payload: retrying an unchanged grant reuses the id
	// so the server dedupes it, while editing the amount or reason mints a new
	// one — same policy as the user grant dialog.
	const requestIdRef = useRef<{ key: string; id: string } | null>(null);
	const mutation = useGrantOrganizationCreditsMutation();

	const parsedAmount = Number(amount);
	// Decimal credits in 0.01 steps — mirrors adminGrantCreditsInputSchema.
	const amountIsValid =
		Number.isFinite(parsedAmount) &&
		parsedAmount > 0 &&
		parsedAmount <= 1_000_000 &&
		roundCreditAmount(parsedAmount) === parsedAmount;
	const trimmedReason = reason.trim();
	const reasonIsValid = trimmedReason.length <= 500;

	function resetForm() {
		setAmount("");
		setReason("");
		setSubmitted(false);
		requestIdRef.current = null;
	}

	function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen && mutation.isPending) {
			return;
		}
		if (!nextOpen) {
			resetForm();
		}
		onOpenChange(nextOpen);
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSubmitted(true);

		if (!amountIsValid || !reasonIsValid) {
			return;
		}

		const payloadKey = `${parsedAmount}:${trimmedReason}`;
		if (requestIdRef.current?.key !== payloadKey) {
			requestIdRef.current = { key: payloadKey, id: crypto.randomUUID() };
		}

		try {
			await mutation.mutateAsync({
				organizationId: organization.id,
				amount: parsedAmount,
				reason: trimmedReason || undefined,
				requestId: requestIdRef.current.id,
			});
			toast.success(
				`${formatCreditAmount(parsedAmount)} credits granted to ${organization.name}'s pool.`,
			);
			resetForm();
			onOpenChange(false);
		} catch (error) {
			toast.error(
				isApiClientError(error)
					? error.message
					: "Credits could not be granted. Please try again.",
			);
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<form onSubmit={handleSubmit} className="flex flex-col gap-6">
					<DialogHeader>
						<div className="flex items-center gap-3">
							<div className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
								<WalletCardsIcon aria-hidden="true" />
							</div>
							<div className="flex min-w-0 flex-col gap-1">
								<DialogTitle>Grant team credits</DialogTitle>
								<DialogDescription className="truncate">
									Add promo credits to {organization.name}&apos;s shared pool.
								</DialogDescription>
							</div>
						</div>
					</DialogHeader>

					<FieldGroup className="gap-5">
						<Field data-invalid={submitted && !amountIsValid}>
							<FieldLabel htmlFor="grant-org-credit-amount">Amount</FieldLabel>
							<Input
								id="grant-org-credit-amount"
								type="number"
								inputMode="decimal"
								min={0.01}
								max={1_000_000}
								step={0.01}
								value={amount}
								onChange={(event) => setAmount(event.target.value)}
								placeholder="Enter a credit amount"
								aria-invalid={submitted && !amountIsValid}
								autoFocus
							/>
							<FieldDescription>
								Current pool balance:{" "}
								{formatCreditBalance(organization.creditsBalance)} credits.
							</FieldDescription>
							<FieldError>
								{submitted && !amountIsValid
									? "Enter an amount between 0.01 and 1,000,000, in 0.01 steps."
									: null}
							</FieldError>
						</Field>

						<Field>
							<FieldLabel>Quick amount</FieldLabel>
							<ToggleGroup
								type="single"
								variant="outline"
								size="sm"
								value={amount}
								onValueChange={(value) => {
									if (value) {
										setAmount(value);
									}
								}}
								aria-label="Choose a credit amount"
								className="w-full"
							>
								{CREDIT_PRESETS.map((preset) => (
									<ToggleGroupItem
										key={preset}
										value={String(preset)}
										aria-label={`Grant ${preset.toLocaleString()} credits`}
										className="flex-1"
									>
										{preset.toLocaleString()}
									</ToggleGroupItem>
								))}
							</ToggleGroup>
						</Field>

						<Field data-invalid={submitted && !reasonIsValid}>
							<FieldLabel htmlFor="grant-org-credit-reason">
								Reason{" "}
								<span className="font-normal text-muted-foreground">
									(optional)
								</span>
							</FieldLabel>
							<Textarea
								id="grant-org-credit-reason"
								value={reason}
								onChange={(event) => setReason(event.target.value)}
								placeholder="Campaign credit, support adjustment…"
								aria-invalid={submitted && !reasonIsValid}
								maxLength={500}
							/>
							<FieldDescription>
								This note will appear in the team&apos;s credit ledger.
							</FieldDescription>
							<FieldError>
								{submitted && !reasonIsValid
									? "Keep the reason under 500 characters."
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
									data-icon="inline-start"
									className="animate-spin"
									aria-hidden="true"
								/>
							) : (
								<WalletCardsIcon data-icon="inline-start" aria-hidden="true" />
							)}
							{mutation.isPending ? "Granting…" : "Grant credits"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

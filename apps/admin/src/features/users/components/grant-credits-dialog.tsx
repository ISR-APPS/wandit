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
import type { AdminUserSummary } from "@/features/users/api/users.dto";
import { useGrantCreditsMutation } from "@/features/users/api/users.mutations";
import { isApiClientError } from "@/lib/api-client";

const CREDIT_PRESETS = [100, 500, 1_000, 5_000] as const;

type GrantCreditsDialogProps = {
	user: AdminUserSummary;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function GrantCreditsDialog({
	user,
	open,
	onOpenChange,
}: GrantCreditsDialogProps) {
	const [amount, setAmount] = useState("");
	const [reason, setReason] = useState("");
	const [submitted, setSubmitted] = useState(false);
	// Keyed by the submitted payload: retrying an unchanged grant reuses the id so
	// the server dedupes it, while editing the amount or reason mints a new one —
	// otherwise an edited retry of a grant that silently succeeded would dedupe
	// against the old row and apply the old amount.
	const requestIdRef = useRef<{ key: string; id: string } | null>(null);
	const mutation = useGrantCreditsMutation();

	const parsedAmount = Number(amount);
	const amountIsValid =
		Number.isInteger(parsedAmount) &&
		parsedAmount > 0 &&
		parsedAmount <= 1_000_000;
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
				userId: user.id,
				amount: parsedAmount,
				reason: trimmedReason || undefined,
				requestId: requestIdRef.current.id,
			});
			toast.success(
				`${parsedAmount.toLocaleString()} credits granted to ${user.name}.`,
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
								<DialogTitle>Grant credits</DialogTitle>
								<DialogDescription className="truncate">
									Add credits to {user.name}&apos;s balance.
								</DialogDescription>
							</div>
						</div>
					</DialogHeader>

					<FieldGroup className="gap-5">
						<Field data-invalid={submitted && !amountIsValid}>
							<FieldLabel htmlFor="grant-credit-amount">Amount</FieldLabel>
							<Input
								id="grant-credit-amount"
								type="number"
								inputMode="numeric"
								min={1}
								max={1_000_000}
								step={1}
								value={amount}
								onChange={(event) => setAmount(event.target.value)}
								placeholder="Enter a credit amount"
								aria-invalid={submitted && !amountIsValid}
								autoFocus
							/>
							<FieldDescription>
								Current balance: {user.creditsBalance.toLocaleString()} credits.
							</FieldDescription>
							<FieldError>
								{submitted && !amountIsValid
									? "Enter a whole number between 1 and 1,000,000."
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
							<FieldLabel htmlFor="grant-credit-reason">
								Reason{" "}
								<span className="font-normal text-muted-foreground">
									(optional)
								</span>
							</FieldLabel>
							<Textarea
								id="grant-credit-reason"
								value={reason}
								onChange={(event) => setReason(event.target.value)}
								placeholder="Campaign credit, support adjustment…"
								aria-invalid={submitted && !reasonIsValid}
								maxLength={500}
							/>
							<FieldDescription>
								This note will appear in the user&apos;s credit ledger.
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

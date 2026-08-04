import { FlaskConicalIcon, Loader2Icon } from "lucide-react";
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
import type { AdminUserSummary } from "@/features/users/api/users.dto";
import { useBetaEnrollUserMutation } from "@/features/users/api/users.mutations";
import { isApiClientError } from "@/lib/api-client";

const DEFAULT_BETA_CREDITS = "500";

type BetaEnrollDialogProps = {
	user: AdminUserSummary;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function BetaEnrollDialog({
	user,
	open,
	onOpenChange,
}: BetaEnrollDialogProps) {
	const [credits, setCredits] = useState(DEFAULT_BETA_CREDITS);
	const [reason, setReason] = useState("");
	const [submitted, setSubmitted] = useState(false);
	const idempotencyRef = useRef<{ key: string; id: string } | null>(null);
	const mutation = useBetaEnrollUserMutation();

	const parsedCredits = Number(credits);
	const creditsAreValid =
		Number.isInteger(parsedCredits) &&
		parsedCredits > 0 &&
		parsedCredits <= 1_000_000;
	const trimmedReason = reason.trim();
	const reasonIsValid = trimmedReason.length > 0 && trimmedReason.length <= 500;

	function reset() {
		setCredits(DEFAULT_BETA_CREDITS);
		setReason("");
		setSubmitted(false);
		idempotencyRef.current = null;
	}

	function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen && mutation.isPending) {
			return;
		}

		// Preserve an attempted payload and its UUID across closing/reopening. If
		// the server committed but the response was lost, the next identical retry
		// must reuse the key instead of granting a second promo lot.
		if (!nextOpen && idempotencyRef.current === null) {
			reset();
		}

		onOpenChange(nextOpen);
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSubmitted(true);

		if (!creditsAreValid || !reasonIsValid) {
			return;
		}

		const payloadKey = `${parsedCredits}:${trimmedReason}`;
		if (idempotencyRef.current?.key !== payloadKey) {
			idempotencyRef.current = {
				key: payloadKey,
				id: crypto.randomUUID(),
			};
		}

		try {
			await mutation.mutateAsync({
				userId: user.id,
				credits: parsedCredits,
				reason: trimmedReason,
				idempotencyKey: idempotencyRef.current.id,
			});
			toast.success(
				`${user.name} enrolled in beta with ${parsedCredits.toLocaleString()} promo credits.`,
			);
			reset();
			onOpenChange(false);
		} catch (error) {
			toast.error(
				isApiClientError(error)
					? error.message
					: "Beta enrollment could not be completed. Please try again.",
			);
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<form
					onSubmit={handleSubmit}
					noValidate
					className="flex flex-col gap-6"
				>
					<DialogHeader>
						<div className="flex items-center gap-3">
							<div className="flex size-10 items-center justify-center rounded-lg bg-muted">
								<FlaskConicalIcon aria-hidden="true" />
							</div>
							<div>
								<DialogTitle>Confirm beta enrollment</DialogTitle>
								<DialogDescription className="mt-1">
									This grants {user.name} early access and promo credits in one
									atomic operation.
								</DialogDescription>
							</div>
						</div>
					</DialogHeader>

					<FieldGroup className="gap-5">
						<Field data-invalid={submitted && !creditsAreValid}>
							<FieldLabel htmlFor={`beta-credits-${user.id}`}>
								Promo credits
							</FieldLabel>
							<Input
								id={`beta-credits-${user.id}`}
								type="number"
								inputMode="numeric"
								min={1}
								max={1_000_000}
								step={1}
								value={credits}
								onChange={(event) => setCredits(event.target.value)}
								aria-invalid={submitted && !creditsAreValid}
								aria-describedby={`beta-credits-description-${user.id} beta-credits-error-${user.id}`}
								autoFocus
							/>
							<FieldDescription id={`beta-credits-description-${user.id}`}>
								Defaults to 500 and remains editable.
							</FieldDescription>
							<FieldError id={`beta-credits-error-${user.id}`}>
								{submitted && !creditsAreValid
									? "Enter a whole number between 1 and 1,000,000."
									: null}
							</FieldError>
						</Field>

						<Field data-invalid={submitted && !reasonIsValid}>
							<FieldLabel htmlFor={`beta-reason-${user.id}`}>Reason</FieldLabel>
							<Textarea
								id={`beta-reason-${user.id}`}
								value={reason}
								onChange={(event) => setReason(event.target.value)}
								placeholder="Pilot cohort, customer interview, support approval…"
								maxLength={500}
								aria-invalid={submitted && !reasonIsValid}
								aria-describedby={`beta-reason-description-${user.id} beta-reason-error-${user.id}`}
							/>
							<FieldDescription id={`beta-reason-description-${user.id}`}>
								This reason is recorded in the beta access audit trail.
							</FieldDescription>
							<FieldError id={`beta-reason-error-${user.id}`}>
								{submitted && !reasonIsValid
									? "Enter a reason of 500 characters or fewer."
									: null}
							</FieldError>
						</Field>
					</FieldGroup>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							disabled={mutation.isPending}
							onClick={() => handleOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={mutation.isPending}>
							{mutation.isPending ? (
								<Loader2Icon className="animate-spin" aria-hidden="true" />
							) : (
								<FlaskConicalIcon aria-hidden="true" />
							)}
							{mutation.isPending ? "Enrolling…" : "Enroll in beta"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

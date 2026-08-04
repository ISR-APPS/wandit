import {
	CheckCircle2Icon,
	Loader2Icon,
	RotateCcwIcon,
	WebhookIcon,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useReplayBillingWebhookMutation } from "@/features/settings/api/settings.mutations";
import { isApiClientError } from "@/lib/api-client";

export function BillingOpsCard() {
	const [eventId, setEventId] = useState("");
	const [submitted, setSubmitted] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [queuedEventId, setQueuedEventId] = useState<string | null>(null);
	const mutation = useReplayBillingWebhookMutation();

	const cleanEventId = eventId.trim();
	const eventIdIsValid = cleanEventId.length > 0;

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSubmitted(true);
		setErrorMessage(null);
		setQueuedEventId(null);

		if (!eventIdIsValid) {
			return;
		}

		try {
			const result = await mutation.mutateAsync(cleanEventId);
			setQueuedEventId(result.eventId);
			toast.success(`Webhook ${result.eventId} queued for replay.`);
		} catch (error) {
			setErrorMessage(
				isApiClientError(error)
					? error.message
					: "The webhook replay could not be queued. Please try again.",
			);
		}
	}

	return (
		<Card className="shadow-none">
			<CardHeader>
				<div className="flex items-start gap-3">
					<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
						<WebhookIcon aria-hidden="true" />
					</div>
					<div className="flex min-w-0 flex-col gap-1.5">
						<CardTitle>Billing ops</CardTitle>
						<CardDescription>
							Queue a stored billing webhook when Stripe can no longer redeliver
							it.
						</CardDescription>
					</div>
				</div>
			</CardHeader>

			<CardContent>
				<form onSubmit={handleSubmit}>
					<FieldGroup className="gap-5">
						<Field data-invalid={submitted && !eventIdIsValid}>
							<FieldLabel htmlFor="billing-webhook-event-id">
								Webhook event ID
							</FieldLabel>
							<Input
								id="billing-webhook-event-id"
								value={eventId}
								onChange={(event) => {
									setEventId(event.target.value);
									setErrorMessage(null);
									setQueuedEventId(null);
								}}
								placeholder="evt_…"
								autoComplete="off"
								disabled={mutation.isPending}
								aria-invalid={
									(submitted && !eventIdIsValid) || Boolean(errorMessage)
								}
								aria-describedby="billing-webhook-description billing-webhook-error"
							/>
							<FieldDescription id="billing-webhook-description">
								Only failed, received, or expired-lease events are replayable.
							</FieldDescription>
							<FieldError id="billing-webhook-error">
								{submitted && !eventIdIsValid
									? "Enter the stored webhook event ID."
									: errorMessage}
							</FieldError>
						</Field>

						<Button type="submit" disabled={mutation.isPending}>
							{mutation.isPending ? (
								<Loader2Icon
									data-icon="inline-start"
									className="animate-spin"
									aria-hidden="true"
								/>
							) : (
								<RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
							)}
							{mutation.isPending ? "Queueing…" : "Replay webhook"}
						</Button>

						{queuedEventId ? (
							<div
								role="status"
								className="flex min-w-0 items-start gap-2 rounded-lg border bg-muted/30 p-3 text-sm"
							>
								<CheckCircle2Icon
									className="mt-0.5 shrink-0"
									aria-hidden="true"
								/>
								<div className="flex min-w-0 flex-col gap-1">
									<Badge variant="secondary">Replay queued</Badge>
									<code className="break-all font-mono text-muted-foreground text-xs">
										{queuedEventId}
									</code>
								</div>
							</div>
						) : null}
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}

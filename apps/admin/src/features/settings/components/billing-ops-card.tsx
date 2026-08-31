import {
	AlertTriangleIcon,
	CheckCircle2Icon,
	Loader2Icon,
	RefreshCwIcon,
	RotateCcwIcon,
	SaveIcon,
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
import { useAdminPermission } from "@/features/auth/lib/permissions";
import type { ProductSettingsView } from "@/features/settings/api/settings.dto";
import {
	useReplayBillingWebhookMutation,
	useUpdateProductSettingsMutation,
} from "@/features/settings/api/settings.mutations";
import { isApiClientError } from "@/lib/api-client";

const DZD_RATE_PATTERN = /^\d+(?:\.\d{1,2})?$/;
const SETTINGS_CONFLICT_MESSAGE = "settings changed elsewhere — reload";

type BillingOpsCardProps = {
	reloadSettings: () => Promise<void>;
	settings: ProductSettingsView;
};

export function BillingOpsCard({
	reloadSettings,
	settings,
}: BillingOpsCardProps) {
	const [dzdRateDraft, setDzdRateDraft] = useState<string | null>(null);
	const [rateSubmitted, setRateSubmitted] = useState(false);
	const [rateErrorMessage, setRateErrorMessage] = useState<string | null>(null);
	const [rateConflict, setRateConflict] = useState(false);
	const [isReloadingSettings, setIsReloadingSettings] = useState(false);
	const [eventId, setEventId] = useState("");
	const [submitted, setSubmitted] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [queuedEventId, setQueuedEventId] = useState<string | null>(null);
	const rateMutation = useUpdateProductSettingsMutation();
	const replayMutation = useReplayBillingWebhookMutation();
	const canManageSettings = useAdminPermission({ settings: ["manage"] });

	const dzdRate = dzdRateDraft ?? String(settings.dzdPerUsdRate);
	const cleanDzdRate = dzdRate.trim();
	const parsedDzdRate = Number(cleanDzdRate);
	const dzdRateIsValid =
		DZD_RATE_PATTERN.test(cleanDzdRate) &&
		parsedDzdRate > 0 &&
		parsedDzdRate <= 10_000;
	const dzdRateChanged =
		dzdRateIsValid && parsedDzdRate !== settings.dzdPerUsdRate;

	const cleanEventId = eventId.trim();
	const eventIdIsValid = cleanEventId.length > 0;

	async function handleRateSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setRateSubmitted(true);
		setRateErrorMessage(null);

		if (
			!canManageSettings ||
			!dzdRateIsValid ||
			!dzdRateChanged ||
			rateConflict
		) {
			return;
		}

		try {
			await rateMutation.mutateAsync({
				dzdPerUsdRate: parsedDzdRate,
				version: settings.version,
			});
			toast.success("USD to DZD rate updated.");
			setDzdRateDraft(null);
			setRateSubmitted(false);
		} catch (error) {
			if (isApiClientError(error) && error.status === 409) {
				setRateConflict(true);
				setRateErrorMessage(null);
				return;
			}

			setRateErrorMessage(
				isApiClientError(error)
					? error.message
					: "The USD to DZD rate could not be updated. Please try again.",
			);
		}
	}

	async function reloadAfterRateConflict() {
		setIsReloadingSettings(true);
		setRateErrorMessage(null);

		try {
			await reloadSettings();
			setRateConflict(false);
		} catch (error) {
			setRateErrorMessage(
				isApiClientError(error)
					? error.message
					: "Product settings could not be reloaded. Please try again.",
			);
		} finally {
			setIsReloadingSettings(false);
		}
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSubmitted(true);
		setErrorMessage(null);
		setQueuedEventId(null);

		if (!eventIdIsValid) {
			return;
		}

		try {
			const result = await replayMutation.mutateAsync(cleanEventId);
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
							Manage offline receipt pricing and replay stored billing webhooks.
						</CardDescription>
					</div>
				</div>
			</CardHeader>

			<CardContent className="flex flex-col gap-6">
				{rateConflict ? (
					<div
						role="alert"
						className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"
					>
						<div className="flex min-w-0 items-start gap-3">
							<AlertTriangleIcon
								className="mt-0.5 shrink-0 text-destructive"
								aria-hidden="true"
							/>
							<p className="font-medium text-sm">{SETTINGS_CONFLICT_MESSAGE}</p>
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={isReloadingSettings}
							onClick={() => void reloadAfterRateConflict()}
						>
							{isReloadingSettings ? (
								<Loader2Icon
									data-icon="inline-start"
									className="animate-spin"
									aria-hidden="true"
								/>
							) : (
								<RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
							)}
							{isReloadingSettings ? "Reloading…" : "Reload settings"}
						</Button>
					</div>
				) : null}

				<form onSubmit={handleRateSubmit} noValidate>
					<FieldGroup className="gap-5">
						<Field data-invalid={rateSubmitted && !dzdRateIsValid}>
							<FieldLabel htmlFor="billing-dzd-per-usd-rate">
								USD → DZD rate
							</FieldLabel>
							<Input
								id="billing-dzd-per-usd-rate"
								type="number"
								inputMode="decimal"
								min={0.01}
								max={10_000}
								step={0.01}
								value={dzdRate}
								onChange={(event) => {
									setDzdRateDraft(event.target.value);
									setRateErrorMessage(null);
								}}
								disabled={
									rateMutation.isPending || rateConflict || !canManageSettings
								}
								aria-invalid={
									(rateSubmitted && !dzdRateIsValid) ||
									Boolean(rateErrorMessage)
								}
								aria-describedby="billing-dzd-rate-description billing-dzd-rate-error"
							/>
							<FieldDescription id="billing-dzd-rate-description">
								DZD per 1 USD, used to price offline receipts in dinars.
							</FieldDescription>
							<FieldError id="billing-dzd-rate-error">
								{rateSubmitted && !dzdRateIsValid
									? "Enter a rate from 0.01 to 10,000 with at most 2 decimal places."
									: rateErrorMessage}
							</FieldError>
						</Field>

						<Button
							type="submit"
							disabled={
								rateMutation.isPending ||
								rateConflict ||
								!canManageSettings ||
								(dzdRateIsValid && !dzdRateChanged)
							}
						>
							{rateMutation.isPending ? (
								<Loader2Icon
									data-icon="inline-start"
									className="animate-spin"
									aria-hidden="true"
								/>
							) : (
								<SaveIcon data-icon="inline-start" aria-hidden="true" />
							)}
							{rateMutation.isPending ? "Saving…" : "Save rate"}
						</Button>
					</FieldGroup>
				</form>

				<form className="border-t pt-6" onSubmit={handleSubmit}>
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
								disabled={replayMutation.isPending}
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

						<Button type="submit" disabled={replayMutation.isPending}>
							{replayMutation.isPending ? (
								<Loader2Icon
									data-icon="inline-start"
									className="animate-spin"
									aria-hidden="true"
								/>
							) : (
								<RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
							)}
							{replayMutation.isPending ? "Queueing…" : "Replay webhook"}
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

import {
	AlertTriangleIcon,
	GiftIcon,
	Loader2Icon,
	SearchCheckIcon,
} from "lucide-react";
import { type MouseEvent, useState } from "react";
import { toast } from "sonner";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogMedia,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { ProductSettingsView } from "@/features/settings/api/settings.dto";
import { useBackfillSignupGrantsMutation } from "@/features/settings/api/settings.mutations";
import { isApiClientError } from "@/lib/api-client";

type SignupGrantBackfillCardProps = {
	settings: ProductSettingsView;
};

/**
 * Enabling the signup grant never grants to users who signed up while it was
 * off. This card makes that a separate, explicit decision: a dry run counts
 * the skipped users, the confirmed run requeues them through the outbox.
 */
export function SignupGrantBackfillCard({
	settings,
}: SignupGrantBackfillCardProps) {
	const [skippedCount, setSkippedCount] = useState<number | null>(null);
	const [confirming, setConfirming] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const mutation = useBackfillSignupGrantsMutation();
	const grantEnabled = settings.signupGrantEnabled;

	async function runDryRun() {
		setErrorMessage(null);

		try {
			const result = await mutation.mutateAsync({ dryRun: true });
			setSkippedCount(result.skipped);
		} catch (error) {
			setErrorMessage(describeError(error));
		}
	}

	async function confirmBackfill(event: MouseEvent<HTMLButtonElement>) {
		event.preventDefault();
		setErrorMessage(null);

		try {
			const result = await mutation.mutateAsync({ dryRun: false });
			setSkippedCount(Math.max(0, result.skipped - result.requeued));
			setConfirming(false);
			toast.success(
				`${result.requeued.toLocaleString()} signup grant${result.requeued === 1 ? "" : "s"} queued for delivery.`,
			);
		} catch (error) {
			setErrorMessage(describeError(error));
		}
	}

	return (
		<Card className="shadow-none">
			<CardHeader>
				<div className="flex items-start gap-3">
					<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
						<GiftIcon aria-hidden="true" />
					</div>
					<div className="flex min-w-0 flex-col gap-1.5">
						<CardTitle>Signup grant backfill</CardTitle>
						<CardDescription>
							Grant the promotional balance to users who signed up while the
							signup grant was off. Enabling the switch alone never does this.
						</CardDescription>
					</div>
				</div>
			</CardHeader>

			<CardContent className="flex flex-col gap-4">
				{!grantEnabled ? (
					<p className="rounded-md bg-muted/40 px-3 py-2 text-muted-foreground text-sm">
						Enable the signup credit grant first. The backfill uses the grant
						amount in force when it runs.
					</p>
				) : null}

				<div className="flex flex-wrap items-center gap-3">
					<Button
						type="button"
						variant="outline"
						disabled={mutation.isPending}
						onClick={() => void runDryRun()}
					>
						{mutation.isPending && !confirming ? (
							<Loader2Icon
								data-icon="inline-start"
								className="animate-spin"
								aria-hidden="true"
							/>
						) : (
							<SearchCheckIcon data-icon="inline-start" aria-hidden="true" />
						)}
						Count skipped signups
					</Button>
					{skippedCount !== null ? (
						<Badge variant={skippedCount > 0 ? "secondary" : "outline"}>
							{skippedCount.toLocaleString()} user
							{skippedCount === 1 ? "" : "s"} without a grant
						</Badge>
					) : null}
				</div>

				<Button
					type="button"
					disabled={
						!grantEnabled ||
						mutation.isPending ||
						skippedCount === null ||
						skippedCount === 0
					}
					onClick={() => setConfirming(true)}
				>
					<GiftIcon data-icon="inline-start" aria-hidden="true" />
					Backfill {skippedCount ? `${skippedCount.toLocaleString()} ` : ""}
					skipped signup{skippedCount === 1 ? "" : "s"}
				</Button>

				{errorMessage ? (
					<p role="alert" className="text-destructive text-sm">
						{errorMessage}
					</p>
				) : null}
			</CardContent>

			<AlertDialog
				open={confirming}
				onOpenChange={(open) => {
					if (!open && !mutation.isPending) {
						setConfirming(false);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogMedia>
							<AlertTriangleIcon aria-hidden="true" />
						</AlertDialogMedia>
						<AlertDialogTitle>
							Backfill {skippedCount?.toLocaleString() ?? 0} skipped signups?
						</AlertDialogTitle>
						<AlertDialogDescription>
							Each of these users receives{" "}
							{settings.signupGrantCredits.toLocaleString()} promo credits
							through the scheduled delivery sweep. This cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					{errorMessage ? (
						<p role="alert" className="text-destructive text-sm">
							{errorMessage}
						</p>
					) : null}
					<AlertDialogFooter>
						<AlertDialogCancel disabled={mutation.isPending}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							disabled={mutation.isPending}
							onClick={confirmBackfill}
						>
							{mutation.isPending ? (
								<Loader2Icon
									data-icon="inline-start"
									className="animate-spin"
									aria-hidden="true"
								/>
							) : null}
							{mutation.isPending ? "Queueing…" : "Backfill now"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Card>
	);
}

function describeError(error: unknown): string {
	return isApiClientError(error)
		? error.message
		: "The signup grant backfill could not run. Please try again.";
}

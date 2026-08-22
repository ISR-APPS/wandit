import type { PatchProductSettingsBody } from "@wandit/contracts";
import {
	AlertTriangleIcon,
	GiftIcon,
	Loader2Icon,
	RefreshCwIcon,
	SaveIcon,
	ShieldCheckIcon,
} from "lucide-react";
import {
	type FormEvent,
	type MouseEvent,
	useEffect,
	useRef,
	useState,
} from "react";
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
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { ProductSettingsView } from "@/features/settings/api/settings.dto";
import { useUpdateProductSettingsMutation } from "@/features/settings/api/settings.mutations";
import { isApiClientError } from "@/lib/api-client";

const SETTINGS_CONFLICT_MESSAGE = "settings changed elsewhere — reload";

const BOOLEAN_SETTING_KEYS = [
	"signupGrantEnabled",
	"paidSubscriptionsEnabled",
	"topupsEnabled",
	"organizationsEnabled",
	"emailAuthEnabled",
] as const;

type BooleanSettingKey = (typeof BOOLEAN_SETTING_KEYS)[number];

type PendingToggle = {
	key: BooleanSettingKey;
	nextValue: boolean;
};

type ToggleDetails = {
	description: string;
	label: string;
	consequence: (nextValue: boolean, signupGrantCredits: number) => string;
};

const TOGGLE_DETAILS: Record<BooleanSettingKey, ToggleDetails> = {
	signupGrantEnabled: {
		label: "Signup credit grant",
		description:
			"Control whether new accounts receive the configured promotional balance.",
		consequence: (nextValue, signupGrantCredits) =>
			nextValue
				? `Every future signup will receive ${signupGrantCredits.toLocaleString()} promo credits. Existing accounts will not receive a retroactive grant unless you run the signup grant backfill.`
				: "Future signups will stop receiving promo credits. Credits already granted to existing accounts will remain available.",
	},
	paidSubscriptionsEnabled: {
		label: "Paid subscriptions",
		description:
			"Control admission to new paid checkouts, plan changes, and subscription resumes.",
		consequence: (nextValue) =>
			nextValue
				? "Signed-in users will be able to start, change, or resume paid subscriptions. Existing paid fulfillment already continues regardless of this switch."
				: "New paid checkouts, plan changes, and subscription resumes will be blocked. Payments already made will still be fulfilled.",
	},
	topupsEnabled: {
		label: "Credit top-ups",
		description: "Control admission to new one-time credit pack purchases.",
		consequence: (nextValue) =>
			nextValue
				? "Users will be able to purchase new credit top-ups. Previously paid top-ups are fulfilled either way."
				: "New credit top-up purchases will be blocked. Top-ups that were already paid will still be fulfilled.",
	},
	organizationsEnabled: {
		label: "Team workspaces",
		description:
			"Control whether users can create team workspaces and see the Business plan.",
		consequence: (nextValue) =>
			nextValue
				? "Users will see the workspace switcher, can create team workspaces, and can buy the Business plan."
				: "New team creation and new Business checkouts will be blocked. Existing teams keep working — members, invitations, projects, and paid renewals are unaffected.",
	},
	emailAuthEnabled: {
		label: "Email sign-in",
		description:
			"Control whether users can sign in with a magic link or email code (in addition to Google).",
		consequence: (nextValue) =>
			nextValue
				? "The auth dialog will offer email sign-in: users receive a magic link or 6-digit code, and any verified email address can create an account. Requires a configured email provider (RESEND_API_KEY)."
				: "The email form disappears from the auth dialog and sign-in emails stop being sent (already-sent links/codes stay valid for up to 10 minutes). Google sign-in is unaffected. Accounts created via email stay intact but cannot sign in again until this is re-enabled — unless their address is also a Google account.",
	},
};

type ProductControlsCardProps = {
	settings: ProductSettingsView;
	reloadSettings: () => Promise<void>;
};

export function ProductControlsCard({
	settings,
	reloadSettings,
}: ProductControlsCardProps) {
	const [pendingToggle, setPendingToggle] = useState<PendingToggle | null>(
		null,
	);
	const [grantCredits, setGrantCredits] = useState(
		String(settings.signupGrantCredits),
	);
	const [grantSubmitted, setGrantSubmitted] = useState(false);
	const [conflict, setConflict] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isReloading, setIsReloading] = useState(false);
	const toggleTriggerRef = useRef<HTMLButtonElement | null>(null);
	const mutation = useUpdateProductSettingsMutation();

	useEffect(() => {
		setGrantCredits(String(settings.signupGrantCredits));
		setGrantSubmitted(false);
	}, [settings.signupGrantCredits]);

	const parsedGrantCredits = Number(grantCredits);
	const grantCreditsAreValid =
		Number.isSafeInteger(parsedGrantCredits) && parsedGrantCredits > 0;
	const grantCreditsChanged =
		grantCreditsAreValid && parsedGrantCredits !== settings.signupGrantCredits;

	function requestToggle(key: BooleanSettingKey, nextValue: boolean) {
		if (nextValue === settings[key] || conflict) {
			return;
		}

		setErrorMessage(null);
		mutation.reset();
		setPendingToggle({ key, nextValue });
	}

	function handleDialogOpenChange(open: boolean) {
		if (!open && !mutation.isPending) {
			setPendingToggle(null);
			setErrorMessage(null);
		}
	}

	async function confirmToggle(event: MouseEvent<HTMLButtonElement>) {
		event.preventDefault();

		if (!pendingToggle) {
			return;
		}

		const details = TOGGLE_DETAILS[pendingToggle.key];
		const input = {
			version: settings.version,
			[pendingToggle.key]: pendingToggle.nextValue,
		} as PatchProductSettingsBody;

		try {
			const updated = await mutation.mutateAsync(input);
			toast.success(
				`${details.label} ${pendingToggle.nextValue ? "enabled" : "disabled"}.`,
				updated.signupGrantSkippedCount
					? {
							description: `${updated.signupGrantSkippedCount.toLocaleString()} user${updated.signupGrantSkippedCount === 1 ? "" : "s"} signed up while it was off. Use the signup grant backfill to grant them.`,
						}
					: undefined,
			);
			setPendingToggle(null);
			setErrorMessage(null);
		} catch (error) {
			handleMutationError(error, () => {
				setConflict(true);
				setPendingToggle(null);
			});
		}
	}

	async function saveGrantCredits(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setGrantSubmitted(true);
		setErrorMessage(null);

		if (!grantCreditsAreValid || !grantCreditsChanged || conflict) {
			return;
		}

		try {
			await mutation.mutateAsync({
				signupGrantCredits: parsedGrantCredits,
				version: settings.version,
			});
			toast.success("Signup grant amount updated.");
			setGrantSubmitted(false);
		} catch (error) {
			handleMutationError(error, () => setConflict(true));
		}
	}

	function handleMutationError(error: unknown, onConflict: () => void) {
		if (isApiClientError(error) && error.status === 409) {
			setErrorMessage(null);
			onConflict();
			return;
		}

		setErrorMessage(
			isApiClientError(error)
				? error.message
				: "Product settings could not be updated. Please try again.",
		);
	}

	async function reloadAfterConflict() {
		setIsReloading(true);
		setErrorMessage(null);

		try {
			await reloadSettings();
			setConflict(false);
		} catch (error) {
			setErrorMessage(
				isApiClientError(error)
					? error.message
					: "Product settings could not be reloaded. Please try again.",
			);
		} finally {
			setIsReloading(false);
		}
	}

	const pendingDetails = pendingToggle
		? TOGGLE_DETAILS[pendingToggle.key]
		: null;

	return (
		<Card className="gap-0 py-0 shadow-none">
			<CardHeader className="border-b py-6">
				<div className="flex items-start gap-3">
					<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
						<ShieldCheckIcon aria-hidden="true" />
					</div>
					<div className="flex min-w-0 flex-col gap-1.5">
						<CardTitle>Admission controls</CardTitle>
						<CardDescription className="max-w-2xl">
							Kill switches affect new admissions only. Paid entitlements and
							credits already issued remain intact.
						</CardDescription>
					</div>
				</div>
			</CardHeader>

			<CardContent className="px-0">
				{conflict ? (
					<div
						role="alert"
						className="m-5 flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"
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
							disabled={isReloading}
							onClick={() => void reloadAfterConflict()}
						>
							{isReloading ? (
								<Loader2Icon
									data-icon="inline-start"
									className="animate-spin"
									aria-hidden="true"
								/>
							) : (
								<RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
							)}
							{isReloading ? "Reloading…" : "Reload settings"}
						</Button>
					</div>
				) : null}

				{errorMessage ? (
					<p
						role="alert"
						className="mx-5 mt-5 rounded-md bg-destructive/5 px-3 py-2 text-destructive text-sm"
					>
						{errorMessage}
					</p>
				) : null}

				<div className="divide-y">
					{BOOLEAN_SETTING_KEYS.map((key) => {
						const details = TOGGLE_DETAILS[key];
						const checked = settings[key];

						return (
							<div
								key={key}
								className="grid gap-4 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
							>
								<div className="flex min-w-0 flex-col gap-1.5">
									<div className="flex flex-wrap items-center gap-2">
										<p className="font-medium text-sm">{details.label}</p>
										<Badge variant={checked ? "default" : "outline"}>
											{checked ? "Enabled" : "Disabled"}
										</Badge>
									</div>
									<p className="max-w-2xl text-muted-foreground text-sm leading-relaxed">
										{details.description}
									</p>
								</div>
								<Switch
									onFocus={(event) => {
										toggleTriggerRef.current = event.currentTarget;
									}}
									onPointerDown={(event) => {
										toggleTriggerRef.current = event.currentTarget;
									}}
									checked={checked}
									disabled={mutation.isPending || conflict}
									onCheckedChange={(nextValue) => requestToggle(key, nextValue)}
									aria-label={`${checked ? "Disable" : "Enable"} ${details.label.toLowerCase()}`}
								/>
							</div>
						);
					})}
				</div>

				<form
					onSubmit={saveGrantCredits}
					noValidate
					className="border-t bg-muted/20 px-5 py-5"
				>
					<FieldGroup>
						<Field
							data-invalid={grantSubmitted && !grantCreditsAreValid}
							className="sm:grid sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end"
						>
							<div className="flex min-w-0 flex-col gap-1.5 sm:pb-1">
								<div className="flex items-center gap-2 font-medium text-sm">
									<GiftIcon aria-hidden="true" />
									Signup grant amount
								</div>
								<FieldDescription id="signup-grant-description">
									Promo credits issued to each future signup when the grant
									switch is enabled.
								</FieldDescription>
							</div>
							<div className="flex flex-col gap-2">
								<FieldLabel htmlFor="signup-grant-credits">Credits</FieldLabel>
								<Input
									id="signup-grant-credits"
									type="number"
									inputMode="numeric"
									min={1}
									step={1}
									value={grantCredits}
									onChange={(event) => setGrantCredits(event.target.value)}
									disabled={mutation.isPending || conflict}
									aria-invalid={grantSubmitted && !grantCreditsAreValid}
									aria-describedby="signup-grant-description signup-grant-error"
								/>
							</div>
							<Button
								type="submit"
								disabled={
									mutation.isPending ||
									conflict ||
									(grantCreditsAreValid && !grantCreditsChanged)
								}
							>
								{mutation.isPending && !pendingToggle ? (
									<Loader2Icon
										data-icon="inline-start"
										className="animate-spin"
										aria-hidden="true"
									/>
								) : (
									<SaveIcon data-icon="inline-start" aria-hidden="true" />
								)}
								{mutation.isPending && !pendingToggle
									? "Saving…"
									: "Save amount"}
							</Button>
							<FieldError
								id="signup-grant-error"
								className="sm:col-span-2 sm:col-start-2"
							>
								{grantSubmitted && !grantCreditsAreValid
									? "Enter a positive whole number of credits."
									: null}
							</FieldError>
						</Field>
					</FieldGroup>
				</form>
			</CardContent>

			<AlertDialog
				open={pendingToggle !== null}
				onOpenChange={handleDialogOpenChange}
			>
				<AlertDialogContent
					onCloseAutoFocus={(event) => {
						event.preventDefault();
						toggleTriggerRef.current?.focus();
					}}
				>
					<AlertDialogHeader>
						<AlertDialogMedia>
							<AlertTriangleIcon aria-hidden="true" />
						</AlertDialogMedia>
						<AlertDialogTitle>
							{pendingToggle?.nextValue ? "Enable" : "Disable"}{" "}
							{pendingDetails?.label.toLowerCase()}?
						</AlertDialogTitle>
						<AlertDialogDescription>
							{pendingToggle && pendingDetails
								? pendingDetails.consequence(
										pendingToggle.nextValue,
										settings.signupGrantCredits,
									)
								: "Confirm this settings change."}
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
							variant={pendingToggle?.nextValue ? "default" : "destructive"}
							disabled={mutation.isPending}
							onClick={confirmToggle}
						>
							{mutation.isPending ? (
								<Loader2Icon
									data-icon="inline-start"
									className="animate-spin"
									aria-hidden="true"
								/>
							) : null}
							{mutation.isPending
								? "Applying…"
								: pendingToggle?.nextValue
									? "Enable setting"
									: "Disable setting"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Card>
	);
}

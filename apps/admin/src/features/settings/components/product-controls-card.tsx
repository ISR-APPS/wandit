/**
 * Admin settings card for the product switches and their amounts.
 * The amounts are the signup grant and the user referral rewards.
 * It also holds the list of V2 builder models that ops turn off during a provider incident.
 * The settings page renders it. It calls the product-settings mutation.
 */
import {
	type PatchProductSettingsBody,
	USER_REFERRAL_ACTIVATION_MIN_CREDITS,
	USER_REFERRAL_ACTIVATION_WINDOW_DAYS,
	USER_REFERRAL_PAID_HOLD_DAYS,
} from "@wandit/contracts";
import {
	AlertTriangleIcon,
	BanIcon,
	GiftIcon,
	Loader2Icon,
	RefreshCwIcon,
	SaveIcon,
	ShieldCheckIcon,
	UserPlusIcon,
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
import { useAdminPermission } from "@/features/auth/lib/permissions";
import type { ProductSettingsView } from "@/features/settings/api/settings.dto";
import { useUpdateProductSettingsMutation } from "@/features/settings/api/settings.mutations";
import { isApiClientError } from "@/lib/api-client";

const SETTINGS_CONFLICT_MESSAGE = "settings changed elsewhere — reload";

const BOOLEAN_SETTING_KEYS = [
	"signupGrantEnabled",
	"manualPaymentsEnabled",
	"topupsEnabled",
	"organizationsEnabled",
	"emailAuthEnabled",
	"lifecycleEmailsEnabled",
	"v2BuilderEnabled",
	"userReferralsEnabled",
	"starterPassRequired",
] as const;

type BooleanSettingKey = (typeof BOOLEAN_SETTING_KEYS)[number];

type PendingToggle = {
	key: BooleanSettingKey;
	nextValue: boolean;
};

// Same upper limit as the settings contract and the `product_settings` checks, in whole credits.
const USER_REFERRAL_CREDITS_MAX = 10_000;

// The three reward amounts of the user referral program. Each one gets one form row.
const USER_REFERRAL_CREDIT_FIELDS = [
	{
		key: "userReferralFriendCredits",
		title: "Referral friend bonus",
		description: "Promo credits the invited friend gets right after signup.",
	},
	{
		key: "userReferralActivationCredits",
		title: "Referral activation reward",
		description: `Promo credits the referrer gets when the friend uses ${USER_REFERRAL_ACTIVATION_MIN_CREDITS} credits within ${USER_REFERRAL_ACTIVATION_WINDOW_DAYS} days of joining.`,
	},
	{
		key: "userReferralPaidCredits",
		title: "Referral paid reward",
		description: `Promo credits the referrer gets ${USER_REFERRAL_PAID_HOLD_DAYS} days after the friend's first payment, if the payment is not refunded.`,
	},
] as const;

type UserReferralCreditField = (typeof USER_REFERRAL_CREDIT_FIELDS)[number];

type NumericSettingKey = "signupGrantCredits" | UserReferralCreditField["key"];

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
	manualPaymentsEnabled: {
		label: "Offline payments",
		description:
			"Control whether users can request a wallet top-up paid by cash or transfer.",
		consequence: (nextValue) =>
			nextValue
				? "Users will see Cash / transfer and can submit offline top-up requests. Administrators must still collect the money and record each top-up."
				: "Cash / transfer will be hidden and new offline requests will be blocked. Existing requests stay available for administrators to record or close.",
	},
	topupsEnabled: {
		label: "Card top-ups",
		description:
			"Control admission to new wallet top-ups paid by card (Stripe). SlickPay and offline payments have their own switches.",
		consequence: (nextValue) =>
			nextValue
				? "Users will be able to top up their wallet by card. Previously paid top-ups are fulfilled either way."
				: "New card top-ups will be blocked. Top-ups that were already paid will still be fulfilled.",
	},
	organizationsEnabled: {
		label: "Team workspaces",
		description:
			"Control whether users can create team workspaces. The team owner tops up the team wallet.",
		consequence: (nextValue) =>
			nextValue
				? "Users will see the workspace switcher and can create team workspaces."
				: "New team creation will be blocked. Existing teams keep working — members, invitations, projects, and team wallets are unaffected.",
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
	lifecycleEmailsEnabled: {
		label: "Lifecycle emails",
		description:
			"Control delivery of lifecycle email automations from the durable event outbox.",
		consequence: (nextValue) =>
			nextValue
				? "New eligible lifecycle events will be delivered to Resend automations. Events dropped while this switch was disabled will not be replayed."
				: "Queued and future lifecycle events will be recorded but dropped without sending. Transactional emails such as sign-in links, invitations, and receipts are unaffected.",
	},
	v2BuilderEnabled: {
		label: "V2 app builder",
		description:
			"Open the V2 app builder (web apps on a sandbox) to users who also carry the PostHog flag v2-builder.",
		consequence: (nextValue) =>
			nextValue
				? "Users whose PostHog flag v2-builder is on will reach the V2 app builder routes. Everyone else still gets the V1 page builder."
				: "The V2 app builder routes will deny every user regardless of the PostHog flag. Existing V2 projects keep their data but their turns stop.",
	},
	userReferralsEnabled: {
		label: "User referrals",
		description:
			"Give each user an invite link. The invited friend and the referrer both get promo credits.",
		consequence: (nextValue) =>
			nextValue
				? "Each user will get an invite link in the app. The invited friend and the referrer will both receive promo credits at the referral amounts set below."
				: "No invite link will show and no reward will be paid while this is off. Credits already paid remain available.",
	},
	starterPassRequired: {
		label: "Starter pass",
		description:
			"Fraud gate. An account that never paid must pay $1 by card or 250 DA by CIB/Edahabia before it can spend credits.",
		consequence: (nextValue) =>
			nextValue
				? "Accounts that never paid cannot spend credits until they pay $1 by card or 250 DA by CIB/Edahabia. Turning it on grants a pass to every account that already paid. Card top-ups must be on for non-Algerian users."
				: "Every account can spend its credits again without a Starter pass. Passes already granted stay on their accounts.",
	},
};

type ProductControlsCardProps = {
	settings: ProductSettingsView;
	reloadSettings: () => Promise<void>;
};

/**
 * The "Admission controls" card of the settings page.
 * A switch asks for a confirmation first. Each amount has its own form and its own save.
 * A 409 from the server locks the card until the admin reloads the settings.
 */
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
	const [pendingNumericSetting, setPendingNumericSetting] =
		useState<NumericSettingKey | null>(null);
	const [isSavingDisabledModels, setIsSavingDisabledModels] = useState(false);
	const [conflict, setConflict] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isReloading, setIsReloading] = useState(false);
	const toggleTriggerRef = useRef<HTMLButtonElement | null>(null);
	const mutation = useUpdateProductSettingsMutation();
	const canManage = useAdminPermission({ settings: ["manage"] });

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
		if (!canManage || nextValue === settings[key] || conflict) {
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

		if (
			!canManage ||
			!grantCreditsAreValid ||
			!grantCreditsChanged ||
			conflict
		) {
			return;
		}

		setPendingNumericSetting("signupGrantCredits");
		try {
			await mutation.mutateAsync({
				signupGrantCredits: parsedGrantCredits,
				version: settings.version,
			});
			toast.success("Signup grant amount updated.");
			setGrantSubmitted(false);
		} catch (error) {
			handleMutationError(error, () => setConflict(true));
		} finally {
			setPendingNumericSetting(null);
		}
	}

	async function saveUserReferralCredits(
		field: UserReferralCreditField,
		credits: number,
	) {
		setErrorMessage(null);
		setPendingNumericSetting(field.key);
		const input: PatchProductSettingsBody = { version: settings.version };
		input[field.key] = credits;

		try {
			await mutation.mutateAsync(input);
			toast.success(`${field.title} updated.`);
		} catch (error) {
			handleMutationError(error, () => setConflict(true));
		} finally {
			setPendingNumericSetting(null);
		}
	}

	async function saveDisabledModels(modelIds: string[]) {
		setErrorMessage(null);
		setIsSavingDisabledModels(true);

		try {
			await mutation.mutateAsync({
				v2DisabledModels: modelIds,
				version: settings.version,
			});
			toast.success("Disabled V2 models updated.");
		} catch (error) {
			// The server answers 400 for an id with no price row. Its body only says "Validation failed".
			if (isApiClientError(error) && error.status === 400) {
				setErrorMessage(
					"One model id has no price row. Copy the ids from the builder model list, for example google/gemini-4-neon.",
				);
				return;
			}
			handleMutationError(error, () => setConflict(true));
		} finally {
			setIsSavingDisabledModels(false);
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
							Kill switches control new admissions and lifecycle delivery. Paid
							entitlements and credits already issued remain intact.
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
									disabled={mutation.isPending || conflict || !canManage}
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
									disabled={mutation.isPending || conflict || !canManage}
									aria-invalid={grantSubmitted && !grantCreditsAreValid}
									aria-describedby="signup-grant-description signup-grant-error"
								/>
							</div>
							<Button
								type="submit"
								disabled={
									mutation.isPending ||
									conflict ||
									!canManage ||
									(grantCreditsAreValid && !grantCreditsChanged)
								}
							>
								{mutation.isPending &&
								pendingNumericSetting === "signupGrantCredits" ? (
									<Loader2Icon
										data-icon="inline-start"
										className="animate-spin"
										aria-hidden="true"
									/>
								) : (
									<SaveIcon data-icon="inline-start" aria-hidden="true" />
								)}
								{mutation.isPending &&
								pendingNumericSetting === "signupGrantCredits"
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

				<DisabledModelsForm
					savedModelIds={settings.v2DisabledModels}
					isLocked={mutation.isPending || conflict || !canManage}
					isSaving={isSavingDisabledModels}
					onSave={(modelIds) => void saveDisabledModels(modelIds)}
				/>

				{USER_REFERRAL_CREDIT_FIELDS.map((field) => (
					<UserReferralCreditsForm
						key={field.key}
						field={field}
						savedCredits={settings[field.key]}
						isLocked={mutation.isPending || conflict || !canManage}
						isSaving={mutation.isPending && pendingNumericSetting === field.key}
						onSave={(credits) => void saveUserReferralCredits(field, credits)}
					/>
				))}
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
							disabled={mutation.isPending || !canManage}
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

type UserReferralCreditsFormProps = {
	/** The settings key that this form saves, with the title and the help text of the row. */
	field: UserReferralCreditField;
	/** Amount in the settings row now, in whole credits. */
	savedCredits: number;
	/** True while a settings save runs, a version conflict shows, or the admin cannot manage settings. */
	isLocked: boolean;
	/** True while the save of this field runs. The button then shows a spinner. */
	isSaving: boolean;
	/** Gets a valid, changed amount in whole credits. The card sends it and shows a failure. */
	onSave: (credits: number) => void;
};

/** One amount row of the user referral program. It has the layout of the signup grant form. */
function UserReferralCreditsForm({
	field,
	savedCredits,
	isLocked,
	isSaving,
	onSave,
}: UserReferralCreditsFormProps) {
	const [draftCredits, setDraftCredits] = useState(String(savedCredits));
	const [submitted, setSubmitted] = useState(false);

	// A save or a reload changes the saved amount. The draft and the error then start again.
	useEffect(() => {
		setDraftCredits(String(savedCredits));
		setSubmitted(false);
	}, [savedCredits]);

	const parsedCredits = Number(draftCredits);
	// Zero is not a legal amount: the credit grant rejects it.
	const creditsAreValid =
		Number.isSafeInteger(parsedCredits) &&
		parsedCredits >= 1 &&
		parsedCredits <= USER_REFERRAL_CREDITS_MAX;
	const creditsChanged = creditsAreValid && parsedCredits !== savedCredits;
	const showError = submitted && !creditsAreValid;
	const descriptionId = `${field.key}-description`;
	const errorId = `${field.key}-error`;

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSubmitted(true);

		if (isLocked || !creditsChanged) {
			return;
		}

		onSave(parsedCredits);
	}

	return (
		<form
			onSubmit={handleSubmit}
			noValidate
			className="border-t bg-muted/20 px-5 py-5"
		>
			<FieldGroup>
				<Field
					data-invalid={showError}
					className="sm:grid sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end"
				>
					<div className="flex min-w-0 flex-col gap-1.5 sm:pb-1">
						<div className="flex items-center gap-2 font-medium text-sm">
							<UserPlusIcon aria-hidden="true" />
							{field.title}
						</div>
						<FieldDescription id={descriptionId}>
							{field.description} A new amount applies to friends who join after
							the change.
						</FieldDescription>
					</div>
					<div className="flex flex-col gap-2">
						<FieldLabel htmlFor={field.key}>Credits</FieldLabel>
						<Input
							id={field.key}
							type="number"
							inputMode="numeric"
							min={1}
							max={USER_REFERRAL_CREDITS_MAX}
							step={1}
							value={draftCredits}
							onChange={(event) => setDraftCredits(event.target.value)}
							disabled={isLocked}
							aria-invalid={showError}
							aria-describedby={`${descriptionId} ${errorId}`}
						/>
					</div>
					<Button
						type="submit"
						disabled={isLocked || (creditsAreValid && !creditsChanged)}
					>
						{isSaving ? (
							<Loader2Icon
								data-icon="inline-start"
								className="animate-spin"
								aria-hidden="true"
							/>
						) : (
							<SaveIcon data-icon="inline-start" aria-hidden="true" />
						)}
						{isSaving ? "Saving…" : "Save amount"}
					</Button>
					<FieldError id={errorId} className="sm:col-span-2 sm:col-start-2">
						{showError
							? `Enter a whole number of credits from 1 to ${USER_REFERRAL_CREDITS_MAX.toLocaleString()}.`
							: null}
					</FieldError>
				</Field>
			</FieldGroup>
		</form>
	);
}

type DisabledModelsFormProps = {
	/** `v2DisabledModels` in the settings row now: gateway model ids such as `google/gemini-4-neon`. */
	savedModelIds: readonly string[];
	/** True while a settings save runs, a version conflict shows, or the admin cannot manage settings. */
	isLocked: boolean;
	/** True while the save of this list runs. The button then shows a spinner. */
	isSaving: boolean;
	/** Gets the full new list, without duplicates. An empty list turns every model on again. */
	onSave: (modelIds: string[]) => void;
};

/**
 * The list of V2 builder models that ops turn off, as one text field.
 * The builder hides a turned-off tier, and the API refuses a turn on it.
 */
function DisabledModelsForm({
	savedModelIds,
	isLocked,
	isSaving,
	onSave,
}: DisabledModelsFormProps) {
	const savedText = savedModelIds.join(", ");
	const [draftText, setDraftText] = useState(savedText);

	// A save or a reload changes the saved list. The draft then starts again.
	useEffect(() => {
		setDraftText(savedText);
	}, [savedText]);

	// Commas, spaces, and line breaks all separate the ids.
	const draftModelIds = [
		...new Set(draftText.split(/[\s,]+/).filter((modelId) => modelId !== "")),
	];
	const isChanged = draftModelIds.join(", ") !== savedText;

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (isLocked || !isChanged) {
			return;
		}

		onSave(draftModelIds);
	}

	return (
		<form
			onSubmit={handleSubmit}
			noValidate
			className="border-t bg-muted/20 px-5 py-5"
		>
			<FieldGroup>
				<Field className="sm:grid sm:grid-cols-[minmax(0,1fr)_20rem_auto] sm:items-end">
					<div className="flex min-w-0 flex-col gap-1.5 sm:pb-1">
						<div className="flex items-center gap-2 font-medium text-sm">
							<BanIcon aria-hidden="true" />
							Disabled V2 models
						</div>
						<FieldDescription id="v2-disabled-models-description">
							Model ids to turn off during a provider incident, separated by
							commas. New turns on them fail within 30 seconds. The builder
							hides their tier at the next page load. Leave empty to turn every
							model on.
						</FieldDescription>
					</div>
					<div className="flex flex-col gap-2">
						<FieldLabel htmlFor="v2-disabled-models">Model ids</FieldLabel>
						<Input
							id="v2-disabled-models"
							placeholder="google/gemini-4-neon"
							value={draftText}
							onChange={(event) => setDraftText(event.target.value)}
							disabled={isLocked}
							aria-describedby="v2-disabled-models-description"
						/>
					</div>
					<Button type="submit" disabled={isLocked || !isChanged}>
						{isSaving ? (
							<Loader2Icon
								data-icon="inline-start"
								className="animate-spin"
								aria-hidden="true"
							/>
						) : (
							<SaveIcon data-icon="inline-start" aria-hidden="true" />
						)}
						{isSaving ? "Saving…" : "Save list"}
					</Button>
				</Field>
			</FieldGroup>
		</form>
	);
}

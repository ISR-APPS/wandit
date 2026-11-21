/**
 * Card with the Starter pass state of one credit pool, and the staff Grant and Revoke actions.
 * The user detail page renders it for the personal pool, the organization detail page for the team pool.
 * The page gives the mutation. The card asks for a note in a confirm dialog first.
 */
import { Link } from "@tanstack/react-router";
import { ADMIN_PERMISSION_REQUIRED_ERROR_CODE } from "@wandit/contracts";
import { Loader2Icon, TicketCheckIcon, TicketXIcon } from "lucide-react";
import { type MouseEvent, type PropsWithChildren, useState } from "react";
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
	FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type {
	AdminStarterPass,
	StarterPassAction,
} from "@/features/users/api/users.dto";
import { STARTER_PASS_SOURCE_LABELS } from "@/features/users/lib/constants";
import { formatAdminDateTime } from "@/features/users/lib/formatters";
import { isApiClientError } from "@/lib/api-client";

// Same limits as adminStarterPassBodySchema. The API refuses a note outside them.
const NOTE_MIN_LENGTH = 3;
const NOTE_MAX_LENGTH = 500;

type StarterPassCardProps = {
	/** Live pass of the pool from the detail answer. Null: no pass. Undefined: an older API sent no field. */
	starterPass: AdminStarterPass | null | undefined;
	/** Name of the pool in the copy, for example "this personal wallet" or "the team wallet". */
	poolLabel: string;
	/** True when the staff member may grant and revoke. The page uses the credit grant rule. */
	canChange: boolean;
	/** Text that replaces the buttons when canChange is false, for example where to act instead. */
	readOnlyHint?: string;
	/** True while the grant or revoke request runs. */
	isPending: boolean;
	/** Sends the grant or the revoke with the trimmed note. It rejects with the API error on failure. */
	onChange: (action: StarterPassAction, note: string) => Promise<void>;
};

/** Shows the pass, its source, and its note. A grant or revoke needs a note of 3 to 500 characters. */
export function StarterPassCard({
	starterPass,
	poolLabel,
	canChange,
	readOnlyHint,
	isPending,
	onChange,
}: StarterPassCardProps) {
	const [pendingAction, setPendingAction] = useState<StarterPassAction | null>(
		null,
	);
	const [note, setNote] = useState("");
	const [submitted, setSubmitted] = useState(false);
	const trimmedNote = note.trim();
	const noteIsValid =
		trimmedNote.length >= NOTE_MIN_LENGTH &&
		trimmedNote.length <= NOTE_MAX_LENGTH;
	// An older API sends no field. Then the card cannot know the state and offers no action.
	const nextAction: StarterPassAction | null =
		starterPass === undefined ? null : starterPass ? "revoke" : "grant";

	function handleOpenChange(open: boolean) {
		if (open || isPending) {
			return;
		}
		setPendingAction(null);
		setNote("");
		setSubmitted(false);
	}

	async function handleConfirm(event: MouseEvent<HTMLButtonElement>) {
		event.preventDefault();
		setSubmitted(true);

		if (!pendingAction || !noteIsValid) {
			return;
		}

		try {
			await onChange(pendingAction, trimmedNote);
			toast.success(
				pendingAction === "grant"
					? `Starter pass granted to ${poolLabel}.`
					: `Starter pass revoked for ${poolLabel}.`,
			);
			setPendingAction(null);
			setNote("");
			setSubmitted(false);
		} catch (error) {
			toast.error(
				isApiClientError(error) &&
					error.code === ADMIN_PERMISSION_REQUIRED_ERROR_CODE
					? "Your permissions changed. Reload the page to refresh your access."
					: isApiClientError(error)
						? error.message
						: "The Starter pass could not be changed. Please try again.",
			);
		}
	}

	return (
		<Card className="shadow-none">
			<CardHeader className="space-y-1.5">
				<div className="flex flex-wrap items-center gap-2">
					<CardTitle>Starter pass</CardTitle>
					{starterPass === undefined ? (
						<Badge variant="outline" className="text-muted-foreground">
							Unknown
						</Badge>
					) : starterPass ? (
						<Badge
							variant="outline"
							className="border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300"
						>
							Active
						</Badge>
					) : (
						<Badge variant="secondary">None</Badge>
					)}
				</div>
				<CardDescription>
					While the Starter pass switch is on, a pool without a pass cannot
					spend credits.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-5">
				{starterPass === undefined ? (
					<p className="text-muted-foreground text-sm">
						The API did not send the Starter pass state. Deploy the newer API to
						see it.
					</p>
				) : starterPass ? (
					<dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
						<DetailItem label="Since">
							{formatAdminDateTime(starterPass.createdAt)}
						</DetailItem>
						<DetailItem label="Source">
							{STARTER_PASS_SOURCE_LABELS[starterPass.source]}
						</DetailItem>
						{starterPass.grantedByUserId ? (
							<DetailItem label="Granted by">
								<Link
									to="/users/$userId"
									params={{ userId: starterPass.grantedByUserId }}
									className="truncate font-mono text-xs hover:underline"
								>
									{starterPass.grantedByUserId}
								</Link>
							</DetailItem>
						) : null}
						{starterPass.note ? (
							<DetailItem label="Note">{starterPass.note}</DetailItem>
						) : null}
					</dl>
				) : (
					<p className="text-muted-foreground text-sm">
						No live pass. It comes from a $1 card or SlickPay payment, an
						offline top-up, or a staff grant.
					</p>
				)}

				{nextAction && canChange ? (
					<div>
						<Button
							type="button"
							size="sm"
							variant={nextAction === "revoke" ? "outline" : "default"}
							onClick={() => setPendingAction(nextAction)}
						>
							{nextAction === "revoke" ? (
								<TicketXIcon data-icon="inline-start" aria-hidden="true" />
							) : (
								<TicketCheckIcon data-icon="inline-start" aria-hidden="true" />
							)}
							{nextAction === "revoke" ? "Revoke pass" : "Grant pass"}
						</Button>
					</div>
				) : null}
				{nextAction && !canChange && readOnlyHint ? (
					<p className="text-muted-foreground text-sm">{readOnlyHint}</p>
				) : null}
			</CardContent>

			<AlertDialog
				open={pendingAction !== null}
				onOpenChange={handleOpenChange}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogMedia>
							{pendingAction === "revoke" ? (
								<TicketXIcon aria-hidden="true" />
							) : (
								<TicketCheckIcon aria-hidden="true" />
							)}
						</AlertDialogMedia>
						<AlertDialogTitle>
							{pendingAction === "revoke"
								? "Revoke the Starter pass?"
								: "Grant the Starter pass?"}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{pendingAction === "revoke"
								? `While the switch is on, ${poolLabel} cannot spend credits until it pays again or gets a new grant. Credits stay in the wallet.`
								: `After the grant, ${poolLabel} can spend its credits while the switch is on. No money is charged.`}
						</AlertDialogDescription>
					</AlertDialogHeader>

					<Field data-invalid={submitted && !noteIsValid}>
						<FieldLabel htmlFor="starter-pass-note">Note</FieldLabel>
						<Textarea
							id="starter-pass-note"
							value={note}
							onChange={(event) => setNote(event.target.value)}
							placeholder="Trusted partner, payment checked by hand, fraud…"
							aria-invalid={submitted && !noteIsValid}
							maxLength={NOTE_MAX_LENGTH}
						/>
						<FieldDescription>
							The note goes to the audit log. Only administrators see it.
						</FieldDescription>
						<FieldError>
							{submitted && !noteIsValid
								? `Write a note of ${NOTE_MIN_LENGTH} to ${NOTE_MAX_LENGTH} characters.`
								: null}
						</FieldError>
					</Field>

					<AlertDialogFooter>
						<AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							variant={pendingAction === "revoke" ? "destructive" : "default"}
							disabled={isPending}
							onClick={handleConfirm}
						>
							{isPending ? (
								<Loader2Icon
									data-icon="inline-start"
									className="animate-spin"
									aria-hidden="true"
								/>
							) : null}
							{isPending
								? "Saving…"
								: pendingAction === "revoke"
									? "Revoke pass"
									: "Grant pass"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Card>
	);
}

function DetailItem({ label, children }: PropsWithChildren<{ label: string }>) {
	return (
		<div className="flex min-w-0 flex-col gap-1">
			<dt className="text-muted-foreground text-xs">{label}</dt>
			<dd className="min-w-0 break-words font-medium text-sm">{children}</dd>
		</div>
	);
}

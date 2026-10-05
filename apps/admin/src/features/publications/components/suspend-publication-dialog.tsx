/**
 * Confirm dialog of the take-down switch of a V2 app. It suspends the app
 * with a reason and an optional note, or it lifts the suspension.
 * `PublicationSuspensionAction` opens it; it calls the publication mutations.
 */
import {
	ADMIN_PERMISSION_REQUIRED_ERROR_CODE,
	suspendedReasonCodes,
} from "@wandit/contracts";
import { BanIcon, Loader2Icon, PlayIcon } from "lucide-react";
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
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
	AdminPublication,
	SuspendedReasonCode,
} from "@/features/publications/api/publications.dto";
import {
	useSuspendPublicationMutation,
	useUnsuspendPublicationMutation,
} from "@/features/publications/api/publications.mutations";
import { SUSPENDED_REASON_LABELS } from "@/features/publications/lib/formatters";
import { isApiClientError } from "@/lib/api-client";

type SuspendPublicationDialogProps = {
	/** A log row of kind "app". Its `suspension` decides between suspend and unsuspend. */
	publication: AdminPublication;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

/**
 * Suspends or unsuspends the app of `publication`. The dialog ignores close
 * requests while a call runs.
 */
export function SuspendPublicationDialog({
	publication,
	open,
	onOpenChange,
}: SuspendPublicationDialogProps) {
	const [reasonCode, setReasonCode] = useState<SuspendedReasonCode | null>(
		null,
	);
	const [note, setNote] = useState("");
	const [submitted, setSubmitted] = useState(false);
	const suspendMutation = useSuspendPublicationMutation();
	const unsuspendMutation = useUnsuspendPublicationMutation();
	const isSuspended = publication.suspension !== null;
	const isPending = suspendMutation.isPending || unsuspendMutation.isPending;
	const projectName = publication.project.name;

	function resetForm() {
		setReasonCode(null);
		setNote("");
		setSubmitted(false);
	}

	function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen && isPending) {
			return;
		}
		if (!nextOpen) {
			resetForm();
		}
		onOpenChange(nextOpen);
	}

	function handleReasonChange(value: string) {
		setReasonCode(suspendedReasonCodes.find((code) => code === value) ?? null);
	}

	async function handleConfirm(event: MouseEvent<HTMLButtonElement>) {
		event.preventDefault();
		setSubmitted(true);

		try {
			if (isSuspended) {
				await unsuspendMutation.mutateAsync(publication.project.id);
				toast.success(`${projectName} is live again.`);
			} else {
				if (reasonCode === null) {
					return;
				}
				await suspendMutation.mutateAsync({
					projectId: publication.project.id,
					reasonCode,
					note: note.trim() || undefined,
				});
				toast.success(`${projectName} is suspended.`);
			}
			resetForm();
			onOpenChange(false);
		} catch (error) {
			toast.error(
				isApiClientError(error) &&
					error.code === ADMIN_PERMISSION_REQUIRED_ERROR_CODE
					? "Your permissions changed. Reload the page to refresh your access."
					: isApiClientError(error)
						? error.message
						: isSuspended
							? "The app could not be unsuspended. Please try again."
							: "The app could not be suspended. Please try again.",
			);
		}
	}

	return (
		<AlertDialog open={open} onOpenChange={handleOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogMedia>
						{isSuspended ? (
							<PlayIcon aria-hidden="true" />
						) : (
							<BanIcon aria-hidden="true" />
						)}
					</AlertDialogMedia>
					<AlertDialogTitle>
						{isSuspended ? "Unsuspend this app?" : "Suspend this app?"}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{isSuspended
							? `${projectName} will serve again on its Wandit address and its custom domains. The owner can publish again.`
							: `${projectName} will stop serving on its Wandit address and its custom domains. The owner cannot publish or roll back until an admin unsuspends it.`}
					</AlertDialogDescription>
				</AlertDialogHeader>

				{isSuspended ? null : (
					<FieldGroup>
						<Field data-invalid={submitted && reasonCode === null}>
							<FieldLabel htmlFor={`suspend-reason-${publication.id}`}>
								Reason
							</FieldLabel>
							<Select
								value={reasonCode ?? ""}
								onValueChange={handleReasonChange}
								disabled={isPending}
							>
								<SelectTrigger
									id={`suspend-reason-${publication.id}`}
									className="w-full"
									aria-invalid={submitted && reasonCode === null}
								>
									<SelectValue placeholder="Select a reason" />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										{suspendedReasonCodes.map((code) => (
											<SelectItem key={code} value={code}>
												{SUSPENDED_REASON_LABELS[code]}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
							<FieldError>
								{submitted && reasonCode === null
									? "Select a reason before you suspend this app."
									: null}
							</FieldError>
						</Field>
						<Field>
							<FieldLabel htmlFor={`suspend-note-${publication.id}`}>
								Note (optional)
							</FieldLabel>
							<Textarea
								id={`suspend-note-${publication.id}`}
								value={note}
								onChange={(event) => setNote(event.target.value)}
								placeholder="Report link, ticket number, or what you saw…"
								disabled={isPending}
								// The API accepts at most 500 characters.
								maxLength={500}
							/>
							<FieldDescription>
								Only staff see this note. The app owner does not.
							</FieldDescription>
						</Field>
					</FieldGroup>
				)}

				<AlertDialogFooter>
					<AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						variant={isSuspended ? "default" : "destructive"}
						disabled={isPending}
						onClick={handleConfirm}
					>
						{isPending ? (
							<Loader2Icon
								data-icon="inline-start"
								className="animate-spin"
								aria-hidden="true"
							/>
						) : isSuspended ? (
							<PlayIcon data-icon="inline-start" aria-hidden="true" />
						) : (
							<BanIcon data-icon="inline-start" aria-hidden="true" />
						)}
						{isPending
							? "Saving…"
							: isSuspended
								? "Unsuspend app"
								: "Suspend app"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

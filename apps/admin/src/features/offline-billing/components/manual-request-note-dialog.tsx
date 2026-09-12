/**
 * Collects admin notes and closure reasons from request row actions.
 * Uses the request mutation and reports API errors through toasts.
 */
import {
	BanIcon,
	Loader2Icon,
	MessageSquareTextIcon,
	XCircleIcon,
} from "lucide-react";
import { type FormEvent, useState } from "react";
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { AdminManualRequest } from "@/features/offline-billing/api/offline-billing.dto";
import { useUpdateManualRequestMutation } from "@/features/offline-billing/api/offline-billing.mutations";
import {
	type ManualRequestNoteMode,
	mapManualRequestNoteFormDto,
} from "@/features/offline-billing/lib/offline-billing";
import { isApiClientError } from "@/lib/api-client";

type ManualRequestNoteDialogProps = {
	request: AdminManualRequest;
	mode: ManualRequestNoteMode;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

/** Reopening the dialog loads the latest saved note into a fresh form. */
export function ManualRequestNoteDialog(props: ManualRequestNoteDialogProps) {
	if (!props.open) {
		return null;
	}

	return <OpenManualRequestNoteDialog {...props} />;
}

function OpenManualRequestNoteDialog({
	request,
	mode,
	onOpenChange,
}: ManualRequestNoteDialogProps) {
	const [note, setNote] = useState(request.adminNotes ?? "");
	const [submitted, setSubmitted] = useState(false);
	const mutation = useUpdateManualRequestMutation();
	// Null means the form is not valid for this mode.
	const body = mapManualRequestNoteFormDto(mode, note);
	const noteIsValid = body !== null;
	const content = {
		note: {
			Icon: MessageSquareTextIcon,
			title: "Edit admin note",
			description: `Keep internal follow-up context for ${request.fullName}.`,
			submitLabel: "Save note",
			successMessage: "Admin note updated.",
			validationMessage: "Keep the note under 2,000 characters.",
		},
		reject: {
			Icon: XCircleIcon,
			title: "Reject offline request",
			description: `Record why ${request.fullName}'s request will not proceed.`,
			submitLabel: "Reject request",
			successMessage: "Offline request rejected.",
			validationMessage: "Enter a rejection note.",
		},
		cancel: {
			Icon: BanIcon,
			title: "Cancel offline request",
			description: `Record why ${request.fullName} canceled the order.`,
			submitLabel: "Cancel request",
			successMessage: "Offline request canceled.",
			validationMessage: "Enter a cancellation note.",
		},
	}[mode];

	function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen && mutation.isPending) {
			return;
		}
		onOpenChange(nextOpen);
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSubmitted(true);
		if (body === null) {
			return;
		}

		try {
			await mutation.mutateAsync({ requestId: request.id, body });
			toast.success(content.successMessage);
			onOpenChange(false);
		} catch (error) {
			toast.error(
				isApiClientError(error)
					? error.message
					: "The offline request could not be updated. Please try again.",
			);
		}
	}

	const { Icon } = content;

	return (
		<Dialog open onOpenChange={handleOpenChange}>
			<DialogContent>
				<form
					onSubmit={handleSubmit}
					className="flex flex-col gap-6"
					noValidate
				>
					<DialogHeader>
						<div className="flex items-center gap-3">
							<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
								<Icon aria-hidden="true" />
							</div>
							<div>
								<DialogTitle>{content.title}</DialogTitle>
								<DialogDescription className="mt-1">
									{content.description}
								</DialogDescription>
							</div>
						</div>
					</DialogHeader>

					<Field data-invalid={submitted && !noteIsValid}>
						<FieldLabel htmlFor="manual-request-admin-note">
							Admin note{mode === "note" ? " (optional)" : ""}
						</FieldLabel>
						<Textarea
							id="manual-request-admin-note"
							value={note}
							onChange={(event) => setNote(event.target.value)}
							disabled={mutation.isPending}
							maxLength={2000}
							className="min-h-32"
							autoFocus
						/>
						<FieldError>
							{submitted && !noteIsValid ? content.validationMessage : null}
						</FieldError>
					</Field>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => handleOpenChange(false)}
							disabled={mutation.isPending}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							// Both closure actions remove the request from the open queue.
							variant={mode === "note" ? "default" : "destructive"}
							disabled={mutation.isPending}
						>
							{mutation.isPending ? (
								<Loader2Icon
									className="animate-spin"
									data-icon="inline-start"
									aria-hidden="true"
								/>
							) : (
								<Icon data-icon="inline-start" aria-hidden="true" />
							)}
							{mutation.isPending ? "Saving…" : content.submitLabel}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

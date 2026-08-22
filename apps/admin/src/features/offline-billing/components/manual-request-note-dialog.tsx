import { Loader2Icon, MessageSquareTextIcon, XCircleIcon } from "lucide-react";
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
import { isApiClientError } from "@/lib/api-client";

type ManualRequestNoteDialogProps = {
	request: AdminManualRequest;
	mode: "note" | "reject";
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

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
	const trimmedNote = note.trim();
	const noteIsValid =
		trimmedNote.length <= 2000 && (mode !== "reject" || trimmedNote.length > 0);

	function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen && mutation.isPending) {
			return;
		}
		onOpenChange(nextOpen);
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSubmitted(true);
		if (!noteIsValid) {
			return;
		}

		try {
			await mutation.mutateAsync({
				requestId: request.id,
				body:
					mode === "reject"
						? { status: "rejected", adminNotes: trimmedNote }
						: { adminNotes: trimmedNote || null },
			});
			toast.success(
				mode === "reject" ? "Offline request rejected." : "Admin note updated.",
			);
			onOpenChange(false);
		} catch (error) {
			toast.error(
				isApiClientError(error)
					? error.message
					: "The offline request could not be updated. Please try again.",
			);
		}
	}

	const Icon = mode === "reject" ? XCircleIcon : MessageSquareTextIcon;

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
								<DialogTitle>
									{mode === "reject"
										? "Reject offline request"
										: "Edit admin note"}
								</DialogTitle>
								<DialogDescription className="mt-1">
									{mode === "reject"
										? `Record why ${request.fullName}'s request will not proceed.`
										: `Keep internal follow-up context for ${request.fullName}.`}
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
							{submitted && !noteIsValid
								? mode === "reject"
									? "Enter a rejection note."
									: "Keep the note under 2,000 characters."
								: null}
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
							variant={mode === "reject" ? "destructive" : "default"}
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
							{mutation.isPending
								? "Saving…"
								: mode === "reject"
									? "Reject request"
									: "Save note"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

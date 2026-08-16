import { updateStoryLinkInputSchema } from "@wandit/contracts";
import { Loader2Icon } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StoryLinkListItem } from "@/features/story-links/api/story-links.dto";
import { useUpdateStoryLinkMutation } from "@/features/story-links/api/story-links.mutations";

type RenameStoryLinkDialogProps = {
	link: StoryLinkListItem;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

function RenameStoryLinkDialog({
	link,
	open,
	onOpenChange,
}: RenameStoryLinkDialogProps) {
	const updateMutation = useUpdateStoryLinkMutation();
	const submittingRef = useRef(false);
	const [name, setName] = useState(link.name);
	const [nameError, setNameError] = useState<string | null>(null);
	const [requestError, setRequestError] = useState<string | null>(null);
	const pending = updateMutation.isPending;

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (submittingRef.current) {
			return;
		}

		setRequestError(null);
		const parsed = updateStoryLinkInputSchema.safeParse({ name: name.trim() });

		if (!parsed.success) {
			setNameError("Enter a name with 200 characters or fewer.");
			return;
		}

		setNameError(null);
		submittingRef.current = true;
		try {
			await updateMutation.mutateAsync({
				storyLinkId: link.id,
				data: parsed.data,
			});
			toast.success(`${parsed.data.name} was renamed.`);
			onOpenChange(false);
		} catch (error) {
			setRequestError(
				error instanceof Error && error.message
					? error.message
					: "The story link could not be renamed.",
			);
		} finally {
			submittingRef.current = false;
		}
	}

	return (
		<Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
			<DialogContent className="sm:max-w-md">
				<form onSubmit={submit} noValidate className="space-y-5">
					<DialogHeader>
						<DialogTitle>Rename story link</DialogTitle>
						<DialogDescription>
							Only the display name changes. The slug and UTM values stay the
							same.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-2">
						<Label htmlFor="story-link-rename">Name</Label>
						<Input
							id="story-link-rename"
							value={name}
							onChange={(event) => {
								setName(event.target.value);
								setNameError(null);
								setRequestError(null);
							}}
							maxLength={200}
							required
							autoFocus
							aria-invalid={Boolean(nameError)}
							aria-describedby={
								nameError ? "story-link-rename-error" : undefined
							}
						/>
						{nameError ? (
							<p
								id="story-link-rename-error"
								role="alert"
								className="text-destructive text-xs"
							>
								{nameError}
							</p>
						) : null}
					</div>

					{requestError ? (
						<p
							role="alert"
							className="rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-destructive text-sm"
						>
							{requestError}
						</p>
					) : null}

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							disabled={pending}
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={pending || name.trim() === link.name}
						>
							{pending ? <Loader2Icon className="animate-spin" /> : null}
							{pending ? "Saving…" : "Save name"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

export type { RenameStoryLinkDialogProps };
export { RenameStoryLinkDialog };

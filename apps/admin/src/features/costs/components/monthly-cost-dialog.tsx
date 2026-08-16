import type { MonthlyCostEntry } from "@wandit/contracts";
import { Loader2Icon, ReceiptTextIcon } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import { toast } from "sonner";
import type { ZodError } from "zod";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	useCreateMonthlyCostMutation,
	useUpdateMonthlyCostMutation,
} from "@/features/costs/api/costs.mutations";
import { MonthlyCostFormFields } from "@/features/costs/components/monthly-cost-form-fields";
import { formatCostMonth } from "@/features/costs/lib/cost-formatters";
import {
	monthlyCostFormSchema,
	monthlyCostFormValuesFromEntry,
	toMonthlyCostUpdateRequest,
} from "@/features/costs/lib/monthly-cost-form";
import { isApiClientError } from "@/lib/api-client";

type MonthlyCostDialogProps = {
	entry?: MonthlyCostEntry;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onReload: () => Promise<void>;
};

export function MonthlyCostDialog({
	entry,
	open,
	onOpenChange,
	onReload,
}: MonthlyCostDialogProps) {
	const [values, setValues] = useState(() =>
		monthlyCostFormValuesFromEntry(entry),
	);
	const [formError, setFormError] = useState<ZodError | null>(null);
	const submittingRef = useRef(false);
	const createMutation = useCreateMonthlyCostMutation();
	const updateMutation = useUpdateMonthlyCostMutation();
	const isPending = createMutation.isPending || updateMutation.isPending;
	const isEditing = entry !== undefined;

	function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen && isPending) {
			return;
		}
		onOpenChange(nextOpen);
	}

	async function handleConflict() {
		try {
			await onReload();
			onOpenChange(false);
			toast.error(
				isEditing
					? "This month changed elsewhere. The row was reloaded; open it again to edit."
					: "That month already exists. The table was reloaded; edit its row instead.",
			);
		} catch {
			toast.error(
				isEditing
					? "This month changed elsewhere. Reload the row before editing again."
					: "That month already exists. Reload the table and edit its row instead.",
			);
		}
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (submittingRef.current) {
			return;
		}

		const parsed = monthlyCostFormSchema.safeParse(values);
		if (!parsed.success) {
			setFormError(parsed.error);
			return;
		}

		setFormError(null);
		submittingRef.current = true;

		try {
			if (entry) {
				const update = toMonthlyCostUpdateRequest(parsed.data, entry.version);
				if (!update.success) {
					setFormError(update.error);
					return;
				}

				await updateMutation.mutateAsync({
					month: entry.month,
					data: update.data,
				});
				toast.success(`${formatCostMonth(entry.month)} costs updated.`);
			} else {
				await createMutation.mutateAsync(parsed.data);
				toast.success(`${formatCostMonth(parsed.data.month)} costs added.`);
			}

			onOpenChange(false);
		} catch (error) {
			if (isApiClientError(error) && error.status === 409) {
				await handleConflict();
				return;
			}

			toast.error(
				isApiClientError(error)
					? error.message
					: `Monthly costs could not be ${isEditing ? "updated" : "added"}. Please try again.`,
			);
		} finally {
			submittingRef.current = false;
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="max-h-[min(90vh,56rem)] overflow-y-auto sm:max-w-2xl">
				<form
					className="flex flex-col gap-6"
					noValidate
					onSubmit={handleSubmit}
				>
					<DialogHeader>
						<div className="flex items-center gap-3">
							<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
								<ReceiptTextIcon aria-hidden="true" />
							</div>
							<div className="flex min-w-0 flex-col gap-1">
								<DialogTitle>
									{entry
										? `Edit ${formatCostMonth(entry.month)}`
										: "Add monthly costs"}
								</DialogTitle>
								<DialogDescription>
									Record full-calendar-month actuals in USD. Analytics prorates
									them for partial date ranges.
								</DialogDescription>
							</div>
						</div>
					</DialogHeader>

					<MonthlyCostFormFields
						isEditing={isEditing}
						values={values}
						formError={formError}
						setValues={setValues}
					/>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							disabled={isPending}
							onClick={() => handleOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending ? (
								<Loader2Icon className="animate-spin" aria-hidden="true" />
							) : (
								<ReceiptTextIcon aria-hidden="true" />
							)}
							{isPending
								? isEditing
									? "Saving…"
									: "Adding…"
								: isEditing
									? "Save changes"
									: "Add month"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

import type { MonthlyCostEntry } from "@wandit/contracts";
import {
	AlertCircleIcon,
	Loader2Icon,
	PlusIcon,
	RefreshCwIcon,
	Trash2Icon,
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
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeleteMonthlyCostMutation } from "@/features/costs/api/costs.mutations";
import { useMonthlyCostsQuery } from "@/features/costs/api/costs.queries";
import { MonthlyCostDialog } from "@/features/costs/components/monthly-cost-dialog";
import { MonthlyCostsTable } from "@/features/costs/components/monthly-costs-table";
import { formatCostMonth } from "@/features/costs/lib/cost-formatters";
import { isApiClientError } from "@/lib/api-client";

type CostDialogState =
	| { mode: "create" }
	| { mode: "edit"; entry: MonthlyCostEntry }
	| null;

const costSkeletonRowKeys = [
	"cost-row-1",
	"cost-row-2",
	"cost-row-3",
	"cost-row-4",
	"cost-row-5",
	"cost-row-6",
] as const;

export function MonthlyCostsPage() {
	const costsQuery = useMonthlyCostsQuery();
	const deleteMutation = useDeleteMonthlyCostMutation();
	const [dialogState, setDialogState] = useState<CostDialogState>(null);
	const [deleteEntry, setDeleteEntry] = useState<MonthlyCostEntry | null>(null);

	async function reloadCosts() {
		const result = await costsQuery.refetch();
		if (result.error) {
			throw result.error;
		}
	}

	async function confirmDelete(event: MouseEvent<HTMLButtonElement>) {
		event.preventDefault();
		if (!deleteEntry) {
			return;
		}

		try {
			await deleteMutation.mutateAsync(deleteEntry.month);
			toast.success(`${formatCostMonth(deleteEntry.month)} costs deleted.`);
			setDeleteEntry(null);
		} catch (error) {
			toast.error(
				isApiClientError(error)
					? error.message
					: "Monthly costs could not be deleted. Please try again.",
			);
		}
	}

	if (costsQuery.isLoading) {
		return <MonthlyCostsPageSkeleton />;
	}

	if (!costsQuery.data) {
		return (
			<div className="mx-auto w-full max-w-[1600px]">
				<Empty className="min-h-(--content-full-height) border bg-background">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<AlertCircleIcon aria-hidden="true" />
						</EmptyMedia>
						<EmptyTitle>Could not load monthly costs</EmptyTitle>
						<EmptyDescription>
							No cost data was changed. Try loading the table again.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button type="button" onClick={() => void costsQuery.refetch()}>
							<RefreshCwIcon aria-hidden="true" />
							Try again
						</Button>
					</EmptyContent>
				</Empty>
			</div>
		);
	}

	return (
		<div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
			{costsQuery.isError ? (
				<div
					role="alert"
					className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-destructive text-sm"
				>
					<span>
						The displayed costs could not be refreshed and may be stale.
					</span>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => void costsQuery.refetch()}
					>
						<RefreshCwIcon aria-hidden="true" />
						Retry
					</Button>
				</div>
			) : null}

			<header className="flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
				<div className="flex max-w-3xl flex-col gap-2">
					<p className="font-mono text-muted-foreground text-xs uppercase tracking-[0.16em]">
						Product operations
					</p>
					<h1 className="font-semibold text-2xl tracking-tight">
						Monthly costs
					</h1>
					<p className="text-muted-foreground text-sm leading-relaxed">
						Maintain the cost coverage used by acquisition CAC and revenue unit
						economics. The default view contains the latest 12 months.
					</p>
				</div>
				<Button
					type="button"
					onClick={() => setDialogState({ mode: "create" })}
				>
					<PlusIcon aria-hidden="true" />
					Add month
				</Button>
			</header>

			<MonthlyCostsTable
				months={costsQuery.data.months}
				onEdit={(entry) => setDialogState({ mode: "edit", entry })}
				onDelete={setDeleteEntry}
			/>

			{dialogState ? (
				<MonthlyCostDialog
					key={
						dialogState.mode === "edit"
							? `edit-${dialogState.entry.month}-${dialogState.entry.version}`
							: "create"
					}
					entry={dialogState.mode === "edit" ? dialogState.entry : undefined}
					open
					onOpenChange={(open) => {
						if (!open) {
							setDialogState(null);
						}
					}}
					onReload={reloadCosts}
				/>
			) : null}

			<AlertDialog
				open={deleteEntry !== null}
				onOpenChange={(open) => {
					if (!open && !deleteMutation.isPending) {
						setDeleteEntry(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete monthly costs?</AlertDialogTitle>
						<AlertDialogDescription>
							{deleteEntry
								? `${formatCostMonth(deleteEntry.month)} will no longer count as covered cost data. Cost-derived analytics spanning that month will become unavailable until it is added again.`
								: "This monthly cost record will be deleted."}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={deleteMutation.isPending}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							disabled={deleteMutation.isPending}
							onClick={confirmDelete}
						>
							{deleteMutation.isPending ? (
								<Loader2Icon className="animate-spin" aria-hidden="true" />
							) : (
								<Trash2Icon aria-hidden="true" />
							)}
							{deleteMutation.isPending ? "Deleting…" : "Delete month"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

function MonthlyCostsPageSkeleton() {
	return (
		<div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
			<div className="flex flex-col gap-3 border-b pb-6">
				<Skeleton className="h-3 w-32" />
				<Skeleton className="h-8 w-56" />
				<Skeleton className="h-4 w-full max-w-xl" />
			</div>
			<div className="overflow-hidden rounded-xl border">
				<div className="border-b p-6">
					<Skeleton className="h-5 w-40" />
				</div>
				<div className="space-y-4 p-6">
					{costSkeletonRowKeys.map((key) => (
						<Skeleton key={key} className="h-10 w-full" />
					))}
				</div>
			</div>
		</div>
	);
}

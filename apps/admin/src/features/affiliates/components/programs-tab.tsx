import type {
	AffiliateProgramKind,
	AffiliateProgramListItem,
	AffiliateProgramStatus,
	CreateAffiliateProgramInput,
	UpdateAffiliateProgramInput,
} from "@wandit/contracts";
import {
	ArchiveIcon,
	Loader2Icon,
	PencilIcon,
	PlusIcon,
	RefreshCwIcon,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
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
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	useArchiveAffiliateProgramMutation,
	useCreateAffiliateProgramMutation,
	useUpdateAffiliateProgramMutation,
} from "../api/affiliates.mutations";
import { useAffiliateProgramsQuery } from "../api/affiliates.queries";
import {
	formatAffiliateMoney,
	formatAffiliateNumber,
	formatAffiliateRateBps,
	titleCaseAffiliateValue,
} from "../lib/formatters";
import {
	AffiliateSectionMessage,
	AffiliateStatusBadge,
	AffiliateTableLoading,
	CurrencyValues,
	PaginationControls,
} from "./affiliate-ui";

const PAGE_SIZE = 12;

export function ProgramsTab() {
	const [page, setPage] = useState(1);
	const [query, setQuery] = useState("");
	const [kind, setKind] = useState<AffiliateProgramKind | "all">("all");
	const [status, setStatus] = useState<AffiliateProgramStatus | "all">("all");
	const [editorOpen, setEditorOpen] = useState(false);
	const [editing, setEditing] = useState<AffiliateProgramListItem | null>(null);
	const [archiveTarget, setArchiveTarget] =
		useState<AffiliateProgramListItem | null>(null);
	const archiveMutation = useArchiveAffiliateProgramMutation();
	const programsQuery = useAffiliateProgramsQuery({
		page,
		pageSize: PAGE_SIZE,
		q: query.trim() || undefined,
		kind: kind === "all" ? undefined : kind,
		status: status === "all" ? undefined : status,
	});

	function openCreate() {
		setEditing(null);
		setEditorOpen(true);
	}

	function openEdit(program: AffiliateProgramListItem) {
		setEditing(program);
		setEditorOpen(true);
	}

	async function archiveProgram() {
		if (!archiveTarget) {
			return;
		}
		try {
			await archiveMutation.mutateAsync(archiveTarget.program.id);
			toast.success(`${archiveTarget.program.name} was archived.`);
			setArchiveTarget(null);
		} catch (error) {
			toast.error(errorMessage(error, "The program could not be archived."));
		}
	}

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
				<div>
					<h2 className="font-semibold text-lg">Affiliate programs</h2>
					<p className="text-muted-foreground text-sm">
						Program terms are snapshotted when a user is attributed.
					</p>
				</div>
				<Button type="button" onClick={openCreate}>
					<PlusIcon />
					Create program
				</Button>
			</div>

			<div className="flex flex-col gap-2 rounded-lg border bg-background p-3 sm:flex-row">
				<Input
					value={query}
					onChange={(event) => {
						setQuery(event.target.value);
						setPage(1);
					}}
					placeholder="Search programs..."
					className="sm:max-w-xs"
				/>
				<Select
					value={kind}
					onValueChange={(value) => {
						setKind(value as AffiliateProgramKind | "all");
						setPage(1);
					}}
				>
					<SelectTrigger className="w-full sm:w-52">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All kinds</SelectItem>
						<SelectItem value="percentage_recurring">
							Percentage recurring
						</SelectItem>
						<SelectItem value="fixed_one_time">Fixed one-time</SelectItem>
					</SelectContent>
				</Select>
				<Select
					value={status}
					onValueChange={(value) => {
						setStatus(value as AffiliateProgramStatus | "all");
						setPage(1);
					}}
				>
					<SelectTrigger className="w-full sm:w-40">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All statuses</SelectItem>
						<SelectItem value="active">Active</SelectItem>
						<SelectItem value="archived">Archived</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{programsQuery.isPending ? (
				<AffiliateTableLoading columns={8} />
			) : programsQuery.isError || !programsQuery.data ? (
				<AffiliateSectionMessage
					title="Programs could not be loaded"
					description={errorMessage(
						programsQuery.error,
						"Retry the request to restore program management.",
					)}
					action={
						<Button type="button" onClick={() => void programsQuery.refetch()}>
							<RefreshCwIcon />
							Retry
						</Button>
					}
				/>
			) : programsQuery.data.items.length === 0 ? (
				<AffiliateSectionMessage
					title="No programs found"
					description="Create a program or clear the filters to see program terms."
					action={
						<Button type="button" onClick={openCreate}>
							<PlusIcon />
							Create program
						</Button>
					}
				/>
			) : (
				<div className="overflow-hidden rounded-lg border bg-background">
					<div className="overflow-x-auto">
						<Table className="min-w-[1050px]">
							<TableHeader>
								<TableRow>
									<TableHead>Program</TableHead>
									<TableHead>Terms</TableHead>
									<TableHead>Duration</TableHead>
									<TableHead>Hold / cookie</TableHead>
									<TableHead>Reach</TableHead>
									<TableHead>Attributed revenue</TableHead>
									<TableHead>Status</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{programsQuery.data.items.map((item) => (
									<TableRow key={item.program.id}>
										<TableCell>
											<p className="font-medium">{item.program.name}</p>
											<p className="font-mono text-[10px] text-muted-foreground">
												{item.program.id}
											</p>
										</TableCell>
										<TableCell>
											<p className="font-medium text-sm">
												{programTerms(item)}
											</p>
											<p className="text-muted-foreground text-xs">
												{titleCaseAffiliateValue(item.program.kind)}
											</p>
										</TableCell>
										<TableCell>
											{item.program.commissionDurationMonths === null
												? "Lifetime"
												: `${item.program.commissionDurationMonths} months`}
										</TableCell>
										<TableCell>
											<p>{item.program.holdDays} day hold</p>
											<p className="text-muted-foreground text-xs">
												{item.program.cookieWindowDays} day cookie
											</p>
										</TableCell>
										<TableCell>
											<p>
												{formatAffiliateNumber(item.aggregates.affiliateCount)}{" "}
												affiliates
											</p>
											<p className="text-muted-foreground text-xs">
												{formatAffiliateNumber(
													item.aggregates.attributedUserCount,
												)}{" "}
												attributed users
											</p>
										</TableCell>
										<TableCell>
											<CurrencyValues
												currencies={item.aggregates.currencies}
												metric="attributedRevenueCents"
											/>
										</TableCell>
										<TableCell>
											<AffiliateStatusBadge status={item.program.status} />
										</TableCell>
										<TableCell>
											<div className="flex justify-end gap-1">
												<Button
													type="button"
													variant="ghost"
													size="icon-sm"
													onClick={() => openEdit(item)}
												>
													<PencilIcon />
													<span className="sr-only">
														Edit {item.program.name}
													</span>
												</Button>
												<Button
													type="button"
													variant="ghost"
													size="icon-sm"
													disabled={item.program.status === "archived"}
													onClick={() => setArchiveTarget(item)}
												>
													<ArchiveIcon />
													<span className="sr-only">
														Archive {item.program.name}
													</span>
												</Button>
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
					<PaginationControls
						page={programsQuery.data.page}
						pageSize={programsQuery.data.pageSize}
						total={programsQuery.data.total}
						onPageChange={setPage}
					/>
				</div>
			)}

			<ProgramEditorDialog
				open={editorOpen}
				onOpenChange={setEditorOpen}
				item={editing}
			/>

			<AlertDialog
				open={Boolean(archiveTarget)}
				onOpenChange={(open) => {
					if (!open && !archiveMutation.isPending) {
						setArchiveTarget(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Archive this program?</AlertDialogTitle>
						<AlertDialogDescription>
							New links can no longer use {archiveTarget?.program.name}.
							Existing attributions retain their snapshotted terms.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={archiveMutation.isPending}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							disabled={archiveMutation.isPending}
							onClick={(event) => {
								event.preventDefault();
								void archiveProgram();
							}}
						>
							{archiveMutation.isPending ? "Archiving…" : "Archive program"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

function ProgramEditorDialog({
	open,
	onOpenChange,
	item,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	item: AffiliateProgramListItem | null;
}) {
	const createMutation = useCreateAffiliateProgramMutation();
	const updateMutation = useUpdateAffiliateProgramMutation();
	const [name, setName] = useState("");
	const [kind, setKind] = useState<AffiliateProgramKind>(
		"percentage_recurring",
	);
	const [ratePercent, setRatePercent] = useState("15");
	const [fixedAmount, setFixedAmount] = useState("25");
	const [fixedCurrency, setFixedCurrency] = useState("usd");
	const [durationMonths, setDurationMonths] = useState("");
	const [holdDays, setHoldDays] = useState("30");
	const [cookieWindowDays, setCookieWindowDays] = useState("60");
	const [status, setStatus] = useState<AffiliateProgramStatus>("active");
	const [requestError, setRequestError] = useState<string | null>(null);
	const pending = createMutation.isPending || updateMutation.isPending;

	useEffect(() => {
		if (!open) {
			return;
		}
		const program = item?.program;
		setName(program?.name ?? "");
		setKind(program?.kind ?? "percentage_recurring");
		setRatePercent(
			program?.kind === "percentage_recurring"
				? String(program.commissionRateBps / 100)
				: "15",
		);
		setFixedAmount(
			program?.kind === "fixed_one_time"
				? String(program.fixedAmountCents / 100)
				: "25",
		);
		setFixedCurrency(
			program?.kind === "fixed_one_time" ? program.fixedCurrency : "usd",
		);
		setDurationMonths(
			program?.commissionDurationMonths === null || !program
				? ""
				: String(program.commissionDurationMonths),
		);
		setHoldDays(String(program?.holdDays ?? 30));
		setCookieWindowDays(String(program?.cookieWindowDays ?? 60));
		setStatus(program?.status ?? "active");
		setRequestError(null);
	}, [item, open]);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setRequestError(null);
		const common = {
			name: name.trim(),
			commissionDurationMonths: durationMonths
				? Number.parseInt(durationMonths, 10)
				: null,
			holdDays: Number.parseInt(holdDays, 10),
			cookieWindowDays: Number.parseInt(cookieWindowDays, 10),
			status,
		};

		let data: CreateAffiliateProgramInput | UpdateAffiliateProgramInput;
		if (kind === "percentage_recurring") {
			data = {
				...common,
				kind,
				commissionRateBps: Math.round(Number(ratePercent) * 100),
			};
		} else {
			data = {
				...common,
				kind,
				fixedAmountCents: Math.round(Number(fixedAmount) * 100),
				fixedCurrency: fixedCurrency.trim().toLowerCase(),
			};
		}

		try {
			if (item) {
				await updateMutation.mutateAsync({
					programId: item.program.id,
					data: data as UpdateAffiliateProgramInput,
				});
				toast.success(`${name.trim()} was updated.`);
			} else {
				await createMutation.mutateAsync(data as CreateAffiliateProgramInput);
				toast.success(`${name.trim()} was created.`);
			}
			onOpenChange(false);
		} catch (error) {
			setRequestError(errorMessage(error, "The program could not be saved."));
		}
	}

	return (
		<Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
				<form onSubmit={submit} className="space-y-5">
					<DialogHeader>
						<DialogTitle>
							{item ? "Edit program" : "Create program"}
						</DialogTitle>
						<DialogDescription>
							Terms apply to new attributions; existing snapshots do not change.
						</DialogDescription>
					</DialogHeader>

					<div className="grid gap-4 sm:grid-cols-2">
						<FormField label="Program name" htmlFor="program-name">
							<Input
								id="program-name"
								value={name}
								onChange={(event) => setName(event.target.value)}
								required
								maxLength={200}
								autoFocus
							/>
						</FormField>
						<FormField label="Commission kind" htmlFor="program-kind">
							<Select
								value={kind}
								onValueChange={(value) =>
									setKind(value as AffiliateProgramKind)
								}
							>
								<SelectTrigger id="program-kind" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="percentage_recurring">
										Percentage recurring
									</SelectItem>
									<SelectItem value="fixed_one_time">Fixed one-time</SelectItem>
								</SelectContent>
							</Select>
						</FormField>

						{kind === "percentage_recurring" ? (
							<FormField label="Commission rate (%)" htmlFor="program-rate">
								<Input
									id="program-rate"
									type="number"
									min={0}
									max={100}
									step={0.01}
									value={ratePercent}
									onChange={(event) => setRatePercent(event.target.value)}
									required
								/>
							</FormField>
						) : (
							<>
								<FormField label="Fixed amount" htmlFor="program-fixed-amount">
									<Input
										id="program-fixed-amount"
										type="number"
										min={0.01}
										step={0.01}
										value={fixedAmount}
										onChange={(event) => setFixedAmount(event.target.value)}
										required
									/>
								</FormField>
								<FormField label="Currency" htmlFor="program-fixed-currency">
									<Input
										id="program-fixed-currency"
										value={fixedCurrency}
										onChange={(event) => setFixedCurrency(event.target.value)}
										pattern="[A-Za-z]{3}"
										maxLength={3}
										required
										className="uppercase"
									/>
								</FormField>
							</>
						)}

						<FormField label="Duration months" htmlFor="program-duration">
							<Input
								id="program-duration"
								type="number"
								min={1}
								max={1200}
								value={durationMonths}
								onChange={(event) => setDurationMonths(event.target.value)}
								placeholder="Empty = lifetime"
							/>
						</FormField>
						<FormField label="Hold days" htmlFor="program-hold">
							<Input
								id="program-hold"
								type="number"
								min={0}
								max={3650}
								value={holdDays}
								onChange={(event) => setHoldDays(event.target.value)}
								required
							/>
						</FormField>
						<FormField label="Cookie window days" htmlFor="program-cookie">
							<Input
								id="program-cookie"
								type="number"
								min={1}
								max={3650}
								value={cookieWindowDays}
								onChange={(event) => setCookieWindowDays(event.target.value)}
								required
							/>
						</FormField>
						<FormField label="Status" htmlFor="program-status">
							<Select
								value={status}
								onValueChange={(value) =>
									setStatus(value as AffiliateProgramStatus)
								}
							>
								<SelectTrigger id="program-status" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="active">Active</SelectItem>
									<SelectItem value="archived">Archived</SelectItem>
								</SelectContent>
							</Select>
						</FormField>
					</div>

					{requestError ? (
						<p className="rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-destructive text-sm">
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
						<Button type="submit" disabled={pending}>
							{pending ? <Loader2Icon className="animate-spin" /> : null}
							{pending ? "Saving…" : "Save program"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function FormField({
	label,
	htmlFor,
	children,
}: {
	label: string;
	htmlFor: string;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-2">
			<Label htmlFor={htmlFor}>{label}</Label>
			{children}
		</div>
	);
}

function programTerms(item: AffiliateProgramListItem) {
	if (item.program.kind === "percentage_recurring") {
		return formatAffiliateRateBps(item.program.commissionRateBps);
	}
	return formatAffiliateMoney(
		item.program.fixedAmountCents,
		item.program.fixedCurrency,
	);
}

function errorMessage(error: unknown, fallback: string) {
	return error instanceof Error && error.message ? error.message : fallback;
}

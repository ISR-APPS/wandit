import type {
	AffiliateLinkListItem,
	AffiliateProgram,
	CreateAffiliateLinkInput,
	UpdateAffiliateLinkInput,
} from "@wandit/contracts";
import {
	CheckIcon,
	ChevronDownIcon,
	CopyIcon,
	Loader2Icon,
} from "lucide-react";
import { type FormEvent, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
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
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
	useCreateAffiliateLinkMutation,
	useUpdateAffiliateLinkMutation,
} from "../api/affiliates.mutations";
import { useAffiliateProgramsQuery } from "../api/affiliates.queries";
import {
	formatAffiliateMoney,
	formatAffiliateRateBps,
} from "../lib/formatters";
import { filterPrograms } from "../lib/program-matching";
import { buildReferralUrl } from "../lib/referral-url";

type LinkEditorPayload = {
	programId: string;
	code: string;
	label: string | null;
	landingPath: string;
	expiresAt: string | null;
	active: boolean;
};

export function LinkEditorDialog({
	affiliateId,
	open,
	onOpenChange,
	initial,
}: {
	affiliateId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initial?: AffiliateLinkListItem | null;
}) {
	const createMutation = useCreateAffiliateLinkMutation();
	const updateMutation = useUpdateAffiliateLinkMutation();
	const pending = createMutation.isPending || updateMutation.isPending;

	async function saveLink(data: LinkEditorPayload) {
		if (initial) {
			await updateMutation.mutateAsync({
				affiliateId,
				linkId: initial.link.id,
				data: data satisfies UpdateAffiliateLinkInput,
			});
			toast.success(`${data.code} was updated.`);
		} else {
			await createMutation.mutateAsync({
				affiliateId,
				data: data satisfies CreateAffiliateLinkInput,
			});
			toast.success(`${data.code} was created.`);
		}
		onOpenChange(false);
	}

	return (
		<Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
			<DialogContent className="sm:max-w-xl">
				{/* Radix unmounts the content after the exit animation, so the keyed
				    form gets fresh state on every open without an effect. */}
				<LinkEditorForm
					key={initial?.link.id ?? "new"}
					initial={initial}
					pending={pending}
					onCancel={() => onOpenChange(false)}
					onSave={saveLink}
				/>
			</DialogContent>
		</Dialog>
	);
}

function LinkEditorForm({
	initial,
	pending,
	onCancel,
	onSave,
}: {
	initial?: AffiliateLinkListItem | null;
	pending: boolean;
	onCancel: () => void;
	onSave: (data: LinkEditorPayload) => Promise<void>;
}) {
	const programTriggerId = useId();
	const programTriggerRef = useRef<HTMLButtonElement>(null);
	const [programPickerOpen, setProgramPickerOpen] = useState(false);
	const [programQuery, setProgramQuery] = useState("");
	// The server caps this list at 100 programs; this picker intentionally does not page further.
	const programsQuery = useAffiliateProgramsQuery({ page: 1, pageSize: 100 });
	const [programId, setProgramId] = useState(
		() => initial?.link.programId ?? "",
	);
	const [code, setCode] = useState(() => initial?.link.code ?? "");
	const [label, setLabel] = useState(() => initial?.link.label ?? "");
	const [landingPath, setLandingPath] = useState(
		() => initial?.link.landingPath ?? "/",
	);
	const [expiresAt, setExpiresAt] = useState(() =>
		toDateTimeInput(initial?.link.expiresAt ?? null),
	);
	const [active, setActive] = useState(() => initial?.link.active ?? true);
	const [programError, setProgramError] = useState<string | null>(null);
	const [requestError, setRequestError] = useState<string | null>(null);
	const availablePrograms = programsQuery.data?.items ?? [];
	// Archived programs cannot be picked, so they do not take window slots.
	// The link's current program stays selectable in edit mode.
	const selectablePrograms = availablePrograms.filter(
		(item) =>
			item.program.status !== "archived" ||
			item.program.id === initial?.link.programId,
	);
	const matchingPrograms = filterPrograms(selectablePrograms, programQuery);
	const programsLoading = programsQuery.isPending;
	// A failed background refetch keeps the last list; only block without data.
	const programsUnavailable = programsQuery.isError && !programsQuery.data;
	const loadedProgramCount = availablePrograms.length;
	const totalProgramCount = programsQuery.data?.total ?? loadedProgramCount;
	const selectedLoadedProgram = availablePrograms.find(
		(item) => item.program.id === programId,
	);
	const selectedInitialProgram =
		initial?.link.programId === programId ? initial.program : null;
	const selectedProgramName =
		selectedLoadedProgram?.program.name ?? selectedInitialProgram?.name ?? null;
	const selectedProgramStatus =
		selectedLoadedProgram?.program.status ??
		selectedInitialProgram?.status ??
		null;
	const selectedProgramTerms = selectedLoadedProgram
		? formatProgramTermsHint(selectedLoadedProgram.program)
		: null;
	const displayQuery = programQuery.trim();
	const referralUrl = buildReferralUrl(
		landingPath || "/",
		code || "PARTNER_CODE",
	);

	function selectProgram(nextProgramId: string) {
		setProgramId(nextProgramId);
		setProgramError(null);
		setProgramPickerOpen(false);
		setProgramQuery("");
	}

	async function copyReferralUrl() {
		try {
			await navigator.clipboard.writeText(
				buildReferralUrl(landingPath || "/", code),
			);
			toast.success("Referral URL copied.");
		} catch {
			toast.error("Copy failed.");
		}
	}

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setRequestError(null);
		setProgramError(null);

		if (!programId) {
			setProgramError("Select a program before saving.");
			programTriggerRef.current?.focus();
			return;
		}

		const data = {
			programId,
			code: code.trim(),
			label: label.trim() || null,
			landingPath: landingPath.trim(),
			expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
			active,
		};

		try {
			await onSave(data);
		} catch (error) {
			setRequestError(
				error instanceof Error && error.message
					? error.message
					: "The referral link could not be saved.",
			);
		}
	}

	return (
		<form onSubmit={submit} className="space-y-5">
			<DialogHeader>
				<DialogTitle>
					{initial ? "Edit referral link" : "Create referral link"}
				</DialogTitle>
				<DialogDescription>
					The selected program owns the commission and cookie-window terms.
				</DialogDescription>
			</DialogHeader>

			<FormField label="Program" htmlFor={programTriggerId}>
				<Popover open={programPickerOpen} onOpenChange={setProgramPickerOpen}>
					<PopoverTrigger asChild>
						<Button
							ref={programTriggerRef}
							id={programTriggerId}
							type="button"
							variant="outline"
							role="combobox"
							aria-expanded={programPickerOpen}
							aria-required="true"
							aria-invalid={Boolean(programError)}
							disabled={programsLoading || programsUnavailable}
							className="h-auto min-h-9 w-full justify-between py-2 text-start font-normal"
						>
							{selectedProgramName ? (
								<span className="min-w-0 flex-1 text-start">
									<span className="block truncate">
										{selectedProgramName}
										{selectedProgramStatus === "archived" ? " (archived)" : ""}
									</span>
									{selectedProgramTerms ? (
										<span className="block truncate text-muted-foreground text-xs">
											{selectedProgramTerms}
										</span>
									) : null}
								</span>
							) : programsLoading ? (
								<span className="min-w-0 flex-1 truncate text-muted-foreground">
									Loading programs…
								</span>
							) : programsUnavailable ? (
								<span className="min-w-0 flex-1 truncate text-muted-foreground">
									Programs unavailable
								</span>
							) : (
								<span className="min-w-0 flex-1 truncate text-muted-foreground">
									Select a program
								</span>
							)}
							{programsLoading ? (
								<Loader2Icon
									aria-hidden="true"
									className="size-4 shrink-0 animate-spin opacity-50"
								/>
							) : (
								<ChevronDownIcon
									aria-hidden="true"
									className="size-4 shrink-0 opacity-50"
								/>
							)}
						</Button>
					</PopoverTrigger>
					<PopoverContent
						align="start"
						className="w-(--radix-popover-trigger-width) max-w-[calc(100vw-2rem)] p-0"
					>
						<Command shouldFilter={false} loop defaultValue={programId}>
							<CommandInput
								value={programQuery}
								onValueChange={setProgramQuery}
								placeholder="Search programs…"
								aria-label="Search programs"
								maxLength={200}
							/>
							<CommandList label="Program search results">
								<CommandEmpty>
									{loadedProgramCount === 0
										? "No programs exist yet. Create a program first."
										: displayQuery
											? `No program matches "${displayQuery}"`
											: "No programs available."}
								</CommandEmpty>
								{matchingPrograms.items.length > 0 ? (
									<CommandGroup heading="Programs">
										{matchingPrograms.items.map((item) => {
											const isArchived = item.program.status === "archived";

											return (
												<CommandItem
													key={item.program.id}
													value={item.program.id}
													onSelect={() => selectProgram(item.program.id)}
													className="items-start py-2.5"
													aria-label={`Select ${item.program.name}${
														isArchived ? " (archived)" : ""
													}`}
												>
													<CheckIcon
														aria-hidden="true"
														className={cn(
															"mt-0.5 size-4",
															programId === item.program.id
																? "opacity-100"
																: "opacity-0",
														)}
													/>
													<span className="min-w-0 flex-1">
														<span className="block truncate font-medium">
															{item.program.name}
															{isArchived ? " (archived)" : ""}
														</span>
														<span className="block truncate text-muted-foreground text-xs">
															{formatProgramTermsHint(item.program)}
														</span>
													</span>
												</CommandItem>
											);
										})}
									</CommandGroup>
								) : null}
								{matchingPrograms.total > matchingPrograms.items.length ? (
									<div className="border-t px-3 py-2 text-center text-muted-foreground text-xs">
										Showing {matchingPrograms.items.length} of{" "}
										{matchingPrograms.total} — keep typing to narrow
									</div>
								) : null}
								{totalProgramCount > loadedProgramCount ? (
									<div className="border-t px-3 py-2 text-center text-muted-foreground text-xs">
										Only the {loadedProgramCount} newest programs are listed.
									</div>
								) : null}
							</CommandList>
						</Command>
					</PopoverContent>
				</Popover>
				{programsUnavailable ? (
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={programsQuery.isFetching}
						onClick={() => void programsQuery.refetch()}
					>
						{programsQuery.isFetching ? (
							<Loader2Icon aria-hidden="true" className="animate-spin" />
						) : null}
						Retry
					</Button>
				) : null}
				{programError ? (
					<p role="alert" className="text-destructive text-sm">
						{programError}
					</p>
				) : null}
			</FormField>

			<div className="grid gap-4 sm:grid-cols-2">
				<FormField label="Code" htmlFor="affiliate-link-code">
					<Input
						id="affiliate-link-code"
						value={code}
						onChange={(event) => setCode(event.target.value)}
						placeholder="PARTNER_2026"
						minLength={6}
						maxLength={128}
						pattern="[A-Za-z0-9][A-Za-z0-9_\-]*"
						required
						className="font-mono"
						autoFocus
					/>
				</FormField>
				<FormField
					label="Label (visible to the partner)"
					htmlFor="affiliate-link-label"
				>
					<Input
						id="affiliate-link-label"
						value={label}
						onChange={(event) => setLabel(event.target.value)}
						placeholder="Optional"
						maxLength={200}
					/>
					<p className="text-muted-foreground text-xs">
						Shown in the partner&apos;s Affiliates page next to the code. Do not
						write internal notes here.
					</p>
				</FormField>
			</div>

			<FormField label="Landing path" htmlFor="affiliate-link-path">
				<Input
					id="affiliate-link-path"
					value={landingPath}
					onChange={(event) => setLandingPath(event.target.value)}
					placeholder="/"
					pattern="\/[^\/].*|\/"
					required
				/>
				<div className="flex min-w-0 items-center gap-1">
					<p
						className="min-w-0 flex-1 break-all text-muted-foreground text-xs"
						title={referralUrl}
					>
						{referralUrl}
					</p>
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						className="shrink-0"
						aria-label="Copy referral URL"
						disabled={!code}
						onClick={() => void copyReferralUrl()}
					>
						<CopyIcon />
					</Button>
				</div>
			</FormField>
			<FormField label="Expires at" htmlFor="affiliate-link-expiry">
				<Input
					id="affiliate-link-expiry"
					type="datetime-local"
					value={expiresAt}
					onChange={(event) => setExpiresAt(event.target.value)}
				/>
			</FormField>
			<div className="flex items-start gap-3 rounded-lg border p-3">
				<Checkbox
					id="affiliate-link-active"
					checked={active}
					onCheckedChange={(value) => setActive(Boolean(value))}
				/>
				<div>
					<Label htmlFor="affiliate-link-active">Active</Label>
					<p className="mt-1 text-muted-foreground text-xs">
						Expired links remain expired even when this switch is on.
					</p>
				</div>
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
					onClick={onCancel}
				>
					Cancel
				</Button>
				<Button type="submit" disabled={pending}>
					{pending ? <Loader2Icon className="animate-spin" /> : null}
					{pending ? "Saving…" : "Save link"}
				</Button>
			</DialogFooter>
		</form>
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

function formatProgramTermsHint(program: AffiliateProgram) {
	if (program.kind === "percentage_recurring") {
		const duration =
			program.commissionDurationMonths === null
				? "lifetime"
				: `${program.commissionDurationMonths} ${
						program.commissionDurationMonths === 1 ? "month" : "months"
					}`;
		return `${formatAffiliateRateBps(program.commissionRateBps)} recurring · ${duration}`;
	}

	return `${formatAffiliateMoney(
		program.fixedAmountCents,
		program.fixedCurrency,
	)} one-time`;
}

function toDateTimeInput(value: string | null) {
	if (!value) {
		return "";
	}

	const date = new Date(value);
	const localTime = new Date(
		date.getTime() - date.getTimezoneOffset() * 60_000,
	);
	return localTime.toISOString().slice(0, 16);
}

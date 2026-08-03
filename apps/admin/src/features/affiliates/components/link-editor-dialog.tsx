import type {
	AffiliateLinkListItem,
	CreateAffiliateLinkInput,
	UpdateAffiliateLinkInput,
} from "@wandit/contracts";
import { Loader2Icon } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
	useCreateAffiliateLinkMutation,
	useUpdateAffiliateLinkMutation,
} from "../api/affiliates.mutations";
import { useAffiliateProgramsQuery } from "../api/affiliates.queries";

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
	const [programQuery, setProgramQuery] = useState("");
	const programsQuery = useAffiliateProgramsQuery({
		page: 1,
		pageSize: 100,
		q: programQuery.trim() || undefined,
	});
	const createMutation = useCreateAffiliateLinkMutation();
	const updateMutation = useUpdateAffiliateLinkMutation();
	const pending = createMutation.isPending || updateMutation.isPending;
	const [programId, setProgramId] = useState("");
	const [code, setCode] = useState("");
	const [label, setLabel] = useState("");
	const [landingPath, setLandingPath] = useState("/start");
	const [expiresAt, setExpiresAt] = useState("");
	const [active, setActive] = useState(true);
	const [requestError, setRequestError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) {
			return;
		}
		setProgramQuery(initial?.program.name ?? "");
		setProgramId(initial?.link.programId ?? "");
		setCode(initial?.link.code ?? "");
		setLabel(initial?.link.label ?? "");
		setLandingPath(initial?.link.landingPath ?? "/start");
		setExpiresAt(toDateTimeInput(initial?.link.expiresAt ?? null));
		setActive(initial?.link.active ?? true);
		setRequestError(null);
	}, [initial, open]);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setRequestError(null);
		const data = {
			programId,
			code: code.trim(),
			label: label.trim() || null,
			landingPath: landingPath.trim(),
			expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
			active,
		};

		try {
			if (initial) {
				await updateMutation.mutateAsync({
					affiliateId,
					linkId: initial.link.id,
					data: data satisfies UpdateAffiliateLinkInput,
				});
				toast.success(`${code.trim()} was updated.`);
			} else {
				await createMutation.mutateAsync({
					affiliateId,
					data: data satisfies CreateAffiliateLinkInput,
				});
				toast.success(`${code.trim()} was created.`);
			}
			onOpenChange(false);
		} catch (error) {
			setRequestError(
				error instanceof Error && error.message
					? error.message
					: "The referral link could not be saved.",
			);
		}
	}

	return (
		<Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
			<DialogContent className="sm:max-w-xl">
				<form onSubmit={submit} className="space-y-5">
					<DialogHeader>
						<DialogTitle>
							{initial ? "Edit referral link" : "Create referral link"}
						</DialogTitle>
						<DialogDescription>
							The selected program owns the commission and cookie-window terms.
						</DialogDescription>
					</DialogHeader>

					<FormField
						label="Find program"
						htmlFor="affiliate-link-program-search"
					>
						<Input
							id="affiliate-link-program-search"
							value={programQuery}
							onChange={(event) => {
								setProgramQuery(event.target.value);
								setProgramId("");
							}}
							placeholder="Search program name"
						/>
					</FormField>

					<FormField label="Program" htmlFor="affiliate-link-program">
						<Select value={programId} onValueChange={setProgramId} required>
							<SelectTrigger id="affiliate-link-program" className="w-full">
								<SelectValue placeholder="Select a program" />
							</SelectTrigger>
							<SelectContent>
								{programsQuery.data?.items.map((item) => (
									<SelectItem
										key={item.program.id}
										value={item.program.id}
										disabled={item.program.status === "archived"}
									>
										{item.program.name}
										{item.program.status === "archived" ? " (archived)" : ""}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
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
								pattern="[A-Za-z0-9][A-Za-z0-9_-]*"
								required
								className="font-mono"
								autoFocus
							/>
						</FormField>
						<FormField label="Internal label" htmlFor="affiliate-link-label">
							<Input
								id="affiliate-link-label"
								value={label}
								onChange={(event) => setLabel(event.target.value)}
								placeholder="Optional"
								maxLength={200}
							/>
						</FormField>
					</div>

					<FormField label="Landing path" htmlFor="affiliate-link-path">
						<Input
							id="affiliate-link-path"
							value={landingPath}
							onChange={(event) => setLandingPath(event.target.value)}
							placeholder="/start"
							pattern="/[^/].*|/"
							required
						/>
						<p className="text-muted-foreground text-xs">
							wandit.ai{landingPath || "/start"}?ref={code || "PARTNER_CODE"}
						</p>
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

					{programsQuery.isError ? (
						<p className="text-destructive text-sm">
							Programs could not be loaded. Close this dialog and retry.
						</p>
					) : null}
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
							disabled={pending || programsQuery.isPending || !programId}
						>
							{pending ? <Loader2Icon className="animate-spin" /> : null}
							{pending ? "Saving…" : "Save link"}
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

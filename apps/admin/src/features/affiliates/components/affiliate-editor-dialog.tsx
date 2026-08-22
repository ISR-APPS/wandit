import type {
	AffiliateDetail,
	AffiliatePayoutMethod,
	AffiliateStatus,
	AffiliateUserIdentity,
	CreateAffiliateInput,
	UpdateAffiliateInput,
} from "@wandit/contracts";
import { Loader2Icon } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
	useCreateAffiliateMutation,
	useUpdateAffiliateMutation,
} from "../api/affiliates.mutations";
import { PortalAccessControl } from "./portal-access-control";

export function AffiliateEditorDialog({
	open,
	onOpenChange,
	initial,
	onSaved,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initial?: AffiliateDetail | null;
	onSaved?: (affiliateId: string) => void;
}) {
	const createMutation = useCreateAffiliateMutation();
	const updateMutation = useUpdateAffiliateMutation();
	const pending = createMutation.isPending || updateMutation.isPending;
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [linkedUser, setLinkedUser] = useState<AffiliateUserIdentity | null>(
		null,
	);
	const [company, setCompany] = useState("");
	const [channel, setChannel] = useState("");
	const [country, setCountry] = useState("");
	const [payoutMethod, setPayoutMethod] =
		useState<AffiliatePayoutMethod>("manual");
	const [payoutDetails, setPayoutDetails] = useState("");
	const [status, setStatus] = useState<AffiliateStatus>("active");
	const [notes, setNotes] = useState("");
	const [requestError, setRequestError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) {
			return;
		}
		setName(initial?.affiliate.name ?? "");
		setEmail(initial?.affiliate.email ?? "");
		setLinkedUser(initial?.linkedUser ?? null);
		setCompany(initial?.affiliate.company ?? "");
		setChannel(initial?.affiliate.channel ?? "");
		setCountry(initial?.affiliate.country ?? "");
		setPayoutMethod(initial?.affiliate.payoutMethod ?? "manual");
		setPayoutDetails(
			initial?.payoutDetails
				? JSON.stringify(initial.payoutDetails, null, 2)
				: "",
		);
		setStatus(initial?.affiliate.status ?? "active");
		setNotes(initial?.notes ?? "");
		setRequestError(null);
	}, [initial, open]);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setRequestError(null);

		let parsedPayoutDetails: Record<string, unknown> | null = null;
		try {
			parsedPayoutDetails = parsePayoutDetails(payoutDetails);
		} catch (error) {
			setRequestError(
				error instanceof Error ? error.message : "Payout details are invalid.",
			);
			return;
		}

		const data = {
			userId: linkedUser?.id ?? null,
			name: name.trim(),
			email: email.trim(),
			company: nullable(company),
			channel: nullable(channel),
			country: nullable(country),
			payoutMethod,
			payoutDetails: parsedPayoutDetails,
			status,
			notes: nullable(notes),
		};

		try {
			const saved = initial
				? await updateMutation.mutateAsync({
						affiliateId: initial.affiliate.id,
						data: data satisfies UpdateAffiliateInput,
					})
				: await createMutation.mutateAsync(data satisfies CreateAffiliateInput);
			toast.success(
				initial
					? `${saved.affiliate.name} was updated.`
					: `${saved.affiliate.name} was created.`,
			);
			onOpenChange(false);
			onSaved?.(saved.affiliate.id);
		} catch (error) {
			setRequestError(
				error instanceof Error && error.message
					? error.message
					: "The affiliate could not be saved.",
			);
		}
	}

	return (
		<Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
				<form onSubmit={submit} className="space-y-5">
					<DialogHeader>
						<DialogTitle>
							{initial ? "Edit affiliate" : "Create affiliate"}
						</DialogTitle>
						<DialogDescription>
							Partner identity and payout settings. Referral terms are selected
							when you create each link.
						</DialogDescription>
					</DialogHeader>

					<div className="grid gap-4 sm:grid-cols-2">
						<FormField label="Name" htmlFor="affiliate-name">
							<Input
								id="affiliate-name"
								value={name}
								onChange={(event) => setName(event.target.value)}
								required
								maxLength={200}
								autoFocus
							/>
						</FormField>
						<FormField label="Email" htmlFor="affiliate-email">
							<Input
								id="affiliate-email"
								type="email"
								value={email}
								onChange={(event) => setEmail(event.target.value)}
								required
								maxLength={320}
							/>
						</FormField>
						<FormField label="Company" htmlFor="affiliate-company">
							<Input
								id="affiliate-company"
								value={company}
								onChange={(event) => setCompany(event.target.value)}
								placeholder="Optional"
								maxLength={200}
							/>
						</FormField>
						<FormField label="Channel" htmlFor="affiliate-channel">
							<Input
								id="affiliate-channel"
								value={channel}
								onChange={(event) => setChannel(event.target.value)}
								placeholder="Creator, agency, community…"
								maxLength={100}
							/>
						</FormField>
						<FormField label="Country" htmlFor="affiliate-country">
							<Input
								id="affiliate-country"
								value={country}
								onChange={(event) => setCountry(event.target.value)}
								placeholder="Optional"
								maxLength={100}
							/>
						</FormField>
						<FormField label="Payout method" htmlFor="affiliate-payout-method">
							<Select
								value={payoutMethod}
								onValueChange={(value) =>
									setPayoutMethod(value as AffiliatePayoutMethod)
								}
							>
								<SelectTrigger id="affiliate-payout-method" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="manual">Manual</SelectItem>
									<SelectItem value="paypal">PayPal</SelectItem>
									<SelectItem value="wise">Wise</SelectItem>
								</SelectContent>
							</Select>
						</FormField>
						<FormField label="Status" htmlFor="affiliate-status">
							<Select
								value={status}
								onValueChange={(value) => setStatus(value as AffiliateStatus)}
							>
								<SelectTrigger id="affiliate-status" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="active">Active</SelectItem>
									<SelectItem value="paused">Paused</SelectItem>
								</SelectContent>
							</Select>
						</FormField>
					</div>

					<PortalAccessControl
						key={`${initial?.affiliate.id ?? "new"}-${open ? "open" : "closed"}`}
						dialogOpen={open}
						linkedUser={linkedUser}
						affiliateEmail={email}
						suggestExactMatch={!linkedUser}
						onLinkedUserChange={setLinkedUser}
					/>

					<FormField
						label="Payout details (JSON)"
						htmlFor="affiliate-payout-details"
					>
						<Textarea
							id="affiliate-payout-details"
							value={payoutDetails}
							onChange={(event) => setPayoutDetails(event.target.value)}
							placeholder={
								'Optional, for example {"email":"partner@example.com"}'
							}
							className="min-h-24 font-mono text-xs"
						/>
					</FormField>
					<FormField label="Internal notes" htmlFor="affiliate-notes">
						<Textarea
							id="affiliate-notes"
							value={notes}
							onChange={(event) => setNotes(event.target.value)}
							maxLength={5000}
							className="min-h-24"
						/>
					</FormField>

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
						<Button type="submit" disabled={pending}>
							{pending ? <Loader2Icon className="animate-spin" /> : null}
							{pending ? "Saving…" : "Save affiliate"}
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

function nullable(value: string) {
	return value.trim() || null;
}

function parsePayoutDetails(value: string): Record<string, unknown> | null {
	if (!value.trim()) {
		return null;
	}
	const parsed: unknown = JSON.parse(value);
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		throw new Error("Payout details must be a JSON object.");
	}
	return parsed as Record<string, unknown>;
}

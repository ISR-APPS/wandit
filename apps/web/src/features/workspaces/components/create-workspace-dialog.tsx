/**
 * "Name your workspace" — the Business upgrade flow (teams-workspaces.md
 * §5.6): name → create the organization → switch the app into it → send the
 * OWNER to Business checkout (the workspace header now scopes the checkout to
 * the new org, so the subscription lands on the org, never the person).
 */
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@wandit/ui/components/dialog";
import { Button } from "@wandit/ui/components/button";
import { Input } from "@wandit/ui/components/input";
import { Label } from "@wandit/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@wandit/ui/components/select";
import type {
	BillingInterval,
	CreateBillingCheckoutBody,
} from "@wandit/contracts";
import { useMemo, useState } from "react";

import { useBillingPlansQuery } from "@/features/billing/api/billing.queries";
import { useCreateBillingCheckout } from "@/features/billing/api/billing.mutations";
import { authClient } from "@/features/auth/lib/auth-client";
import { useWorkspace } from "@/features/workspaces/lib/workspace-provider";
import { workspacesKeys } from "@/features/workspaces/api/workspaces.queries";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n";

function slugify(name: string): string {
	const base = name
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)+/g, "")
		.slice(0, 40);
	const suffix = Math.random().toString(36).slice(2, 6);

	return base ? `${base}-${suffix}` : `workspace-${suffix}`;
}

export function CreateWorkspaceDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const { switchWorkspace } = useWorkspace();
	const plansQuery = useBillingPlansQuery();
	const checkout = useCreateBillingCheckout();

	const [name, setName] = useState("");
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [interval, setInterval] = useState<BillingInterval>("month");
	// Set once the org exists so a retry after a failed checkout leg reuses it
	// instead of minting a duplicate workspace per click.
	const [createdOrgId, setCreatedOrgId] = useState<string | null>(null);

	const business = useMemo(
		() =>
			plansQuery.data?.plans.find((plan) => plan.id === "business") ?? null,
		[plansQuery.data],
	);
	const [tierCredits, setTierCredits] = useState<number | null>(null);
	const selectedTier =
		business?.tiers.find(
			(tier) => tier.tierCredits === (tierCredits ?? 250),
		) ?? business?.tiers[0];

	const submit = async () => {
		const trimmed = name.trim();

		if (!createdOrgId && !trimmed) {
			setError(t("workspaces.create.errors.nameRequired"));
			return;
		}

		setError(null);
		setCreating(true);

		try {
			if (!createdOrgId) {
				const created = await authClient.organization.create({
					name: trimmed,
					slug: slugify(trimmed),
				});

				if (created.error || !created.data) {
					// Better Auth reports a refused allowUserToCreateOrganization
					// callback (the organizationsEnabled kill switch) with its own
					// plugin code; ORGANIZATIONS_DISABLED covers our Nest guards.
					const code = created.error?.code;

					setError(
						code === "YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_ORGANIZATION" ||
							code === "ORGANIZATIONS_DISABLED"
							? t("workspaces.create.errors.disabled")
							: t("workspaces.create.errors.failed"),
					);
					return;
				}

				setCreatedOrgId(created.data.id);
				await queryClient.invalidateQueries({
					queryKey: workspacesKeys.list(),
				});
				// From here every request — including the checkout below — acts as
				// the new org workspace.
				switchWorkspace(created.data.id);
			}

			try {
				await checkout.mutateAsync({
					plan: "business",
					tierCredits: (selectedTier?.tierCredits ??
						200) as CreateBillingCheckoutBody["tierCredits"],
					interval,
				});
				// Success navigates to Stripe; no further UI state needed.
			} catch {
				// The workspace exists — only payment failed to start. Distinct
				// copy so the user retries checkout instead of re-creating.
				setError(t("workspaces.create.errors.checkoutFailed"));
			}
		} catch {
			setError(t("workspaces.create.errors.failed"));
		} finally {
			setCreating(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader className="text-start">
					<DialogTitle className="font-display tracking-tight">
						{t("workspaces.create.title")}
					</DialogTitle>
					<DialogDescription>
						{t("workspaces.create.description")}
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-2">
						<Label htmlFor="workspace-name">
							{t("workspaces.create.nameLabel")}
						</Label>
						<Input
							id="workspace-name"
							value={name}
							autoFocus
							disabled={Boolean(createdOrgId)}
							placeholder={t("workspaces.create.namePlaceholder")}
							onChange={(event) => setName(event.target.value)}
						/>
					</div>
					{business && business.tiers.length > 0 ? (
						<div className="grid grid-cols-2 gap-3">
							<div className="flex flex-col gap-2">
								<Label>{t("billing.planPicker.creditTier")}</Label>
								<Select
									value={String(selectedTier?.tierCredits ?? 250)}
									onValueChange={(value) => setTierCredits(Number(value))}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{business.tiers.map((tier) => (
											<SelectItem
												key={tier.tierCredits}
												value={String(tier.tierCredits)}
											>
												{tier.tierCredits} · ${tier.monthlyUsd}/mo
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="flex flex-col gap-2">
								<Label>{t("billing.planPicker.billingCycle")}</Label>
								<Select
									value={interval}
									onValueChange={(value) =>
										setInterval(value as BillingInterval)
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="month">
											{t("billing.planPicker.monthly")}
										</SelectItem>
										<SelectItem value="year">
											{t("billing.planPicker.yearly")}
										</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
					) : null}
					{error ? (
						<p className="text-destructive text-sm" role="alert">
							{error}
						</p>
					) : null}
					<Button
						type="button"
						disabled={creating || checkout.isPending}
						onClick={() => void submit()}
					>
						{creating || checkout.isPending
							? t("workspaces.create.creating")
							: createdOrgId
								? t("workspaces.create.retryCheckout")
								: t("workspaces.create.submit")}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

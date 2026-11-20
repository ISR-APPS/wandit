/**
 * "Name your workspace": name, create the organization, switch the app into it, close.
 * workspace-switcher.tsx opens it. It calls the Better Auth organization endpoint
 * through createWorkspace, and starts no checkout (pricing-v8-pay-as-you-go.md section 6).
 */

import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@wandit/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@wandit/ui/components/dialog";
import { Input } from "@wandit/ui/components/input";
import { Label } from "@wandit/ui/components/label";
import { useState } from "react";
import { createWorkspace } from "@/features/workspaces/api/workspace-members.services";
import { workspacesKeys } from "@/features/workspaces/api/workspaces.queries";
import { useWorkspace } from "@/features/workspaces/lib/workspace-provider";
import { isApiClientError } from "@/lib/api-client";
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
	// The server refuses a user slug with the `personal-` prefix of personal workspaces (workspaces-sharing.md 1).
	const safeBase = `${base}-`.startsWith("personal-") ? `team-${base}` : base;

	return safeBase ? `${safeBase}-${suffix}` : `workspace-${suffix}`;
}

/**
 * The team workspace dialog of the switcher. It creates the organization and switches the app into it.
 * A team needs no plan and no checkout (pricing-v8 D11): the owner tops up the team wallet later.
 */
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

	const [name, setName] = useState("");
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const submit = async () => {
		const trimmed = name.trim();

		if (!trimmed) {
			setError(t("workspaces.create.errors.nameRequired"));
			return;
		}

		setError(null);
		setCreating(true);

		try {
			const organizationId = await createWorkspace({
				name: trimmed,
				slug: slugify(trimmed),
			});

			await queryClient.invalidateQueries({
				queryKey: workspacesKeys.list(),
			});
			switchWorkspace(organizationId);
			// The dialog stays mounted in the switcher, so the next open starts with an empty name.
			setName("");
			onOpenChange(false);
		} catch (error) {
			// Better Auth reports a refused allowUserToCreateOrganization
			// callback (the organizationsEnabled kill switch) with its own
			// plugin code; ORGANIZATIONS_DISABLED covers our Nest guards.
			const code = isApiClientError(error) ? error.code : null;

			setError(
				code === "YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_ORGANIZATION" ||
					code === "ORGANIZATIONS_DISABLED"
					? t("workspaces.create.errors.disabled")
					: t("workspaces.create.errors.failed"),
			);
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
							placeholder={t("workspaces.create.namePlaceholder")}
							onChange={(event) => setName(event.target.value)}
						/>
					</div>
					{error ? (
						<p className="text-destructive text-sm" role="alert">
							{error}
						</p>
					) : null}
					<Button
						type="button"
						disabled={creating}
						onClick={() => void submit()}
					>
						{creating
							? t("workspaces.create.creating")
							: t("workspaces.create.submit")}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

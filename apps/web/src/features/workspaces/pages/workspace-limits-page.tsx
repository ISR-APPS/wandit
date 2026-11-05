/**
 * Member credit limits — the default monthly cap plus per-member overrides,
 * with each member's spend this calendar month (teams-workspaces.md §9).
 * It shows for a team workspace and the own personal workspace. In another
 * user's personal workspace it sends the user to the dashboard: those limits
 * cap that user's money (workspaces-sharing.md 0). While organizations are off,
 * the own personal workspace sends the user there too (workspaces-sharing.md 3.4).
 * The list also holds external collaborators; owners and admins see them labeled.
 * Scoped by the workspace header; the server requires limits:manage for PUT.
 */
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@wandit/ui/components/button";
import { Input } from "@wandit/ui/components/input";
import { Label } from "@wandit/ui/components/label";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useSession } from "@/features/auth";
import { formatCreditAmount } from "@/features/credits";
import { DashboardShell } from "@/features/projects";
import {
	usePutWorkspaceMemberLimitsMutation,
	useWorkspaceCollaboratorsQuery,
	useWorkspaceMemberLimitsQuery,
} from "@/features/workspaces/api/workspaces.queries";
import {
	useCollaborationGates,
	useWorkspace,
} from "@/features/workspaces/lib/workspace-provider";
import { useTranslation } from "@/lib/i18n";

/**
 * Empty input = no limit (null); otherwise a positive integer. Limits stay
 * deliberately WHOLE credits (pricing v4 keeps the admin input coarse even
 * though spend is fractional) — decimals are rejected, matching the contract.
 */
function parseLimit(value: string): number | null | undefined {
	const trimmed = value.trim();

	if (trimmed === "") {
		return null;
	}

	const parsed = Number(trimmed);

	return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

/** The `/_auth/workspace/limits` route renders it. */
export default function WorkspaceLimitsPage() {
	const { activeWorkspaceId } = useWorkspace();

	return (
		<DashboardShell titleKey="workspaces.limits.title">
			{/* A new key drops the typed limits when the workspace changes. */}
			<LimitsContent key={activeWorkspaceId} />
		</DashboardShell>
	);
}

function LimitsContent() {
	const { locale, t } = useTranslation();
	const navigate = useNavigate();
	const { data: session } = useSession();
	const { actorCanManageLimits, isPersonal } = useWorkspace();
	const gates = useCollaborationGates();
	// A URL can still open the page while it is hidden.
	const isHidden = !gates.isPending && !gates.showsLimits;
	const limitsQuery = useWorkspaceMemberLimitsQuery({
		enabled: gates.showsLimits,
	});
	// The collaborators route answers owners and admins only; it labels the external rows.
	const collaboratorsQuery = useWorkspaceCollaboratorsQuery({
		enabled: gates.showsLimits && actorCanManageLimits,
	});
	const save = usePutWorkspaceMemberLimitsMutation();
	const collaboratorIds = new Set(
		(collaboratorsQuery.data?.collaborators ?? []).map(
			(collaborator) => collaborator.userId,
		),
	);

	useEffect(() => {
		if (isHidden) {
			void navigate({ to: "/dashboard" });
		}
	}, [isHidden, navigate]);

	const [defaultLimit, setDefaultLimit] = useState<string>("");
	const [memberLimits, setMemberLimits] = useState<Record<string, string>>({});
	const [hydrated, setHydrated] = useState(false);

	useEffect(() => {
		if (!limitsQuery.data || hydrated) {
			return;
		}

		setDefaultLimit(
			limitsQuery.data.defaultMemberMonthlyCreditLimit?.toString() ?? "",
		);
		setMemberLimits(
			Object.fromEntries(
				limitsQuery.data.members.map((member) => [
					member.userId,
					member.monthlyCreditLimit?.toString() ?? "",
				]),
			),
		);
		setHydrated(true);
	}, [limitsQuery.data, hydrated]);

	if (isHidden) {
		return null;
	}

	const submit = () => {
		const parsedDefault = parseLimit(defaultLimit);
		const members = (limitsQuery.data?.members ?? []).flatMap((member) => {
			const parsed = parseLimit(memberLimits[member.userId] ?? "");

			if (parsed === undefined) {
				return [];
			}

			if (parsed === (member.monthlyCreditLimit ?? null)) {
				return [];
			}

			return [{ userId: member.userId, monthlyCreditLimit: parsed }];
		});

		save.mutate(
			{
				...(parsedDefault !== undefined
					? { defaultMemberMonthlyCreditLimit: parsedDefault }
					: {}),
				...(members.length > 0 ? { members } : {}),
			},
			{
				onSuccess: () => toast.success(t("workspaces.limits.saved")),
				onError: () => toast.error(t("workspaces.limits.saveFailed")),
			},
		);
	};

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pt-6 pb-16 md:px-6">
			<header>
				<h1 className="font-display text-2xl tracking-tight">
					{t("workspaces.limits.title")}
				</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					{t("workspaces.limits.description")}
				</p>
			</header>

			{limitsQuery.isPending ? (
				<div className="flex justify-center p-8">
					<Loader2 className="size-5 animate-spin text-muted-foreground" />
				</div>
			) : null}

			{limitsQuery.isError ? (
				<p className="text-muted-foreground text-sm">
					{t("workspaces.limits.loadFailed")}
				</p>
			) : null}

			{limitsQuery.data ? (
				<>
					<section className="flex max-w-sm flex-col gap-2">
						<Label htmlFor="default-limit">
							{t("workspaces.limits.defaultLabel")}
						</Label>
						<Input
							id="default-limit"
							inputMode="numeric"
							placeholder={t("workspaces.limits.noLimit")}
							value={defaultLimit}
							disabled={!actorCanManageLimits}
							onChange={(event) => setDefaultLimit(event.target.value)}
						/>
					</section>

					<section className="flex flex-col divide-y rounded-lg border">
						{limitsQuery.data.members.map((member) => {
							// The personal owner spends their own money, so the server refuses a limit on them.
							const isPersonalOwner =
								isPersonal && member.userId === session?.user.id;

							return (
								<div
									key={member.userId}
									className="flex items-center gap-3 p-4"
								>
									<div className="min-w-0 flex-1">
										<p className="truncate font-medium text-sm">
											{member.name}
											{collaboratorIds.has(member.userId) ? (
												<span className="ms-2 text-muted-foreground text-xs">
													{t("workspaces.limits.collaborator")}
												</span>
											) : null}
										</p>
										<p className="truncate text-muted-foreground text-xs">
											{member.email}
										</p>
									</div>
									<div className="text-end">
										<p className="text-muted-foreground text-xs">
											{t("workspaces.limits.spentThisMonth")}
										</p>
										<p className="font-mono text-sm tabular-nums">
											{formatCreditAmount(member.spentThisMonth, locale)}
										</p>
									</div>
									<Input
										className="w-28"
										inputMode="numeric"
										placeholder={t("workspaces.limits.noLimit")}
										aria-label={t("workspaces.limits.customLimit")}
										value={memberLimits[member.userId] ?? ""}
										disabled={!actorCanManageLimits || isPersonalOwner}
										onChange={(event) =>
											setMemberLimits((current) => ({
												...current,
												[member.userId]: event.target.value,
											}))
										}
									/>
								</div>
							);
						})}
					</section>

					{actorCanManageLimits ? (
						<div>
							<Button type="button" disabled={save.isPending} onClick={submit}>
								{save.isPending
									? t("workspaces.limits.saving")
									: t("workspaces.limits.save")}
							</Button>
						</div>
					) : null}
				</>
			) : null}
		</div>
	);
}

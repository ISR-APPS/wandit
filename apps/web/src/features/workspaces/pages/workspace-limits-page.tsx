/**
 * Member credit limits — the default monthly cap plus per-member overrides,
 * with each member's spend this calendar month (teams-workspaces.md §9).
 * Scoped by the workspace header; the server requires limits:manage for PUT.
 */
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@wandit/ui/components/button";
import { Input } from "@wandit/ui/components/input";
import { Label } from "@wandit/ui/components/label";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { formatCreditAmount } from "@/features/credits/lib/format-credits";
import {
	usePutWorkspaceMemberLimitsMutation,
	useWorkspaceMemberLimitsQuery,
} from "@/features/workspaces/api/workspaces.queries";
import { useWorkspace } from "@/features/workspaces/lib/workspace-provider";
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

export default function WorkspaceLimitsPage() {
	const { locale, t } = useTranslation();
	const navigate = useNavigate();
	const { actorCanManageWorkspace, isPersonal } = useWorkspace();
	const limitsQuery = useWorkspaceMemberLimitsQuery({ enabled: !isPersonal });
	const save = usePutWorkspaceMemberLimitsMutation();

	useEffect(() => {
		if (isPersonal) {
			void navigate({ to: "/dashboard" });
		}
	}, [isPersonal, navigate]);

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

	if (isPersonal) {
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
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
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
							disabled={!actorCanManageWorkspace}
							onChange={(event) => setDefaultLimit(event.target.value)}
						/>
					</section>

					<section className="flex flex-col divide-y rounded-lg border">
						{limitsQuery.data.members.map((member) => (
							<div key={member.userId} className="flex items-center gap-3 p-4">
								<div className="min-w-0 flex-1">
									<p className="truncate font-medium text-sm">{member.name}</p>
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
									disabled={!actorCanManageWorkspace}
									onChange={(event) =>
										setMemberLimits((current) => ({
											...current,
											[member.userId]: event.target.value,
										}))
									}
								/>
							</div>
						))}
					</section>

					{actorCanManageWorkspace ? (
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

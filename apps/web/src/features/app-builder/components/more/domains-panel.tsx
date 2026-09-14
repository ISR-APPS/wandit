/**
 * Domains panel of the More view: one row per domain with its status, and the
 * connect / buy card under it. Web apps only.
 * Rendered by components/more/more-view.tsx inside PanelShell, which draws the
 * title. Reads projectDomainsQuery; connect and buy have no backend yet.
 */

import { useSuspenseQuery } from "@tanstack/react-query";
import { Badge } from "@wandit/ui/components/badge";
import { Button } from "@wandit/ui/components/button";
import { Input } from "@wandit/ui/components/input";
import { useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/lib/i18n";
import { projectDomainsQuery } from "../../api/app-builder.queries";
import type { ProjectDomain } from "../../api/dto";

export type DomainsPanelProps = {
	projectId: string;
};

export function DomainsPanel({ projectId }: DomainsPanelProps) {
	const { t } = useTranslation();
	const { data: domains } = useSuspenseQuery(projectDomainsQuery(projectId));
	const [draft, setDraft] = useState("");
	const notWired = () => toast(t("appBuilder.mock.notWired"));

	return (
		<>
			<ul className="divide-y rounded-2xl border bg-card">
				{domains.map((domain) => (
					<li
						key={domain.host}
						className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
					>
						<div className="min-w-0">
							<div className="font-semibold" dir="auto">
								{domain.host}
							</div>
							<div className="text-muted-foreground text-xs">
								{statusNote(domain, t)}
							</div>
						</div>
						{domain.status === "live" ? (
							<Badge variant="success">
								<span
									aria-hidden
									className="size-1.5 rounded-full bg-success"
								/>
								{t("appBuilder.domains.live")}
							</Badge>
						) : (
							<Badge variant="warning">
								{t("appBuilder.domains.verifying")}
							</Badge>
						)}
					</li>
				))}
			</ul>

			<div className="flex items-center gap-2 rounded-2xl border bg-card p-3">
				<Input
					className="flex-1"
					placeholder={t("appBuilder.domains.placeholder")}
					aria-label={t("appBuilder.domains.inputLabel")}
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
					dir="auto"
				/>
				<Button disabled={draft.trim() === ""} onClick={notWired}>
					{t("appBuilder.domains.connect")}
				</Button>
				<Button variant="outline" onClick={notWired}>
					{t("appBuilder.domains.buy")}
				</Button>
			</div>
		</>
	);
}

/** Second line of a domain row. A live custom domain has no note. */
function statusNote(
	domain: ProjectDomain,
	t: ReturnType<typeof useTranslation>["t"],
): string | null {
	if (domain.kind === "wandit") return t("appBuilder.domains.freePrimary");
	if (domain.status === "verifying") {
		return t("appBuilder.domains.waitingDns", {
			target: domain.cnameTarget ?? "",
		});
	}
	return null;
}

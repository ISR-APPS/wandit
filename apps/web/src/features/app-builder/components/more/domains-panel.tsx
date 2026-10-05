/**
 * Domains panel of the More view: one row per domain with its status, and the
 * connect / buy card under it. Web apps only.
 * Rendered by components/more/more-view.tsx inside PanelShell, which draws the
 * title. Reads projectDomainsQuery; connect and buy have no backend yet.
 */

import { GlobeIcon } from "@phosphor-icons/react/Globe";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@wandit/ui/components/button";
import { Input } from "@wandit/ui/components/input";
import { cn } from "@wandit/ui/lib/utils";
import { useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/lib/i18n";
import { projectDomainsQuery } from "../../api/app-builder.queries";
import type { ProjectDomain } from "../../api/dto";
import {
	PANEL_CARD_CLASS,
	PANEL_INPUT_CLASS,
	PANEL_PRIMARY_BUTTON_CLASS,
	PANEL_SECONDARY_BUTTON_CLASS,
	PanelChip,
} from "./panel-shell";

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
			<ul
				className={cn(
					PANEL_CARD_CLASS,
					"divide-y divide-night/[0.07] dark:divide-white/[0.07]",
				)}
			>
				{domains.map((domain) => (
					<li
						key={domain.host}
						className="flex items-center gap-3.5 px-5 py-3.5"
					>
						<span
							aria-hidden
							className={cn(
								"grid size-9 shrink-0 place-items-center rounded-full",
								domain.status === "live"
									? "bg-spark/20 text-night dark:bg-spark/15 dark:text-spark"
									: "bg-night/[0.05] text-night/50 dark:bg-white/[0.06] dark:text-foreground/50",
							)}
						>
							<GlobeIcon weight="duotone" className="size-[18px]" />
						</span>
						<div className="min-w-0 flex-1">
							<div
								className="truncate font-medium font-mono text-[13.5px] text-night dark:text-foreground"
								dir="auto"
							>
								{domain.host}
							</div>
							<div className="font-sans text-[13px] text-night/55 dark:text-foreground/55">
								{statusNote(domain, t)}
							</div>
						</div>
						{domain.status === "live" ? (
							<PanelChip tone="success">
								<span
									aria-hidden
									className="size-1.5 rounded-full bg-success"
								/>
								{t("appBuilder.domains.live")}
							</PanelChip>
						) : (
							<PanelChip tone="warning">
								{/* The pulse tells that the DNS check still runs. */}
								<span
									aria-hidden
									className="size-1.5 rounded-full bg-spark-deep motion-safe:animate-pulse dark:bg-spark"
								/>
								{t("appBuilder.domains.verifying")}
							</PanelChip>
						)}
					</li>
				))}
			</ul>

			<div
				className={cn(
					PANEL_CARD_CLASS,
					"flex flex-col gap-2 p-2 transition-shadow focus-within:border-primary/40 focus-within:ring-[3px] focus-within:ring-primary/15 sm:flex-row sm:items-center",
				)}
			>
				<Input
					className={cn(
						PANEL_INPUT_CLASS,
						"flex-1 border-transparent bg-transparent font-mono focus-visible:border-transparent focus-visible:ring-0 dark:border-transparent dark:bg-transparent",
					)}
					placeholder={t("appBuilder.domains.placeholder")}
					aria-label={t("appBuilder.domains.inputLabel")}
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
					dir="auto"
				/>
				<div className="flex gap-2">
					<Button
						className={cn(
							PANEL_PRIMARY_BUTTON_CLASS,
							"h-10 flex-1 px-5 sm:flex-none",
						)}
						disabled={draft.trim() === ""}
						onClick={notWired}
					>
						{t("appBuilder.domains.connect")}
					</Button>
					<Button
						variant="outline"
						className={cn(
							PANEL_SECONDARY_BUTTON_CLASS,
							"h-10 flex-1 px-5 sm:flex-none",
						)}
						onClick={notWired}
					>
						{t("appBuilder.domains.buy")}
					</Button>
				</div>
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

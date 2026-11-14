/**
 * The connected-agents list of the /coding-agents page, with a Revoke button and a confirm step per agent.
 * coding-agents-page.tsx renders it. It reads useConnectedAgentsQuery and revokes with useRevokeConnectedAgentMutation.
 * A client name is untrusted text: plain text only, no link, no logo.
 */

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@wandit/ui/components/alert-dialog";
import { Button } from "@wandit/ui/components/button";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";
import { useState } from "react";

import {
	PANEL_CARD_TITLE_CLASS,
	PANEL_HINT_CLASS,
	PANEL_SECONDARY_BUTTON_CLASS,
} from "@/features/app-builder";
import { formatDate, useTranslation } from "@/lib/i18n";
import { useRevokeConnectedAgentMutation } from "../api/coding-agents.mutations";
import { useConnectedAgentsQuery } from "../api/coding-agents.queries";
import type { ConnectedAgent } from "../api/coding-agents.services";
import { clientAddresses, parseRequestedScopes } from "../lib/helpers";
import { ScopeList } from "./scope-list";

/** A small grey line of an agent row: the name note, the address, the connect date. 12 px, so one step under PANEL_HINT_CLASS. */
const ROW_NOTE_CLASS =
	"font-sans text-night/60 text-xs dark:text-foreground/60";

/** The list of the grants of the signed-in user. A revoke ends the access of the agent at once. */
export function ConnectedAgents() {
	const { t, locale } = useTranslation();
	const agentsQuery = useConnectedAgentsQuery();
	const revoke = useRevokeConnectedAgentMutation();
	// The agent of the open confirm dialog. Null closes the dialog.
	const [pendingRevoke, setPendingRevoke] = useState<ConnectedAgent | null>(
		null,
	);
	const unnamed = t("auth.codingAgents.client.unnamed");

	const renderList = () => {
		if (agentsQuery.isPending) {
			return (
				<div className="flex flex-col gap-3">
					<Skeleton className="h-20 rounded-[16px]" />
					<Skeleton className="h-20 rounded-[16px]" />
				</div>
			);
		}
		if (agentsQuery.isError) {
			return (
				<div className="flex flex-wrap items-center gap-3">
					<p className={PANEL_HINT_CLASS}>
						{t("auth.codingAgents.connected.loadFailed")}
					</p>
					<Button
						variant="outline"
						size="sm"
						className={PANEL_SECONDARY_BUTTON_CLASS}
						onClick={() => void agentsQuery.refetch()}
					>
						{t("auth.codingAgents.connected.retry")}
					</Button>
				</div>
			);
		}
		if (agentsQuery.data.length === 0) {
			return (
				<p className={PANEL_HINT_CLASS}>
					{t("auth.codingAgents.connected.empty")}
				</p>
			);
		}
		return (
			<ul className="divide-y divide-night/[0.07] dark:divide-white/[0.07]">
				{agentsQuery.data.map((agent) => {
					// Without a redirect URI, only a CIMD client id gives an address.
					const address = clientAddresses(agent.clientId, null).at(0);
					const isRevoking = revoke.isPending && revoke.variables === agent.id;
					return (
						<li
							key={agent.id}
							className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start"
						>
							<div className="min-w-0 flex-1">
								<p
									dir="auto"
									className="line-clamp-2 break-words font-grotesk font-semibold text-[15px] text-night dark:text-foreground"
								>
									{agent.clientName ?? unnamed}
								</p>
								<p
									className={cn(
										ROW_NOTE_CLASS,
										"mt-0.5 flex flex-wrap items-baseline gap-x-2",
									)}
								>
									{agent.clientName ? (
										<span>{t("auth.codingAgents.client.givenByApp")}</span>
									) : null}
									{address ? (
										<code dir="ltr" className="break-all font-mono">
											{address.address}
										</code>
									) : null}
								</p>
								<div className="mt-3">
									<ScopeList
										scopes={parseRequestedScopes(agent.scopes.join(" "))}
									/>
								</div>
								<p className={cn(ROW_NOTE_CLASS, "mt-3")}>
									{t("auth.codingAgents.connected.since", {
										date: formatDate(agent.createdAt, locale, {
											dateStyle: "medium",
										}),
									})}
								</p>
							</div>
							<Button
								variant="outline"
								size="sm"
								className={cn(PANEL_SECONDARY_BUTTON_CLASS, "self-start")}
								disabled={isRevoking}
								onClick={() => setPendingRevoke(agent)}
							>
								{t("auth.codingAgents.revoke.action")}
							</Button>
						</li>
					);
				})}
			</ul>
		);
	};

	return (
		<div className="flex flex-col gap-5">
			<div>
				<h3 className={PANEL_CARD_TITLE_CLASS}>
					{t("auth.codingAgents.connected.title")}
				</h3>
				<p className={cn(PANEL_HINT_CLASS, "mt-1")}>
					{t("auth.codingAgents.connected.description")}
				</p>
			</div>
			{renderList()}
			<AlertDialog
				open={pendingRevoke !== null}
				onOpenChange={(open) => {
					if (!open) setPendingRevoke(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("auth.codingAgents.revoke.title")}
						</AlertDialogTitle>
						<AlertDialogDescription className="break-words">
							{t("auth.codingAgents.revoke.description", {
								name: pendingRevoke?.clientName ?? unnamed,
							})}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>
							{t("auth.codingAgents.revoke.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={() => {
								if (pendingRevoke === null) return;
								revoke.mutate(pendingRevoke.id);
							}}
						>
							{t("auth.codingAgents.revoke.confirm")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

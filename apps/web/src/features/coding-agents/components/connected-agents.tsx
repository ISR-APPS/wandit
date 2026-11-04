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
import { useState } from "react";

import { formatDate, useTranslation } from "@/lib/i18n";
import { useRevokeConnectedAgentMutation } from "../api/coding-agents.mutations";
import { useConnectedAgentsQuery } from "../api/coding-agents.queries";
import type { ConnectedAgent } from "../api/coding-agents.services";
import { clientAddresses, parseRequestedScopes } from "../lib/helpers";
import { ScopeList } from "./scope-list";

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
					<Skeleton className="h-20 rounded-xl" />
					<Skeleton className="h-20 rounded-xl" />
				</div>
			);
		}
		if (agentsQuery.isError) {
			return (
				<div className="flex flex-wrap items-center gap-3 text-sm">
					<p className="text-muted-foreground">
						{t("auth.codingAgents.connected.loadFailed")}
					</p>
					<Button
						variant="outline"
						size="sm"
						onClick={() => void agentsQuery.refetch()}
					>
						{t("auth.codingAgents.connected.retry")}
					</Button>
				</div>
			);
		}
		if (agentsQuery.data.length === 0) {
			return (
				<p className="text-muted-foreground text-sm">
					{t("auth.codingAgents.connected.empty")}
				</p>
			);
		}
		return (
			<ul className="divide-y">
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
									className="line-clamp-2 break-words font-grotesk font-semibold"
								>
									{agent.clientName ?? unnamed}
								</p>
								<p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-muted-foreground text-xs">
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
								<p className="mt-3 text-muted-foreground text-xs">
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
								className="self-start"
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
				<h3 className="font-grotesk font-semibold text-base">
					{t("auth.codingAgents.connected.title")}
				</h3>
				<p className="mt-1 text-muted-foreground text-sm">
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

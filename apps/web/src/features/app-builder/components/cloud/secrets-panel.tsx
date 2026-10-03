/**
 * Secrets panel of the Cloud tab (WANDIT-185, WANDIT-188): a write-only
 * store. It lists the secret names, sets or replaces a value, and deletes a
 * `user` secret. No answer carries a value, and the panel never shows one.
 * Rendered by cloud-tab.tsx without the backend gate: secrets live in the
 * Wandit database. Reads cloudSecretsQuery; writes through useSetSecret and
 * useDeleteSecret.
 */

import { useQuery } from "@tanstack/react-query";
import {
	projectSecretNameSchema,
	setProjectSecretRequestSchema,
} from "@wandit/contracts";
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
import { Badge } from "@wandit/ui/components/badge";
import { Button } from "@wandit/ui/components/button";
import { Input } from "@wandit/ui/components/input";
import { Label } from "@wandit/ui/components/label";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@wandit/ui/components/table";
import { KeyRound, LoaderCircle, Lock, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { formatDate, useTranslation } from "@/lib/i18n";
import { useDeleteSecret, useSetSecret } from "../../api/cloud.mutations";
import { cloudSecretsQuery } from "../../api/cloud.queries";
import type { setSecret } from "../../api/cloud.services";
import { CLOUD_DATE_TIME_FORMAT } from "../../lib/constants";
import { CodeMessage } from "../code/code-viewer";
import { CloudLoadFailed } from "./backend-state";
import { RowsGridSkeleton } from "./rows-grid";

/** Props of SecretsPanel. `putSecret` is the one test seam; the Cloud tab passes no value. */
export type SecretsPanelProps = {
	projectId: string;
	/** True while the Cloud view is on screen. The list read waits for it. */
	isActive: boolean;
	/** The secret PUT. The spec passes a fake; the tab omits it, so the hook calls apiClient. */
	putSecret?: typeof setSecret;
};

/** The set form above the list of names. A saved value leaves the form at once. */
export function SecretsPanel({
	projectId,
	isActive,
	putSecret,
}: SecretsPanelProps) {
	const { t, locale } = useTranslation();
	const secrets = useQuery(cloudSecretsQuery(projectId, isActive));
	const save = useSetSecret(projectId, putSecret);
	const remove = useDeleteSecret(projectId);
	const [name, setName] = useState("");
	const [value, setValue] = useState("");
	// The name the delete dialog asks about; null while the dialog is closed.
	const [pendingDelete, setPendingDelete] = useState<string | null>(null);
	const nameId = useId();
	const valueId = useId();
	// The same schemas as the API, so the form shows the reason before a request.
	const isNameValid = projectSecretNameSchema.safeParse(name).success;
	const isValueValid = setProjectSecretRequestSchema.safeParse({
		value,
	}).success;

	function saveSecret() {
		if (!isNameValid || !isValueValid) return;
		save.mutate(
			{ name, value },
			{
				onSuccess: () => {
					// The value must not stay in the page after the save: not in the
					// fields, and not in the mutation variables.
					setName("");
					setValue("");
					save.reset();
					toast.success(t("workspace.cloud.secrets.form.saved", { name }));
				},
			},
		);
	}

	function renderList() {
		if (secrets.isPending) {
			return <RowsGridSkeleton />;
		}
		// A failed refetch keeps the last good list; only a failed first load has no data.
		if (secrets.data === undefined) {
			return <CloudLoadFailed projectId={projectId} />;
		}
		if (secrets.data.length === 0) {
			return (
				<CodeMessage
					icon={KeyRound}
					text={t("workspace.cloud.secrets.empty")}
				/>
			);
		}
		return (
			<div className="rounded-xl border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t("workspace.cloud.secrets.columns.name")}</TableHead>
							<TableHead>{t("workspace.cloud.secrets.columns.kind")}</TableHead>
							<TableHead>
								{t("workspace.cloud.secrets.columns.updated")}
							</TableHead>
							<TableHead />
						</TableRow>
					</TableHeader>
					<TableBody>
						{secrets.data.map((secret) => (
							<TableRow key={secret.name}>
								<TableCell>
									<span dir="ltr" className="font-medium font-mono text-sm">
										{secret.name}
									</span>
								</TableCell>
								<TableCell>
									<Badge
										variant={secret.kind === "system" ? "info" : "outline"}
									>
										{secret.kind === "system" ? <Lock /> : null}
										{t(`workspace.cloud.secrets.kinds.${secret.kind}`)}
									</Badge>
								</TableCell>
								<TableCell className="text-muted-foreground">
									{formatDate(secret.updatedAt, locale, CLOUD_DATE_TIME_FORMAT)}
								</TableCell>
								<TableCell className="text-end">
									{/* The server refuses to delete a system secret (the Supabase keys), so it gets no button. */}
									{secret.kind === "system" ? null : (
										<Button
											variant="ghost"
											size="icon-sm"
											aria-label={t("workspace.cloud.secrets.delete.label", {
												name: secret.name,
											})}
											onClick={() => setPendingDelete(secret.name)}
										>
											<Trash2 />
										</Button>
									)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		);
	}

	return (
		<div className="flex min-w-0 flex-col gap-6">
			<p className="max-w-2xl text-muted-foreground text-sm">
				{t("workspace.cloud.secrets.description")}
			</p>
			<form
				className="flex max-w-2xl flex-col gap-3 rounded-xl border p-4"
				onSubmit={(event) => {
					event.preventDefault();
					saveSecret();
				}}
			>
				<h2 className="font-semibold">
					{t("workspace.cloud.secrets.form.title")}
				</h2>
				<div className="grid gap-3 sm:grid-cols-2">
					<div className="flex flex-col gap-1.5">
						<Label htmlFor={nameId}>
							{t("workspace.cloud.secrets.form.name")}
						</Label>
						<Input
							id={nameId}
							dir="ltr"
							value={name}
							// Names are upper case (projectSecretNameSchema), so the field converts what the user types.
							onChange={(event) => setName(event.target.value.toUpperCase())}
							aria-invalid={name !== "" && !isNameValid}
							autoComplete="off"
							spellCheck={false}
							className="font-mono"
						/>
						{name !== "" && !isNameValid ? (
							<p className="text-destructive text-xs">
								{t("workspace.cloud.secrets.form.nameInvalid")}
							</p>
						) : null}
					</div>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor={valueId}>
							{t("workspace.cloud.secrets.form.value")}
						</Label>
						{/* A password field, so the value never shows on screen. Chrome ignores
						    "off" on a password field; "new-password" and the two data flags stop
						    the browser and the password managers from saving the value. */}
						<Input
							id={valueId}
							dir="ltr"
							type="password"
							value={value}
							onChange={(event) => setValue(event.target.value)}
							aria-invalid={value !== "" && !isValueValid}
							autoComplete="new-password"
							data-1p-ignore
							data-lpignore="true"
							spellCheck={false}
							className="font-mono"
						/>
						{value !== "" && !isValueValid ? (
							<p className="text-destructive text-xs">
								{t("workspace.cloud.secrets.form.valueInvalid")}
							</p>
						) : null}
					</div>
				</div>
				<div className="flex flex-wrap items-center gap-3">
					<Button
						type="submit"
						size="sm"
						disabled={save.isPending || !isNameValid || !isValueValid}
					>
						{save.isPending ? <LoaderCircle className="animate-spin" /> : null}
						{t("workspace.cloud.secrets.form.save")}
					</Button>
					<p className="text-muted-foreground text-xs">
						{t("workspace.cloud.secrets.form.hint")}
					</p>
				</div>
			</form>
			{renderList()}
			<AlertDialog
				open={pendingDelete !== null}
				onOpenChange={(open) => {
					if (!open) setPendingDelete(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("workspace.cloud.secrets.delete.title")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("workspace.cloud.secrets.delete.description", {
								name: pendingDelete ?? "",
							})}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>
							{t("workspace.cloud.secrets.delete.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={() => {
								if (pendingDelete === null) return;
								const deletedName = pendingDelete;
								remove.mutate(deletedName, {
									onSuccess: () =>
										toast.success(
											t("workspace.cloud.secrets.delete.done", {
												name: deletedName,
											}),
										),
								});
							}}
						>
							{t("workspace.cloud.secrets.delete.confirm")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

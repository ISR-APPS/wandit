// Settings → Danger zone card: delete the project (and its mock workspace
// data) behind an AlertDialog confirmation, then return to the dashboard.

import { useNavigate } from "@tanstack/react-router";
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
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@wandit/ui/components/card";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useDeleteProject } from "@/features/projects";
import { useTranslation } from "@/lib/i18n";
import { useWorkspace } from "../../lib/store";

export function DangerZone() {
	const { t } = useTranslation();
	const { project, projectId } = useWorkspace();
	const navigate = useNavigate();
	const deleteProject = useDeleteProject();
	const [confirmOpen, setConfirmOpen] = useState(false);

	const handleDelete = async () => {
		await deleteProject.mutateAsync(projectId);
		toast.success(t("settings.deleteSuccess"));
		void navigate({ to: "/dashboard" });
	};

	return (
		<Card className="border-destructive/30">
			<CardHeader>
				<CardTitle className="font-display">
					{t("settings.dangerTitle")}
				</CardTitle>
				<CardDescription>{t("settings.dangerDescription")}</CardDescription>
			</CardHeader>
			<CardContent>
				<Button
					variant="destructive"
					onClick={() => setConfirmOpen(true)}
					disabled={deleteProject.isPending}
				>
					{deleteProject.isPending ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Trash2 className="size-4" />
					)}
					{t("settings.deleteCta")}
				</Button>
			</CardContent>

			<AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle className="font-display">
							{t("settings.deleteTitle")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("settings.deleteDescription", { name: project?.name ?? "" })}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{t("settings.deleteCancel")}</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								void handleDelete();
							}}
							className="bg-destructive text-white hover:bg-destructive/90"
						>
							{t("settings.deleteConfirm")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Card>
	);
}

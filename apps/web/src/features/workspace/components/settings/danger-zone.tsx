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
import { deleteMockWorkspace } from "../../api/workspace.services";
import { WORKSPACE_COPY } from "../../lib/constants";
import { useWorkspace } from "../../lib/store";

const COPY = WORKSPACE_COPY.settings;

export function DangerZone() {
	const { project, projectId } = useWorkspace();
	const navigate = useNavigate();
	const deleteProject = useDeleteProject();
	const [confirmOpen, setConfirmOpen] = useState(false);

	const handleDelete = async () => {
		await deleteProject.mutateAsync(projectId);
		deleteMockWorkspace(projectId);
		toast.success(COPY.deleteSuccess);
		void navigate({ to: "/dashboard" });
	};

	return (
		<Card className="border-destructive/30">
			<CardHeader>
				<CardTitle className="font-display">{COPY.dangerTitle}</CardTitle>
				<CardDescription>{COPY.dangerDescription}</CardDescription>
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
					{COPY.deleteCta}
				</Button>
			</CardContent>

			<AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle className="font-display">
							{COPY.deleteTitle}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{COPY.deleteDescription(project?.name ?? "")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{COPY.deleteCancel}</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								void handleDelete();
							}}
							className="bg-destructive text-white hover:bg-destructive/90"
						>
							{COPY.deleteConfirm}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Card>
	);
}

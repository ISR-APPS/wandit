// The detail of one task in a dialog. TaskDialogBody draws the content.
// The board, the overview tables, My tasks, and the Team sheet open it. The parent holds the open task.
import { Dialog, DialogContent } from "~/shared/ui/dialog";
import type { Task } from "../api/tasks.queries";
import { TaskDialogBody } from "./task-dialog-body";

type TaskDialogProps = {
	/** The open task. null closes the dialog. */
	task: Task | null;
	/** Runs with false when the user closes the dialog. */
	onOpenChange: (open: boolean) => void;
};

/** A link in the dialog opens the project of the task and closes the dialog. */
export function TaskDialog({ task, onOpenChange }: TaskDialogProps) {
	return (
		<Dialog open={task !== null} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
				{task ? (
					<TaskDialogBody task={task} onClose={() => onOpenChange(false)} />
				) : null}
			</DialogContent>
		</Dialog>
	);
}

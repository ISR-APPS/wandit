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

import { useTranslation } from "@/lib/i18n";
import { useWorkspace } from "../../lib/store";

/** One shared confirmation covers both the header popover and Settings CTA. */
export function PublishConfirmDialog() {
	const { t } = useTranslation();
	const {
		publishCandidateVersion,
		confirmPublish,
		cancelPublish,
		publishPending,
	} = useWorkspace();
	const versionNumber = publishCandidateVersion?.number;

	return (
		<AlertDialog
			open={versionNumber !== undefined}
			onOpenChange={(open) => {
				if (!open && !publishPending) cancelPublish();
			}}
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						{versionNumber === undefined ? (
							""
						) : (
							<VersionMessage
								message={t("workspace.publish.confirmTitle", {
									n: versionNumber,
								})}
								number={versionNumber}
							/>
						)}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{versionNumber === undefined ? (
							""
						) : (
							<VersionMessage
								message={t("workspace.publish.confirmBody", {
									n: versionNumber,
								})}
								number={versionNumber}
							/>
						)}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel onClick={cancelPublish}>
						{t("workspace.publish.confirmCancel")}
					</AlertDialogCancel>
					<AlertDialogAction
						disabled={versionNumber === undefined || publishPending}
						onClick={confirmPublish}
					>
						{versionNumber === undefined ? (
							t("workspace.publish.publish")
						) : (
							<VersionMessage
								message={t("workspace.publish.confirmVersion", {
									n: versionNumber,
								})}
								number={versionNumber}
							/>
						)}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

function VersionMessage({
	message,
	number,
}: {
	message: string;
	number: number;
}) {
	const marker = `v${number}`;
	const index = message.indexOf(marker);
	if (index === -1) return <span dir="auto">{message}</span>;

	return (
		<span dir="auto">
			{message.slice(0, index)}
			<bdi dir="ltr">{marker}</bdi>
			{message.slice(index + marker.length)}
		</span>
	);
}

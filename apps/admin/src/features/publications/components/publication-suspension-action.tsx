/**
 * Row action of the publish log: "Suspend" or "Unsuspend" for a V2 app.
 * The table actions column and the mobile list render it; it opens
 * `SuspendPublicationDialog`. The server checks the same permission.
 */
import { BanIcon, PlayIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useAdminPermission } from "@/features/auth/lib/permissions";
import type { AdminPublication } from "@/features/publications/api/publications.dto";

import { SuspendPublicationDialog } from "./suspend-publication-dialog";

/**
 * Suspend or Unsuspend button of one log row. It renders nothing without
 * publications:suspend, or for a row that is not an app.
 */
function PublicationSuspensionAction({
	publication,
}: {
	publication: AdminPublication;
}) {
	const [open, setOpen] = useState(false);
	const canSuspend = useAdminPermission({ publications: ["suspend"] });
	const isSuspended = publication.suspension !== null;

	// Only an admin holds publications:suspend, and only a V2 app has a switch.
	if (!canSuspend || publication.kind !== "app") {
		return null;
	}

	return (
		<>
			<Button
				type="button"
				variant="outline"
				size="sm"
				onClick={() => setOpen(true)}
			>
				{isSuspended ? (
					<PlayIcon data-icon="inline-start" aria-hidden="true" />
				) : (
					<BanIcon data-icon="inline-start" aria-hidden="true" />
				)}
				{isSuspended ? "Unsuspend" : "Suspend"}
				<span className="sr-only"> {publication.project.name}</span>
			</Button>
			<SuspendPublicationDialog
				publication={publication}
				open={open}
				onOpenChange={setOpen}
			/>
		</>
	);
}

export { PublicationSuspensionAction };

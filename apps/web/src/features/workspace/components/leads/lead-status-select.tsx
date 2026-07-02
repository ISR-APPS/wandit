// Colored status pill that is also a select — the one-click COD pipeline
// control. Changes apply optimistically via useUpdateLeadStatus.

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@my-better-t-app/ui/components/select";
import { cn } from "@my-better-t-app/ui/lib/utils";
import { toast } from "sonner";

import type { Lead, LeadStatus } from "../../api/dto";
import { useUpdateLeadStatus } from "../../api/leads.mutations";
import {
	LEAD_STATUS_META,
	LEAD_STATUS_ORDER,
	WORKSPACE_COPY,
} from "../../lib/constants";
import { useWorkspace } from "../../lib/store";

/** Pill tint per status — border/bg/text tuned for light and dark. */
const STATUS_TINT: Record<LeadStatus, string> = {
	to_confirm:
		"border-amber-500/25 bg-amber-500/10 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20",
	confirmed:
		"border-blue-500/25 bg-blue-500/10 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20",
	shipped:
		"border-violet-500/25 bg-violet-500/10 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400 dark:hover:bg-violet-500/20",
	delivered:
		"border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20",
	returned:
		"border-slate-500/25 bg-slate-500/10 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400 dark:hover:bg-slate-500/20",
	cancelled:
		"border-red-500/25 bg-red-500/10 text-red-700 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20",
};

export function LeadStatusSelect({ lead }: { lead: Lead }) {
	const { projectId } = useWorkspace();
	const updateStatus = useUpdateLeadStatus(projectId);

	const handleChange = (value: string) => {
		const status = value as LeadStatus;
		if (status === lead.status) return;
		updateStatus.mutate({ leadId: lead.id, status });
		toast.success(
			WORKSPACE_COPY.leads.statusUpdated(
				lead.name,
				LEAD_STATUS_META[status].label,
			),
		);
	};

	return (
		<Select value={lead.status} onValueChange={handleChange}>
			<SelectTrigger
				size="sm"
				aria-label={WORKSPACE_COPY.leads.colStatus}
				className={cn(
					"w-auto gap-1.5 rounded-full px-2.5 font-medium text-xs shadow-none data-[size=sm]:h-7",
					STATUS_TINT[lead.status],
				)}
			>
				<SelectValue>{LEAD_STATUS_META[lead.status].label}</SelectValue>
			</SelectTrigger>
			<SelectContent align="end" position="popper">
				{LEAD_STATUS_ORDER.map((status) => (
					<SelectItem key={status} value={status}>
						<span
							aria-hidden
							className={cn(
								"size-1.5 shrink-0 rounded-full",
								LEAD_STATUS_META[status].dotClass,
							)}
						/>
						{LEAD_STATUS_META[status].label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

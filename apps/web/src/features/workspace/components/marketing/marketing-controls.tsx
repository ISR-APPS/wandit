// Marketing tab controls, rendered inside the main card's header (see
// shell/main-pane-header.tsx): last-updated stamp, markdown export and a
// mock "update plan" refresh — the timed run mirrors what the real
// strategy-regeneration job will do, same pattern as the publish simulation.

import { Button } from "@wandit/ui/components/button";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { relativeTime } from "@/lib/relative-time";
import { useLeadsQuery } from "../../api/leads.queries";
import { WORKSPACE_COPY } from "../../lib/constants";
import { downloadTextFile } from "../../lib/helpers";
import {
	buildMarketingPlanMarkdown,
	getMarketingPlan,
} from "../../lib/mock-marketing";
import { useWorkspace } from "../../lib/store";

const COPY = WORKSPACE_COPY.marketing;

const UPDATE_DURATION_MS = 1200;
const INITIAL_AGE_MS = 2 * 3_600_000;

export function MarketingControls() {
	const { projectId, project } = useWorkspace();
	const leadsQuery = useLeadsQuery(projectId, project?.leadCount);

	const [updatedAt, setUpdatedAt] = useState(() =>
		new Date(Date.now() - INITIAL_AGE_MS).toISOString(),
	);
	const [updating, setUpdating] = useState(false);
	const timerRef = useRef<number | null>(null);

	useEffect(
		() => () => {
			if (timerRef.current !== null) window.clearTimeout(timerRef.current);
		},
		[],
	);

	const exportPlan = () => {
		if (!project) return;
		const plan = getMarketingPlan(project);
		const confirmed = (leadsQuery.data ?? []).filter(
			(lead) => lead.status === "confirmed",
		).length;
		downloadTextFile(
			COPY.exportFileName(projectId),
			buildMarketingPlanMarkdown(plan, project.name, confirmed),
			"text/markdown;charset=utf-8",
		);
		toast.success(COPY.exportedToast);
	};

	const updatePlan = () => {
		if (updating) return;
		setUpdating(true);
		timerRef.current = window.setTimeout(() => {
			setUpdating(false);
			setUpdatedAt(new Date().toISOString());
			toast.success(COPY.planUpdatedToast);
		}, UPDATE_DURATION_MS);
	};

	return (
		<div className="flex items-center gap-1.5">
			<span className="hidden font-mono text-[11px] text-muted-foreground lg:inline">
				{COPY.updatedPrefix} {relativeTime(updatedAt)}
			</span>
			<Button
				variant="outline"
				size="sm"
				className="h-8 rounded-lg"
				onClick={exportPlan}
				disabled={!project}
			>
				<Download className="size-3.5" />
				<span className="hidden sm:inline">{COPY.exportPlan}</span>
			</Button>
			<Button
				size="sm"
				className="h-8 rounded-lg"
				onClick={updatePlan}
				disabled={updating || !project}
			>
				{updating ? (
					<Loader2 className="size-3.5 animate-spin" />
				) : (
					<RefreshCw className="size-3.5" />
				)}
				<span className="hidden sm:inline">
					{updating ? COPY.updating : COPY.updatePlan}
				</span>
			</Button>
		</div>
	);
}

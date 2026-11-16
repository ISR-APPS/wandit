/**
 * The "Use this template" flow of the detail page. It creates the V2 project
 * from the starter template, then opens the builder at `/app/$projectId`.
 * Called by pages/template-detail-page.tsx. Calls the create mutation, the
 * router, and the 402 check of the projects feature.
 */

import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { isInsufficientCreditsApiError } from "@/features/projects";
import { getApiErrorMessage } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";
import type { CreateAppProjectResponse } from "../api/dto";
import { useCreateProjectFromStarterTemplate } from "../api/starter-templates.mutations";

/** What the detail page reads from `useStarterTemplateStart`. */
export type StarterTemplateStart = {
	/** Creates the project from this catalog id and opens the builder. */
	start: (starterTemplateId: string) => Promise<void>;
	/** True from the click until the create fails. It stays true after a successful create. The page disables the button then: a second click would make a second project. */
	isStarting: boolean;
	/** True after a 402: the page opens the insufficient credits dialog. */
	insufficientOpen: boolean;
	setInsufficientOpen: (open: boolean) => void;
};

/**
 * The create sends the UI language, so the first chat message shows the
 * tagline in that language. The API checks the balance: a 402 opens the
 * credits dialog, and every other error shows as a toast.
 */
export function useStarterTemplateStart(): StarterTemplateStart {
	const { locale } = useTranslation();
	const createProject = useCreateProjectFromStarterTemplate();
	const navigate = useNavigate();
	const [insufficientOpen, setInsufficientOpen] = useState(false);
	// The mutation is not pending while the builder route loads. This state covers the two steps.
	const [isStarting, setIsStarting] = useState(false);

	const start = async (starterTemplateId: string) => {
		setIsStarting(true);
		let created: CreateAppProjectResponse;
		try {
			created = await createProject.mutateAsync({ starterTemplateId, locale });
		} catch (error) {
			setIsStarting(false);
			if (isInsufficientCreditsApiError(error)) {
				setInsufficientOpen(true);
				return;
			}
			toast.error(getApiErrorMessage(error));
			return;
		}
		try {
			await navigate({
				to: "/app/$projectId",
				params: { projectId: created.projectId },
			});
		} catch (error) {
			// The server kept the project. The button stays disabled, so a second click cannot make a twin.
			toast.error(getApiErrorMessage(error));
		}
	};

	return { start, isStarting, insufficientOpen, setInsufficientOpen };
}

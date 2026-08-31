import { captureEvent, getAnalytics } from "@wandit/analytics/browser";
import {
	type CreateFeedbackRequest,
	type FeedbackCategory,
	feedbackCategorySchema,
} from "@wandit/contracts";
import { getLastCapturedError } from "@wandit/observability/browser";
import { Button } from "@wandit/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@wandit/ui/components/dialog";
import { Label } from "@wandit/ui/components/label";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { Switch } from "@wandit/ui/components/switch";
import { Textarea } from "@wandit/ui/components/textarea";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@wandit/ui/components/toggle-group";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import {
	Bug,
	CircleCheck,
	Lightbulb,
	Loader2,
	MessageCircle,
	MessageSquarePlus,
} from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { useSession } from "@/features/auth";
import { getApiErrorMessage } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";
import { useCreateFeedback } from "../api/feedback.mutations";
import {
	captureScreenshot,
	type FeedbackScreenshot,
} from "../lib/capture-screenshot";

const MIN_MESSAGE_LENGTH = 3;
const MAX_MESSAGE_LENGTH = 4000;
// Show the counter only near the limit, so it does not add noise.
const MESSAGE_COUNTER_THRESHOLD = 3500;
// Field limits from the shared contract. Cut long values here so a valid
// report is never refused for a detail the user does not control.
const MAX_PAGE_URL_LENGTH = 2000;
const MAX_REPLAY_URL_LENGTH = 2000;
const MAX_USER_AGENT_LENGTH = 512;
const MAX_LOCALE_LENGTH = 20;
// How long the thank-you note stays before the dialog closes itself.
const THANK_YOU_CLOSE_MS = 1500;

// PostHog is optional and replay can be off. Guard every step.
function getReplayUrl(): string | undefined {
	try {
		const url = getAnalytics()?.get_session_replay_url?.({
			withTimestamp: true,
		});
		return typeof url === "string"
			? url.slice(0, MAX_REPLAY_URL_LENGTH)
			: undefined;
	} catch {
		return undefined;
	}
}

type FeedbackHostProps = {
	// Draws the element that opens the dialog. The host owns all state.
	renderTrigger: (open: () => void) => ReactNode;
	/** Active workspace conversation, when the trigger lives inside chat scope. */
	chatId?: string;
};

// Owns the dialog, the capture, and the submit flow. The trigger below
// chooses where and how the opener renders.
function FeedbackHost({ renderTrigger, chatId }: FeedbackHostProps) {
	const { t } = useTranslation();
	const { data } = useSession();
	const createFeedback = useCreateFeedback();
	const messageId = useId();
	const screenshotId = useId();
	const [open, setOpen] = useState(false);
	const [message, setMessage] = useState("");
	const [category, setCategory] = useState<FeedbackCategory | null>(null);
	const [screenshot, setScreenshot] = useState<FeedbackScreenshot | null>(null);
	const [includeScreenshot, setIncludeScreenshot] = useState(true);
	const [isCapturing, setIsCapturing] = useState(false);
	const [isSubmitted, setIsSubmitted] = useState(false);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Stop the auto-close timer if the widget goes away first.
	useEffect(
		() => () => {
			if (closeTimer.current) {
				clearTimeout(closeTimer.current);
			}
		},
		[],
	);

	if (!data?.user) {
		return null;
	}

	// The chips above the message. Selection stays optional.
	const categoryOptions = [
		{ value: "bug", Icon: Bug, label: t("common.feedback.categoryBug") },
		{
			value: "idea",
			Icon: Lightbulb,
			label: t("common.feedback.categoryIdea"),
		},
		{
			value: "other",
			Icon: MessageCircle,
			label: t("common.feedback.categoryOther"),
		},
	];

	const canSubmit =
		message.trim().length >= MIN_MESSAGE_LENGTH && !createFeedback.isPending;

	const changeOpen = (next: boolean) => {
		setOpen(next);
		if (next) {
			return;
		}
		// A closed dialog must start fresh at the next open.
		if (closeTimer.current) {
			clearTimeout(closeTimer.current);
			closeTimer.current = null;
		}
		setIsSubmitted(false);
		setMessage("");
		setCategory(null);
		setScreenshot(null);
	};

	const openDialog = () => {
		// Open at once; the user must never wait on the capture. The capture
		// filter removes the dialog and its overlay from the image, so it can
		// run while the dialog is visible.
		setOpen(true);
		if (isCapturing) {
			return;
		}
		setScreenshot(null);
		setIncludeScreenshot(true);
		setIsCapturing(true);
		void captureScreenshot().then((captured) => {
			setScreenshot(captured);
			setIsCapturing(false);
		});
	};

	const submit = async () => {
		const text = message.trim();
		if (!canSubmit) {
			return;
		}

		const lastError = getLastCapturedError();
		const replayUrl = getReplayUrl();
		const withScreenshot = includeScreenshot && screenshot !== null;
		const body: CreateFeedbackRequest = {
			message: text,
			...(chatId ? { chatId } : {}),
			...(category ? { category } : {}),
			pageUrl: window.location.href.slice(0, MAX_PAGE_URL_LENGTH),
			...(replayUrl ? { replayUrl } : {}),
			...(lastError
				? {
						sentryEventId: lastError.eventId,
						sentryEventAt: new Date(lastError.at).toISOString(),
					}
				: {}),
			...(withScreenshot && screenshot ? { screenshot } : {}),
			context: {
				userAgent: navigator.userAgent.slice(0, MAX_USER_AGENT_LENGTH),
				viewport: { width: window.innerWidth, height: window.innerHeight },
				locale: navigator.language.slice(0, MAX_LOCALE_LENGTH),
			},
		};

		try {
			await createFeedback.mutateAsync(body);
			// Show the thank-you note first, then close the dialog by itself.
			setIsSubmitted(true);
			captureEvent("feedback_submitted", {
				hasScreenshot: withScreenshot,
				category: category ?? "none",
			});
			closeTimer.current = setTimeout(() => {
				closeTimer.current = null;
				changeOpen(false);
			}, THANK_YOU_CLOSE_MS);
		} catch (error) {
			// Keep the dialog open so the typed message survives a retry. The
			// toast shows the localized cause when the API gives a known code,
			// for example a rate limit, and a generic text if it does not.
			toast.error(getApiErrorMessage(error));
		}
	};

	return (
		<>
			{renderTrigger(openDialog)}

			<Dialog open={open} onOpenChange={changeOpen}>
				<DialogContent
					data-feedback-widget=""
					className="sm:max-w-md"
					closeLabel={t("common.close")}
					onOpenAutoFocus={(event) => {
						// Put the caret in the message box, not on the close button.
						event.preventDefault();
						textareaRef.current?.focus();
					}}
				>
					<DialogHeader>
						<DialogTitle>{t("common.feedback.title")}</DialogTitle>
						<DialogDescription>
							{t("common.feedback.description")}
						</DialogDescription>
					</DialogHeader>

					{isSubmitted ? (
						<div className="flex flex-col items-center gap-3 py-8 text-center">
							<CircleCheck className="size-8 text-primary" aria-hidden />
							<p className="font-medium text-sm">
								{t("common.feedback.success")}
							</p>
						</div>
					) : (
						<div className="flex flex-col gap-4">
							<div className="flex flex-col gap-2">
								<p className="text-muted-foreground text-xs">
									{t("common.feedback.categoryLabel")}
								</p>
								<ToggleGroup
									type="single"
									variant="outline"
									size="sm"
									value={category ?? ""}
									aria-label={t("common.feedback.categoryLabel")}
									onValueChange={(value) => {
										// An empty value means the user deselected the chip.
										const parsed = feedbackCategorySchema.safeParse(value);
										setCategory(parsed.success ? parsed.data : null);
									}}
								>
									{categoryOptions.map((option) => (
										<ToggleGroupItem key={option.value} value={option.value}>
											<option.Icon data-icon="inline-start" aria-hidden />
											{option.label}
										</ToggleGroupItem>
									))}
								</ToggleGroup>
							</div>

							<div className="flex flex-col gap-2">
								<Label className="sr-only" htmlFor={messageId}>
									{t("common.feedback.messageLabel")}
								</Label>
								<Textarea
									id={messageId}
									ref={textareaRef}
									className="min-h-28"
									value={message}
									maxLength={MAX_MESSAGE_LENGTH}
									placeholder={t("common.feedback.messagePlaceholder")}
									onChange={(event) => setMessage(event.target.value)}
									onKeyDown={(event) => {
										// Cmd+Enter on a Mac, Ctrl+Enter elsewhere.
										if (
											event.key === "Enter" &&
											(event.metaKey || event.ctrlKey) &&
											canSubmit
										) {
											event.preventDefault();
											void submit();
										}
									}}
								/>
								{message.length >= MESSAGE_COUNTER_THRESHOLD ? (
									<p className="self-end text-muted-foreground text-xs">
										{`${message.length}/${MAX_MESSAGE_LENGTH}`}
									</p>
								) : null}
							</div>

							<div className="flex flex-col gap-2">
								{isCapturing ? (
									<Skeleton className="h-40 w-full rounded-md" />
								) : screenshot ? (
									<div className="flex flex-col gap-2">
										<img
											src={screenshot.dataUrl}
											alt={t("common.feedback.screenshotAlt")}
											className="max-h-64 w-full rounded-md border object-contain"
										/>
										<div className="flex items-center gap-2">
											<Switch
												id={screenshotId}
												checked={includeScreenshot}
												onCheckedChange={setIncludeScreenshot}
											/>
											<Label htmlFor={screenshotId}>
												{t("common.feedback.includeScreenshot")}
											</Label>
										</div>
									</div>
								) : null}
								<p className="text-muted-foreground text-xs">
									{t("common.feedback.contextNote")}
								</p>
							</div>

							<Button
								type="button"
								className="self-end"
								disabled={!canSubmit}
								onClick={() => void submit()}
							>
								{createFeedback.isPending ? (
									<Loader2 className="motion-safe:animate-spin" />
								) : null}
								{createFeedback.isPending
									? t("common.feedback.submitting")
									: t("common.feedback.submit")}
							</Button>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}

// A labeled header button, styled like the academy button next to it. The
// label hides on narrow screens where only the icon fits; the tooltip covers
// that case. The bottom-right corner belongs to the live-chat widget.
export type FeedbackButtonProps = { chatId?: string };

export function FeedbackButton({ chatId }: FeedbackButtonProps) {
	const { t } = useTranslation();
	return (
		<FeedbackHost
			chatId={chatId}
			renderTrigger={(open) => (
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							type="button"
							variant="outline"
							size="sm"
							data-feedback-widget=""
							aria-label={t("common.feedback.open")}
							onClick={open}
						>
							<MessageSquarePlus className="size-4" aria-hidden />
							<span className="hidden sm:inline">
								{t("common.feedback.open")}
							</span>
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom">
						{t("common.feedback.open")}
					</TooltipContent>
				</Tooltip>
			)}
		/>
	);
}

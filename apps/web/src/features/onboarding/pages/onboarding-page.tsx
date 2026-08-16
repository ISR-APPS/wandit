import { useNavigate } from "@tanstack/react-router";
import { captureEvent, identifyAnalyticsUser } from "@wandit/analytics/browser";
import {
	completeOnboardingBodySchema,
	getApplicableOnboardingQuestions,
	onboardingQuestions,
} from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import { ArrowLeft } from "lucide-react";
import {
	AnimatePresence,
	MotionConfig,
	motion,
	type Variants,
} from "motion/react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
	invalidateSessionCache,
	refreshSession,
} from "@/features/auth/lib/session";
import { useDictionary, useTranslation } from "@/lib/i18n";

import { useCompleteOnboarding } from "../api/onboarding.mutations";
import {
	ChoiceStep,
	type OnboardingChoiceOption,
} from "../components/choice-step";
import { IgnitionOverlay } from "../components/ignition-overlay";
import { OnboardingProgress } from "../components/onboarding-progress";
import { OnboardingShell } from "../components/onboarding-shell";
import { SoundToggle } from "../components/sound-toggle";
import { SparkFlare } from "../components/spark-flare";
import { TextStep } from "../components/text-step";
import {
	getOnboardingQuestionViewConfig,
	isOnboardingChoiceQuestionViewConfig,
	isOnboardingTextQuestionViewConfig,
	type OnboardingAnswerState,
	type OnboardingQuestion,
	type OnboardingQuestionId,
	type OnboardingQuestionViewConfig,
	removeInapplicableOnboardingAnswers,
} from "../lib/questions";
import { useOnboardingSound } from "../lib/use-onboarding-sound";

const AUTO_ADVANCE_MS = 320;
const MINIMUM_IGNITION_MS = 1400;

const stepScene: Variants = {
	hidden: { opacity: 0, y: 14 },
	show: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.45, ease: "easeOut" },
	},
	exit: {
		opacity: 0,
		y: -10,
		transition: { duration: 0.25, ease: "easeIn" },
	},
};

type OnboardingPageProps = {
	user: { id: string; email: string; name: string };
	next?: string;
};

export default function OnboardingPage({ user, next }: OnboardingPageProps) {
	const navigate = useNavigate();
	const { setTheme } = useTheme();
	const { t, dir } = useTranslation();
	const copy = useDictionary().onboarding;
	const completeOnboarding = useCompleteOnboarding();
	const { muted, toggle, playSelect, playCompletion } = useOnboardingSound();
	const [activeIndex, setActiveIndex] = useState(0);
	const [answers, setAnswers] = useState<OnboardingAnswerState>(() => ({
		name: user.name.slice(0, 100),
	}));
	const [pulse, setPulse] = useState(0);
	const [submitting, setSubmitting] = useState(false);
	const advanceTimerRef = useRef<number | null>(null);
	const interactionLockedRef = useRef(false);
	const completedStepsRef = useRef(new Set<OnboardingQuestionId>());
	const skippedStepsRef = useRef(new Set<OnboardingQuestionId>());
	const capturedStartRef = useRef(false);
	const mountedRef = useRef(true);

	const visibleQuestions = getApplicableOnboardingQuestions(answers);
	const question =
		visibleQuestions[activeIndex] ??
		visibleQuestions[0] ??
		onboardingQuestions[0];
	const view = getOnboardingQuestionViewConfig(question.id);
	const titleId = `onboarding-question-${question.id}`;

	useEffect(() => {
		mountedRef.current = true;
		window.scrollTo({ top: 0, behavior: "auto" });
		if (!capturedStartRef.current) {
			capturedStartRef.current = true;
			captureEvent("onboarding_started");
		}

		return () => {
			mountedRef.current = false;
			if (advanceTimerRef.current !== null) {
				window.clearTimeout(advanceTimerRef.current);
			}
		};
	}, []);

	const statusLines = [
		copy.submitting.saving,
		copy.submitting.warming,
		copy.submitting.igniting,
	];

	function recordStepCompletion(stepId: OnboardingQuestionId) {
		if (completedStepsRef.current.has(stepId)) return;
		completedStepsRef.current.add(stepId);
		captureEvent("onboarding_step_completed", { stepId });
	}

	function recordStepSkip(stepId: OnboardingQuestionId) {
		if (skippedStepsRef.current.has(stepId)) return;
		skippedStepsRef.current.add(stepId);
		captureEvent("onboarding_step_skipped", { stepId });
	}

	function clearAdvanceTimer() {
		if (advanceTimerRef.current === null) return;
		window.clearTimeout(advanceTimerRef.current);
		advanceTimerRef.current = null;
	}

	function goBack() {
		if (submitting || interactionLockedRef.current) return;
		clearAdvanceTimer();
		interactionLockedRef.current = false;
		window.scrollTo({ top: 0, behavior: "auto" });
		setActiveIndex((index) => Math.max(index - 1, 0));
	}

	function updateTextAnswer(value: string) {
		setAnswers((current) => ({ ...current, [question.id]: value }));
	}

	function advanceOrSubmit(nextAnswers: OnboardingAnswerState) {
		const nextVisibleQuestions = getApplicableOnboardingQuestions(nextAnswers);
		const currentVisibleIndex = nextVisibleQuestions.findIndex(
			({ id }) => id === question.id,
		);

		if (currentVisibleIndex === nextVisibleQuestions.length - 1) {
			void submitAnswers(nextAnswers);
			return;
		}

		advanceTimerRef.current = window.setTimeout(() => {
			advanceTimerRef.current = null;
			interactionLockedRef.current = false;
			window.scrollTo({ top: 0, behavior: "auto" });
			setActiveIndex(Math.max(currentVisibleIndex + 1, 0));
		}, AUTO_ADVANCE_MS);
	}

	async function submitAnswers(nextAnswers: OnboardingAnswerState) {
		const parsed = completeOnboardingBodySchema.safeParse({
			answers: nextAnswers,
		});
		if (!parsed.success) {
			interactionLockedRef.current = false;
			toast.error(copy.error.submit);
			return;
		}

		const requestOutcome = completeOnboarding
			.mutateAsync(parsed.data)
			.then(async () => {
				// The auth modal only re-identifies on a user-id change, so the
				// renamed person profile must be pushed here or PostHog keeps the
				// pre-onboarding name for the rest of the SPA session.
				identifyAnalyticsUser(user.id, {
					email: user.email,
					name: parsed.data.answers.name,
				});
				// Must settle before navigating: the _auth guard reads the session
				// and would bounce a stale "not onboarded" user straight back here.
				await refreshSession().catch(() => invalidateSessionCache());
				return true;
			})
			.catch(() => false);

		await new Promise<void>((resolve) => {
			window.setTimeout(resolve, AUTO_ADVANCE_MS);
		});
		if (!mountedRef.current) {
			await requestOutcome;
			return;
		}

		setSubmitting(true);
		const [requestSucceeded] = await Promise.all([
			requestOutcome,
			new Promise<void>((resolve) => {
				window.setTimeout(resolve, MINIMUM_IGNITION_MS);
			}),
		]);

		if (!mountedRef.current) return;

		if (!requestSucceeded) {
			interactionLockedRef.current = false;
			setSubmitting(false);
			toast.error(copy.error.submit);
			return;
		}

		playCompletion();
		await navigate({ href: next ?? "/dashboard", replace: true });
	}

	function answerCurrentQuestion(value: string) {
		if (interactionLockedRef.current || submitting) return;

		const answer = question.type === "text" ? value.trim() : value;
		if (!answer) return;

		interactionLockedRef.current = true;
		clearAdvanceTimer();

		if (question.id === "style" && (answer === "light" || answer === "dark")) {
			setTheme(answer);
		}

		const nextAnswers = removeInapplicableOnboardingAnswers({
			...answers,
			[question.id]: answer,
		});
		setAnswers(nextAnswers);
		setPulse((current) => current + 1);
		playSelect();
		recordStepCompletion(question.id);
		advanceOrSubmit(nextAnswers);
	}

	function skipCurrentQuestion() {
		if (
			interactionLockedRef.current ||
			submitting ||
			!("optional" in question && question.optional === true)
		) {
			return;
		}

		interactionLockedRef.current = true;
		clearAdvanceTimer();

		const nextAnswers = { ...answers };
		delete nextAnswers[question.id];
		const applicableAnswers = removeInapplicableOnboardingAnswers(nextAnswers);
		setAnswers(applicableAnswers);
		recordStepSkip(question.id);
		advanceOrSubmit(applicableAnswers);
	}

	return (
		<MotionConfig reducedMotion="user">
			<OnboardingShell>
				<SoundToggle
					muted={muted}
					label={muted ? copy.common.soundOn : copy.common.soundOff}
					onToggle={toggle}
				/>

				{submitting ? (
					<IgnitionOverlay lines={statusLines} />
				) : (
					<>
						{activeIndex > 0 ? (
							<Button
								type="button"
								variant="ghost"
								size="icon"
								aria-label={copy.common.back}
								onClick={goBack}
								className="absolute start-4 top-4 z-20 text-muted-foreground hover:text-foreground active:scale-95 md:start-6 md:top-6"
							>
								<ArrowLeft aria-hidden className="size-4.5 rtl:rotate-180" />
							</Button>
						) : null}

						<div className="flex min-h-svh w-full flex-col items-center justify-center px-4 py-16 md:px-8 md:py-24">
							<div className="flex w-full flex-col items-center text-center">
								<SparkFlare pulse={pulse} />

								<AnimatePresence mode="wait" initial={false}>
									<motion.section
										key={question.id}
										variants={stepScene}
										initial="hidden"
										animate="show"
										exit="exit"
										aria-labelledby={titleId}
										className="mt-4 w-full"
									>
										<h1
											id={titleId}
											className="mx-auto max-w-3xl text-balance font-bold font-display text-2xl tracking-tight md:text-3xl rtl:leading-[1.3] rtl:tracking-normal"
										>
											{t(view.titleKey)}
										</h1>

										<div
											className={cn(
												"mx-auto mt-6 w-full md:mt-8",
												view.type === "text"
													? "max-w-md"
													: view.variant === "style-preview"
														? "max-w-2xl"
														: view.grid.desktopColumns === 3
															? "max-w-3xl"
															: "max-w-4xl",
											)}
										>
											<QuestionRenderer
												question={question}
												view={view}
												answer={answers[question.id] ?? ""}
												dir={dir}
												pulse={pulse}
												titleId={titleId}
												onTextChange={updateTextAnswer}
												onAnswer={answerCurrentQuestion}
												onSkip={skipCurrentQuestion}
											/>
										</div>
									</motion.section>
								</AnimatePresence>
							</div>

							<OnboardingProgress
								currentIndex={activeIndex}
								total={visibleQuestions.length}
								className="absolute bottom-5 md:bottom-7"
							/>
						</div>
					</>
				)}
			</OnboardingShell>
		</MotionConfig>
	);
}

type QuestionRendererProps = {
	question: OnboardingQuestion;
	view: OnboardingQuestionViewConfig;
	answer: string;
	dir: "ltr" | "rtl";
	pulse: number;
	titleId: string;
	onTextChange: (value: string) => void;
	onAnswer: (value: string) => void;
	onSkip: () => void;
};

function QuestionRenderer({
	question,
	view,
	answer,
	dir,
	pulse,
	titleId,
	onTextChange,
	onAnswer,
	onSkip,
}: QuestionRendererProps) {
	const { t } = useTranslation();

	if (
		question.type === "choice" &&
		isOnboardingChoiceQuestionViewConfig(view)
	) {
		const options = question.options.flatMap<OnboardingChoiceOption>(
			(value) => {
				const option = view.options.find((item) => item.value === value);
				return option
					? [{ value, label: t(option.labelKey), icon: option.icon }]
					: [];
			},
		);

		return (
			<ChoiceStep
				options={options}
				selectedValue={answer || undefined}
				columns={view.grid.desktopColumns}
				variant={view.variant === "style-preview" ? "style" : "default"}
				dir={dir}
				pulse={pulse}
				onSelect={onAnswer}
				titleId={titleId}
			/>
		);
	}

	if (question.type === "text" && isOnboardingTextQuestionViewConfig(view)) {
		const optional = "optional" in question && question.optional === true;

		return (
			<TextStep
				value={answer}
				label={t(view.labelKey)}
				nextLabel={t(view.nextLabelKey)}
				placeholder={view.placeholderKey ? t(view.placeholderKey) : undefined}
				skipLabel={view.skipLabelKey ? t(view.skipLabelKey) : undefined}
				optional={optional}
				onChange={onTextChange}
				onSubmit={() => onAnswer(answer)}
				onSkip={onSkip}
				inputId={`onboarding-answer-${question.id}`}
				autoComplete={optional ? "off" : "name"}
				maxLength={question.maxLength}
			/>
		);
	}

	return null;
}

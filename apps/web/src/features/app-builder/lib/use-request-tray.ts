/**
 * State of the request tray. It steps through the open questions of the
 * last reply, keeps the picks and the image uploads, and builds the typed
 * answers that the composer button sends in one turn. Called by
 * chat-pane.tsx; calls the upload service of the projects feature.
 */

import {
	ATTACHMENT_MEDIA_TYPES,
	projectPromptMaxLength,
	type TurnQuestionAnswer,
	type UploadAttachmentResponse,
} from "@wandit/contracts";
import { useCallback, useEffect, useRef, useState } from "react";

import { attachmentMaxBytesFor, uploadAttachment } from "@/features/projects";
import { useTranslation } from "@/lib/i18n";
import type { BuilderDataParts } from "../api/dto";
import type { ComposerSubmitOverride } from "../components/chat/composer";
import type { TrayBodyCallbacks } from "../components/chat/request-tray/tray-bodies";
import type {
	RequestTrayState,
	TrayBody,
} from "../components/chat/request-tray/types";

/** One open question of the last reply, as lib/turn-parts.ts maps it. */
export type TrayQuestion = BuilderDataParts["question"];

/** Images an `attachments` question takes when the agent names no limit (the V1 default). */
const DEFAULT_MAX_FILES = 3;

// The upload route takes these image types. The tray asks for images only:
// the agent copies them into the app.
const IMAGE_MEDIA_TYPES: ReadonlySet<string> = new Set(
	ATTACHMENT_MEDIA_TYPES.filter((mediaType) => mediaType.startsWith("image/")),
);
const IMAGE_ACCEPT = [...IMAGE_MEDIA_TYPES].join(",");

/** One picked image of an `attachments` question, before and after its upload. */
type UploadDraft = {
	id: string;
	name: string;
	/** Object URL of the local file; revoked on remove and when the pane unmounts. */
	previewUrl: string;
	status: "uploading" | "ready" | "error";
	/** The stored file, once the upload answered. */
	uploaded: UploadAttachmentResponse | null;
};

/** One answered step: the typed answer and its line in the user bubble. */
type StepAnswer = { answer: TurnQuestionAnswer; summary: string };

type RoundState = {
	/** Keys of the round's questions, joined; a new round starts from zero. */
	roundKey: string;
	stepIndex: number;
	/** Picked option ids by question key. */
	picks: Record<string, string[]>;
	/** Picked images by question key. */
	uploads: Record<string, UploadDraft[]>;
	/** Answers of the steps before the current one. */
	answered: StepAnswer[];
	/** True after the skip X; the next plain message answers the round as skipped. */
	isDismissed: boolean;
};

/** What chat-pane.tsx binds to the tray and to the composer. */
export type RequestTray = {
	/** The tray to show, or null when no question is open or the user skipped the round. */
	state: RequestTrayState | null;
	/** Key of the open round; the tray grows once per round and follows the height of each step. */
	roundKey: string | null;
	/** Key of the shown question, equal to its `data-question` part id; null while the tray hides. */
	questionKey: string | null;
	bodyCallbacks: TrayBodyCallbacks;
	/** The composer answer button while the tray shows; null otherwise. */
	submit: ComposerSubmitOverride | null;
	/** Answers the current question with "Decide for me". */
	delegate: () => void;
	/** Hides the tray until the next reply. */
	dismiss: () => void;
	/**
	 * The answers of a plain message sent while the round is skipped: the
	 * answered steps, then the rest as skipped. Null when no round is skipped.
	 */
	dismissedAnswersFor: (text: string) => TurnQuestionAnswer[] | null;
};

/** Stable key of one question; also the id of its `data-question` part. */
function questionKeyOf(question: TrayQuestion): string {
	return `${question.toolCallId}:${question.questionId}`;
}

function emptyRound(roundKey: string): RoundState {
	return {
		roundKey,
		stepIndex: 0,
		picks: {},
		uploads: {},
		answered: [],
		isDismissed: false,
	};
}

/** The body of one question with the current picks and uploads. */
function bodyOf(
	question: TrayQuestion,
	picked: string[],
	uploads: UploadDraft[],
): TrayBody {
	const options = question.options.map((option) => ({
		id: option.id,
		label: option.label,
	}));
	switch (question.kind) {
		case "free-text":
			return { kind: "free-text" };
		case "multi-select":
			return { kind: "multi-select", options, selectedIds: picked };
		case "attachments":
			return {
				kind: "media-drop",
				accept: IMAGE_ACCEPT,
				items: uploads.map((draft) => ({
					id: draft.id,
					name: draft.name,
					preview: `url("${draft.previewUrl}") center/cover`,
					isUploading: draft.status === "uploading",
					hasError: draft.status === "error",
				})),
				canAddMore: uploads.length < (question.maxFiles ?? DEFAULT_MAX_FILES),
			};
		case "single-choice":
			// The agent offers design worlds: the task added their preview cards.
			if (question.options.some((option) => option.card !== undefined)) {
				return {
					kind: "world-pick",
					options: question.options,
					selectedId: picked[0] ?? null,
				};
			}
			return {
				kind: "single-choice",
				options,
				selectedId: picked[0] ?? null,
			};
	}
}

/**
 * Holds one answer round of the open questions for chat-pane.tsx. A new set
 * of question keys starts a new round at step one. A rejected send brings
 * the same keys back, so the round keeps its picks for the retry.
 */
export function useRequestTray({
	questions,
	draft,
	onSubmit,
	upload = uploadAttachment,
}: {
	/** The open questions of the last reply, in order; empty when none waits. */
	questions: readonly TrayQuestion[];
	/** The live composer text. It answers a free-text question and overrides the chips. */
	draft: string;
	/** Sends the round: the user bubble summary and one answer per question. */
	onSubmit: (input: { message: string; answers: TurnQuestionAnswer[] }) => void;
	/** Test seam; production uploads through the projects feature. */
	upload?: (file: File) => Promise<UploadAttachmentResponse>;
}): RequestTray {
	const { t } = useTranslation();
	const roundKey = questions.map(questionKeyOf).join("|");
	const [stored, setStored] = useState<RoundState>(() => emptyRound(roundKey));
	const round = stored.roundKey === roundKey ? stored : emptyRound(roundKey);

	// Every change starts from a fresh state when a new round replaced the old one.
	const update = useCallback(
		(change: (current: RoundState) => RoundState) =>
			setStored((current) =>
				change(current.roundKey === roundKey ? current : emptyRound(roundKey)),
			),
		[roundKey],
	);

	// The thumbnails hold object URLs. A rejected send shows the same round
	// again, so the URLs stay until a remove or the unmount.
	// LIMIT: previews of sent rounds stay in memory until the pane unmounts.
	// Upgrade: free them when a different round starts.
	const objectUrlsRef = useRef(new Set<string>());
	useEffect(() => {
		const urls = objectUrlsRef.current;
		return () => {
			for (const url of urls) URL.revokeObjectURL(url);
			urls.clear();
		};
	}, []);

	const question = questions[round.stepIndex] ?? null;
	const questionKey = question === null ? null : questionKeyOf(question);
	const picked = questionKey === null ? [] : (round.picks[questionKey] ?? []);
	const uploads =
		questionKey === null ? [] : (round.uploads[questionKey] ?? []);
	const typed = draft.trim();
	const isLastStep = round.stepIndex >= questions.length - 1;

	/** The answer of the current step from the picks, the uploads, and the text; null while incomplete. */
	const currentAnswer = (text: string): StepAnswer | null => {
		if (question === null) return null;
		const typedText = text.trim();
		const base = {
			toolCallId: question.toolCallId,
			questionId: question.questionId,
			action: "answered" as const,
			text: typedText,
		};
		if (question.kind === "attachments") {
			// An image still uploading has no URL yet; the answer waits for it.
			if (uploads.some((draftFile) => draftFile.status === "uploading")) {
				return null;
			}
			const files = uploads.flatMap((draftFile) =>
				draftFile.uploaded === null
					? []
					: [
							{
								url: draftFile.uploaded.url,
								mediaType: draftFile.uploaded.mediaType,
								filename: draftFile.uploaded.filename,
							},
						],
			);
			if (files.length === 0 && typedText === "") return null;
			const summary = [
				files.length > 0
					? t("appBuilder.chat.tray.filesSent", { count: files.length })
					: "",
				typedText,
			]
				.filter((line) => line !== "")
				.join("\n");
			return { answer: { ...base, optionIds: [], files }, summary };
		}
		// Typed text wins over the picked options, as in the V1 tray.
		if (typedText !== "" || question.kind === "free-text") {
			if (typedText === "") return null;
			return {
				answer: { ...base, optionIds: [], files: [] },
				summary: typedText,
			};
		}
		if (picked.length === 0) return null;
		const labels = question.options
			.filter((option) => picked.includes(option.id))
			.map((option) => option.label);
		return {
			answer: { ...base, optionIds: picked, files: [] },
			summary: labels.join(", "),
		};
	};

	/**
	 * Stores one step answer and shows the next step, or sends the round. The
	 * last step is not stored: the send closes the questions, and a rejected
	 * send shows the same step again with its picks.
	 */
	const advance = (stepAnswer: StepAnswer) => {
		const answered = [...round.answered, stepAnswer];
		if (!isLastStep) {
			update((current) => ({
				...current,
				answered,
				stepIndex: current.stepIndex + 1,
			}));
			return;
		}
		// One question: the bubble shows the answer. Several: one line each.
		const message =
			answered.length === 1
				? answered[0].summary
				: answered
						.map(
							(entry, index) =>
								`${questions[index]?.question ?? ""}\n${entry.summary}`,
						)
						.join("\n\n");
		onSubmit({
			// The turn route refuses a longer message. The agent reads `answers`,
			// so a cut bubble loses nothing.
			message: message.slice(0, projectPromptMaxLength),
			answers: answered.map((entry) => entry.answer),
		});
	};

	const runUpload = async (ownerKey: string, draftId: string, file: File) => {
		const patch = (change: Partial<UploadDraft>) =>
			setStored((current) =>
				current.roundKey !== roundKey
					? current
					: {
							...current,
							uploads: {
								...current.uploads,
								[ownerKey]: (current.uploads[ownerKey] ?? []).map((item) =>
									item.id === draftId ? { ...item, ...change } : item,
								),
							},
						},
			);
		try {
			patch({ status: "ready", uploaded: await upload(file) });
		} catch {
			// The thumbnail turns red. The user removes it and picks the file again.
			patch({ status: "error" });
		}
	};

	const bodyCallbacks: TrayBodyCallbacks = {
		onPick: (optionId) => {
			if (questionKey === null) return;
			update((current) => ({
				...current,
				picks: { ...current.picks, [questionKey]: [optionId] },
			}));
		},
		onToggle: (optionId) => {
			if (questionKey === null) return;
			update((current) => {
				const ids = current.picks[questionKey] ?? [];
				return {
					...current,
					picks: {
						...current.picks,
						[questionKey]: ids.includes(optionId)
							? ids.filter((id) => id !== optionId)
							: [...ids, optionId],
					},
				};
			});
		},
		onAddFiles: (files) => {
			if (question === null || questionKey === null) return;
			if (question.kind !== "attachments") return;
			const room = (question.maxFiles ?? DEFAULT_MAX_FILES) - uploads.length;
			if (room <= 0) return;
			const drafts: UploadDraft[] = [];
			const jobs: { draftId: string; file: File }[] = [];
			for (const file of files.slice(0, room)) {
				// The upload route refuses other types and files over the size cap.
				const isValid =
					IMAGE_MEDIA_TYPES.has(file.type) &&
					file.size <= attachmentMaxBytesFor(file.type);
				const previewUrl = URL.createObjectURL(file);
				objectUrlsRef.current.add(previewUrl);
				const draftFile: UploadDraft = {
					id: crypto.randomUUID(),
					name: file.name,
					previewUrl,
					status: isValid ? "uploading" : "error",
					uploaded: null,
				};
				drafts.push(draftFile);
				if (isValid) jobs.push({ draftId: draftFile.id, file });
			}
			update((current) => ({
				...current,
				uploads: {
					...current.uploads,
					[questionKey]: [...(current.uploads[questionKey] ?? []), ...drafts],
				},
			}));
			for (const job of jobs)
				void runUpload(questionKey, job.draftId, job.file);
		},
		onRemoveFile: (draftId) => {
			if (questionKey === null) return;
			const removed = uploads.find((item) => item.id === draftId);
			if (removed !== undefined) {
				URL.revokeObjectURL(removed.previewUrl);
				objectUrlsRef.current.delete(removed.previewUrl);
			}
			update((current) => ({
				...current,
				uploads: {
					...current.uploads,
					[questionKey]: (current.uploads[questionKey] ?? []).filter(
						(item) => item.id !== draftId,
					),
				},
			}));
		},
	};

	const isShown = question !== null && !round.isDismissed;
	const answerNow = currentAnswer(draft);

	/** The composer button label: the V1 wording for each body and pick count. */
	const submitLabel = (): string => {
		if (!isLastStep) return t("appBuilder.chat.tray.next");
		if (question === null || typed !== "") {
			return t("appBuilder.chat.tray.answer");
		}
		const readyFiles = uploads.filter((item) => item.status === "ready");
		switch (question.kind) {
			case "attachments":
				return readyFiles.length > 0
					? t("appBuilder.chat.tray.sendFiles", { count: readyFiles.length })
					: t("appBuilder.chat.tray.answer");
			case "free-text":
				return t("appBuilder.chat.tray.answer");
			case "multi-select":
				return picked.length > 0
					? t("appBuilder.chat.tray.chooseSelected", { count: picked.length })
					: t("appBuilder.chat.tray.chooseOptions");
			case "single-choice":
				return picked.length > 0
					? t("appBuilder.chat.tray.chooseSelected", { count: 1 })
					: t("appBuilder.chat.tray.chooseAnOption");
		}
	};

	return {
		state:
			isShown && question !== null
				? {
						badge: question.kind === "attachments" ? "media" : "question",
						label:
							question.kind === "attachments"
								? t("appBuilder.chat.tray.needsFiles")
								: t("appBuilder.chat.tray.needsDetail"),
						// The harness sends "" for an ask_user call it cannot read.
						question:
							question.question === ""
								? t("appBuilder.chat.askUser.untitled")
								: question.question,
						helper: question.helper,
						step:
							questions.length > 1
								? { current: round.stepIndex + 1, total: questions.length }
								: null,
						body: bodyOf(question, picked, uploads),
						typingOverride:
							typed !== "" &&
							(question.kind === "single-choice" ||
								question.kind === "multi-select"),
					}
				: null,
		roundKey: isShown ? roundKey : null,
		questionKey: isShown ? questionKey : null,
		bodyCallbacks,
		submit: isShown
			? {
					label: submitLabel(),
					disabled: answerNow === null,
					onSubmit: (text) => {
						const stepAnswer = currentAnswer(text);
						if (stepAnswer !== null) advance(stepAnswer);
					},
				}
			: null,
		delegate: () => {
			if (question === null) return;
			advance({
				answer: {
					toolCallId: question.toolCallId,
					questionId: question.questionId,
					action: "delegated",
					optionIds: [],
					text: "",
					files: [],
				},
				summary: t("appBuilder.chat.tray.decideForMe"),
			});
		},
		dismiss: () => update((current) => ({ ...current, isDismissed: true })),
		dismissedAnswersFor: (text) => {
			if (!round.isDismissed || questions.length === 0) return null;
			const skipped = questions
				.slice(round.answered.length)
				.map<TurnQuestionAnswer>((entry, index) => ({
					toolCallId: entry.toolCallId,
					questionId: entry.questionId,
					action: "dismissed",
					optionIds: [],
					// The message goes with the first skipped question; the agent reads it there.
					text: index === 0 ? text : "",
					files: [],
				}));
			return [...round.answered.map((entry) => entry.answer), ...skipped];
		},
	};
}

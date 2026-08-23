/**
 * Browser voice-dictation hook used by the PromptBox microphone button.
 *
 * Flow position:
 * - PromptBox calls toggle() when the user presses the mic button.
 * - This hook records audio with native browser APIs, then calls
 *   transcriptions.services.ts to POST the blob to the API.
 * - When the API returns text, the hook calls onTranscript(), and PromptBox
 *   appends the text to the current draft.
 *
 * Gotchas:
 * - Microphone permission and browser support vary, so the hook exposes
 *   supported/isRecording/isTranscribing for the UI to disable controls.
 * - NOTE: recording stops on unmount so the microphone is not left active.
 */
// Voice dictation for the PromptBox mic button: records mic audio with the
// native MediaRecorder, then POSTs the blob to /api/v1/transcriptions and hands
// the recognized text back to the caller. No custom audio deps — MediaRecorder
// and getUserMedia are native. Permission denial and API failures surface as
// toasts via the i18n messages the caller passes in.

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { toUpgradeModalIntent } from "@/features/billing/lib/billing-error-dispatch";
import { creditsKeys } from "@/features/credits";
import { transcribeAudio } from "../api/transcriptions.services";

// Text shown by the caller when browser permission fails or transcription fails.
type VoiceMessages = {
	permissionDenied: string;
	transcribeError: string;
};

// Preferred container; browsers that reject it fall back to their default.
const PREFERRED_MIME = "audio/webm";

// MediaRecorder is the browser API that turns a live MediaStream into encoded
// audio chunks. This helper asks whether the browser can encode our preferred
// MIME type before passing it to the recorder.
function pickMimeType(): string | undefined {
	if (
		typeof MediaRecorder !== "undefined" &&
		typeof MediaRecorder.isTypeSupported === "function" &&
		MediaRecorder.isTypeSupported(PREFERRED_MIME)
	) {
		return PREFERRED_MIME;
	}
	return undefined;
}

// Public return shape for useVoiceDictation(). PromptBox uses these flags to
// render the mic button and to avoid duplicate recording/transcription actions.
export type UseVoiceDictation = {
	isRecording: boolean;
	isTranscribing: boolean;
	/** Start recording, or stop-and-transcribe if already recording. */
	toggle: () => void;
	supported: boolean;
};

// Owns the complete microphone lifecycle for one PromptBox instance.
export function useVoiceDictation(
	onTranscript: (text: string) => void,
	messages: VoiceMessages,
): UseVoiceDictation {
	const queryClient = useQueryClient();
	// isRecording tracks the local recorder state; isTranscribing tracks the
	// network request after recording has stopped.
	const [isRecording, setIsRecording] = useState(false);
	const [isTranscribing, setIsTranscribing] = useState(false);

	// Refs hold mutable browser objects that should not trigger React re-renders
	// every time a chunk arrives or a MediaStream changes.
	const recorderRef = useRef<MediaRecorder | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const streamRef = useRef<MediaStream | null>(null);

	// Latest callback/messages without re-creating the recorder handlers.
	// This avoids stale closures inside long-lived event listeners.
	const onTranscriptRef = useRef(onTranscript);
	onTranscriptRef.current = onTranscript;
	const messagesRef = useRef(messages);
	messagesRef.current = messages;

	// Guard for SSR and unsupported browsers. getUserMedia asks for microphone
	// access; MediaRecorder is what packages the audio after permission is granted.
	const supported =
		typeof window !== "undefined" &&
		typeof MediaRecorder !== "undefined" &&
		typeof navigator !== "undefined" &&
		Boolean(navigator.mediaDevices?.getUserMedia);

	// Stop every track in the active MediaStream. This is what actually releases
	// the user's microphone at the browser/OS level.
	const stopStream = useCallback(() => {
		for (const track of streamRef.current?.getTracks() ?? []) track.stop();
		streamRef.current = null;
	}, []);

	// Kill the mic if the component unmounts mid-recording.
	useEffect(() => () => stopStream(), [stopStream]);

	// Start a new recording session: ask permission, create a recorder, collect
	// chunks, and wire the stop handler that uploads the final blob.
	const start = useCallback(async () => {
		if (!supported) return;
		try {
			// getUserMedia prompts the user for microphone access and returns the
			// live audio stream if they approve.
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			streamRef.current = stream;
			const mimeType = pickMimeType();
			const recorder = new MediaRecorder(
				stream,
				mimeType ? { mimeType } : undefined,
			);
			chunksRef.current = [];

			// The browser emits dataavailable events as it records. We only keep
			// non-empty chunks so the final Blob does not contain useless pieces.
			recorder.addEventListener("dataavailable", (event) => {
				if (event.data.size > 0) chunksRef.current.push(event.data);
			});

			// When recorder.stop() fires, package all collected chunks and send them
			// to the transcription API. This happens after the user clicks the mic
			// button a second time.
			recorder.addEventListener("stop", () => {
				stopStream();
				const type = recorder.mimeType || mimeType || "audio/webm";
				const blob = new Blob(chunksRef.current, { type });
				chunksRef.current = [];
				if (blob.size === 0) {
					// Nothing recorded, so there is nothing to upload or append.
					setIsTranscribing(false);
					return;
				}
				// The file extension is only a hint for the server/provider. The MIME
				// type above is the real browser-reported encoding.
				const fileName = `recording.${type.includes("mp4") ? "mp4" : "webm"}`;
				setIsTranscribing(true);
				transcribeAudio(blob, fileName)
					.then((result) => {
						const text = result.text.trim();
						// Empty transcripts are ignored so the composer is not changed by
						// silence or failed speech detection.
						if (text) onTranscriptRef.current(text);
					})
					.catch((error: unknown) => {
						if (!toUpgradeModalIntent(error)) {
							toast.error(messagesRef.current.transcribeError);
						}
					})
					.finally(() => {
						void queryClient.invalidateQueries({
							queryKey: creditsKeys.scope(),
						});
						setIsTranscribing(false);
					});
			});

			recorderRef.current = recorder;
			recorder.start();
			setIsRecording(true);
		} catch {
			// Permission denial and recorder setup failures land here. Either way,
			// make sure any partially opened stream is closed before showing a toast.
			stopStream();
			setIsRecording(false);
			toast.error(messagesRef.current.permissionDenied);
		}
	}, [queryClient, supported, stopStream]);

	// Stop the active recorder. The actual transcription work runs in the
	// recorder's "stop" event handler above.
	const stop = useCallback(() => {
		const recorder = recorderRef.current;
		setIsRecording(false);
		if (recorder && recorder.state !== "inactive") recorder.stop();
		recorderRef.current = null;
	}, []);

	// Single public button action: first click starts recording, second click
	// stops and begins transcription.
	const toggle = useCallback(() => {
		if (isRecording) {
			stop();
			return;
		}
		void start();
	}, [isRecording, start, stop]);

	return { isRecording, isTranscribing, toggle, supported };
}

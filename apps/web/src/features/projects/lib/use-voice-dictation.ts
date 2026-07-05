// Voice dictation for the PromptBox mic button: records mic audio with the
// native MediaRecorder, then POSTs the blob to /api/v1/transcriptions and hands
// the recognized text back to the caller. No custom audio deps — MediaRecorder
// and getUserMedia are native. Permission denial and API failures surface as
// toasts via the i18n messages the caller passes in.

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { transcribeAudio } from "../api/transcriptions.services";

type VoiceMessages = {
	permissionDenied: string;
	transcribeError: string;
};

// Preferred container; browsers that reject it fall back to their default.
const PREFERRED_MIME = "audio/webm";

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

export type UseVoiceDictation = {
	isRecording: boolean;
	isTranscribing: boolean;
	/** Start recording, or stop-and-transcribe if already recording. */
	toggle: () => void;
	supported: boolean;
};

export function useVoiceDictation(
	onTranscript: (text: string) => void,
	messages: VoiceMessages,
): UseVoiceDictation {
	const [isRecording, setIsRecording] = useState(false);
	const [isTranscribing, setIsTranscribing] = useState(false);

	const recorderRef = useRef<MediaRecorder | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const streamRef = useRef<MediaStream | null>(null);

	// Latest callback/messages without re-creating the recorder handlers.
	const onTranscriptRef = useRef(onTranscript);
	onTranscriptRef.current = onTranscript;
	const messagesRef = useRef(messages);
	messagesRef.current = messages;

	const supported =
		typeof window !== "undefined" &&
		typeof MediaRecorder !== "undefined" &&
		typeof navigator !== "undefined" &&
		Boolean(navigator.mediaDevices?.getUserMedia);

	const stopStream = useCallback(() => {
		for (const track of streamRef.current?.getTracks() ?? []) track.stop();
		streamRef.current = null;
	}, []);

	// Kill the mic if the component unmounts mid-recording.
	useEffect(() => () => stopStream(), [stopStream]);

	const start = useCallback(async () => {
		if (!supported) return;
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			streamRef.current = stream;
			const mimeType = pickMimeType();
			const recorder = new MediaRecorder(
				stream,
				mimeType ? { mimeType } : undefined,
			);
			chunksRef.current = [];

			recorder.addEventListener("dataavailable", (event) => {
				if (event.data.size > 0) chunksRef.current.push(event.data);
			});

			recorder.addEventListener("stop", () => {
				stopStream();
				const type = recorder.mimeType || mimeType || "audio/webm";
				const blob = new Blob(chunksRef.current, { type });
				chunksRef.current = [];
				if (blob.size === 0) {
					setIsTranscribing(false);
					return;
				}
				const fileName = `recording.${type.includes("mp4") ? "mp4" : "webm"}`;
				setIsTranscribing(true);
				transcribeAudio(blob, fileName)
					.then((result) => {
						const text = result.text.trim();
						if (text) onTranscriptRef.current(text);
					})
					.catch(() => {
						toast.error(messagesRef.current.transcribeError);
					})
					.finally(() => setIsTranscribing(false));
			});

			recorderRef.current = recorder;
			recorder.start();
			setIsRecording(true);
		} catch {
			stopStream();
			setIsRecording(false);
			toast.error(messagesRef.current.permissionDenied);
		}
	}, [supported, stopStream]);

	const stop = useCallback(() => {
		const recorder = recorderRef.current;
		setIsRecording(false);
		if (recorder && recorder.state !== "inactive") recorder.stop();
		recorderRef.current = null;
	}, []);

	const toggle = useCallback(() => {
		if (isRecording) {
			stop();
			return;
		}
		void start();
	}, [isRecording, start, stop]);

	return { isRecording, isTranscribing, toggle, supported };
}

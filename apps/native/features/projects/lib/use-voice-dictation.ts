import * as Haptics from "expo-haptics";
import {
	type AudioRecorder,
	RecordingPresets,
	type RecordingOptions,
	requestRecordingPermissionsAsync,
	setAudioModeAsync,
	useAudioRecorder,
} from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import { isApiClientError } from "@/shared/lib/api-client";

import { createTranscription } from "../api/transcriptions.requests";

const MAX_RECORDING_MS = 5 * 60 * 1000;
const ELAPSED_TICK_MS = 250;

const VOICE_RECORDING_OPTIONS = {
	...RecordingPresets.HIGH_QUALITY,
	bitRate: 64000,
	isMeteringEnabled: true,
	numberOfChannels: 1,
} satisfies RecordingOptions;

export type VoiceDictationStatus = "idle" | "recording" | "transcribing";

type VoiceDictationMessages = {
	permissionDenied: string;
	recordingError: string;
	recordingTooLargeError: string;
	recordingUnreadableError: string;
	transcribeError: string;
};

type StopOptions = {
	haptic?: boolean;
	upload: boolean;
};

type StopRecorderOptions = StopOptions & {
	session: number;
};

export type UseVoiceDictation = {
	cancel: () => Promise<void>;
	clearError: () => void;
	elapsedSeconds: number;
	error: string | null;
	isBusy: boolean;
	isRecording: boolean;
	isTranscribing: boolean;
	recorder: AudioRecorder;
	start: () => Promise<void>;
	status: VoiceDictationStatus;
	stop: () => Promise<void>;
};

export function useVoiceDictation(
	onTranscript: (text: string) => void,
	messages: VoiceDictationMessages,
): UseVoiceDictation {
	const recorder = useAudioRecorder(VOICE_RECORDING_OPTIONS);
	const [status, setStatusState] = useState<VoiceDictationStatus>("idle");
	const [elapsedSeconds, setElapsedSeconds] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [isStopping, setIsStoppingState] = useState(false);

	const activeSessionRef = useRef(0);
	const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const messagesRef = useRef(messages);
	const mountedRef = useRef(true);
	const onTranscriptRef = useRef(onTranscript);
	const startedAtRef = useRef(0);
	const startingRef = useRef(false);
	const statusRef = useRef<VoiceDictationStatus>("idle");
	const stoppingRef = useRef(false);

	messagesRef.current = messages;
	onTranscriptRef.current = onTranscript;

	const setSafeStatus = useCallback((nextStatus: VoiceDictationStatus) => {
		statusRef.current = nextStatus;
		if (mountedRef.current) {
			setStatusState(nextStatus);
		}
	}, []);

	const setSafeStopping = useCallback((nextIsStopping: boolean) => {
		stoppingRef.current = nextIsStopping;
		if (mountedRef.current) {
			setIsStoppingState(nextIsStopping);
		}
	}, []);

	const clearError = useCallback(() => {
		if (mountedRef.current) {
			setError(null);
		}
	}, []);

	const clearTimers = useCallback(() => {
		if (elapsedTimerRef.current) {
			clearInterval(elapsedTimerRef.current);
			elapsedTimerRef.current = null;
		}
	}, []);

	const restoreAudioMode = useCallback(async () => {
		try {
			await setAudioModeAsync({
				allowsRecording: false,
				playsInSilentMode: true,
			});
		} catch {
			// Best-effort cleanup. The user-facing operation has already ended.
		}
	}, []);

	const tickHaptic = useCallback(() => {
		if (Platform.OS === "ios") {
			void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
				() => undefined,
			);
		}
	}, []);

	const stopRecorder = useCallback(
		async ({ haptic = true, session, upload }: StopRecorderOptions) => {
			if (haptic) {
				tickHaptic();
			}

			try {
				let uri: string | null = null;
				try {
					if (isRecorderRecording(recorder)) {
						await recorder.stop();
					}
					uri = getRecorderUri(recorder);
				} catch {
					await restoreAudioMode();
					if (mountedRef.current && session === activeSessionRef.current) {
						setError(
							upload
								? messagesRef.current.transcribeError
								: messagesRef.current.recordingError,
						);
						setElapsedSeconds(0);
						setSafeStatus("idle");
					}
					return;
				}

				await restoreAudioMode();

				if (!mountedRef.current || session !== activeSessionRef.current) {
					return;
				}

				setElapsedSeconds(0);

				if (!upload) {
					setSafeStatus("idle");
					return;
				}

				if (!uri) {
					setError(messagesRef.current.transcribeError);
					setSafeStatus("idle");
					return;
				}

				try {
					const result = await createTranscription(uri);
					if (!mountedRef.current || session !== activeSessionRef.current) {
						return;
					}

					const text = result.text.trim();
					if (text) {
						onTranscriptRef.current(text);
					}
					setSafeStatus("idle");
				} catch (transcriptionError) {
					if (mountedRef.current && session === activeSessionRef.current) {
						setError(
							getTranscriptionErrorMessage(
								transcriptionError,
								messagesRef.current,
							),
						);
						setSafeStatus("idle");
					}
				}
			} finally {
				if (session === activeSessionRef.current) {
					setSafeStopping(false);
				}
			}
		},
		[
			recorder,
			restoreAudioMode,
			setSafeStatus,
			setSafeStopping,
			tickHaptic,
		],
	);

	const finishRecording = useCallback(
		async ({ haptic = true, upload }: StopOptions) => {
			if (statusRef.current !== "recording" || stoppingRef.current) {
				return;
			}

			const session = upload
				? activeSessionRef.current
				: activeSessionRef.current + 1;
			if (!upload) {
				activeSessionRef.current = session;
			}

			setSafeStopping(true);
			clearError();
			clearTimers();
			setSafeStatus(upload ? "transcribing" : "idle");

			await stopRecorder({ haptic, session, upload });
		},
		[
			clearError,
			clearTimers,
			setSafeStatus,
			setSafeStopping,
			stopRecorder,
		],
	);

	const startElapsedClock = useCallback(
		(onMaxDurationReached: () => void) => {
			startedAtRef.current = Date.now();
			setElapsedSeconds(0);
			elapsedTimerRef.current = setInterval(() => {
				if (!mountedRef.current || statusRef.current !== "recording") {
					return;
				}

				const recorderDurationMillis = getRecorderDurationMillis(recorder);
				const elapsedMillis =
					recorderDurationMillis ?? Date.now() - startedAtRef.current;
				setElapsedSeconds(
					Math.floor(Math.min(elapsedMillis, MAX_RECORDING_MS) / 1000),
				);

				if (elapsedMillis >= MAX_RECORDING_MS && !stoppingRef.current) {
					onMaxDurationReached();
				}
			}, ELAPSED_TICK_MS);
		},
		[recorder],
	);

	const stop = useCallback(async () => {
		if (statusRef.current !== "recording" || stoppingRef.current) {
			return;
		}

		await finishRecording({ upload: true });
	}, [finishRecording]);

	const cancel = useCallback(async () => {
		if (statusRef.current !== "recording" || stoppingRef.current) {
			return;
		}

		await finishRecording({ upload: false });
	}, [finishRecording]);

	const start = useCallback(async () => {
		if (
			statusRef.current !== "idle" ||
			startingRef.current ||
			stoppingRef.current
		) {
			return;
		}

		startingRef.current = true;
		activeSessionRef.current += 1;
		clearError();
		clearTimers();
		setElapsedSeconds(0);

		const session = activeSessionRef.current;

		try {
			const permission = await requestRecordingPermissionsAsync();
			if (!permission.granted) {
				if (mountedRef.current && session === activeSessionRef.current) {
					setError(messagesRef.current.permissionDenied);
				}
				return;
			}

			await setAudioModeAsync({
				allowsRecording: true,
				playsInSilentMode: true,
			});
			await recorder.prepareToRecordAsync();

			if (!mountedRef.current || session !== activeSessionRef.current) {
				await restoreAudioMode();
				return;
			}

			recorder.record();
			setSafeStatus("recording");
			startElapsedClock(() => {
				void finishRecording({ upload: true });
			});
			tickHaptic();
		} catch {
			await restoreAudioMode();
			if (mountedRef.current && session === activeSessionRef.current) {
				setError(messagesRef.current.recordingError);
				setSafeStatus("idle");
			}
		} finally {
			startingRef.current = false;
		}
	}, [
		clearError,
		clearTimers,
		recorder,
		restoreAudioMode,
		setSafeStatus,
		startElapsedClock,
		finishRecording,
		tickHaptic,
	]);

	useEffect(() => {
		mountedRef.current = true;

		return () => {
			mountedRef.current = false;
			activeSessionRef.current += 1;
			clearTimers();
			if (isRecorderRecording(recorder)) {
				void recorder
					.stop()
					.catch(() => undefined)
					.finally(() => {
						void restoreAudioMode();
					});
			} else {
				void restoreAudioMode();
			}
		};
	}, [clearTimers, recorder, restoreAudioMode]);

	return {
		cancel,
		clearError,
		elapsedSeconds,
		error,
		isBusy: status !== "idle" || isStopping,
		isRecording: status === "recording",
		isTranscribing: status === "transcribing",
		recorder,
		start,
		status,
		stop,
	};
}

function isRecorderRecording(recorder: AudioRecorder) {
	try {
		return recorder.isRecording || recorder.getStatus().isRecording;
	} catch {
		return recorder.isRecording;
	}
}

function getRecorderUri(recorder: AudioRecorder) {
	try {
		return recorder.uri ?? recorder.getStatus().url;
	} catch {
		return recorder.uri;
	}
}

function getRecorderDurationMillis(recorder: AudioRecorder) {
	try {
		const durationMillis = recorder.getStatus().durationMillis;

		if (Number.isFinite(durationMillis) && durationMillis >= 0) {
			return durationMillis;
		}
	} catch {
		return null;
	}

	return null;
}

function getTranscriptionErrorMessage(
	error: unknown,
	messages: VoiceDictationMessages,
) {
	if (isApiClientError(error)) {
		if (
			error.statusCode === 413 ||
			error.code === "AUDIO_FILE_TOO_LARGE"
		) {
			return messages.recordingTooLargeError;
		}

		if (
			error.statusCode === 400 &&
			[
				"UNSUPPORTED_AUDIO_TYPE",
				"AUDIO_FILE_REQUIRED",
				"INVALID_MULTIPART_AUDIO",
			].includes(error.code)
		) {
			return messages.recordingUnreadableError;
		}
	}

	return messages.transcribeError;
}

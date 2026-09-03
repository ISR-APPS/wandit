import { useCallback, useEffect, useRef, useState } from "react";

const SOUND_PREFERENCE_KEY = "wandit-onboarding-sound";
const MINIMUM_GAIN = 0.0001;

type AudioContextConstructor = new (
	options?: AudioContextOptions,
) => AudioContext;

let sharedAudioContext: AudioContext | null = null;
let didTryCreatingAudioContext = false;

function getAudioContext(): AudioContext | null {
	if (sharedAudioContext) {
		return sharedAudioContext;
	}
	if (didTryCreatingAudioContext || typeof window === "undefined") {
		return null;
	}

	didTryCreatingAudioContext = true;
	const audioWindow = window as unknown as {
		AudioContext?: AudioContextConstructor;
		webkitAudioContext?: AudioContextConstructor;
	};
	const Context = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
	if (!Context) {
		return null;
	}

	try {
		sharedAudioContext = new Context();
		return sharedAudioContext;
	} catch {
		return null;
	}
}

function disconnect(node: AudioNode): void {
	try {
		node.disconnect();
	} catch {
		// Browsers differ on whether disconnecting an already-disconnected node throws.
	}
}

function playWithAudioContext(
	createSound: (context: AudioContext) => void,
): void {
	try {
		const context = getAudioContext();
		if (!context || context.state === "closed") {
			return;
		}

		const play = () => {
			try {
				if (context.state !== "closed") {
					createSound(context);
				}
			} catch {
				// Sound is optional and must never interrupt onboarding.
			}
		};

		if (context.state === "running") {
			play();
			return;
		}

		void context
			.resume()
			.then(play)
			.catch(() => undefined);
	} catch {
		// AudioContext may be blocked or unavailable in embedded browsers.
	}
}

function unlockAudioContext(): void {
	playWithAudioContext(() => undefined);
}

function createSelectTick(context: AudioContext): void {
	const now = context.currentTime;
	const oscillator = context.createOscillator();
	const gain = context.createGain();

	oscillator.type = "triangle";
	oscillator.frequency.setValueAtTime(660, now);
	oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.06);
	gain.gain.setValueAtTime(0.06, now);
	gain.gain.exponentialRampToValueAtTime(MINIMUM_GAIN, now + 0.06);

	oscillator.connect(gain);
	gain.connect(context.destination);
	oscillator.addEventListener(
		"ended",
		() => {
			disconnect(oscillator);
			disconnect(gain);
		},
		{ once: true },
	);
	oscillator.start(now);
	oscillator.stop(now + 0.065);
}

function scheduleChimeVoice(
	context: AudioContext,
	frequency: number,
	startAt: number,
	type: OscillatorType,
	peakGain: number,
): void {
	const oscillator = context.createOscillator();
	const gain = context.createGain();
	const endAt = startAt + 0.4;

	oscillator.type = type;
	oscillator.frequency.setValueAtTime(frequency, startAt);
	gain.gain.setValueAtTime(peakGain, startAt);
	gain.gain.exponentialRampToValueAtTime(MINIMUM_GAIN, endAt);

	oscillator.connect(gain);
	gain.connect(context.destination);
	oscillator.addEventListener(
		"ended",
		() => {
			disconnect(oscillator);
			disconnect(gain);
		},
		{ once: true },
	);
	oscillator.start(startAt);
	oscillator.stop(endAt + 0.02);
}

function createCompletionChime(context: AudioContext): void {
	const now = context.currentTime;
	const notes = [
		{ frequency: 523.25, startAt: now },
		{ frequency: 783.99, startAt: now + 0.09 },
	] as const;

	for (const note of notes) {
		// Each note totals 0.04 gain; even full overlap stays below 0.1.
		scheduleChimeVoice(context, note.frequency, note.startAt, "sine", 0.026);
		scheduleChimeVoice(
			context,
			note.frequency,
			note.startAt,
			"triangle",
			0.014,
		);
	}
}

function readMutedPreference(): boolean {
	if (typeof window === "undefined") {
		return false;
	}

	try {
		const value = window.localStorage.getItem(SOUND_PREFERENCE_KEY);
		return value === "off" || value === "false" || value === "muted";
	} catch {
		return false;
	}
}

function persistMutedPreference(muted: boolean): void {
	if (typeof window === "undefined") {
		return;
	}

	try {
		window.localStorage.setItem(SOUND_PREFERENCE_KEY, muted ? "off" : "on");
	} catch {
		// Storage may be unavailable in private or embedded browser contexts.
	}
}

export function useOnboardingSound() {
	const [muted, setMuted] = useState(readMutedPreference);
	const mutedRef = useRef(muted);
	mutedRef.current = muted;

	useEffect(() => {
		persistMutedPreference(muted);
	}, [muted]);

	const toggle = useCallback(() => {
		const nextMuted = !mutedRef.current;
		mutedRef.current = nextMuted;
		setMuted(nextMuted);
		if (!nextMuted) {
			unlockAudioContext();
		}
	}, []);

	const playSelect = useCallback(() => {
		if (!mutedRef.current) {
			playWithAudioContext(createSelectTick);
		}
	}, []);

	const playCompletion = useCallback(() => {
		if (!mutedRef.current) {
			playWithAudioContext(createCompletionChime);
		}
	}, []);

	return { muted, toggle, playSelect, playCompletion };
}

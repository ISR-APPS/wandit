/**
 * Plays a short chime when a builder turn ends while the user is away from the page.
 * use-builder-chat.ts calls it at the end frame of a turn stream, and at each click and key press.
 * use-create-app-project.ts calls it at the create gesture. It calls only the Web Audio API.
 */

// The two notes of the chime in Hz: C5, then G5. The onboarding chime uses the same notes.
const CHIME_NOTES_HZ = [523.25, 783.99] as const;
// Time between the start of the first note and the start of the second note.
const NOTE_GAP_SEC = 0.15;
// Time from the start of a note to silence.
const NOTE_LENGTH_SEC = 0.6;
// Fade-in time. A note that starts at full gain makes a click.
const NOTE_ATTACK_SEC = 0.01;
// 5 times the onboarding chime, because the user is in another tab or app. Two notes together stay below 1.
const NOTE_PEAK_GAIN = 0.2;
// An exponential ramp cannot start or end at 0.
const SILENT_GAIN = 0.0001;

// One context for this module. Safari unlocks each context separately, so the chime must use the unlocked one.
let audioContext: AudioContext | null = null;
// True after `new AudioContext()` threw. The next try fails too, so one try keeps the console clean.
let hasAudioContextFailed = false;
// True after a gesture started the context one time. After that, `resume()` needs no gesture.
let isAudioContextUnlocked = false;
// True from the schedule of a chime until its last note ends. A suspend in that time cuts the chime,
// and the cut notes then play at the next resume. So no suspend and no second chime start in that time.
let isChimePlaying = false;

function getAudioContext(): AudioContext | null {
	if (audioContext !== null) return audioContext;
	// jsdom, a server render, and an old browser have no Web Audio.
	if (hasAudioContextFailed || typeof AudioContext === "undefined") return null;
	try {
		audioContext = new AudioContext();
	} catch (error) {
		hasAudioContextFailed = true;
		console.error("Turn end sound: the audio context did not start", error);
	}
	return audioContext;
}

// The user is away when the tab is hidden, or when another window or app has the focus.
// Focus inside the preview iframe counts as focus on the page.
function isUserAway(): boolean {
	return document.visibilityState === "hidden" || !document.hasFocus();
}

// A running context keeps the audio device open. In Firefox that uses power and stops the idle sleep.
// So the context runs only during the unlock and during a chime.
function suspendAudioContext(context: AudioContext): void {
	if (isChimePlaying) return;
	void context.suspend().catch((error: unknown) => {
		console.error("Turn end sound: the audio context did not suspend", error);
	});
}

// The times use the audio clock, so the timer throttle of a hidden tab does not change them.
function scheduleChime(context: AudioContext): void {
	CHIME_NOTES_HZ.forEach((frequencyHz, noteIndex) => {
		const startAt = context.currentTime + noteIndex * NOTE_GAP_SEC;
		const endAt = startAt + NOTE_LENGTH_SEC;
		const oscillator = context.createOscillator();
		const gain = context.createGain();
		oscillator.frequency.value = frequencyHz;
		gain.gain.setValueAtTime(SILENT_GAIN, startAt);
		gain.gain.linearRampToValueAtTime(
			NOTE_PEAK_GAIN,
			startAt + NOTE_ATTACK_SEC,
		);
		gain.gain.exponentialRampToValueAtTime(SILENT_GAIN, endAt);
		oscillator.connect(gain).connect(context.destination);
		oscillator.start(startAt);
		oscillator.stop(endAt);
		// The end of the last note is the end of the chime.
		if (noteIndex === CHIME_NOTES_HZ.length - 1) {
			isChimePlaying = true;
			oscillator.onended = () => {
				isChimePlaying = false;
				suspendAudioContext(context);
			};
		}
	});
}

/**
 * Starts the audio context one time inside a user gesture, then suspends it.
 * A browser blocks audio that no gesture started. Safari needs the gesture on this same context.
 * Never throws.
 */
export function unlockTurnEndSound(): void {
	if (isAudioContextUnlocked) return;
	const context = getAudioContext();
	if (context === null) return;
	void context
		.resume()
		.then(() => {
			isAudioContextUnlocked = true;
			suspendAudioContext(context);
		})
		.catch((error: unknown) => {
			console.error("Turn end sound: the audio context did not resume", error);
		});
}

/**
 * Plays the chime only when the user is away from the page. The function drops a blocked sound.
 * Never throws: the caller is the stream handler, and a throw there fails the turn stream.
 */
export function playTurnEndSoundWhenAway(): void {
	// LIMIT: a browser plays no sound before the first click or key press after a page load. A frozen or discarded tab is also silent. Upgrade: a browser Notification.
	if (!isUserAway()) return;
	const context = getAudioContext();
	if (context === null) return;
	// After one unlock, the context resumes here with no gesture. Before an unlock, Safari resumes it
	// only at the next gesture. The user is back on the page then, so the second check drops the late chime.
	void context
		.resume()
		.then(() => {
			// One chime is enough. Blocked calls also resolve together here when the context starts.
			if (isChimePlaying) return;
			if (isUserAway()) scheduleChime(context);
			else suspendAudioContext(context);
		})
		.catch((error: unknown) => {
			console.error("Turn end sound: the chime did not play", error);
		});
}

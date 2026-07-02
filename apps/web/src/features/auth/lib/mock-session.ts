export type SessionUser = {
	id: string;
	name: string;
	email: string;
	image?: string;
};

export const MOCK_USER: SessionUser = {
	id: "u_mock",
	name: "Zack B.",
	email: "zack@wandit.dev",
};

type MockSession = { user: SessionUser } | null;

const STORAGE_KEY = "wandit-mock-session";

function read(): MockSession {
	if (typeof window === "undefined") return null;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		return raw ? (JSON.parse(raw) as { user: SessionUser }) : null;
	} catch {
		return null;
	}
}

let snapshot: MockSession = read();
const listeners = new Set<() => void>();

function emit() {
	for (const listener of listeners) listener();
}

export const mockSessionStore = {
	subscribe(listener: () => void): () => void {
		listeners.add(listener);
		return () => listeners.delete(listener);
	},
	getSnapshot(): MockSession {
		return snapshot;
	},
	getServerSnapshot(): MockSession {
		return null;
	},
	signIn(user: SessionUser = MOCK_USER): void {
		snapshot = { user };
		try {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
		} catch {
			// storage unavailable — session stays in-memory
		}
		emit();
	},
	signOut(): void {
		snapshot = null;
		try {
			window.localStorage.removeItem(STORAGE_KEY);
		} catch {
			// storage unavailable
		}
		emit();
	},
};

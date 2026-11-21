// Supabase client of the app. The `api/` files of each feature import it.
// The root layout imports this file first, so a missing env value stops the
// app at start. D18: there is no null client and no "no backend yet" path.
// It also holds the auth client that confirms a sign-up, for `auth.mutations.ts`.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";

// babel-preset-expo inlines only a static `process.env.EXPO_PUBLIC_*` read.
// A dynamic `process.env[name]` stays undefined in the bundle.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
	const missing = [
		supabaseUrl ? null : "EXPO_PUBLIC_SUPABASE_URL",
		supabaseAnonKey ? null : "EXPO_PUBLIC_SUPABASE_ANON_KEY",
	].filter((name) => name !== null);
	throw new Error(
		`Missing ${missing.join(" and ")}. The project backend is provisioned at creation. ` +
			"Ask the host to re-provision instead of removing the check.",
	);
}

/** The data client of the app. Queries run as the signed-in user under RLS. */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
	auth: {
		// Native has no localStorage; AsyncStorage keeps the session across starts.
		storage: AsyncStorage,
		autoRefreshToken: true,
		persistSession: true,
		// No browser redirect brings a session into the app: Expo Go has no OAuth.
		detectSessionInUrl: false,
	},
});

// LIMIT: one sign-up confirmation at a time, because each code view uses this one client.
// When two confirmations overlap, each one can use the session of the other one.
// Upgrade: one client for each code view.
/**
 * The auth client of a sign-up that waits for its password save. Its session stays in
 * memory, so `useSession()` does not see it. `useFinishSignUp` gives the session to `supabase`,
 * but only when `supabase` holds no session.
 * Never call `signOut` on it: Supabase then closes the session that the app uses.
 */
export const signUpAuth = createClient(supabaseUrl, supabaseAnonKey, {
	auth: {
		// On the web, supabase-js warns when two clients have the same storage key.
		storageKey: "sign-up-confirmation",
		persistSession: false,
		autoRefreshToken: false,
		detectSessionInUrl: false,
	},
}).auth;

// Supabase guidance for React Native: refresh the token only in the foreground.
// The browser tab on the web handles this itself.
if (Platform.OS !== "web") {
	AppState.addEventListener("change", (state) => {
		if (state === "active") {
			void supabase.auth.startAutoRefresh();
		} else {
			void supabase.auth.stopAutoRefresh();
		}
	});
}

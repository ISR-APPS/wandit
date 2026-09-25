// French dictionary. Informal tone (tu), as in the web template.
// Must keep the same keys and the same tree shape as en.ts.
import type { Dictionary } from "./translate";

export const fr: Dictionary = {
	common: {
		appName: "Mon app",
		back: "Retour",
		retry: "Réessayer",
	},
	home: {
		title: "Bienvenue",
		subtitle: "Cette app tourne sur iPhone, Android et le web.",
		languageTitle: "Langue",
		openProfiles: "Ouvrir la liste des profils",
	},
	profiles: {
		title: "Profils",
		empty: "Aucun profil à afficher. Ton profil apparaît après la connexion.",
		loadError: "La liste n'a pas chargé.",
		unnamed: "Pas encore de nom",
	},
};

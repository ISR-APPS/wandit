// French dictionary. Algerian-market informal tone, per docs/localization.md.
// Must keep the same keys and the same tree shape as en.ts.
import type { Dictionary } from "./translate";

export const fr: Dictionary = {
	common: {
		appName: "Wandit App",
		save: "Enregistrer",
		signOut: "Se déconnecter",
	},
	nav: {
		features: "Avantages",
		signIn: "Se connecter",
	},
	landing: {
		heroTitle: "Ton business en ligne en quelques minutes",
		heroSubtitle:
			"Une vitrine rapide avec un formulaire intégré. Tes clients te joignent directement.",
		heroCta: "Commencer",
		featuresTitle: "Tout ce qu'il te faut",
		feature1Title: "Rapide par défaut",
		feature1Body: "Des pages statiques servies au plus proche de tes clients.",
		feature2Title: "Des clients qui te joignent",
		feature2Body:
			"Chaque demande du formulaire arrive directement dans ta boîte de leads.",
		feature3Title: "Trois langues",
		feature3Body:
			"Anglais, français et arabe avec un support complet de droite à gauche.",
	},
	lead: {
		title: "Demande un rappel",
		subtitle: "Laisse tes coordonnées et on t'appelle aujourd'hui.",
		name: "Nom complet",
		namePlaceholder: "Ton nom",
		phone: "Téléphone",
		phonePlaceholder: "05 00 00 00 00",
		wilaya: "Wilaya",
		wilayaPlaceholder: "Alger",
		commune: "Commune",
		communePlaceholder: "Ta commune",
		product: "Produit",
		productPlaceholder: "Qu'est-ce que tu veux commander ?",
		quantity: "Quantité",
		submit: "Envoyer la demande",
		successTitle: "Demande reçue",
		successBody: "Merci. On te rappelle dès que possible.",
		errorRequired: "Remplis tous les champs avant d'envoyer.",
	},
	login: {
		title: "Connexion",
		subtitle:
			"On t'envoie un lien magique par email. Pas besoin de mot de passe.",
		email: "Email",
		emailPlaceholder: "toi@example.com",
		submit: "Recevoir le lien",
		sending: "Envoi…",
		sentTitle: "Vérifie ton email",
		sentBody: "Ouvre le lien dans l'email pour terminer la connexion.",
		error: "La connexion a échoué. Réessaie.",
	},
	app: {
		profileTitle: "Profil",
		fullName: "Nom complet",
		fullNamePlaceholder: "Ton nom affiché",
		savedBody: "Ton profil a été mis à jour.",
		loadError: "Ton profil n'a pas chargé. Rafraîchis la page.",
		saveError: "Ton profil n'a pas été enregistré. Réessaie.",
	},
};

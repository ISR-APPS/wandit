/**
 * The landing factory batch — 57 website worlds authored in one deliberate
 * sweep to widen the taste library far beyond the original hand-built set.
 * Same DesignWorld contract as the parent registry; every world here is
 * `kind: "website"` and carries the full metadata set (family, industries,
 * preview) so menus and taste questions can render it without special cases.
 *
 * Four worlds were renamed at merge time because the batch reused ids the
 * registry already owned with different designs: fournil→boulange,
 * nocturne→generique, riviera→promenade, vitrine→catalogue.
 */
import type { DesignWorld } from "../types";
import { affiche } from "./affiche";
import { allure } from "./allure";
import { an2000 } from "./an2000";
import { aquarelle } from "./aquarelle";
import { atlas } from "./atlas";
import { bauplan } from "./bauplan";
import { bloc } from "./bloc";
import { boulange } from "./boulange";
import { braise } from "./braise";
import { cabinet } from "./cabinet";
import { campus } from "./campus";
import { capitale } from "./capitale";
import { carnet } from "./carnet";
import { catalogue } from "./catalogue";
import { chantier } from "./chantier";
import { clair } from "./clair";
import { diwan } from "./diwan";
import { domaine } from "./domaine";
import { eclat } from "./eclat";
import { ecrin } from "./ecrin";
import { elan } from "./elan";
import { fanzine } from "./fanzine";
import { folies } from "./folies";
import { forme } from "./forme";
import { gabarit } from "./gabarit";
import { gazette } from "./gazette";
import { generique } from "./generique";
import { gommette } from "./gommette";
import { grille } from "./grille";
import { guimauve } from "./guimauve";
import { herbier } from "./herbier";
import { horizon } from "./horizon";
import { huitbit } from "./huitbit";
import { hypertexte } from "./hypertexte";
import { iris } from "./iris";
import { maillot } from "./maillot";
import { maison } from "./maison";
import { manifeste } from "./manifeste";
import { observatoire } from "./observatoire";
import { onde } from "./onde";
import { orfevre } from "./orfevre";
import { phosphore } from "./phosphore";
import { photographe } from "./photographe";
import { poudre } from "./poudre";
import { promenade } from "./promenade";
import { pupitre } from "./pupitre";
import { sauce } from "./sauce";
import { serment } from "./serment";
import { silhouette } from "./silhouette";
import { studio } from "./studio";
import { tutti } from "./tutti";
import { velin } from "./velin";
import { verre } from "./verre";
import { voeu } from "./voeu";
import { voltage } from "./voltage";
import { wabi } from "./wabi";
import { zellij } from "./zellij";

export const landingWorlds: DesignWorld[] = [
	affiche,
	allure,
	an2000,
	aquarelle,
	atlas,
	bauplan,
	bloc,
	boulange,
	braise,
	cabinet,
	campus,
	capitale,
	carnet,
	catalogue,
	chantier,
	clair,
	diwan,
	domaine,
	eclat,
	ecrin,
	elan,
	fanzine,
	folies,
	forme,
	gabarit,
	gazette,
	generique,
	gommette,
	grille,
	guimauve,
	herbier,
	horizon,
	huitbit,
	hypertexte,
	iris,
	maillot,
	maison,
	manifeste,
	observatoire,
	onde,
	orfevre,
	phosphore,
	photographe,
	poudre,
	promenade,
	pupitre,
	sauce,
	serment,
	silhouette,
	studio,
	tutti,
	velin,
	verre,
	voeu,
	voltage,
	wabi,
	zellij,
];

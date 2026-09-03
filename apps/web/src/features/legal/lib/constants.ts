// Non-copy legal config. The documents live in dictionaries/*/legal.json and
// carry {placeholder} tokens; the values behind those tokens are here so that a
// change of entity, mailbox or publication date touches one file only.

import { GOOGLE_SHEETS_SCOPE } from "@wandit/contracts";

/**
 * Registered entity that fills {company}: the company behind the product, not
 * the product. The Limited Use sentence is the one place that must name the app
 * instead, because Google matches it against the consent screen, so that
 * sentence spells "Wandit" literally and carries no {company} token.
 *
 */
export const LEGAL_COMPANY = "Scalemind Marketing Consultancy L.L.C";

/**
 * The same entity spelled as the trade licence prints it and as Meta Business
 * info holds it. Meta business verification looks for the legal business name
 * on the website and publishes no rule on case, so the places a verification
 * crawler reads — the landing footer and the static no-JS fallback in
 * apps/web/index.html — print this exact form. Prose in the legal documents
 * keeps LEGAL_COMPANY. Derived, so the two can never name different entities.
 */
export const LEGAL_COMPANY_REGISTERED_NAME = LEGAL_COMPANY.toUpperCase();

/** Registered office that fills {address}, as printed on the trade licence. */
export const LEGAL_COMPANY_ADDRESS =
	"Office 94-104, Khalid Abdulrahim Shaaban Building, Al Garhoud, Deira, Dubai, United Arab Emirates";

/**
 * Trade licence that fills {licenceNo}, issued by the Department of Economy and
 * Tourism, Dubai. Both documents state it so that a reader can check the entity
 * against the public register.
 */
export const LEGAL_TRADE_LICENCE_NO = "1570192";

/** Commercial register entry that fills {registerNo}, same purpose. */
export const LEGAL_COMMERCIAL_REGISTER_NO = "2743008";

/** Mailbox that fills {email}. It must accept mail: Google tests the address. */
export const LEGAL_CONTACT_EMAIL = "contact@scalemindapps.com";

/** Origin that fills {siteUrl}. Shown without the scheme, linked with it. */
export const LEGAL_SITE_URL = "https://wandit.dev";

/**
 * The single Google scope the Sheets sync asks for, which fills {driveScope}.
 * Re-exported from the contract the client and the server already share, so a
 * scope change cannot leave the published policy behind.
 */
export const LEGAL_DRIVE_SCOPE = GOOGLE_SHEETS_SCOPE;

/** Target of {googlePolicyUrl}, labelled with legal.common.googlePolicyLabel. */
export const GOOGLE_USER_DATA_POLICY_URL =
	"https://developers.google.com/terms/api-services-user-data-policy";

/** Target of {googlePermissionsUrl}, labelled with legal.common.googlePermissionsLabel. */
export const GOOGLE_PERMISSIONS_URL =
	"https://myaccount.google.com/permissions";

/**
 * Publication date of both documents. ISO so that formatDate() can render it in
 * the reader's locale; bump it whenever the copy in legal.json changes, because
 * both documents state that this date identifies the version in force.
 */
export const LEGAL_LAST_UPDATED_ISO = "2026-08-17";

/**
 * App avatar: a round picture of a person, or the initials when there is no picture.
 * Screens use AppAvatar, not the HeroUI Avatar, so every avatar changes in this file.
 */
import { Avatar } from "heroui-native";

/** HeroUI Native Avatar with its parts: Image, Fallback (the initials), and Background. */
export const AppAvatar = Avatar;

/** Up to two initials from a name or an email, for example "Ada Lovelace" gives "AL". */
export function initialsOf(text: string): string {
	const words = text.split(/[\s@._-]+/).filter((word) => word.length > 0);
	return (
		words
			.slice(0, 2)
			// Array.from splits by character, so an emoji or another surrogate pair stays whole.
			.map((word) => (Array.from(word)[0] ?? "").toUpperCase())
			.join("")
	);
}

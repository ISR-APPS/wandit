export function canonicalDomainHost(name: string) {
	return name.startsWith("www.") ? name : `www.${name}`;
}

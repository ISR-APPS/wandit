export function canonicalDomainHost(name: string) {
	return name.startsWith("www.") ? name : `www.${name}`;
}

export function apexRedirectTarget(name: string) {
	return `https://${canonicalDomainHost(name)}`;
}

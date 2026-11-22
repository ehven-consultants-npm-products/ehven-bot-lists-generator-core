export interface CreditsInput {owner: string; site: string; tools?: readonly string[]}
export interface DisclosureInput {contact: string; expires: string; canonical: string; languages?: readonly string[]}
export declare function renderHumans(input: CreditsInput): string;
export declare function renderSecurity(input: DisclosureInput, options?: {now?: number}): string;

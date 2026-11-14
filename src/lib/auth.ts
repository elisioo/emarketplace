export type AccountRole = "buyer" | "seller";
export function isAccountRole(value: unknown): value is AccountRole { return value === "buyer" || value === "seller"; }
export function requiresSeller(path: string): boolean { return path === "/create" || path.startsWith("/create/") || path === "/seller/payments"; }
export function isPublicAuthPath(path: string): boolean { return ["/login", "/signup", "/auth/confirm", "/choose-role"].includes(path); }

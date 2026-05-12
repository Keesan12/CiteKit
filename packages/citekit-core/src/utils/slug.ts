export function normalizeDomain(domain: string): string {
  return domain.replace(/^https?:\/\//i, "").replace(/\/+$/, "").toLowerCase();
}

export function generateBrandSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}


import path from "node:path";

export function nowIso(): string {
  return new Date().toISOString();
}

export function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeList(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function normalizeTag(tag: string): string {
  return tag.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function slugify(input: string): string {
  return normalizeTag(input) || "untitled";
}

export function relativeFromRoot(root: string, target: string): string {
  return path.relative(root, target).replace(/\\/g, "/");
}

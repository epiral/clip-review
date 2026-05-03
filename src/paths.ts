import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const srcDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(srcDir, "..");

export function rootPath(...parts: string[]): string {
  return join(projectRoot, ...parts);
}

export function dataRoot(...parts: string[]): string {
  const base = process.env.PINIX_DATA_DIR ?? join(process.env.HOME ?? "/tmp", ".pinix", "data", "review");
  return join(base, ...parts);
}

export function dbPath(): string {
  return dataRoot("review.db");
}

export function schemaPath(): string {
  const seedSchema = rootPath("seed", "schema.sql");
  if (existsSync(seedSchema)) return seedSchema;
  return dataRoot("schema.sql");
}

export function ensureDataDir(): void {
  mkdirSync(dataRoot(), { recursive: true });
}

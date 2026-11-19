import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function parseEnvValue(fileName: string, key: string): string | null {
  const filePath = path.join(process.cwd(), fileName);
  if (!existsSync(filePath)) return null;
  const prefix = `${key}=`;
  for (const raw of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.startsWith(prefix)) continue;
    let value = line.slice(prefix.length).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value;
  }
  return null;
}

function parsePostgresUrl(connectionString: string): URL | null {
  try {
    const url = new URL(connectionString);
    if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function dbIdentity(connectionString: string): string | null {
  const url = parsePostgresUrl(connectionString);
  if (!url) return null;
  const hostname = url.hostname.replace(/-pooler(?=\.|$)/, "").toLowerCase();
  const port = url.port || "5432";
  const database = decodeURIComponent(url.pathname.replace(/^\//, "")).split(
    "/",
  )[0];
  if (!hostname || !database) return null;
  return `${hostname}:${port}/${database}`;
}

export function resolveDatabaseURL(): string {
  const testUrl = parseEnvValue(".env.test.local", "DATABASE_URL");
  if (!testUrl) {
    throw new Error(
      "Playwright DATABASE_URL is missing. Create .env.test.local with a dedicated Neon test branch URL.",
    );
  }

  const parsed = parsePostgresUrl(testUrl);
  const testId = dbIdentity(testUrl);
  if (!parsed || !testId) {
    throw new Error("Playwright DATABASE_URL is not a valid PostgreSQL URL.");
  }
  if (!parsed.hostname.toLowerCase().endsWith(".neon.tech")) {
    throw new Error(
      "Playwright DATABASE_URL hostname must be a Neon host (.neon.tech).",
    );
  }

  const devUrl = parseEnvValue(".env", "DATABASE_URL");
  if (!devUrl) {
    throw new Error(
      "Development DATABASE_URL is missing from .env. Isolation cannot be verified.",
    );
  }
  const devId = dbIdentity(devUrl);
  if (!devId) {
    throw new Error(
      "Development DATABASE_URL in .env is not a valid PostgreSQL URL. Isolation cannot be verified.",
    );
  }
  if (testId === devId) {
    throw new Error(
      "Playwright DATABASE_URL matches the development database. Refusing to run.",
    );
  }

  return testUrl;
}

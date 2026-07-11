import { chmod, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { APIRequestContext, BrowserContext } from "playwright-core";
import { getSessionFile } from "./profile.js";
import { isBoothHost } from "./browser/read-only-guard.js";

type StorageStateContext = Pick<APIRequestContext, "storageState"> | Pick<BrowserContext, "storageState">;

export async function persistBoothSession(context: StorageStateContext, sessionFile = getSessionFile()): Promise<void> {
  const state = await context.storageState();
  const filtered = {
    cookies: state.cookies.filter((cookie) => isBoothHost(cookie.domain.replace(/^\./u, ""))),
    origins: state.origins.filter((origin) => {
      try {
        return isBoothHost(new URL(origin.origin).hostname);
      } catch {
        return false;
      }
    }),
  };
  await mkdir(dirname(sessionFile), { recursive: true, mode: 0o700 });
  await writeFile(sessionFile, `${JSON.stringify(filtered, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await chmod(sessionFile, 0o600).catch(() => undefined);
}

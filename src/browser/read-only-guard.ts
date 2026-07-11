const allowedMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export function isBoothHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "booth.pm" || host.endsWith(".booth.pm");
}

export function isAllowedBoothRequest(method: string, url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return !isBoothHost(parsed.hostname) || allowedMethods.has(method.toUpperCase());
}

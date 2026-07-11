export const boothErrorCodes = [
  "AUTH_REQUIRED",
  "NOT_FOUND",
  "BOOTH_CHANGED",
  "RATE_LIMITED",
  "NETWORK_ERROR",
] as const;

export type BoothErrorCode = (typeof boothErrorCodes)[number];

export class BoothError extends Error {
  readonly code: BoothErrorCode;
  readonly sourceUrl: string | undefined;

  constructor(code: BoothErrorCode, message: string, sourceUrl?: string) {
    super(message);
    this.name = "BoothError";
    this.code = code;
    this.sourceUrl = sourceUrl;
  }
}

export function asBoothError(error: unknown, sourceUrl?: string): BoothError {
  if (error instanceof BoothError) return error;
  const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
  return new BoothError("NETWORK_ERROR", message, sourceUrl);
}

export interface BoothReader {
  read<T>(path: string, parser: (html: string, finalUrl: string) => T): Promise<{ data: T; url: string }>;
  readJson<T>(
    path: string,
    parser: (json: unknown, finalUrl: string) => T,
    options?: { origin?: string; csrfFrom?: string },
  ): Promise<{ data: T; url: string }>;
  close(): Promise<void>;
}

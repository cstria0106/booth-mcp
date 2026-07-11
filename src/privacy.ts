export interface RedactionResult {
  text: string;
  redactions: string[];
}

const patterns: Array<{ name: string; pattern: RegExp; replacement: string }> = [
  {
    name: "email",
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu,
    replacement: "[이메일 마스킹]",
  },
  {
    name: "phone",
    pattern: /(?<!\d)(?:\+?81[-\s]?)?(?:0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4})(?!\d)/gu,
    replacement: "[전화번호 마스킹]",
  },
  {
    name: "postal_code",
    pattern: /(?<!\d)〒?\s*\d{3}[-ー]\d{4}(?!\d)/gu,
    replacement: "[우편번호 마스킹]",
  },
];

export function redactSensitiveText(value: string): RedactionResult {
  let text = value;
  const redactions = new Set<string>();

  for (const entry of patterns) {
    if (entry.pattern.test(text)) {
      redactions.add(entry.name);
      entry.pattern.lastIndex = 0;
      text = text.replace(entry.pattern, entry.replacement);
    }
    entry.pattern.lastIndex = 0;
  }

  return { text, redactions: [...redactions] };
}

export function maskDirectIdentifier(value: string | undefined): string | undefined {
  return value?.trim() ? "[마스킹]" : undefined;
}

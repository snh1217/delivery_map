export function normalizePhoneNumber(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const cleaned = trimmed.replace(/[^\d+]/g, "");

  if (cleaned.startsWith("+")) {
    return /^\+[1-9]\d{7,14}$/.test(cleaned) ? cleaned : null;
  }

  const digits = cleaned.replace(/\D/g, "");
  if (!digits) {
    return null;
  }

  if (digits.startsWith("82")) {
    const value = `+${digits}`;
    return /^\+[1-9]\d{7,14}$/.test(value) ? value : null;
  }

  if (digits.startsWith("0")) {
    const value = `+82${digits.slice(1)}`;
    return /^\+[1-9]\d{7,14}$/.test(value) ? value : null;
  }

  const value = `+${digits}`;
  return /^\+[1-9]\d{7,14}$/.test(value) ? value : null;
}

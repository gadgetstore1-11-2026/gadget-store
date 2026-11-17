export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  if (/^01[3-9]\d{8}$/.test(digits)) {
    return digits;
  }

  if (/^8801[3-9]\d{8}$/.test(digits)) {
    return `0${digits.slice(3)}`;
  }

  return digits;
}

export function getCustomerAuthEmail(phone: string): string {
  const normalizedPhone = normalizePhone(phone);

  return `${normalizedPhone}@accounts.gadgetstore.com`;
}

export function isValidBangladeshPhone(phone: string): boolean {
  return /^01[3-9]\d{8}$/.test(normalizePhone(phone));
}

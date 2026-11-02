export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function getCustomerAuthEmail(phone: string): string {
  const normalizedPhone = normalizePhone(phone);

  return `${normalizedPhone}@accounts.gadgetstore.com`;
}

export function isValidBangladeshPhone(phone: string): boolean {
  return /^01[3-9]\d{8}$/.test(normalizePhone(phone));
}
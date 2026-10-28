/** A wa.me link: the number in international format, digits only, plus an optional prefilled message. */
export function whatsappUrl(phone: string, message = ''): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) throw new Error('WhatsApp number must contain digits');
  const text = message.trim();
  return text ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : `https://wa.me/${digits}`;
}

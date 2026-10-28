import { describe, expect, it } from 'vitest';
import { whatsappUrl } from './whatsapp';

describe('whatsappUrl', () => {
  it('keeps only the digits of a formatted international number', () => {
    expect(whatsappUrl('+54 9 11 0000-0000')).toBe('https://wa.me/5491100000000');
  });

  it('appends the prefilled message, URL-encoded', () => {
    expect(whatsappUrl('5491100000000', 'Hola, quiero hablar de mi próxima obra.')).toBe(
      'https://wa.me/5491100000000?text=Hola%2C%20quiero%20hablar%20de%20mi%20pr%C3%B3xima%20obra.',
    );
  });

  it('omits the text parameter when the message is blank', () => {
    expect(whatsappUrl('5491100000000', '   ')).toBe('https://wa.me/5491100000000');
  });

  it('rejects a number without digits', () => {
    expect(() => whatsappUrl('+-- ')).toThrow('WhatsApp number must contain digits');
  });
});

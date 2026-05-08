import { isStrictStructuredCommand } from './whatsapp-messaging.service';

describe('isStrictStructuredCommand', () => {
  it('acepta solo 1/2 y keycaps', () => {
    expect(isStrictStructuredCommand('1')).toBe('CONFIRM');
    expect(isStrictStructuredCommand('2')).toBe('CANCEL');
    expect(isStrictStructuredCommand('1️⃣')).toBe('CONFIRM');
    expect(isStrictStructuredCommand('2️⃣')).toBe('CANCEL');
    expect(isStrictStructuredCommand(' 1 ')).toBe('CONFIRM');
  });

  it('rechaza texto libre y comandos semánticos previos', () => {
    expect(isStrictStructuredCommand('hola')).toBeNull();
    expect(isStrictStructuredCommand('ok')).toBeNull();
    expect(isStrictStructuredCommand('confirmo')).toBeNull();
    expect(isStrictStructuredCommand('cancelo')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { accountFailure, accountSettings, avatarProblem, passwordProblem, passwordRequirements, needsReverification, verificationLevel, type AccountSettings } from './profile';

const settings: AccountSettings = {
  attributes: { username: { enabled: true, required: true } }, usernameSettings: { min_length: 4, max_length: 20 },
  passwordSettings: { min_length: 10, max_length: 64, require_numbers: true, require_uppercase: true, require_lowercase: true, require_special_char: true, allowed_special_characters: '!@', disable_hibp: false, show_zxcvbn: true },
};
describe('own-account policy and safe feedback', () => {
  it('reads the actual capability resource and fails closed when absent', () => {
    expect(accountSettings(null)).toBeNull();
    expect(accountSettings({ __internal_environment: { userSettings: settings } } as never)).toBe(settings);
    expect(accountSettings({ __internal_environment: { userSettings: {} } } as never)).toBeNull();
  });
  it.each(['short', 'abcdefghij1!', 'ABCDEFGHIJ1!', 'Abcdefghij!', 'Abcdefghij1', 'A'.repeat(65)])('validates the configured policy: %s', value => {
    expect(passwordProblem(value, settings)).not.toBeNull();
  });
  it('accepts configured syntax while leaving breached-password and strength checks to Clerk', () => {
    expect(passwordProblem('Abcdefghij1!', settings)).toBeNull();
    expect(passwordRequirements(settings).join(' ')).toContain('10 e 64');
    expect(passwordRequirements(settings).join(' ')).toContain('fugas de dados');
  });
  it.each([
    [{ type: 'image/svg+xml', size: 100 }, 'JPEG'],
    [{ type: 'image/jpeg', size: 5 * 1024 * 1024 + 1 }, '5 MB'],
    [{ type: 'image/png', size: 0 }, '5 MB'],
  ])('rejects unsafe/unsupported avatar files', (file, message) => expect(avatarProblem(file)).toContain(message));
  it('accepts a bounded supported image', () => expect(avatarProblem({ type: 'image/webp', size: 1000 })).toBeNull());
  it('recognizes only the provider reverification requirement, never skips it', () => {
    const error = { errors: [{ code: 'session_reverification_required', meta: { reverification: { level: 'second_factor' } } }] };
    expect(needsReverification(error)).toBe(true); expect(verificationLevel(error)).toBe('second_factor');
    expect(verificationLevel({})).toBe('multi_factor'); expect(needsReverification({})).toBe(false);
  });
  it('maps current-password, occupied username and verification errors to safe Portuguese fields', () => {
    expect(accountFailure({ errors: [{ code: 'form_password_incorrect' }] }).issues?.[0]).toMatchObject({ path: ['currentPassword'], message: 'A palavra-passe atual não está correta.' });
    expect(accountFailure({ errors: [{ code: 'form_identifier_exists', meta: { paramName: 'username' } }] }).issues?.[0]?.path).toEqual(['username']);
    expect(accountFailure({ errors: [{ code: 'form_code_incorrect', meta: { paramName: 'code' } }] }).issues?.[0]?.message).toContain('código');
    expect(accountFailure({ errors: [{ code: 'form_password_pwned' }] }).issues?.[0]?.path).toEqual(['newPassword']);
  });
  it('never surfaces raw provider messages, stacks or secrets', () => {
    const result = JSON.stringify(accountFailure({ errors: [{ code: 'unknown_sensitive_code', message: 'secret token', longMessage: 'raw stack' }] }));
    expect(result).not.toMatch(/secret|token|raw stack|unknown_sensitive_code/);
  });
});

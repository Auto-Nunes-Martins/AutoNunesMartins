import type { ClerkContext } from 'svelte-clerk';
import type { FormFailure } from '$lib/forms/formFeedback';

export type AccountUser = NonNullable<ClerkContext['user']>;
export type AccountSession = NonNullable<ClerkContext['session']>;
export type Verification = Awaited<ReturnType<AccountSession['startVerification']>>;
export type Email = AccountUser['emailAddresses'][number];
export type AccountSettings = {
  attributes: Record<string, { enabled: boolean; required: boolean; verifications?: string[] }>;
  passwordSettings: {
    min_length: number; max_length: number; require_numbers: boolean;
    require_uppercase: boolean; require_lowercase: boolean; require_special_char: boolean;
    allowed_special_characters: string; disable_hibp: boolean; show_zxcvbn: boolean;
  };
  usernameSettings: { min_length: number; max_length: number };
};

// Clerk JS exposes this read-only getter, but svelte-clerk 1.1 does not type it.
// Keep the compatibility boundary here. Missing configuration disables editing;
// never infer enabled account attributes or invent a password policy.
export function accountSettings(clerk: ClerkContext['clerk']): AccountSettings | null {
  const value = (clerk as unknown as { __internal_environment?: { userSettings?: AccountSettings } } | null)
    ?.__internal_environment?.userSettings;
  return value?.attributes && value.passwordSettings && value.usernameSettings ? value : null;
}

type AccountError = { code?: string; meta?: { paramName?: string; param_name?: string; reverification?: { level?: string } } };
export function accountErrors(error: unknown): AccountError[] {
  const errors = (error as { errors?: AccountError[] } | null)?.errors;
  return Array.isArray(errors) ? errors : [];
}
export function needsReverification(error: unknown) {
  return accountErrors(error).some(e => e.code === 'session_reverification_required');
}
export function verificationLevel(error: unknown): 'first_factor' | 'second_factor' | 'multi_factor' {
  const level = accountErrors(error).find(e => e.code === 'session_reverification_required')?.meta?.reverification?.level;
  return level === 'first_factor' || level === 'second_factor' ? level : 'multi_factor';
}

const fields: Record<string, string> = {
  first_name: 'firstName', last_name: 'lastName', username: 'username',
  current_password: 'currentPassword', new_password: 'newPassword', password: 'newPassword',
  email_address: 'email', email: 'email', code: 'code', file: 'avatar',
};
export function accountFailure(error: unknown, fallbackField?: string): FormFailure {
  const issues = accountErrors(error).map(e => {
    const code = e.code ?? '';
    const param = e.meta?.paramName ?? e.meta?.param_name ?? '';
    let field = fields[param] ?? fallbackField;
    let message = 'Não foi possível confirmar a alteração. Verifique a ligação e tente novamente.';
    if (code === 'form_password_incorrect') { field = fallbackField === 'verification' ? 'verification' : 'currentPassword'; message = 'A palavra-passe atual não está correta.'; }
    else if (code.includes('password_pwned')) { field ??= 'newPassword'; message = 'Esta palavra-passe apareceu numa fuga de dados. Escolha outra.'; }
    else if (code.includes('password')) { field ??= 'newPassword'; message = 'A palavra-passe não cumpre a política de segurança. Consulte os requisitos e escolha outra.'; }
    else if (code === 'form_identifier_exists' || code.includes('username_taken')) message = 'Este identificador já está a ser utilizado. Escolha outro.';
    else if (code.includes('verification_failed') || code.includes('code_incorrect')) message = 'O código não está correto. Verifique-o e tente novamente.';
    else if (code.includes('expired')) message = 'O código ou a confirmação expirou. Peça um novo código.';
    else if (code.includes('rate_limit') || code.includes('too_many')) message = 'Foram feitas demasiadas tentativas. Aguarde um pouco antes de repetir.';
    else if (code.includes('file_size')) message = 'A fotografia excede o tamanho permitido. Escolha um ficheiro mais pequeno.';
    else if (code.includes('file_type') || code.includes('image')) message = 'Não foi possível usar esta imagem. Escolha uma fotografia JPEG, PNG ou WebP válida.';
    else if (code.includes('not_allowed') || code.includes('forbidden')) message = 'Esta alteração não está disponível para a sua conta.';
    else if (code.includes('invalid') || code.includes('format')) message = 'O formato não é válido. Reveja este campo.';
    return { path: field ? [field] : [], message };
  });
  return { error: 'Não foi possível guardar.', issues: issues.length ? issues : [{ path: fallbackField ? [fallbackField] : [], message: 'Não foi possível confirmar a alteração. Verifique a ligação e tente novamente.' }] };
}

export function passwordRequirements(settings: AccountSettings) {
  const p = settings.passwordSettings;
  return [
    `Entre ${p.min_length} e ${p.max_length} caracteres`,
    ...(p.require_uppercase ? ['Uma letra maiúscula'] : []),
    ...(p.require_lowercase ? ['Uma letra minúscula'] : []),
    ...(p.require_numbers ? ['Um número'] : []),
    ...(p.require_special_char ? [`Um carácter especial${p.allowed_special_characters ? ': ' + p.allowed_special_characters : ''}`] : []),
    ...(!p.disable_hibp ? ['Não ter sido exposta em fugas de dados'] : []),
    ...(p.show_zxcvbn ? ['Resistência suficiente a tentativas de adivinhação'] : []),
  ];
}
export function passwordProblem(password: string, settings: AccountSettings): string | null {
  const p = settings.passwordSettings;
  if (password.length < p.min_length || password.length > p.max_length) return `Use entre ${p.min_length} e ${p.max_length} caracteres.`;
  if (p.require_uppercase && !/[A-Z]/.test(password)) return 'Inclua uma letra maiúscula.';
  if (p.require_lowercase && !/[a-z]/.test(password)) return 'Inclua uma letra minúscula.';
  if (p.require_numbers && !/[0-9]/.test(password)) return 'Inclua um número.';
  if (p.require_special_char && ![...password].some(c => p.allowed_special_characters ? p.allowed_special_characters.includes(c) : /[^\p{L}\p{N}\s]/u.test(c))) return 'Inclua um carácter especial permitido.';
  return null;
}

// Deliberately conservative CRM upload limit; Clerk validates the final upload.
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export function avatarProblem(file: Pick<File, 'size' | 'type'>): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Escolha uma fotografia JPEG, PNG ou WebP.';
  if (!file.size || file.size > AVATAR_MAX_BYTES) return 'Escolha uma fotografia até 5 MB.';
  return null;
}

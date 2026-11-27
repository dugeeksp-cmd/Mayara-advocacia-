import type { ClientRecord, ServiceLink } from '../types/legal';
import { matchLinksForClient } from './legalFieldOptions';
import { extractLast4Digits, sha256Hex } from './masksAndFormatters';

export type ClientLoginCheckResult =
  | 'invalid'
  | 'requires_password_setup'
  | 'authenticated';

export function generatePasswordSalt(lengthBytes = 16): string {
  const bytes = new Uint8Array(lengthBytes);
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < lengthBytes; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashClientPassword(password: string, salt: string): Promise<string> {
  return sha256Hex(`${salt}:${password.trim()}`);
}

export function validateNewClientPassword(
  password: string,
  confirmPassword: string
): string | null {
  const clean = password.trim();
  if (clean.length < 6) {
    return 'A senha de acesso deve ter pelo menos 6 caracteres.';
  }
  if (clean !== confirmPassword.trim()) {
    return 'As senhas informadas não conferem. Verifique e tente novamente.';
  }
  return null;
}

export async function verifyClientLoginAttempt(params: {
  client: Pick<ClientRecord, 'whatsapp' | 'passwordHash' | 'passwordSalt' | 'hasCustomPassword'>;
  passwordInput: string;
}): Promise<ClientLoginCheckResult> {
  const { client, passwordInput } = params;
  const cleanInput = passwordInput.trim();
  if (!cleanInput) return 'invalid';

  if (client.hasCustomPassword && client.passwordHash && client.passwordSalt) {
    const computed = await hashClientPassword(cleanInput, client.passwordSalt);
    return computed === client.passwordHash ? 'authenticated' : 'invalid';
  }

  const expectedInitialPin = extractLast4Digits(client.whatsapp);
  if (expectedInitialPin.length === 4 && cleanInput === expectedInitialPin) {
    return 'requires_password_setup';
  }

  return 'invalid';
}

export function partitionClientServiceLinks(
  client: Pick<ClientRecord, 'id' | 'fullName' | 'whatsapp'>,
  links: ServiceLink[]
): {
  pendingSignatureLinks: ServiceLink[];
  completedLinks: ServiceLink[];
} {
  const matched = matchLinksForClient(client, links).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );

  const pendingSignatureLinks: ServiceLink[] = [];
  const completedLinks: ServiceLink[] = [];

  for (const link of matched) {
    if (link.status === 'concluido') {
      completedLinks.push(link);
    } else {
      pendingSignatureLinks.push(link);
    }
  }

  return { pendingSignatureLinks, completedLinks };
}

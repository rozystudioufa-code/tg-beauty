import * as crypto from 'crypto';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface ValidationResult {
  valid: boolean;
  user?: TelegramUser;
}

export function validateInitData(initData: string, botToken: string): ValidationResult {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { valid: false };

  params.delete('hash');

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (computedHash !== hash) return { valid: false };

  const userStr = params.get('user');
  if (!userStr) return { valid: false };

  try {
    const user: TelegramUser = JSON.parse(decodeURIComponent(userStr));
    return { valid: true, user };
  } catch {
    return { valid: false };
  }
}

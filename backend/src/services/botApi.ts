interface BotInfo {
  id: number;
  username: string;
  first_name: string;
}

interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

export async function getBotInfo(token: string): Promise<BotInfo | null> {
  const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const data = (await res.json()) as TelegramResponse<BotInfo>;
  if (!data.ok || !data.result) return null;
  return data.result;
}

export async function setWebhook(token: string, webhookUrl: string): Promise<boolean> {
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ['message', 'callback_query', 'pre_checkout_query', 'successful_payment'],
    }),
  });
  const data = (await res.json()) as TelegramResponse<boolean>;
  return data.ok;
}

export async function setBotCommands(token: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commands: [
        { command: 'start', description: 'Открыть каталог услуг' },
        { command: 'mybookings', description: 'Мои записи' },
        { command: 'help', description: 'Помощь' },
      ],
    }),
  });
}

export async function sendMessage(token: string, chatId: number, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
}

import process from 'node:process';
import { Hono } from 'hono';
import { webhookCallback } from 'grammy';
import { createBot } from './bot';
import { buildEnv } from './env';

const env = buildEnv();
const { bot, getSubscribedUsers } = createBot(env);
const honoWebhookHandler = webhookCallback(bot, 'hono');

const app = new Hono();

app.get('/', (c: any) => c.text('Telegram Bot Cron Railway is running!'));
app.get('/healthz', (c: any) => c.json({ ok: true }));

// Cron trigger endpoint – hit this from Railway Cron
app.post('/cron/trigger', async (c: any) => {
  const auth = c.req.header('Authorization');
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { action = 'cron', message } = (await c.req.json().catch(() => ({}))) as {
    action?: string;
    message?: string;
  };

  const usersList = getSubscribedUsers();
  console.log('Webhook trigger received:', { action, message, subscribers: usersList.length });
  
  let successCount = 0;
  const textToSend = message || `Alert executed: ${action}`;

  // Broadcast to all subscribed users
  for (const userId of usersList) {
    try {
      await bot.api.sendMessage(userId, textToSend);
      successCount++;
    } catch (err) {
      console.error(`Failed to send message to ${userId}:`, err);
    }
  }

  return c.json({ success: true, sent_to: successCount, total_subscribers: usersList.length });
});

app.post('/telegram-webhook', honoWebhookHandler);

const port = Number(env.PORT || process.env.PORT || 8080);

console.log(`Server is explicitly running on http://0.0.0.0:${port}`);
export default {
  port: port,
  hostname: '0.0.0.0',
  fetch: app.fetch,
  error(error: unknown) {
    console.error('Hono error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
};


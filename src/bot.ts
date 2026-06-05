import { Database } from 'bun:sqlite';
import { Bot, type Context } from 'grammy';
import type { Env } from './env';

export function createBot(env: Env) {
  const bot = new Bot<Context>(env.BOT_TOKEN);

  // Initialize SQLite database (persists to a file called users.db)
  // In Railway, you should mount a Volume to /app/data and use /app/data/users.db
  const dbPath = process.env.DB_PATH || 'users.db';
  const db = new Database(dbPath, { create: true });
  
  // Create table if it doesn't exist
  db.query(`
    CREATE TABLE IF NOT EXISTS subscribers (
      chat_id INTEGER PRIMARY KEY
    )
  `).run();

  const addSubscriber = db.query(`INSERT OR IGNORE INTO subscribers (chat_id) VALUES (?)`);
  const getSubscribersQuery = db.query(`SELECT chat_id FROM subscribers`);

  // We wrap database reads to always get the freshest list of users
  const getSubscribedUsers = () => {
    const rows = getSubscribersQuery.all() as { chat_id: number }[];
    return rows.map(r => r.chat_id);
  };

  bot.command('start', async (ctx) => {
    if (ctx.chat?.id) {
      addSubscriber.run(ctx.chat.id);
    }
    await ctx.reply(
      '👋 Welcome! You are now subscribed to Airflow alerts.\n\nUse /help to see available commands.'
    );
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(
      'Available commands:\n/start - Subscribe to alerts\n/help - This help text'
    );
  });

  bot.on('message', async (ctx) => {
    if (ctx.chat?.id) {
        addSubscriber.run(ctx.chat.id);
    }
    await ctx.reply(`Hi! Your chat ID is ${ctx.chat?.id}. You are subscribed to alerts.`);
  });

  bot.catch((err) => {
    console.error('Bot error:', err);
  });

  return { bot, getSubscribedUsers };
}

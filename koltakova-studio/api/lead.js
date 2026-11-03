// Заявка з сайту → повідомлення в Telegram
// На Vercel у Settings → Environment Variables додайте TELEGRAM_TOKEN і TELEGRAM_CHAT_ID
const clean = v => String(v || '').slice(0, 300).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

module.exports = async (req, res) => {
  const token = String(process.env.TELEGRAM_TOKEN || '').trim().replace(/^bot/i, '');
  const chat = String(process.env.TELEGRAM_CHAT_ID || '').trim();

  // Перевірка налаштувань: відкрийте /api/lead у браузері (токен не показується)
  if (req.method === 'GET') {
    const out = {
      token_added: !!token,
      token_format_ok: /^\d+:[A-Za-z0-9_-]{30,}$/.test(token),
      chat_id_added: !!chat,
      chat_id_format_ok: /^-?\d+$/.test(chat)
    };
    if (out.token_format_ok) {
      try {
        const me = await (await fetch(`https://api.telegram.org/bot${token}/getMe`)).json();
        out.bot_found = !!me.ok; if (me.ok) out.bot_username = '@' + me.result.username;
        if (me.ok && out.chat_id_format_ok) {
          const ch = await (await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(chat)}`)).json();
          out.bot_can_write_to_you = !!ch.ok; if (!ch.ok) out.telegram_says = ch.description;
        }
      } catch (e) { out.network_error = true; }
    }
    return res.status(200).json(out);
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const name = clean(body.name), contact = clean(body.contact), need = clean(body.need);
  if (!name || !contact) return res.status(400).json({ ok: false, error: 'empty' });
  if (!token || !chat) return res.status(500).json({ ok: false, error: 'not configured' });

  const text = `🔔 <b>Нова заявка з сайту</b>\n\n👤 ${name}\n📱 ${contact}\n🧩 ${need || 'не вказано'}`;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML' })
    });
    const j = await r.json().catch(() => ({}));
    return res.status(r.ok ? 200 : 502).json({ ok: r.ok, error: j.description });
  } catch (e) { return res.status(502).json({ ok: false, error: 'network' }); }
};

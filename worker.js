// Cloudflare Worker — прокси к Telegram. Прячет токен бота.
// Деплой см. в README.md.
//
// Нужны два секрета (Settings → Variables → Add → Secret):
//   BOT_TOKEN  — токен бота от @BotFather
//   CHAT_ID    — твой chat id (узнать через @userinfobot)

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: cors });
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return new Response("Bad JSON", { status: 400, headers: cors });
    }

    const date = String(data.date ?? "").slice(0, 20);
    const time = String(data.time ?? "").slice(0, 10);
    const food = String(data.food ?? "").slice(0, 60);

    const text =
      `💌 Свидание подтверждено!\n` +
      `📅 Дата: ${date}\n` +
      `🕒 Время: ${time}\n` +
      `🍽 Еда: ${food}`;

    const tgUrl = `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`;
    const resp = await fetch(tgUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: env.CHAT_ID, text }),
    });

    if (!resp.ok) {
      return new Response("Telegram error", { status: 502, headers: cors });
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  },
};

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const corsHeaders = {
      "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info, accept, origin",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Max-Age": "86400"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }
    const json = /* @__PURE__ */ __name((data, status = 200) => new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }), "json");
    const sbFetch = /* @__PURE__ */ __name(async (endpoint, options = {}) => {
      const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${endpoint}`, {
        ...options,
        headers: {
          "apikey": env.BREZEL_SECRET,
          "Authorization": `Bearer ${env.BREZEL_SECRET}`,
          "Content-Type": "application/json",
          "Prefer": "return=representation",
          ...options.headers
        }
      });
      return res.json();
    }, "sbFetch");
    const tgSend = /* @__PURE__ */ __name(async (token, text) => {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: env.MY_CHAT_ID, text, parse_mode: "HTML" })
      });
    }, "tgSend");
    try {
      if (path === "/webhook" && request.method === "POST") {
        const update = await request.json();
        if (update.message && update.message.reply_to_message && update.message.text) {
          const replyToText = update.message.reply_to_message.text;
          const match = replyToText.match(/\(ID: ([^)]+)\)/);
          if (match) {
            const sessionId = match[1].trim();
            await sbFetch("support_messages", {
              method: "POST",
              body: JSON.stringify({
                session_id: sessionId,
                sender: "admin",
                text: update.message.text
              })
            });
          }
        }
        return json({ ok: true });
      }
      if (path === "/api/lead" && request.method === "POST") {
        const { name, phone, turnstileToken } = await request.json();
        if (env.TURNSTILE_SECRET && turnstileToken !== "1x0000000000000000000000000000000AA") {
          const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `secret=${env.TURNSTILE_SECRET}&response=${turnstileToken}`
          });
          const verifyData = await verifyRes.json();
          if (!verifyData.success) return json({ error: "\u0412\u044B \u0440\u043E\u0431\u043E\u0442!" }, 400);
        }
        const text = `\u{1F525} <b>\u041D\u043E\u0432\u0430\u044F \u0437\u0430\u044F\u0432\u043A\u0430!</b>

\u{1F464} \u0418\u043C\u044F: ${name}
\u{1F4DE} \u0422\u0435\u043B\u0435\u0444\u043E\u043D: ${phone}`;
        ctx.waitUntil(tgSend(env.CLIENT_BOT_TOKEN, text));
        return json({ success: true });
      }
      if (path === "/api/order" && request.method === "POST") {
        const { items, total, userName } = await request.json();
        if (!Array.isArray(items) || items.length === 0) return json({ error: "\u041F\u0443\u0441\u0442\u043E\u0439 \u0437\u0430\u043A\u0430\u0437" }, 400);
        if (total > 1e5) return json({ error: "\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u0430\u044F \u0441\u0443\u043C\u043C\u0430" }, 400);
        const itemsList = items.map((i) => `- ${i.name} (${i.qty} \u0448\u0442.) \u2014 ${i.price * i.qty} \u20BD`).join("\n");
        const text = `\u{1F4E6} <b>\u041D\u043E\u0432\u044B\u0439 \u0437\u0430\u043A\u0430\u0437!</b>

\u{1F464} \u041A\u043B\u0438\u0435\u043D\u0442: ${userName}

\u{1F6D2} \u0422\u043E\u0432\u0430\u0440\u044B:
${itemsList}

\u{1F4B0} <b>\u0418\u0442\u043E\u0433\u043E: ${total} \u20BD</b>`;
        ctx.waitUntil(tgSend(env.ADMIN_BOT_TOKEN, text));
        return json({ success: true });
      }
      if (path === "/api/gigachat" && request.method === "POST") {
        const { message, sessionId, history } = await request.json();
        if (!message || message.length > 1e3) return json({ reply: "\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u0434\u043B\u0438\u043D\u043D\u043E\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435." }, 400);
        const ip = request.headers.get("CF-Connecting-IP") || "unknown";
        const limitKey = `limit_${ip}_${sessionId}`;
        let msgCount = parseInt(await env.MESSAGES_KV.get(limitKey)) || 0;
        const authHeader = request.headers.get("Authorization");
        if (msgCount >= 5 && !authHeader) {
          return json({ reply: "\u{1F6AB} \u0412\u044B \u0438\u0441\u0447\u0435\u0440\u043F\u0430\u043B\u0438 \u043B\u0438\u043C\u0438\u0442 (5 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439). \u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u0443\u0439\u0442\u0435\u0441\u044C, \u0447\u0442\u043E\u0431\u044B \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C \u043E\u0431\u0449\u0435\u043D\u0438\u0435." });
        }
        const badWords = ["\u0445\u0443\u0439", "\u043F\u0438\u0437\u0434", "\u0435\u0431\u0430\u043B", "\u0441\u0443\u043A\u0430", "\u0431\u043B\u044F\u0442\u044C", "\u043D\u0430\u0445\u0443\u0439"];
        const isSpam = badWords.some((w) => message.toLowerCase().includes(w)) || message.length < 2;
        if (isSpam) {
          ctx.waitUntil(tgSend(env.ADMIN_BOT_TOKEN, `\u{1F6A8} <b>\u0425\u0430\u043A\u0435\u0440/\u0421\u043F\u0430\u043C:</b>
IP: ${ip}
ID: ${sessionId}
\u{1F4AC}: ${message}`));
          return json({ reply: "\u042F \u0442\u0435\u0431\u044F \u0432\u0438\u0436\u0443, \u0445\u0430\u043A\u0435\u0440. \u041D\u0435 \u0431\u0430\u043B\u0443\u0439\u0441\u044F." });
        }
        if (!authHeader) {
          ctx.waitUntil(env.MESSAGES_KV.put(limitKey, (msgCount + 1).toString(), { expirationTtl: 86400 }));
        }
        const formattedHistory = (history || []).map((msg) => ({
          role: msg.sender === "user" ? "user" : "assistant",
          content: msg.text
        }));
        let reply = "";
        try {
          const aiResponse = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
            messages: [
              { role: "system", content: "\u0422\u044B \u2014 \u0414\u043E\u043A\u0442\u043E\u0440 \u0411\u0440\u0435\u0437\u0435\u043B\u044C, \u0434\u043E\u0431\u0440\u044B\u0439 \u0434\u0435\u0434\u0443\u0448\u043A\u0430-\u0441\u044B\u0440\u043E\u0432\u0430\u0440. \u041E\u0442\u0432\u0435\u0447\u0430\u0439 \u043A\u0440\u0430\u0442\u043A\u043E, \u0432\u0435\u0436\u043B\u0438\u0432\u043E." },
              ...formattedHistory,
              { role: "user", content: message }
            ]
          });
          reply = aiResponse.response || "\u041E\u0445, \u0441\u0442\u0430\u0440\u044B\u0439 \u044F \u0441\u0442\u0430\u043B. \u0414\u0430\u0432\u0430\u0439 \u0435\u0449\u0435 \u0440\u0430\u0437.";
        } catch (e) {
          console.error("CF AI Error:", e);
          return json({ reply: "\u041E\u0445, \u0441\u0435\u0442\u044C \u0431\u0430\u0440\u0430\u0445\u043B\u0438\u0442. \u041F\u043E\u0434\u043E\u0436\u0434\u0438 \u0447\u0443\u0442\u043E\u043A." });
        }
        return json({ reply });
        ;
      }
      if (path === "/api/support" && request.method === "POST") {
        const { message, sessionId, userEmail } = await request.json();
        const displayId = userEmail || sessionId;
        const text = `\u{1F464} <b>\u041A\u043B\u0438\u0435\u043D\u0442 (${displayId})</b>
ID: ${sessionId}

${message}

<i>\u0421\u0432\u0430\u0439\u043F\u043D\u0438 \u044D\u0442\u043E \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u0432\u043F\u0440\u0430\u0432\u043E, \u0447\u0442\u043E\u0431\u044B \u043E\u0442\u0432\u0435\u0442\u0438\u0442\u044C.</i>`;
        ctx.waitUntil(tgSend(env.PANEL_BOT_TOKEN, text));
        return json({ success: true });
      }
      if (path === "/api/guard-help" && request.method === "POST") {
        const { message, userId, userEmail } = await request.json();
        const displayId = userEmail || userId;
        ctx.waitUntil(tgSend(env.ADMIN_BOT_TOKEN, `\u{1F6E1}\uFE0F <b>SOS! \u0412\u0437\u043B\u043E\u043C \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0430!</b>
\u041F\u043E\u0447\u0442\u0430: ${displayId}
ID: ${userId}
\u{1F4AC}: ${message}`));
        return json({ reply: "\u0421\u0438\u0433\u043D\u0430\u043B SOS \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043F\u043E\u0447\u0442\u0443 \u0434\u043B\u044F \u0441\u0431\u0440\u043E\u0441\u0430 \u043F\u0430\u0440\u043E\u043B\u044F." });
      }
      return json({ error: "Not Found" }, 404);
    } catch (error) {
      return json({ error: error.message }, 500);
    }
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map

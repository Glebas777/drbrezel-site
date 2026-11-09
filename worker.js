// Глобальное хранилище (для маппинга сообщений Telegram и клиентов)
const activeChats = {};

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Credentials': 'true',
    };

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

    const url = new URL(request.url);

    // 1. ЧАТ С ИИ
    if (url.pathname === '/api/gigachat' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { message, history, sessionId } = body;

        if (/менеджер|человек|оператор|поддержк|помощь|позови|свяжись|админ/i.test(message)) {
            const text = `👤 <b>Клиент зовет менеджера!</b>\nID: ${sessionId}\n💬: ${message}`;
            const tgRes = await fetch(`https://api.telegram.org/bot${env.ADMIN_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: env.MY_CHAT_ID, text, parse_mode: 'HTML' })
            });
            const tgData = await tgRes.json();
            if (tgData.ok) activeChats[tgData.result.message_id] = sessionId;
            
            return new Response(JSON.stringify({ reply: "Секунду, я передаю ваш вопрос старшему менеджеру." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const recentHistory = (history || []).slice(-6).map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: String(msg.text || '').trim() || '...'
        }));

        const systemPrompt = "Ты — Доктор Брезель, добрый и немного шутливый дедушка-сыровар из магазина Dr. Brezel Gourmet. Ты общаешься с клиентами на сайте. Отвечай на их вопросы по-человечески, с душой. Если спрашивают про сыр — советуй. Если спрашивают про покупку — говори, что нужно нажать кнопку 'Смотреть коллекцию' или зайти в каталог. Если спрашивают 'как дела' — можешь ответить, что у тебя всё отлично, сыры зреют, и спросить, чем помочь. Не выдумывай ссылок и скидок, которых нет. Отвечай кратко (1-3 предложения).";

        const zvenoRes = await fetch('https://api.zveno.ai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.ZVENO_API_KEY}` },
          body: JSON.stringify({
            model: 'minimax/minimax-m2.7',
            messages: [{ role: 'system', content: systemPrompt }, ...recentHistory, { role: 'user', content: String(message || '').trim() || '...' }],
            max_tokens: 300
          })
        });

        if (!zvenoRes.ok) {
          const errText = await zvenoRes.text();
          return new Response(JSON.stringify({ reply: `Ошибка ZvenoAI (${zvenoRes.status}): ${errText}` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const data = await zvenoRes.json();
        let reply = data.choices?.[0]?.message?.content || 'Ох, сеть барахлит.';

        if (reply.includes('/sendtohelper')) {
            const text = `🚨 <b>Клиент тупит/грубит!</b>\nID: ${sessionId}\n💬: ${message}`;
            const tgRes = await fetch(`https://api.telegram.org/bot${env.ADMIN_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: env.MY_CHAT_ID, text, parse_mode: 'HTML' })
            });
            const tgData = await tgRes.json();
            if (tgData.ok) activeChats[tgData.result.message_id] = sessionId;
            reply = "Секунду, я передаю ваш вопрос старшему менеджеру. Он ответит в течение 15 минут.";
        }

        return new Response(JSON.stringify({ reply }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ reply: 'Ошибка: ' + e.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // 2. ЗАЯВКИ
    if (url.pathname === '/api/lead' && request.method === 'POST') {
        try {
            const { name, phone } = await request.json();
            const text = `🔥 <b>Новая заявка!</b>\n\n👤 Имя: ${name}\n📞 Телефон: ${phone}`;
            ctx.waitUntil(fetch(`https://api.telegram.org/bot${env.CLIENT_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: env.MY_CHAT_ID, text, parse_mode: 'HTML' })
            }));
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
            return new Response(JSON.stringify({ error: 'Ошибка' }), { status: 500, headers: corsHeaders });
        }
    }

    // 3. ПОДДЕРЖКА (ТОННЕЛЬ)
    if (url.pathname === '/api/support' && request.method === 'POST') {
        const body = await request.json();
        const { message, sessionId, userEmail } = body;
        const displayId = userEmail || sessionId;
        const text = `👤 <b>Клиент (${displayId})</b>\nID: ${sessionId}\n\n${message}\n\n<i>Свайпни вправо.</i>`;
        const tgRes = await fetch(`https://api.telegram.org/bot${env.ADMIN_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: env.MY_CHAT_ID, text, parse_mode: 'HTML' })
        });
        const tgData = await tgRes.json();
        if (tgData.ok) activeChats[tgData.result.message_id] = sessionId;
        
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 4. ЗАКАЗЫ
    if (url.pathname === '/api/order' && request.method === 'POST') {
        try {
            const { items, total, userName } = await request.json();
            const itemsList = items.map(i => `- ${i.name} (${i.qty} шт.) — ${i.price * i.qty} ₽`).join('\n');
            const text = `📦 <b>Новый заказ!</b>\n\n👤 Клиент: ${userName}\n\n🛒 Товары:\n${itemsList}\n\n💰 <b>Итого: ${total} ₽</b>`;
            ctx.waitUntil(fetch(`https://api.telegram.org/bot${env.ADMIN_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: env.MY_CHAT_ID, text, parse_mode: 'HTML' })
            }));
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
            return new Response(JSON.stringify({ error: 'Ошибка' }), { status: 500, headers: corsHeaders });
        }
    }

    // 5. ВЕБХУК TELEGRAM (ОТВЕТЫ ИЗ БОТА)
    if (url.pathname === '/webhook' && request.method === 'POST') {
        try {
            const update = await request.json();
            if (update.message && update.message.reply_to_message) {
                const replyToId = update.message.reply_to_message.message_id;
                const sessionId = activeChats[replyToId];
                if (sessionId) {
                    await fetch(`${env.SUPABASE_URL}/rest/v1/support_messages`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': env.SUPABASE_KEY,
                            'Authorization': `Bearer ${env.SUPABASE_KEY}`
                        },
                        body: JSON.stringify({ session_id: sessionId, sender: 'admin', text: update.message.text })
                    });
                }
            }
            return new Response('OK', { status: 200 });
        } catch (e) {
            return new Response('Error', { status: 200 });
        }
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }
};

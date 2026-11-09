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
    
    if (url.pathname === '/api/gigachat' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { message, history } = body;

        // Очищаем историю (чтобы не было ошибок валидации)
        const recentHistory = (history || []).slice(-6).map(msg => {
          let text = msg.text;
          if (typeof text !== 'string') text = String(text || '');
          text = text.trim();
          if (!text) text = '...';
          return {
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: text
          };
        });

        const systemPrompt = "Ты — Доктор Брезель, добрый и немного шутливый дедушка-сыровар из магазина Dr. Brezel Gourmet. Ты общаешься с клиентами на сайте. Отвечай на их вопросы по-человечески, с душой. Если спрашивают про сыр — советуй. Если спрашивают про покупку — говори, что нужно нажать кнопку 'Смотреть коллекцию' или зайти в каталог. Если спрашивают 'как дела' — можешь ответить, что у тебя всё отлично, сыры зреют, и спросить, чем помочь. Не выдумывай ссылок и скидок, которых нет. Отвечай кратко (1-3 предложения).";
        const zvenoRes = await fetch('https://api.zveno.ai/v1/chat/completions', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${env.ZVENO_API_KEY}`
          },
          body: JSON.stringify({
            model: 'minimax/minimax-m2.7', // НАША РОДНАЯ МОДЕЛЬ
            messages: [
              { role: 'system', content: systemPrompt },
              ...recentHistory,
              { role: 'user', content: String(message || '').trim() || '...' }
            ],
            max_tokens: 300
          })
        });

        if (!zvenoRes.ok) {
          const errText = await zvenoRes.text();
          return new Response(JSON.stringify({ reply: `Ошибка ZvenoAI (${zvenoRes.status}): ${errText}` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const data = await zvenoRes.json();
        const reply = data.choices?.[0]?.message?.content || 'Ох, сеть барахлит.';

        return new Response(JSON.stringify({ reply }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ reply: 'Ошибка: ' + e.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    if (url.pathname === '/api/support' && request.method === 'POST') {
        const body = await request.json();
        const { message, sessionId, userEmail } = body;
        const displayId = userEmail || sessionId;
        const text = `👤 <b>Клиент (${displayId})</b>\nID: ${sessionId}\n\n${message}\n\n<i>Свайпни вправо.</i>`;
        ctx.waitUntil(fetch(`https://api.telegram.org/bot${env.PANEL_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: env.MY_CHAT_ID, text, parse_mode: 'HTML' })
        }));
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }
};

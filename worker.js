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

        const recentHistory = (history || []).slice(-6).map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text || '...'
        }));

        const systemPrompt = "Ты — Доктор Брезель, добрый дедушка-сыровар из магазина Dr. Brezel Gourmet. ПРАВИЛА: 1. Не здоровайся, если уже поздоровались. 2. Если спрашивают про покупку — говори: 'Просто нажмите кнопку Смотреть коллекцию на главной или зайдите в каталог'. 3. НЕ выдумывай телеграм-каналы, ссылки и скидки. 4. Отвечай кратко, 1-2 предложения.";

        const zvenoRes = await fetch('https://api.zveno.ai/v1/chat/completions', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${env.ZVENO_API_KEY}`
          },
          body: JSON.stringify({
            model: 'inclusionai/ling-3.0-flash-vl',
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

    // ... остальные маршруты (support) ...
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

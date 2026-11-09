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

        // ПРОМПТ В ОДНУ СТРОКУ (без переносов, чтобы не было ошибки)
        const systemPrompt = "Ты — Доктор Брезель, чат-бот премиальной сыроварни Dr. Brezel Gourmet. Твоя задача — вежливо отвечать на вопросы клиентов и помогать с выбором сыра. ПРАВИЛА: 1. Не здоровайся каждый раз, если клиент уже поздоровался. Сразу отвечай по делу. 2. Если спрашивают 'как дела' — кратко ответь и переведи тему на сыр (спроси, чем помочь). 3. Если просят купить — скажи, что нужно нажать кнопку 'Смотреть коллекцию' или перейти в каталог. 4. Отвечай кратко, 1-2 предложения. Будь доброжелательным.";

        const aiResponse = await env.AI.run('@cf/zai-org/glm-4.7-flash', {
          messages: [
            { role: 'system', content: systemPrompt },
            ...recentHistory,
            { role: 'user', content: message }
          ],
          chat_template_kwargs: { enable_thinking: false }
        });
        
        let reply = aiResponse.response || 
                    (aiResponse.choices && aiResponse.choices[0] && aiResponse.choices[0].message && aiResponse.choices[0].message.content) || 
                    'Ох, сеть барахлит.';

        return new Response(JSON.stringify({ reply }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ reply: 'Ошибка Cloudflare AI: ' + e.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const app = express();
app.use(cors());
app.use(express.json());

// В самом начале proxy.js, после app.use(express.json());
app.use((req, res, next) => {
    // Простейшая защита от подделки sessionId (если нужно — усилим)
    if (req.body && req.body.sessionId) {
        const validSession = /^user_[a-z0-9]{6,}$/i.test(req.body.sessionId);
        if (!validSession) {
            return res.status(400).json({ error: 'Неверный sessionId' });
        }
    }
    next();
});

const CLIENT_BOT_TOKEN = process.env.CLIENT_BOT_TOKEN;
const ADMIN_BOT_TOKEN = process.env.ADMIN_BOT_TOKEN;
const MY_CHAT_ID = process.env.MY_CHAT_ID;
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
    realtime: { transport: ws }
});

const activeChats = {};
let lastUpdateId = 0;

async function sendToClientBot(text) {
    try {
        await fetch(`https://api.telegram.org/bot${CLIENT_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: MY_CHAT_ID, text, parse_mode: 'HTML' })
        });
    } catch (e) { console.error('Ошибка клиентского бота:', e.message); }
}

async function sendToAdminBot(text) {
    try {
        await fetch(`https://api.telegram.org/bot${ADMIN_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: MY_CHAT_ID, text, parse_mode: 'HTML' })
        });
    } catch (e) { console.error('Ошибка админ-бота:', e.message); }
}

async function pollTelegram() {
    try {
        const res = await fetch(`https://api.telegram.org/bot${ADMIN_BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=10`);
        const data = await res.json();
        if (data.ok && data.result.length > 0) {
            for (const update of data.result) {
                lastUpdateId = update.update_id;
                const message = update.message;
                if (message && message.reply_to_message) {
                    const replyToId = message.reply_to_message.message_id;
                    const sessionId = activeChats[replyToId];
                    if (sessionId) {
                        await supabase.from('support_messages').insert([{
                            session_id: sessionId,
                            sender: 'admin',
                            text: message.text
                        }]);
                    }
                }
            }
        }
    } catch (e) {}
    setTimeout(pollTelegram, 2000);
}
pollTelegram();

app.post('/api/lead', async (req, res) => {
    const { name, phone, turnstileToken } = req.body;
    try {
        const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `secret=${TURNSTILE_SECRET}&response=${turnstileToken}`
        });
        const verifyData = await verifyRes.json();
        if (!verifyData.success) return res.status(400).json({ error: 'Вы робот!' });
    } catch (e) {}

    await sendToClientBot(`🔥 <b>Новая заявка!</b>\n\n👤 Имя: ${name}\n📞 Телефон: ${phone}`);
    res.json({ success: true });
});

app.post('/api/guard-help', async (req, res) => {
    const { message, userId } = req.body;
    
    // Отправляем запрос в ZvenoAI, чтобы он дал совет по безопасности
    try {
        const zvenoRes = await fetch('https://api.zveno.ai/v1/chat/completions', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${process.env.ZVENO_API_KEY}`
            },
            body: JSON.stringify({
                model: 'minimax/minimax-m2.7',
                messages: [
                    { 
                        role: 'system', 
                        content: `Ты — Brezel's Guard, ИИ-защитник аккаунта. Отвечай кратко (до 3 предложений), давай советы по безопасности.` 
                    },
                    { role: 'user', content: message }
                ]
            })
        });
        
        const chatData = await zvenoRes.json();
        const reply = chatData.choices?.[0]?.message?.content || 'Я не смог проанализировать запрос.';
        
        // Отправляем ответ тебе в ТГ (чтобы ты видел, что ИИ делает)
        await sendToAdminBot(`🛡️ <b>Brezel's Guard AI:</b>\nID: ${userId}\n💬: ${message}\n\n🤖 Ответ: ${reply}`);
        
        res.json({ reply });
    } catch (e) {
        res.status(500).json({ error: 'Ошибка ИИ-Защитника' });
    }
});

app.post('/api/order', async (req, res) => {
    try {
        const { items, total, userName } = req.body;
        
        const itemsList = items.map(i => `- ${i.name} (${i.qty} шт.) — ${i.price * i.qty} ₽`).join('\n');
        
        await sendToAdminBot(`📦 <b>Новый заказ!</b>\n\n👤 Клиент: ${userName}\n\n🛒 Товары:\n${itemsList}\n\n💰 <b>Итого: ${total} ₽</b>`);
        
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

app.post('/api/gigachat', async (req, res) => {
    const { message, sessionId, history } = req.body; 
    if (!message) return res.status(400).json({ reply: 'Пусто' });

    if (!message || message.length > 1000) {
    return res.status(400).json({ reply: 'Слишком длинное сообщение или пустое.' });
}

    try {
        const formattedHistory = (history || []).map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
        }));

        const zvenoRes = await fetch('https://api.zveno.ai/v1/chat/completions', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${process.env.ZVENO_API_KEY}`
            },
            body: JSON.stringify({
                model: 'minimax/minimax-m2.7',
                messages: [
                    { 
                        role: 'system', 
                        content: `Ты — Доктор Брезель, старичок-сыровар. Твоя цель — продавать сыр Dr. Brezel Gourmet.
                        ПРАВИЛА:
                        1. Отвечай КРАТКО (до 2 предложений).
                        2. Если клиент грубит или пишет бред (ы, а, чо) — напиши РОВНО: /sendtohelper
                        3. Если просят менеджера — напиши РОВНО: /sendtohelper
                        4. Если просят стикер — напиши только код: :wow:, :love:, :cheese:, :laugh:, :think:, :applause:.
                        5. НИКОГДА не выдумывай факты.` 
                    },
                    ...formattedHistory,
                    { role: 'user', content: message }
                ],
                temperature: 0.7,
                max_tokens: 200 // Не экономим, но и не жжем
            })
        });

        if (!zvenoRes.ok) {
            console.log('ZvenoAI вернул статус:', zvenoRes.status);
            return res.json({ reply: "Ох, сеть барахлит. Подожди чуток." });
        }

        const chatData = await zvenoRes.json();
        let reply = chatData.choices?.[0]?.message?.content || '';

        // ЕСЛИ ИИ ВЫДАЛ КОМАНДУ /sendtohelper
        if (reply.includes('/sendtohelper')) {
            await sendToAdminBot(`🚨 <b>Клиент тупит/грубит!</b>\nID: ${sessionId}\n💬: ${message}`);
            return res.json({ reply: "Секунду, я передаю ваш вопрос старшему менеджеру. Он ответит в течение 15 минут." });
        }

        if (!reply) {
            reply = "Ох, старый я стал. Давай еще раз, только помедленнее.";
        }

        res.json({ reply });

    } catch (e) {
        console.log('ZvenoAI Error:', e.message);
        res.json({ reply: "Ох, сеть барахлит. Подожди чуток." });
    }
});

app.post('/api/support', async (req, res) => {
    try {
        const { message, sessionId } = req.body;
        const tgRes = await sendToAdminBot(`👤 <b>Клиент (${sessionId}):</b>\n${message}`);
        if (tgRes && tgRes.ok) activeChats[tgRes.result.message_id] = sessionId;
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
});

app.listen(3000, () => console.log('200'));
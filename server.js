const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Твои переменные из .env
const ADMIN_BOT_TOKEN = process.env.ADMIN_BOT_TOKEN;
const PANEL_BOT_TOKEN = process.env.PANEL_BOT_TOKEN;
const MY_CHAT_ID = process.env.MY_CHAT_ID;
const ZVENO_API_KEY = process.env.ZVENO_API_KEY; // Если используешь ZvenoAI

// Эндпоинт для чата
app.post('/api/gigachat', async (req, res) => {
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ reply: 'Пустое сообщение' });

    // Используем ZvenoAI (как раньше)
    try {
        const zvenoRes = await fetch('https://api.zveno.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ZVENO_API_KEY}`
            },
            body: JSON.stringify({
                model: 'nvidia/nemotron-3.5-super-vl:free',
                messages: [
                    { role: 'system', content: 'Ты — Доктор Брезель, добрый дедушка-сыровар. Отвечай кратко, вежливо.' },
                    ...(history || []).slice(-4).map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text })),
                    { role: 'user', content: message }
                ],
                max_tokens: 500
            })
        });

        if (!zvenoRes.ok) return res.json({ reply: 'Ошибка ИИ.' });
        const data = await zvenoRes.json();
        const reply = data.choices?.[0]?.message?.content || 'Ох, сеть барахлит.';

        // Отправка менеджеру в ТГ (если просят)
        if (reply.includes('Секунду, я передаю')) {
            fetch(`https://api.telegram.org/bot${ADMIN_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: MY_CHAT_ID, text: `🚨 Клиент зовет менеджера!\n${message}`, parse_mode: 'HTML' })
            }).catch(() => {});
            return res.json({ reply: 'Секунду, я передаю ваш вопрос старшему менеджеру.' });
        }

        res.json({ reply });
    } catch (e) {
        res.json({ reply: 'Ошибка сервера.' });
    }
});

// Эндпоинт для поддержки
app.post('/api/support', async (req, res) => {
    const { message, sessionId, userEmail } = req.body;
    const displayId = userEmail || sessionId;
    const text = `👤 Клиент (${displayId})\nID: ${sessionId}\n\n${message}`;
    fetch(`https://api.telegram.org/bot${PANEL_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: MY_CHAT_ID, text, parse_mode: 'HTML' })
    }).catch(() => {});
    res.json({ success: true });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
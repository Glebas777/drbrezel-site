// api/chat.js
import GigaChat from 'gigachat';
import { Agent } from 'node:https';

// Отключаем проверку сертификата для российского API (нужно для GigaChat)
const httpsAgent = new Agent({ rejectUnauthorized: false });

const client = new GigaChat({
    timeout: 600,
    model: 'GigaChat',
    credentials: process.env.GIGACHAT_CLIENT_SECRET, // Ключ из Сбера
    httpsAgent: httpsAgent,
});

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'No message' });

    try {
        const response = await client.chat({
            messages: [
                { role: 'system', content: 'Ты — Доктор Брезель, старичок-сыровар, шутник и эксперт. Отвечай кратко, с юмором, но по делу. Ты продаёшь премиальный сыр Dr. Brezel Gourmet.' },
                { role: 'user', content: message }
            ],
        });
        res.status(200).json({ reply: response.choices[0]?.message.content });
    } catch (error) {
        res.status(500).json({ error: 'GigaChat error' });
    }
}
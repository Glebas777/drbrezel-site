const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Твой Cloudflare Worker (где работает Cloudflare AI)
const CF_WORKER_URL = 'https://api.drbrezel.ru/api/gigachat'; 

// Эндпоинт для чата (Layero проксирует запрос в Cloudflare)
app.post('/api/gigachat', async (req, res) => {
    try {
        const response = await fetch(CF_WORKER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body) // Передаем то, что прислал телефон
        });

        if (!response.ok) {
            return res.status(500).json({ reply: 'Ошибка на стороне Cloudflare.' });
        }

        const data = await response.json();
        res.json(data); // Отдаем ответ телефону
    } catch (e) {
        console.error(e);
        res.json({ reply: 'Ошибка прокси-сервера.' });
    }
});

// Эндпоинт для поддержки (тоже проксируем)
app.post('/api/support', async (req, res) => {
    try {
        const response = await fetch('https://api.drbrezel.ru/api/support', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false });
    }
});

app.listen(PORT, () => console.log(`Proxy server running on port ${PORT}`));
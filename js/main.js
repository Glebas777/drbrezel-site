import { supabase } from './supabase-client.js';
import { addToCart } from './cart.js';

window.addEventListener('load', () => {
    const preloader = document.getElementById('preloader');
    if (preloader) {
        preloader.style.opacity = '0';
        setTimeout(() => preloader.remove(), 500);
    }
});

const STICKER_CODES = [':wow:', ':think:', ':applause:', ':wink:', ':love:', ':laugh:', ':star:', ':cry:', ':cheese:', ':question:', ':typing:', ':wait:'];
const STICKER_BG_SIZE = '300% 400%';
const STICKER_IMG_PATH = 'assets/images/stickers.png';

let sessionId = 'user_' + Math.random().toString(36).substring(2, 9);
let currentAbortController = null;
let typingInterval = null;

async function updateAuthUI() {
    const authContainer = document.getElementById('auth-buttons');
    if (!authContainer) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        authContainer.innerHTML = `
            <a href="cart.html" class="header__btn" style="text-decoration: none;">Корзина</a>
            <a href="profile.html" class="header__btn" style="text-decoration: none;">Личный кабинет</a>
        `;
    } else {
        authContainer.innerHTML = `<a href="login.html" class="header__btn" style="text-decoration: none;">Войти</a>`;
    }
}

function initHeroConveyors() {
    const visual = document.getElementById('hero-visual');
    if (!visual) return;
    visual.innerHTML = ''; 
    const images = [];
    for (let i = 1; i <= 15; i++) images.push(`assets/images/cheese-${i}.jpg`);
    const baseCardSize = 300;
    const gap = 20;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const cardsPerRow = Math.ceil((screenWidth / (baseCardSize + gap)) * 2); 
    const rowsCount = Math.ceil(screenHeight / (baseCardSize + gap)) + 2;

    for (let r = 0; r < rowsCount; r++) {
        const row = document.createElement('div');
        row.className = 'hero__visual-row';
        if (r % 2 !== 0) row.style.animationDirection = 'reverse';
        row.style.animationDuration = `${150 + Math.random() * 100}s`;
        for (let c = 0; c < cardsPerRow; c++) {
            const item = document.createElement('div');
            item.className = 'hero__visual-item';
            item.style.backgroundImage = `url('${images[Math.floor(Math.random() * images.length)]}')`;
            const scale = 0.8 + Math.random() * 0.4; 
            const randomHeight = 250 + Math.random() * 150; 
            item.style.width = `${baseCardSize * scale}px`;
            item.style.height = `${randomHeight}px`;
            item.style.transform = `translateY(${(Math.random() - 0.5) * 60}px)`;
            row.appendChild(item);
        }
        visual.appendChild(row);
    }
}

let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (document.getElementById('hero-visual')) initHeroConveyors();
    }, 500);
});

document.addEventListener('DOMContentLoaded', () => {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('active'); });
    }, { threshold: 0.15 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    initHeroConveyors();
    updateAuthUI();
});

const chatBtn = document.getElementById('chat-send');
const chatInput = document.getElementById('chat-input');
const messagesContainer = document.getElementById('chat-messages');
const stickersBtn = document.getElementById('stickers-btn');
const stickersPanel = document.getElementById('stickers-panel');

let isBotBusy = false;
let messageQueue = [];

if (stickersPanel) {
    STICKER_CODES.forEach((code, index) => {
        const stickerDiv = document.createElement('div');
        stickerDiv.className = 'sticker-item';
        stickerDiv.style.backgroundImage = `url('${STICKER_IMG_PATH}')`;
        stickerDiv.style.backgroundSize = STICKER_BG_SIZE;
        stickerDiv.style.backgroundPosition = `${(index % 3) * 50}% ${Math.floor(index / 3) * 33.33}%`;
        stickerDiv.addEventListener('click', () => {
            sendSticker(code, 'user');
            stickersPanel.classList.remove('active');
        });
        stickersPanel.appendChild(stickerDiv);
    });
}

if (stickersBtn) stickersBtn.addEventListener('click', () => stickersPanel.classList.toggle('active'));

function addMessage(text, sender, isSticker = false) {
    if (!messagesContainer) return;
    const wrapper = document.createElement('div');
    wrapper.className = `msg-wrapper ${sender}`;
    let content = '';
    if (isSticker) {
        const index = STICKER_CODES.indexOf(text);
        content = `<div class="msg-sticker" style="background-image: url('${STICKER_IMG_PATH}'); background-size: ${STICKER_BG_SIZE}; background-position: ${(index % 3) * 50}% ${Math.floor(index / 3) * 33.33}%;"></div>`;
    } else {
        content = (sender === 'bot') ? marked.parse(text) : text;
    }
    wrapper.innerHTML = `<div class="msg">${content}</div><div class="msg-meta"><span>${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span></div>`;
    messagesContainer.appendChild(wrapper);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    saveHistory();
}

function saveHistory() {
    if (!messagesContainer) return;
    const msgs = Array.from(messagesContainer.children).map(w => ({ html: w.innerHTML, className: w.className }));
    localStorage.setItem('dr_brezel_history', JSON.stringify(msgs));
}

function loadHistory() {
    if (!messagesContainer) return;
    const saved = localStorage.getItem('dr_brezel_history');
    if (saved) {
        messagesContainer.innerHTML = '';
        JSON.parse(saved).forEach(m => {
            const div = document.createElement('div');
            div.className = m.className;
            div.innerHTML = m.html;
            messagesContainer.appendChild(div);
        });
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}
loadHistory();

function sendSticker(code, sender) {
    if (isBotBusy) return;
    addMessage(code, sender, true);
    if (sender === 'user') {
        messageQueue.push({ text: `Я отправил стикер ${code}`, isSticker: true });
        processQueue();
    }
}

// --- ФУНКЦИЯ ПЕЧАТНОЙ МАШИНКИ ---
function typeWriter(element, text, speed = 20) {
    element.innerHTML = '';
    const html = marked.parse(text);
    let i = 0;
    
    return setInterval(() => {
        if (i >= html.length) {
            clearInterval(typingInterval);
            element.innerHTML = html; // Вставляем окончательный вариант
            return;
        }
        // Обрезаем и парсим, чтобы браузер не ломался на незакрытых тегах
        element.innerHTML = html.substring(0, i) + '█';
        i += 3; // Скорость (3 символа за тик)
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, speed);
}

async function getBotResponse(text) {
    const typingId = 'typing-' + Date.now();
    const typingWrapper = document.createElement('div');
    typingWrapper.className = 'msg-wrapper bot';
    typingWrapper.id = typingId;
    
    typingWrapper.innerHTML = `<div class="msg" style="display: flex; align-items: center; gap: 8px; padding: 12px 20px;"><span style="color: #aaa; font-size: 14px;">Доктор Брезель печатает</span><span class="typing-dots"><span>.</span><span>.</span><span>.</span></span></div>`;
    messagesContainer.appendChild(typingWrapper);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    chatInput.disabled = true;
    chatBtn.innerHTML = '⏹';
    chatBtn.style.color = '#F44336';

    const history = Array.from(messagesContainer.querySelectorAll('.msg-wrapper'))
        .slice(-4)
        .map(w => ({ sender: w.classList.contains('user') ? 'user' : 'bot', text: w.querySelector('.msg')?.innerText || '' }));

    currentAbortController = new AbortController();

    try {
        const chatResponse = await fetch('https://drbrezel-site-main.layero.app/api/gigachat', {
            method: 'POST',
            body: JSON.stringify({ message: text, sessionId: sessionId, history: history }),
            signal: currentAbortController.signal
        });

        const chatData = await chatResponse.json();
        const reply = chatData.reply || 'Доктор задумался.';
        
        document.getElementById(typingId)?.remove();

        // Создаем финальное сообщение
        const finalMsgWrapper = document.createElement('div');
        finalMsgWrapper.className = 'msg-wrapper bot';
        finalMsgWrapper.innerHTML = `<div class="msg"></div><div class="msg-meta"><span>${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span></div>`;
        messagesContainer.appendChild(finalMsgWrapper);
        
        const msgElement = finalMsgWrapper.querySelector('.msg');
        
        // Ищем стикеры
        const foundStickers = STICKER_CODES.filter(code => reply.includes(code));
        let textReply = reply;
        foundStickers.forEach(code => { textReply = textReply.replace(code, '').trim(); });

        // Запускаем печать
        if (textReply) {
            typingInterval = typeWriter(msgElement, textReply, 15);
        }

        foundStickers.forEach(code => { setTimeout(() => addMessage(code, 'bot', true), 500); });
        saveHistory();

    } catch (error) {
        document.getElementById(typingId)?.remove();
        if (error.name === 'AbortError') {
            addMessage('Вы остановили ответ Доктора.', 'bot');
        } else {
            addMessage('Ошибка связи.', 'bot');
        }
    } finally {
        chatInput.disabled = false;
        chatBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
        chatBtn.style.color = 'var(--accent)';
        currentAbortController = null;
    }
}

async function processQueue() {
    if (isBotBusy || messageQueue.length === 0) return;
    isBotBusy = true;
    const msg = messageQueue.shift();
    await getBotResponse(msg.text);
    isBotBusy = false;
    processQueue();
}

async function sendMessage() {
    const text = chatInput.value.trim();
    
    // Если бот печатает или ждет — останавливаем
    if (currentAbortController) {
        currentAbortController.abort();
        if (typingInterval) clearInterval(typingInterval);
        return;
    }

    if (!text) return;
    chatInput.value = '';
    addMessage(text, 'user');
    messageQueue.push({ text });
    processQueue();
}

if (chatBtn && chatInput) {
    chatBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
}

document.getElementById('clear-chat-btn')?.addEventListener('click', () => {
    if(confirm('Очистить историю чата?')) {
        localStorage.removeItem('dr_brezel_history');
        location.reload();
    }
});

// --- МЕНЕДЖЕР ---
document.addEventListener('DOMContentLoaded', async () => {
    const callHumanBtn = document.getElementById('call-human-btn');
    if (!callHumanBtn) return;

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        callHumanBtn.addEventListener('click', () => {
            addMessage("Чтобы связаться с менеджером, пожалуйста, войдите в аккаунт.", 'bot');
        });
        return;
    }

    callHumanBtn.addEventListener('click', async () => {
        const userQuestion = prompt("Опишите ваш вопрос, и менеджер ответит в течение 15 минут:");
        if (!userQuestion) return;

        addMessage(userQuestion, 'user');
        
        try {
            await fetch('https://drbrezel.ru/api/support', {
                method: 'POST',
                body: JSON.stringify({ message: userQuestion, sessionId: sessionId, userEmail: session.email })
            });
        } catch (e) {}

        addMessage("Секунду, я передаю ваш вопрос старшему менеджеру...", 'bot');
    });
});

// --- БУРГЕР ---
document.addEventListener('DOMContentLoaded', () => {
    const burgerBtn = document.getElementById('burger-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    if (burgerBtn && mobileMenu) {
        burgerBtn.addEventListener('click', () => {
            burgerBtn.classList.toggle('active');
            mobileMenu.classList.toggle('active');
        });
    }
});

// --- BREZEL'S GUARD: VPN DETECTOR ---
async function checkVPN() {
    try {
        // Если у тебя нет токена ipinfo, просто убери ?token=...
        const res = await fetch('https://ipinfo.io/json'); 
        const data = await res.json();
        
        const org = (data.org || '').toLowerCase();
        // Проверяем, похоже ли соединение на VPN или хостинг
        const isVpn = org.includes('vpn') || org.includes('proxy') || org.includes('hosting') || org.includes('cloud') || org.includes('amazon') || org.includes('digitalocean');
        
        if (isVpn) {
            showVpnWarning();
        }
    } catch (e) {
        console.log('Ошибка проверки VPN (пропускаем):', e);
    }
}

function showVpnWarning() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
        // Пульсирующая кнопка (Мобилка)
        const btn = document.createElement('div');
        btn.innerHTML = '🛡️';
        btn.style.cssText = `
            position: fixed; bottom: 20px; left: 20px; z-index: 99999;
            width: 50px; height: 50px; background: #FFA600; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: 24px; cursor: pointer; box-shadow: 0 0 0 0 rgba(255, 166, 0, 0.7);
            animation: pulseVpn 2s infinite;
        `;
        btn.onclick = () => {
            alert('Уважаемый пользователь! Для стабильной работы сайта, пожалуйста, отключите VPN. Некоторые мобильные операторы блокируют запросы.');
            btn.remove();
        };
        document.body.appendChild(btn);
    } else {
        // Полоса снизу (ПК)
        const bar = document.createElement('div');
        bar.style.cssText = `
            position: fixed; bottom: 0; left: 0; width: 100%;
            background: #FFA600; color: #000; text-align: center;
            padding: 12px; font-weight: 600; z-index: 99999;
            font-family: var(--font-body); font-size: 14px;
        `;
        bar.innerHTML = '⚠️ Похоже, вы используете VPN. Для корректной работы чата и корзины, пожалуйста, отключите его.';
        document.body.appendChild(bar);
    }
}

// Добавляем анимацию пульсации
const style = document.createElement('style');
style.innerHTML = `
    @keyframes pulseVpn {
        0% { box-shadow: 0 0 0 0 rgba(255, 166, 0, 0.7); }
        70% { box-shadow: 0 0 0 15px rgba(255, 166, 0, 0); }
        100% { box-shadow: 0 0 0 0 rgba(255, 166, 0, 0); }
    }
`;
document.head.appendChild(style);

setTimeout(checkVPN, 2000);
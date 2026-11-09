import { supabase } from './supabase-client.js';
import { addToCart } from './cart.js';

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

const products = [
    { id: '1', name: 'Классический сыр', category: 'cheese', price: 1200, weight: '500 г', desc: 'Полутвердый, с сливочным вкусом. Выдержка 6 месяцев.', tag: 'Хит' },
    { id: '2', name: 'Сыр Gourmet', category: 'cheese', price: 1800, weight: '500 г', desc: 'Насыщенный вкус, премиальная линейка. Выдержка 12 месяцев.', tag: 'New' },
    { id: '3', name: 'Брецель классический', category: 'brezel', price: 300, weight: '150 г', desc: 'Баварский, с хрустящей корочкой и крупной солью.', tag: null },
    { id: '4', name: 'Масло сыродавленное', category: 'butter', price: 900, weight: '250 мл', desc: 'Из отборных семян. Без нагрева и химии.', tag: null },
    { id: '5', name: 'Подарочный набор', category: 'set', price: 3500, weight: '1.5 кг', desc: '3 вида сыра + брецель. Идеальный подарок.', tag: 'Сет' },
    { id: '6', name: 'Сыр с пажитником', category: 'cheese', price: 1500, weight: '400 г', desc: 'Ореховый вкус, нежная текстура. Выдержка 8 месяцев.', tag: null },
];

const grid = document.getElementById('product-grid');
if (!grid) {
    console.error('Контейнер product-grid не найден');
} else {
    grid.innerHTML = products.map(product => `
        <div class="product-card" data-id="${product.id}">
            <div class="product-img">
                ${product.tag ? `<span class="product-tag">${product.tag}</span>` : ''}
                <div class="img-placeholder">Фото ${product.name}</div>
                <button class="add-to-cart-btn" data-id="${product.id}" data-name="${product.name}" data-price="${product.price}">В корзину</button>
            </div>
            <div class="product-info">
                <h3>${product.name}</h3>
                <p class="product-desc">${product.desc}</p>
                <div class="product-bottom">
                    <span class="product-price">${product.price} ₽</span>
                    <span class="product-weight">${product.weight}</span>
                </div>
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            addToCart({
                id: btn.dataset.id,
                name: btn.dataset.name,
                price: parseInt(btn.dataset.price)
            });
        });
    });

    document.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.add-to-cart-btn')) return;
            window.location.href = `product.html?id=${card.dataset.id}`;
        });
    });

    if (!REDUCED_MOTION) {
        const cards = document.querySelectorAll('.product-card');
        cards.forEach((card, i) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(30px)';
            card.style.transition = `opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${i * 60}ms, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${i * 60}ms`;
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                });
            });
        });
    }
}

window.addEventListener('load', updateAuthUI);
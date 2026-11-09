import { supabase } from './supabase-client.js';
import { addToCart } from './cart.js';

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

const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get('id') || '2';

const productData = {
    '1': { name: 'Классический сыр', price: 1200, desc: 'Полутвердый, с сливочным вкусом. Выдержка 6 месяцев.' },
    '2': { name: 'Сыр Gourmet', price: 1800, desc: 'Насыщенный вкус, премиальная линейка. Выдержка 12 месяцев.' },
    '3': { name: 'Брецель классический', price: 300, desc: 'Баварский, с хрустящей корочкой и крупной солью.' },
};

const product = productData[productId] || productData['2'];

document.getElementById('product-name').textContent = product.name;
document.getElementById('product-price').textContent = `${product.price} ₽`;
document.getElementById('product-desc').textContent = product.desc;

document.getElementById('add-to-cart-btn').addEventListener('click', () => {
    addToCart({
        id: productId,
        name: product.name,
        price: product.price
    });
});

document.getElementById('favorite-btn').addEventListener('click', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        alert('Войдите, чтобы добавить в избранное.');
        return;
    }
    const { error } = await supabase.from('favorites').insert([{
        user_id: session.user.id,
        product_id: productId,
        product_name: product.name,
        product_price: product.price
    }]);
    if (error) alert('Ошибка: ' + error.message);
    else alert('Добавлено в избранное!');
});

document.getElementById('share-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
        alert('Ссылка скопирована!');
    });
});

document.getElementById('review-form').addEventListener('submit', (e) => {
    e.preventDefault();
    alert('Отзыв отправлен (пока в разработке).');
    document.getElementById('review-text').value = '';
});

window.addEventListener('load', updateAuthUI);
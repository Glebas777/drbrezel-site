import { supabase } from './supabase-client.js';

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

let cartItems = [];
let discountPercent = 0;

async function loadCart() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    const { data, error } = await supabase
        .from('cart_items')
        .select('*')
        .eq('user_id', session.user.id);

    if (error) {
        console.error('Ошибка загрузки корзины:', error);
        return;
    }

    cartItems = data || [];
    renderCart();
}

function renderCart() {
    const container = document.getElementById('cart-items-container');
    
    if (cartItems.length === 0) {
        container.innerHTML = `<div class="empty-cart">Ваша корзина пуста. <a href="catalog.html" style="color: var(--accent);">Перейти в каталог</a></div>`;
        updateSummary();
        return;
    }

    container.innerHTML = cartItems.map(item => `
        <div class="cart-item" data-id="${item.id}">
            <div class="cart-item-img">Фото</div>
            <div class="cart-item-info">
                <h4>${item.product_name}</h4>
                <p>${item.product_price} ₽ / шт.</p>
            </div>
            <div class="cart-item-controls">
                <button class="qty-minus" data-id="${item.id}">−</button>
                <span>${item.quantity}</span>
                <button class="qty-plus" data-id="${item.id}">+</button>
            </div>
            <div class="cart-item-price">${item.product_price * item.quantity} ₽</div>
            <button class="cart-item-remove" data-id="${item.id}">×</button>
        </div>
    `).join('');

    document.querySelectorAll('.qty-minus').forEach(btn => {
        btn.addEventListener('click', () => changeQuantity(btn.dataset.id, -1));
    });
    document.querySelectorAll('.qty-plus').forEach(btn => {
        btn.addEventListener('click', () => changeQuantity(btn.dataset.id, 1));
    });
    document.querySelectorAll('.cart-item-remove').forEach(btn => {
        btn.addEventListener('click', () => removeItem(btn.dataset.id));
    });

    updateSummary();
}

async function changeQuantity(id, delta) {
    const item = cartItems.find(i => i.id == id);
    if (!item) return;

    const newQty = item.quantity + delta;
    if (newQty < 1) return;

    const { error } = await supabase
        .from('cart_items')
        .update({ quantity: newQty })
        .eq('id', id);

    if (!error) {
        item.quantity = newQty;
        renderCart();
    }
}

async function removeItem(id) {
    const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', id);

    if (!error) {
        cartItems = cartItems.filter(i => i.id != id);
        renderCart();
    }
}

function updateSummary() {
    const subtotal = cartItems.reduce((sum, item) => sum + (item.product_price * item.quantity), 0);
    const discount = subtotal * (discountPercent / 100);
    const total = subtotal - discount;

    document.getElementById('summary-subtotal').textContent = `${subtotal} ₽`;
    document.getElementById('summary-discount').textContent = `−${discount} ₽`;
    document.getElementById('summary-total').textContent = `${total} ₽`;
}

document.getElementById('apply-promo').addEventListener('click', async () => {
    const code = document.getElementById('promo-code').value.trim().toUpperCase();
    if (!code) return;

    const { data, error } = await supabase
        .from('promo_codes')
        .select('discount_percent')
        .eq('code', code)
        .eq('is_active', true)
        .single();

    if (error || !data) {
        alert('Промокод не найден или неактивен.');
        return;
    }

    discountPercent = data.discount_percent;
    alert(`Промокод применен! Скидка ${discountPercent}%`);
    updateSummary();
});

async function submitOrder() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    const subtotal = cartItems.reduce((sum, item) => sum + (item.product_price * item.quantity), 0);
    const discount = subtotal * (discountPercent / 100);
    const total = subtotal - discount;

    const { error: orderError } = await supabase.from('orders').insert([{
        user_id: session.user.id,
        items: cartItems.map(i => ({ name: i.product_name, price: i.product_price, qty: i.quantity })),
        total: total
    }]);

    if (orderError) {
        alert('Ошибка создания заказа: ' + orderError.message);
        return;
    }

    await supabase.from('cart_items').delete().eq('user_id', session.user.id);

    try {
        await fetch('http://localhost:3000/api/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                items: cartItems.map(i => ({ name: i.product_name, qty: i.quantity, price: i.product_price })),
                total: total,
                userName: session.user.user_metadata.full_name || 'Клиент'
            })
        });
    } catch (e) { console.log('Ошибка отправки в ТГ'); }

    alert('Заказ оформлен! Доктор Брезель уже начал собирать вашу посылку.');
    window.location.href = 'profile.html';
}

document.getElementById('checkout-btn').addEventListener('click', async () => {
    if (cartItems.length === 0) {
        alert('Корзина пуста.');
        return;
    }

    const ageModal = document.getElementById('age-modal');
    if (ageModal) {
        ageModal.style.display = 'flex';
        return;
    }

    const isAdult = confirm('Вам есть 18 лет?');
    if (!isAdult) {
        alert('Извините, продажа запрещена лицам младше 18 лет.');
        return;
    }

    await submitOrder();
});

document.addEventListener('DOMContentLoaded', () => {
    const ageModal = document.getElementById('age-modal');
    if (ageModal) {
        const buttons = ageModal.querySelectorAll('button');
        const yesBtn = buttons[0];
        const noBtn = buttons[1];
        if (yesBtn) {
            yesBtn.addEventListener('click', async () => {
                ageModal.style.display = 'none';
                await submitOrder();
            });
        }
        if (noBtn) {
            noBtn.addEventListener('click', () => {
                window.location.href = 'https://www.google.com';
            });
        }
    }
});

window.addEventListener('load', updateAuthUI);
loadCart();
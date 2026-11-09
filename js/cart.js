import { supabase } from './supabase-client.js';

// Добавить товар в корзину
export async function addToCart(product) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        alert('Войдите в аккаунт, чтобы добавить товар в корзину.');
        window.location.href = 'login.html';
        return;
    }

    const { error } = await supabase.from('cart_items').insert([{
        user_id: session.user.id,
        product_id: product.id,
        product_name: product.name,
        product_price: product.price,
        quantity: 1
    }]);

    if (error) alert('Ошибка: ' + error.message);
    else {
        alert('Товар добавлен в корзину!');
        updateCartCount();
    }
}

// Обновить счетчик корзины в хедере
export async function updateCartCount() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
        .from('cart_items')
        .select('quantity')
        .eq('user_id', session.user.id);

    if (!error && data) {
        const count = data.reduce((sum, item) => sum + item.quantity, 0);
        const cartBtn = document.getElementById('cart-btn');
        if (cartBtn) cartBtn.textContent = `Корзина (${count})`;
    }
}
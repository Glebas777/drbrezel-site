import { supabase } from './supabase-client.js';
import { checkPasswordStrength, checkPasswordPwned } from './password-checker.js';

let currentUser = null;

async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = 'login.html'; return null; }
    currentUser = session.user;
    return currentUser;
}

async function loadProfile() {
    const user = await checkSession();
    if (!user) return;

    const name = user.user_metadata.full_name || user.user_metadata.name || 'Гость';
    document.getElementById('user-name').textContent = name;
    document.getElementById('user-email').textContent = user.email;
    document.getElementById('settings-name').value = name;

    const { data: orders } = await supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    const ordersList = document.getElementById('orders-list');
    if (!orders || orders.length === 0) {
        ordersList.innerHTML = '<div class="empty-state">У вас пока нет заказов.</div>';
    } else {
        ordersList.innerHTML = orders.map(order => `
            <div class="order-card">
                <div class="order-header"><span>Заказ #${order.id.split('-')[0]}</span><span class="order-status">${order.status || 'В обработке'}</span></div>
                <div class="order-items">${JSON.stringify(order.items)}</div>
                <div style="margin-top:10px; font-weight:600; color:var(--accent);">Итого: ${order.total} ₽</div>
            </div>
        `).join('');
    }

    const presentationToggle = document.getElementById('presentation-toggle');
    if (presentationToggle) {
        presentationToggle.checked = localStorage.getItem('presentation_mode') !== 'false';
        presentationToggle.addEventListener('change', (e) => {
            localStorage.setItem('presentation_mode', e.target.checked ? 'true' : 'false');
        });
    }

    const { data: favorites } = await supabase.from('favorites').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    const favList = document.getElementById('fav-list');
    if (!favorites || favorites.length === 0) {
        favList.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">Вы еще ничего не добавили в избранное.</div>';
    } else {
        favList.innerHTML = favorites.map(fav => `
            <div class="fav-card">
                <button class="fav-remove" data-id="${fav.id}" title="Удалить">×</button>
                <h4>${fav.product_name}</h4>
                <p>${fav.product_price} ₽</p>
            </div>
        `).join('');
        document.querySelectorAll('.fav-remove').forEach(btn => {
            btn.addEventListener('click', async () => {
                await supabase.from('favorites').delete().eq('id', btn.dataset.id);
                loadProfile();
            });
        });
    }

    await updateGuardUI();
}

loadProfile();

document.getElementById('link-tg-btn')?.addEventListener('click', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch('https://drbrezel-api.turgleb7.workers.dev/api/link-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: session.user.id })
    });
    const data = await res.json();

    if (data.code) {
        const tgLink = `https://t.me/${data.botUsername}?start=${data.code}`;
        alert(`Ваш код: ${data.code}\n\nПерейдите в бота и нажмите Start:\n${tgLink}`);
        window.open(tgLink, '_blank');
    } else {
        alert('Ошибка генерации кода.');
    }
});

// Вкладки
document.querySelectorAll('.profile-nav-btn').forEach(tab => {
    tab.addEventListener('click', async () => {
        if (tab.dataset.tab === 'logout') {
            await supabase.auth.signOut();
            window.location.href = 'index.html';
            return;
        }
        document.querySelectorAll('.profile-nav-btn').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.profile-tab').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    });
});

document.getElementById('settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newName = document.getElementById('settings-name').value;
    const { error } = await supabase.auth.updateUser({ data: { full_name: newName } });
    if (error) alert('Ошибка: ' + error.message);
    else { alert('Имя обновлено!'); document.getElementById('user-name').textContent = newName; }
});

document.getElementById('password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPass = document.getElementById('new-password').value;
    const strength = checkPasswordStrength(newPass);
    if (!strength.isValid) return alert('Пароль слишком легкий: ' + strength.errors.join(', '));
    
    const pwned = await checkPasswordPwned(newPass);
    if (pwned.pwned) return alert(`Этот пароль уже слит в базу (${pwned.count} раз). Придумай другой.`);

    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) alert('Ошибка: ' + error.message);
    else alert('Пароль успешно изменен!');
});

// --- BREZEL'S GUARD 2.0 ---

async function updateGuardUI() {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) return;

    const btn = document.getElementById('enable-2fa-btn');
    const sosSection = document.getElementById('sos-section');
    if (!btn) return;

    if (data.currentLevel === 'aal2' || data.nextLevel === 'aal2') {
        btn.textContent = 'Включено';
        btn.style.background = '#4CAF50';
        btn.style.color = '#fff';
        btn.disabled = true;
        if (sosSection) sosSection.style.display = 'block';
    } else {
        btn.textContent = 'Включить';
        btn.disabled = false;
        if (sosSection) sosSection.style.display = 'none';
    }
}

document.getElementById('enable-2fa-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('enable-2fa-btn');
    if (btn.disabled) return;

    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    if (error) return alert('Ошибка Supabase (включи TOTP в дашборде): ' + error.message);

    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);';
    modal.innerHTML = `
        <div style="background:#151515;padding:30px;border-radius:24px;text-align:center;max-width:420px;width:90%;border:1px solid #333;box-shadow:0 20px 50px rgba(0,0,0,0.5);">
            <h3 style="margin-bottom:10px;font-family:var(--font-heading);font-size:24px;">Brezel's Guard</h3>
            <p style="color:#aaa;font-size:14px;margin-bottom:20px;">Сканируйте QR в приложении или введите текстовый ключ:</p>
            <div style="background:#fff;padding:10px;border-radius:12px;display:inline-block;margin-bottom:10px;">
                <img src="${data.totp.qr_code}" alt="QR Code" style="width:180px;height:180px;">
            </div>
            <div style="background:#222;padding:10px;border-radius:8px;margin-bottom:20px;font-family:monospace;font-size:14px;color:var(--accent);letter-spacing:1px;word-break:break-all;">
                ${data.totp.secret}
            </div>
            <input type="text" id="totp-code" placeholder="Введите 6 цифр" maxlength="6" style="width:100%;padding:14px;border-radius:12px;border:1px solid #333;background:#0A0A0A;color:#fff;text-align:center;font-size:24px;letter-spacing:8px;margin-bottom:15px;outline:none;">
            <button id="verify-totp" style="width:100%;padding:14px;border-radius:12px;background:var(--accent);color:#000;border:none;font-weight:bold;font-size:16px;cursor:pointer;margin-bottom:10px;">Подтвердить</button>
            <button id="close-totp" style="width:100%;padding:14px;border-radius:12px;background:transparent;color:#888;border:none;cursor:pointer;">Отмена</button>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('close-totp').onclick = () => {
        modal.remove();
        supabase.auth.mfa.unenroll({ factorId: data.id });
    };

    document.getElementById('verify-totp').onclick = async () => {
        const code = document.getElementById('totp-code').value;
        if (code.length !== 6) return alert('Введите 6 цифр');

        const verifyBtn = document.getElementById('verify-totp');
        verifyBtn.textContent = 'Проверка...';

        const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: data.id, code: code });

        if (verifyError) {
            alert('Неверный код: ' + verifyError.message);
            verifyBtn.textContent = 'Подтвердить';
        } else {
            modal.remove();
            alert('🛡️ Brezel\'s Guard активирован!');
            updateGuardUI();
        }
    };
});

// Кнопка SOS (Меня взломали)
document.getElementById('sos-btn')?.addEventListener('click', async () => {
    const confirmSos = confirm("Вы уверены? Мы выкинем вас со всех устройств и потребуем сбросить пароль.");
    if (!confirmSos) return;

    try {
        await fetch('https://drbrezel-api.turgleb7.workers.dev/api/guard-help', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: "Нажата кнопка SOS", 
                userId: currentUser.id, 
                userEmail: currentUser.email 
            })
        });
        
        alert("Сигнал отправлен. Сейчас вас выкинет из всех сессий. Проверьте почту для сброса пароля.");
        await supabase.auth.signOut();
        window.location.href = 'login.html';

    } catch (e) {
        alert("Ошибка соединения с сервером безопасности.");
    }
});

// Удаление аккаунта (3 подтверждения)
document.getElementById('delete-account-btn')?.addEventListener('click', async () => {
    const confirm1 = confirm("Вы уверены, что хотите удалить аккаунт? Вы потеряете все заказы и избранное.");
    if (!confirm1) return;
    
    const confirm2 = confirm("Вы точно уверены? Это действие НЕВОЗМОЖНО отменить.");
    if (!confirm2) return;
    
    const confirm3 = prompt("Введите слово 'УДАЛИТЬ' заглавными буквами, чтобы подтвердить.");
    if (confirm3 !== 'УДАЛИТЬ') return alert('Удаление отменено.');

    const { error } = await supabase.rpc('delete_user'); 
    if (error) {
        alert('Ошибка удаления: ' + error.message + '\n(Убедитесь, что функция delete_user создана в Supabase)');
    } else {
        await supabase.auth.signOut();
        alert('Аккаунт удален.');
        window.location.href = 'index.html';
    }
});
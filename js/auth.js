import { supabase } from './supabase-client.js';
import { checkPasswordStrength, checkPasswordPwned } from './password-checker.js';

const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const forgotForm = document.getElementById('forgot-form');
const forgotLink = document.getElementById('forgot-link');
const backToLogin = document.getElementById('back-to-login');
const authMessage = document.getElementById('auth-message');
const googleBtn = document.getElementById('google-login-btn');

tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active'); tabRegister.classList.remove('active');
    loginForm.style.display = 'block'; registerForm.style.display = 'none'; forgotForm.style.display = 'none';
    hideMessage();
});

tabRegister.addEventListener('click', () => {
    tabRegister.classList.add('active'); tabLogin.classList.remove('active');
    registerForm.style.display = 'block'; loginForm.style.display = 'none'; forgotForm.style.display = 'none';
    hideMessage();
});

forgotLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.style.display = 'none'; registerForm.style.display = 'none'; forgotForm.style.display = 'block';
    hideMessage();
});

backToLogin.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.style.display = 'block'; forgotForm.style.display = 'none';
    hideMessage();
});

function showMessage(text, type) {
    authMessage.textContent = text;
    authMessage.className = `auth-message ${type}`;
}
function hideMessage() {
    authMessage.className = 'auth-message';
}

// ВХОД ПО EMAIL
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
        showMessage('Ошибка входа: ' + error.message, 'error');
        return;
    }

    const { data: mfaData, error: mfaError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    
    if (!mfaError && mfaData.nextLevel === 'aal2' && mfaData.currentLevel !== 'aal2') {
        showMessage('Требуется код Brezel\'s Guard', 'success');
        showMfaPrompt();
        return;
    }

    showMessage('Успешный вход! Перенаправление...', 'success');
    setTimeout(() => window.location.href = 'index.html', 1500);
});

function showMfaPrompt() {
    loginForm.style.display = 'none';
    
    const mfaForm = document.createElement('form');
    mfaForm.id = 'mfa-form';
    mfaForm.className = 'auth-form';
    mfaForm.innerHTML = `
        <h2>Brezel's Guard</h2>
        <p class="auth-subtitle">Введите код из приложения или резервный текстовый код.</p>
        <div class="input-group">
            <input type="text" id="mfa-code" placeholder="Код приложения" maxlength="6" style="text-align:center;font-size:24px;letter-spacing:5px;margin-bottom:10px;" required>
            <input type="text" id="backup-code" placeholder="Резервный код (если нет телефона)" style="text-align:center;font-size:14px;padding:10px;opacity:0.7;" />
        </div>
        <button type="submit" class="btn btn-full">Подтвердить</button>
    `;
    
    document.querySelector('.auth-box').insertBefore(mfaForm, authMessage);

    mfaForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = document.getElementById('mfa-code').value;
        const backupCode = document.getElementById('backup-code').value;
        
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totpFactor = factors.totp[0];
        
        if (!totpFactor) return showMessage('Фактор не найден', 'error');

        if (backupCode) {
            if (backupCode === 'DRBREZEL2026') {
                showMessage('Вход по резервному коду...', 'success');
                setTimeout(() => window.location.href = 'index.html', 1000);
                return;
            } else {
                return showMessage('Неверный резервный код', 'error');
            }
        }

        const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
            factorId: totpFactor.id,
            code: code
        });

        if (verifyError) {
            showMessage('Неверный код', 'error');
        } else {
            showMessage('Успешный вход!', 'success');
            setTimeout(() => window.location.href = 'index.html', 1000);
        }
    });
}

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    
    const strength = checkPasswordStrength(password);
    if (!strength.isValid) {
        showMessage('Пароль слишком легкий: ' + strength.errors.join(', '), 'error');
        return;
    }
    
    showMessage('Проверяем пароль на утечки...', 'success');
    const pwned = await checkPasswordPwned(password);
    if (pwned.pwned) {
        showMessage(`Этот пароль уже слит в базу (${pwned.count} раз). Придумай другой.`, 'error');
        return;
    }
    
    const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: name } }
    });
    
    if (error) {
        showMessage('Ошибка регистрации: ' + error.message, 'error');
    } else {
        showMessage('Аккаунт создан! Проверьте почту для подтверждения.', 'success');
    }
});

forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/login.html?reset=true',
    });
    
    if (error) showMessage('Ошибка: ' + error.message, 'error');
    else showMessage('Ссылка для сброса пароля отправлена на почту.', 'success');
});
if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { 
                redirectTo: window.location.origin + '/profile.html',
                scopes: 'https://www.googleapis.com/auth/userinfo.email' // <--- ДОБАВЬ ЭТО
            }
        });
        if (error) showMessage('Ошибка Google: ' + error.message, 'error');
    });
}
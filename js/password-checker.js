// js/password-checker.js

// Проверка на легкость
export function checkPasswordStrength(password) {
    const errors = [];
    if (password.length < 8) errors.push('Минимум 8 символов');
    if (!/[A-Z]/.test(password)) errors.push('Хотя бы одна заглавная буква');
    if (!/[a-z]/.test(password)) errors.push('Хотя бы одна строчная буква');
    if (!/[0-9]/.test(password)) errors.push('Хотя бы одна цифра');
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// Проверка на слитость через HaveIBeenPwned (k-anonymity)
export async function checkPasswordPwned(password) {
    try {
        // 1. Хешируем пароль локально (SHA-1)
        const msgBuffer = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
        
        // 2. Берем первые 5 символов и остаток
        const prefix = hashHex.substring(0, 5);
        const suffix = hashHex.substring(5);
        
        // 3. Отправляем только префикс (5 символов) в API
        const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
        const text = await response.text();
        
        // 4. Ищем наш суффикс в ответе (локально)
        const lines = text.split('\n');
        for (const line of lines) {
            const [lineSuffix, count] = line.split(':');
            if (lineSuffix === suffix) {
                return { pwned: true, count: parseInt(count) };
            }
        }
        
        return { pwned: false, count: 0 };
    } catch (e) {
        console.error('Ошибка проверки HIBP:', e);
        // Если API недоступен, пропускаем проверку (чтобы не блокировать регистрацию)
        return { pwned: false, count: 0, error: true };
    }
}
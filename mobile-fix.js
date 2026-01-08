// mobile-fix.js - Исправление для мобильных устройств
console.log('📱 Mobile Fix загружен');

// Ждём полной загрузки страницы
window.addEventListener('load', function() {
    console.log('✅ Страница полностью загружена');
    
    // Ждём ещё немного для гарантии
    setTimeout(initMobileApp, 500);
});

function initMobileApp() {
    console.log('🔧 Инициализация мобильного приложения');
    
    // 1. Проверяем загрузку Supabase
    if (!window.supabase) {
        console.error('❌ Supabase не загружен, загружаем заново...');
        loadSupabase();
        return;
    }
    
    // 2. Создаём обработчики для кнопок
    setupMobileButtons();
    
    // 3. Тестовая кнопка
    addTestButton();
}

function loadSupabase() {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.onload = function() {
        console.log('✅ Supabase загружен повторно');
        initSupabase();
    };
    document.head.appendChild(script);
}

function initSupabase() {
    // Инициализируем Supabase с вашими ключами
    window.supabaseClient = window.supabase.createClient(
        "https://zdmtwnvaksdbvutrpcnr.supabase.co",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkbXR3bnZha3NkYnZ1dHJwY25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1Mjg4NjcsImV4cCI6MjA4MzEwNDg2N30.QztruYbzPeF8CrZmT_FhMw6VHc1-289qqJ8Qs4Z7nVc"
    );
    
    setupMobileButtons();
}

function setupMobileButtons() {
    console.log('🔄 Настройка мобильных кнопок');
    
    // Кнопка "Получить код" - ПРЯМОЙ ОБРАБОТЧИК
    const sendEmailBtn = document.getElementById('send-email-btn');
    if (sendEmailBtn) {
        // Удаляем старые обработчики
        sendEmailBtn.replaceWith(sendEmailBtn.cloneNode(true));
        const newSendBtn = document.getElementById('send-email-btn');
        
        newSendBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('📱 Кнопка "Получить код" нажата на мобильном');
            mobileSendEmailOTP();
        });
        
        // Добавляем стиль для мобильных
        newSendBtn.style.touchAction = 'manipulation';
        newSendBtn.style.userSelect = 'none';
        console.log('✅ Кнопка "Получить код" настроена');
    }
    
    // Кнопка "Google" - ПРЯМОЙ ОБРАБОТЧИК
    const googleBtn = document.getElementById('google-auth-btn');
    if (googleBtn) {
        googleBtn.replaceWith(googleBtn.cloneNode(true));
        const newGoogleBtn = document.getElementById('google-auth-btn');
        
        newGoogleBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('📱 Кнопка "Google" нажата на мобильном');
            mobileGoogleAuth();
        });
        
        newGoogleBtn.style.touchAction = 'manipulation';
        console.log('✅ Кнопка "Google" настроена');
    }
    
    // Кнопка "Подтвердить"
    const verifyBtn = document.getElementById('verify-otp-btn');
    if (verifyBtn) {
        verifyBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('📱 Кнопка "Подтвердить" нажата');
            mobileVerifyOTP();
        });
    }
    
    // Поля ввода
    const emailInput = document.getElementById('email-input');
    if (emailInput) {
        emailInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                mobileSendEmailOTP();
            }
        });
    }
}

// Мобильная функция отправки OTP
async function mobileSendEmailOTP() {
    const email = document.getElementById('email-input').value.trim();
    
    if (!email || !email.includes('@')) {
        alert('📱 Введите корректный email');
        return;
    }
    
    try {
        // Показываем загрузку
        const btn = document.getElementById('send-email-btn');
        const originalText = btn.textContent;
        btn.textContent = 'Отправка...';
        btn.disabled = true;
        
        console.log('📱 Мобильная отправка OTP на:', email);
        
        // Используем Supabase
        const supabase = window.supabaseClient || window.supabase?.createClient(
            "https://zdmtwnvaksdbvutrpcnr.supabase.co",
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkbXR3bnZha3NkYnZ1dHJwY25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1Mjg4NjcsImV4cCI6MjA4MzEwNDg2N30.QztruYbzPeF8CrZmT_FhMw6VHc1-289qqJ8Qs4Z7nVc"
        );
        
        const { error } = await supabase.auth.signInWithOtp({
            email: email,
            options: {
                shouldCreateUser: true,
                emailRedirectTo: 'https://absgram.onrender.com'
            }
        });
        
        if (error) throw error;
        
        // Показываем поле OTP
        document.querySelector('.otp-group').classList.remove('hidden');
        document.getElementById('otp-input').focus();
        
        alert('✅ Код отправлен! Проверьте email на телефоне.');
        
    } catch (error) {
        console.error('📱 Ошибка:', error);
        alert('❌ Ошибка: ' + error.message);
    } finally {
        // Восстанавливаем кнопку
        const btn = document.getElementById('send-email-btn');
        if (btn) {
            btn.textContent = 'Получить код';
            btn.disabled = false;
        }
    }
}

// Мобильная Google авторизация
async function mobileGoogleAuth() {
    try {
        console.log('📱 Мобильная Google авторизация');
        
        const supabase = window.supabaseClient || window.supabase?.createClient(
            "https://zdmtwnvaksdbvutrpcnr.supabase.co",
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkbXR3bnZha3NkYnZ1dHJwY25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1Mjg4NjcsImV4cCI6MjA4MzEwNDg2N30.QztruYbzPeF8CrZmT_FhMw6VHc1-289qqJ8Qs4Z7nVc"
        );
        
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: 'https://absgram.onrender.com'
            }
        });
        
        if (error) throw error;
        
    } catch (error) {
        console.error('📱 Google ошибка:', error);
        alert('❌ Ошибка Google: ' + error.message);
    }
}

// Мобильная верификация OTP
async function mobileVerifyOTP() {
    const email = document.getElementById('email-input').value.trim();
    const token = document.getElementById('otp-input').value.trim();
    
    if (!token || token.length !== 6) {
        alert('📱 Введите 6-значный код');
        return;
    }
    
    try {
        const supabase = window.supabaseClient || window.supabase?.createClient(
            "https://zdmtwnvaksdbvutrpcnr.supabase.co",
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXAhYmFzZSIsInJlZiI6InpkbXR3bnZha3NkYnZ1dHJwY25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1Mjg4NjcsImV4cCI6MjA4MzEwNDg2N30.QztruYbzPeF8CrZmT_FhMw6VHc1-289qqJ8Qs4Z7nVc"
        );
        
        const { data, error } = await supabase.auth.verifyOtp({
            email: email,
            token: token,
            type: 'email'
        });
        
        if (error) throw error;
        
        alert('✅ Успешный вход!');
        // Переключаем на главный экран
        mobileShowScreen('app');
        
    } catch (error) {
        alert('❌ Неверный код или ошибка');
    }
}

// Мобильная маршрутизация
function mobileShowScreen(screenName) {
    console.log('📱 Переключение экрана:', screenName);
    
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
        screen.style.display = 'none';
    });
    
    const screen = document.getElementById(screenName);
    if (screen) {
        screen.style.display = 'flex';
        setTimeout(() => screen.classList.add('active'), 10);
    }
}

// Тестовая кнопка для отладки
function addTestButton() {
    const testBtn = document.createElement('button');
    testBtn.textContent = '📱 Тест';
    testBtn.style.position = 'fixed';
    testBtn.style.top = '10px';
    testBtn.style.left = '10px';
    testBtn.style.zIndex = '99999';
    testBtn.style.padding = '10px';
    testBtn.style.background = '#FF9800';
    testBtn.style.color = 'white';
    testBtn.style.border = 'none';
    testBtn.style.borderRadius = '10px';
    testBtn.style.fontSize = '14px';
    testBtn.style.touchAction = 'manipulation';
    
    testBtn.addEventListener('click', function() {
        console.log('=== МОБИЛЬНЫЙ ТЕСТ ===');
        console.log('Кнопки найдены:', {
            sendEmail: !!document.getElementById('send-email-btn'),
            google: !!document.getElementById('google-auth-btn'),
            verify: !!document.getElementById('verify-otp-btn')
        });
        
        alert('📱 Мобильный тест:\n' +
              '1. Кнопка "Получить код": ' + (document.getElementById('send-email-btn') ? '✅' : '❌') + '\n' +
              '2. Кнопка "Google": ' + (document.getElementById('google-auth-btn') ? '✅' : '❌') + '\n' +
              '3. Supabase: ' + (window.supabase ? '✅' : '❌'));
    });
    
    document.body.appendChild(testBtn);
}

// Экспортируем функции для глобального доступа
window.mobileSendEmailOTP = mobileSendEmailOTP;
window.mobileGoogleAuth = mobileGoogleAuth;
window.mobileVerifyOTP = mobileVerifyOTP;
window.mobileShowScreen = mobileShowScreen;

console.log('✅ Mobile Fix готов');

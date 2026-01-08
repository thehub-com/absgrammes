// app.js - Absgram Messenger

// ===== КОНФИГУРАЦИЯ =====
const CONFIG = {
    supabase: {
        url: "https://zdmtwnvaksdbvutrpcnr.supabase.co",
        anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkbXR3bnZha3NkYnZ1dHJwY25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1Mjg4NjcsImV4cCI6MjA4MzEwNDg2N30.QztruYbzPeF8CrZmT_FhMw6VHc1-289qqJ8Qs4Z7nVc"
    },
    app: {
        name: "Absgram",
        version: "1.0.0",
        colors: {
            primary: "#FF9800",
            primaryDark: "#F57C00",
            neon: "#FFAB00"
        }
    }
};

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let supabase = null;
let currentUser = null;
let currentChat = null;
let realtimeSubscription = null;
let pendingEmail = null;

// ===== DOM ЭЛЕМЕНТЫ =====
const elements = {
    // Экраны
    screens: {
        splash: document.getElementById('splash'),
        auth: document.getElementById('auth'),
        app: document.getElementById('app'),
        chatWindow: document.getElementById('chat-window')
    },
    
    // Авторизация
    auth: {
        emailInput: document.getElementById('email-input'),
        sendEmailBtn: document.getElementById('send-email-btn'),
        otpInput: document.getElementById('otp-input'),
        verifyOtpBtn: document.getElementById('verify-otp-btn'),
        googleBtn: document.getElementById('google-auth-btn'),
        otpGroup: document.querySelector('.otp-group')
    },
    
    // Главное приложение
    app: {
        userAvatar: document.getElementById('user-avatar'),
        username: document.getElementById('username'),
        userStatus: document.getElementById('user-status'),
        searchBtn: document.getElementById('search-btn'),
        searchPanel: document.getElementById('search-panel'),
        searchInput: document.getElementById('search-input'),
        clearSearchBtn: document.getElementById('clear-search-btn'),
        searchResults: document.getElementById('search-results'),
        newChatBtn: document.getElementById('new-chat-btn'),
        menuBtn: document.getElementById('menu-btn'),
        chatsList: document.getElementById('chats-list'),
        chatsCount: document.getElementById('chats-count'),
        onlineList: document.getElementById('online-list'),
        bottomNavBtns: document.querySelectorAll('.nav-btn')
    },
    
    // Чат
    chat: {
        backBtn: document.getElementById('chat-back-btn'),
        chatAvatar: document.getElementById('chat-avatar'),
        chatName: document.getElementById('chat-name'),
        chatStatus: document.getElementById('chat-status'),
        messagesContainer: document.getElementById('messages-container'),
        messageInput: document.getElementById('message-input'),
        sendBtn: document.getElementById('send-btn')
    },
    
    // Модальные окна
    modals: {
        editProfile: document.getElementById('edit-profile-modal'),
        editUsername: document.getElementById('edit-username'),
        editStatus: document.getElementById('edit-status'),
        usernameStatus: document.getElementById('username-status'),
        cancelEditBtn: document.getElementById('cancel-edit-btn'),
        saveProfileBtn: document.getElementById('save-profile-btn'),
        createGroup: document.getElementById('create-group-modal'),
        groupNameInput: document.getElementById('group-name-input'),
        cancelGroupBtn: document.getElementById('cancel-group-btn'),
        createGroupBtn: document.getElementById('create-group-btn')
    }
};

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Absgram инициализация...');
    
    try {
        // Инициализация Supabase
        supabase = window.supabase.createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey);
        console.log('✅ Supabase подключен');
        
        // Проверка авторизации
        await checkAuth();
        
        // Настройка обработчиков событий
        setupEventListeners();
        
    } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
        showError('Ошибка загрузки приложения');
    }
});

// ===== АВТОРИЗАЦИЯ =====
async function checkAuth() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) {
            console.error('Ошибка проверки пользователя:', error);
            showScreen('auth');
            return;
        }
        
        if (user) {
            currentUser = user;
            await initializeUser();
            showScreen('app');
        } else {
            showScreen('auth');
        }
    } catch (error) {
        console.error('Ошибка авторизации:', error);
        showScreen('auth');
    }
}

async function initializeUser() {
    if (!currentUser) return;
    
    // Создаем профиль если его нет
    await createOrUpdateProfile();
    
    // Обновляем UI
    updateUserUI();
    
    // Загружаем данные
    await Promise.all([
        loadChats(),
        loadOnlineUsers()
    ]);
    
    // Начинаем отслеживать онлайн статус
    startOnlineTracking();
}

async function createOrUpdateProfile() {
    try {
        // Проверяем существующий профиль
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', currentUser.id)
            .single();
        
        // Если профиля нет - создаем
        if (error || !profile) {
            const username = currentUser.email.split('@')[0];
            
            await supabase.from('profiles').insert({
                id: currentUser.id,
                email: currentUser.email,
                username: username,
                status: 'В сети',
                is_online: true,
                last_seen: new Date().toISOString(),
                created_at: new Date().toISOString()
            });
        } else {
            // Обновляем статус онлайн
            await supabase.from('profiles')
                .update({ 
                    is_online: true,
                    last_seen: new Date().toISOString()
                })
                .eq('id', currentUser.id);
        }
    } catch (error) {
        console.error('Ошибка профиля:', error);
    }
}

// ===== EMAIL OTP =====
async function sendEmailOTP() {
    const email = elements.auth.emailInput.value.trim();
    
    if (!email || !isValidEmail(email)) {
        showError('Введите корректный email');
        return;
    }
    
    try {
        // Сохраняем email для верификации
        pendingEmail = email;
        localStorage.setItem('pendingEmail', email);
        
        // Отправляем OTP
        const { error } = await supabase.auth.signInWithOtp({
            email: email,
            options: {
                shouldCreateUser: true,
                emailRedirectTo: window.location.origin
            }
        });
        
        if (error) throw error;
        
        // Показываем поле для кода
        elements.auth.otpGroup.classList.remove('hidden');
        elements.auth.otpInput.focus();
        
        showSuccess('✅ 6-значный код отправлен на email');
        
    } catch (error) {
        console.error('Ошибка OTP:', error);
        showError('Не удалось отправить код: ' + error.message);
    }
}

async function verifyEmailOTP() {
    const email = pendingEmail || localStorage.getItem('pendingEmail') || elements.auth.emailInput.value.trim();
    const token = elements.auth.otpInput.value.trim();
    
    if (!token || token.length !== 6) {
        showError('Введите 6-значный код');
        return;
    }
    
    try {
        const { data, error } = await supabase.auth.verifyOtp({
            email: email,
            token: token,
            type: 'email'
        });
        
        if (error) throw error;
        
        // Успешная авторизация
        currentUser = data.user;
        await initializeUser();
        showScreen('app');
        
        // Очищаем
        localStorage.removeItem('pendingEmail');
        pendingEmail = null;
        
        showSuccess('✅ Авторизация успешна!');
        
    } catch (error) {
        console.error('Ошибка верификации:', error);
        showError('Неверный код или истёк срок действия');
    }
}

async function signInWithGoogle() {
    try {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
        
        if (error) throw error;
    } catch (error) {
        console.error('Google OAuth error:', error);
        showError('Ошибка входа через Google');
    }
}

async function signOut() {
    try {
        // Обновляем статус офлайн
        if (currentUser) {
            await supabase.from('profiles')
                .update({ is_online: false })
                .eq('id', currentUser.id);
        }
        
        // Выход из Supabase
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        // Сброс состояния
        currentUser = null;
        currentChat = null;
        
        // Отписка от realtime
        if (realtimeSubscription) {
            supabase.removeChannel(realtimeSubscription);
            realtimeSubscription = null;
        }
        
        // Переход на экран авторизации
        showScreen('auth');
        
    } catch (error) {
        console.error('Ошибка выхода:', error);
    }
}

// ===== УПРАВЛЕНИЕ ЭКРАНАМИ =====
function showScreen(screenName) {
    // Скрыть все экраны
    Object.values(elements.screens).forEach(screen => {
        if (screen) {
            screen.classList.remove('active');
            screen.style.display = 'none';
        }
    });
    
    // Показать нужный экран
    const screen = elements.screens[screenName];
    if (screen) {
        screen.style.display = 'flex';
        setTimeout(() => screen.classList.add('active'), 10);
    }
}

function updateUserUI() {
    if (!currentUser) return;
    
    const email = currentUser.email || '';
    const username = email.split('@')[0] || 'User';
    const firstLetter = username[0].toUpperCase();
    
    // Обновляем аватар
    if (elements.app.userAvatar) {
        elements.app.userAvatar.textContent = firstLetter;
    }
    
    // Обновляем имя
    if (elements.app.username) {
        elements.app.username.textContent = username;
    }
    
    // Загружаем полные данные профиля
    loadUserProfile();
}

async function loadUserProfile() {
    if (!currentUser) return;
    
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('username, status')
            .eq('id', currentUser.id)
            .single();
        
        if (error) return;
        
        if (profile.username && elements.app.username) {
            elements.app.username.textContent = profile.username;
        }
        
        if (profile.status && elements.app.userStatus) {
            elements.app.userStatus.textContent = profile.status;
        }
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
    }
}

// ===== ПОИСК ПОЛЬЗОВАТЕЛЕЙ =====
async function searchUsers() {
    const searchTerm = elements.app.searchInput.value.trim();
    
    if (!searchTerm) {
        elements.app.searchResults.innerHTML = '';
        return;
    }
    
    try {
        const { data: users, error } = await supabase
            .from('profiles')
            .select('id, username, email, status, is_online')
            .or(`username.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
            .neq('id', currentUser.id)
            .limit(15);
        
        if (error) throw error;
        
        displaySearchResults(users || []);
        
    } catch (error) {
        console.error('Ошибка поиска:', error);
        showError('Ошибка поиска пользователей');
    }
}

function displaySearchResults(users) {
    const container = elements.app.searchResults;
    if (!container) return;
    
    if (users.length === 0) {
        container.innerHTML = `
            <div class="empty-state small">
                <p>Пользователи не найдены</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = users.map(user => {
        const username = user.username || user.email.split('@')[0];
        const avatarText = username[0].toUpperCase();
        const onlineClass = user.is_online ? 'online' : 'offline';
        
        return `
            <div class="chat-item" data-user-id="${user.id}">
                <div class="chat-avatar ${onlineClass}">${avatarText}</div>
                <div class="chat-info">
                    <h4>${username}</h4>
                    <p class="chat-preview">${user.email}</p>
                </div>
                <button class="start-chat-btn" onclick="startChatWithUser('${user.id}', '${username}')">
                    💬
                </button>
            </div>
        `;
    }).join('');
}

function toggleSearch(show) {
    if (show) {
        elements.app.searchPanel.classList.remove('hidden');
        elements.app.searchInput.focus();
    } else {
        elements.app.searchPanel.classList.add('hidden');
        elements.app.searchInput.value = '';
        elements.app.searchResults.innerHTML = '';
    }
}

// ===== ЧАТЫ =====
async function loadChats() {
    if (!currentUser) return;
    
    try {
        // Получаем чаты пользователя
        const { data: chatMembers, error } = await supabase
            .from('chat_members')
            .select(`
                chat_id,
                chats (*)
            `)
            .eq('user_id', currentUser.id)
            .order('joined_at', { ascending: false });
        
        if (error) throw error;
        
        displayChats(chatMembers || []);
        
        // Обновляем счетчик
        if (elements.app.chatsCount) {
            elements.app.chatsCount.textContent = chatMembers?.length || 0;
        }
        
    } catch (error) {
        console.error('Ошибка загрузки чатов:', error);
    }
}

function displayChats(chatMembers) {
    const container = elements.app.chatsList;
    if (!container) return;
    
    if (!chatMembers || chatMembers.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">💬</div>
                <p>Нет активных чатов</p>
                <p class="hint">Найдите пользователя чтобы начать общение</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = chatMembers.map(member => {
        const chat = member.chats;
        const lastMessage = chat.last_message || 'Нет сообщений';
        const lastTime = formatTime(chat.last_message_at);
        
        return `
            <div class="chat-item" onclick="openChat('${chat.id}', '${chat.type || 'personal'}')">
                <div class="chat-avatar">${chat.type === 'group' ? '👥' : '👤'}</div>
                <div class="chat-info">
                    <h4>${chat.name || 'Чат'}</h4>
                    <p class="chat-preview">${lastMessage}</p>
                </div>
                <div class="chat-time">${lastTime}</div>
            </div>
        `;
    }).join('');
}

async function startChatWithUser(userId, username) {
    if (!currentUser) return;
    
    try {
        // Проверяем существующий чат
        const { data: existingChat, error: checkError } = await supabase
            .from('chat_members')
            .select('chat_id')
            .in('user_id', [currentUser.id, userId])
            .groupBy('chat_id')
            .having('count(*)', 'eq', 2);
        
        let chatId;
        
        if (existingChat && existingChat.length > 0) {
            // Чат уже существует
            chatId = existingChat[0].chat_id;
        } else {
            // Создаем новый чат
            const { data: newChat, error: chatError } = await supabase
                .from('chats')
                .insert({
                    type: 'personal',
                    created_at: new Date().toISOString()
                })
                .select()
                .single();
            
            if (chatError) throw chatError;
            
            chatId = newChat.id;
            
            // Добавляем участников
            await supabase.from('chat_members').insert([
                { chat_id: chatId, user_id: currentUser.id },
                { chat_id: chatId, user_id: userId }
            ]);
        }
        
        // Открываем чат
        openChat(chatId, 'personal', username);
        
        // Скрываем поиск
        toggleSearch(false);
        
    } catch (error) {
        console.error('Ошибка создания чата:', error);
        showError('Не удалось начать чат');
    }
}

// ===== ОТКРЫТИЕ ЧАТА =====
async function openChat(chatId, type = 'personal', chatName = null) {
    currentChat = chatId;
    
    // Обновляем заголовок
    if (chatName) {
        elements.chat.chatName.textContent = chatName;
        elements.chat.chatAvatar.textContent = chatName[0].toUpperCase();
    }
    
    // Загружаем сообщения
    await loadMessages(chatId);
    
    // Настраиваем realtime подписку
    setupRealtime(chatId);
    
    // Показываем окно чата
    showScreen('chatWindow');
    elements.chat.messageInput.focus();
}

async function loadMessages(chatId, limit = 50) {
    try {
        const { data: messages, error } = await supabase
            .from('messages')
            .select('*')
            .eq('chat_id', chatId)
            .order('created_at', { ascending: true })
            .limit(limit);
        
        if (error) throw error;
        
        displayMessages(messages || []);
        
    } catch (error) {
        console.error('Ошибка загрузки сообщений:', error);
        showError('Не удалось загрузить сообщения');
    }
}

function displayMessages(messages) {
    const container = elements.chat.messagesContainer;
    if (!container) return;
    
    if (messages.length === 0) {
        container.innerHTML = `
            <div class="empty-chat">
                <p>Начните диалог!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = messages.map(msg => {
        const isSent = msg.sender_id === currentUser.id;
        const time = formatTime(msg.created_at);
        
        return `
            <div class="message ${isSent ? 'sent' : 'received'}">
                <div class="message-text">${escapeHtml(msg.content)}</div>
                <div class="message-meta">
                    <span class="message-time">${time}</span>
                    ${isSent ? `
                        <div class="message-actions">
                            <button class="edit-message-btn" onclick="editMessage('${msg.id}', '${escapeHtml(msg.content)}')">✏️</button>
                            <button class="delete-message-btn" onclick="deleteMessage('${msg.id}')">🗑️</button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    // Прокрутка вниз
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 100);
}

// ===== ОТПРАВКА СООБЩЕНИЙ =====
async function sendMessage() {
    if (!currentUser || !currentChat) return;
    
    const input = elements.chat.messageInput;
    const content = input.value.trim();
    
    if (!content) return;
    
    try {
        // Отправляем сообщение
        const { error } = await supabase.from('messages').insert({
            chat_id: currentChat,
            sender_id: currentUser.id,
            content: content,
            type: 'text',
            created_at: new Date().toISOString()
        });
        
        if (error) throw error;
        
        // Обновляем последнее сообщение в чате
        await supabase.from('chats').update({
            last_message: content.length > 30 ? content.substring(0, 27) + '...' : content,
            last_message_at: new Date().toISOString()
        }).eq('id', currentChat);
        
        // Очищаем поле ввода
        input.value = '';
        updateSendButton();
        
        // Перезагружаем чаты
        await loadChats();
        
        // Перезагружаем сообщения
        await loadMessages(currentChat);
        
    } catch (error) {
        console.error('Ошибка отправки:', error);
        showError('Не удалось отправить сообщение');
    }
}

async function editMessage(messageId, oldContent) {
    const newContent = prompt('Редактировать сообщение:', oldContent);
    
    if (!newContent || newContent.trim() === '' || newContent === oldContent) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('messages')
            .update({
                content: newContent.trim(),
                is_edited: true,
                updated_at: new Date().toISOString()
            })
            .eq('id', messageId)
            .eq('sender_id', currentUser.id);
        
        if (error) throw error;
        
        // Перезагружаем сообщения
        if (currentChat) {
            await loadMessages(currentChat);
        }
        
        showSuccess('Сообщение отредактировано');
        
    } catch (error) {
        console.error('Ошибка редактирования:', error);
        showError('Не удалось отредактировать');
    }
}

async function deleteMessage(messageId) {
    if (!confirm('Удалить это сообщение?')) return;
    
    try {
        const { error } = await supabase
            .from('messages')
            .update({
                content: '[Сообщение удалено]',
                is_deleted: true,
                deleted_at: new Date().toISOString()
            })
            .eq('id', messageId)
            .eq('sender_id', currentUser.id);
        
        if (error) throw error;
        
        // Перезагружаем сообщения
        if (currentChat) {
            await loadMessages(currentChat);
        }
        
        showSuccess('Сообщение удалено');
        
    } catch (error) {
        console.error('Ошибка удаления:', error);
        showError('Не удалось удалить сообщение');
    }
}

// ===== REALTIME ПОДПИСКА =====
function setupRealtime(chatId) {
    // Отписываемся от предыдущей подписки
    if (realtimeSubscription) {
        supabase.removeChannel(realtimeSubscription);
    }
    
    // Подписываемся на новые сообщения
    realtimeSubscription = supabase
        .channel(`chat:${chatId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `chat_id=eq.${chatId}`
            },
            async (payload) => {
                // Игнорируем свои сообщения
                if (payload.new.sender_id === currentUser.id) return;
                
                // Добавляем новое сообщение
                await addNewMessage(payload.new);
                
                // Обновляем список чатов
                await loadChats();
            }
        )
        .subscribe();
}

async function addNewMessage(message) {
    const container = elements.chat.messagesContainer;
    if (!container) return;
    
    // Убираем "пустой чат"
    const emptyChat = container.querySelector('.empty-chat');
    if (emptyChat) emptyChat.remove();
    
    const isSent = message.sender_id === currentUser.id;
    const time = formatTime(message.created_at);
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isSent ? 'sent' : 'received'}`;
    messageElement.innerHTML = `
        <div class="message-text">${escapeHtml(message.content)}</div>
        <div class="message-meta">
            <span class="message-time">${time}</span>
        </div>
    `;
    
    container.appendChild(messageElement);
    
    // Прокрутка вниз
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 100);
}

// ===== ОНЛАЙН ПОЛЬЗОВАТЕЛИ =====
async function loadOnlineUsers() {
    try {
        const { data: users, error } = await supabase
            .from('profiles')
            .select('id, username, status')
            .eq('is_online', true)
            .neq('id', currentUser.id)
            .limit(15);
        
        if (error) throw error;
        
        displayOnlineUsers(users || []);
        
    } catch (error) {
        console.error('Ошибка загрузки онлайн:', error);
    }
}

function displayOnlineUsers(users) {
    const container = elements.app.onlineList;
    if (!container) return;
    
    if (users.length === 0) {
        container.innerHTML = `
            <div class="empty-state small">
                <p>Никого нет онлайн</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = users.map(user => {
        const username = user.username || 'Пользователь';
        const avatarText = username[0].toUpperCase();
        
        return `
            <div class="chat-item" onclick="startChatWithUser('${user.id}', '${username}')">
                <div class="chat-avatar online">${avatarText}</div>
                <div class="chat-info">
                    <h4>${username}</h4>
                    <p class="chat-preview">${user.status || 'В сети'}</p>
                </div>
            </div>
        `;
    }).join('');
}

function startOnlineTracking() {
    // Обновляем статус каждые 30 секунд
    setInterval(async () => {
        if (currentUser) {
            await supabase.from('profiles')
                .update({ 
                    last_seen: new Date().toISOString(),
                    is_online: true 
                })
                .eq('id', currentUser.id);
            
            await loadOnlineUsers();
        }
    }, 30000);
    
    // Обновляем при скрытии/показании вкладки
    document.addEventListener('visibilitychange', async () => {
        if (document.hidden && currentUser) {
            await supabase.from('profiles')
                .update({ is_online: false })
                .eq('id', currentUser.id);
        } else if (currentUser) {
            await supabase.from('profiles')
                .update({ 
                    is_online: true,
                    last_seen: new Date().toISOString()
                })
                .eq('id', currentUser.id);
            
            await loadOnlineUsers();
        }
    });
}

// ===== РЕДАКТИРОВАНИЕ ПРОФИЛЯ =====
async function checkUsernameAvailability(username) {
    if (!username || username.length < 3) {
        return { available: false, message: 'Минимум 3 символа' };
    }
    
    if (username.length > 20) {
        return { available: false, message: 'Максимум 20 символов' };
    }
    
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username)) {
        return { available: false, message: 'Только буквы, цифры и _' };
    }
    
    try {
        const { data: existingUser } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', username)
            .neq('id', currentUser.id)
            .single();
        
        if (existingUser) {
            return { available: false, message: 'Этот ник уже занят' };
        }
        
        return { available: true, message: 'Ник доступен' };
        
    } catch (error) {
        return { available: false, message: 'Ошибка проверки' };
    }
}

async function saveProfile() {
    const username = elements.modals.editUsername.value.trim();
    const status = elements.modals.editStatus.value.trim();
    
    const check = await checkUsernameAvailability(username);
    if (!check.available) {
        showError(check.message);
        return;
    }
    
    try {
        await supabase.from('profiles').update({
            username: username,
            status: status || 'В сети',
            updated_at: new Date().toISOString()
        }).eq('id', currentUser.id);
        
        // Закрываем модалку
        hideModal('editProfile');
        
        // Обновляем UI
        updateUserUI();
        
        showSuccess('Профиль обновлен');
        
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        showError('Не удалось сохранить профиль');
    }
}

// ===== УТИЛИТЫ =====
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    // Сегодня
    if (diff < 24 * 60 * 60 * 1000) {
        return date.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
    
    // Вчера
    if (diff < 48 * 60 * 60 * 1000) {
        return 'вчера';
    }
    
    // Старые сообщения
    return date.toLocaleDateString('ru-RU', { 
        day: '2-digit', 
        month: '2-digit' 
    });
}

function showError(message) {
    console.error('❌', message);
    alert(message);
}

function showSuccess(message) {
    console.log('✅', message);
    alert(message);
}

function updateSendButton() {
    const input = elements.chat.messageInput;
    const btn = elements.chat.sendBtn;
    
    if (input && btn) {
        btn.disabled = input.value.trim().length === 0;
    }
}

function showModal(modalName) {
    const modal = elements.modals[modalName];
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function hideModal(modalName) {
    const modal = elements.modals[modalName];
    if (modal) {
        modal.classList.add('hidden');
    }
}

// ===== ОБРАБОТЧИКИ СОБЫТИЙ =====
function setupEventListeners() {
    // Авторизация
    if (elements.auth.sendEmailBtn) {
        elements.auth.sendEmailBtn.addEventListener('click', sendEmailOTP);
    }
    
    if (elements.auth.verifyOtpBtn) {
        elements.auth.verifyOtpBtn.addEventListener('click', verifyEmailOTP);
    }
    
    if (elements.auth.googleBtn) {
        elements.auth.googleBtn.addEventListener('click', signInWithGoogle);
    }
    
    if (elements.auth.otpInput) {
        elements.auth.otpInput.addEventListener('input', (e) => {
            if (e.target.value.length === 6) {
                verifyEmailOTP();
            }
        });
    }
    
    // Поиск
    if (elements.app.searchBtn) {
        elements.app.searchBtn.addEventListener('click', () => {
            const isHidden = elements.app.searchPanel.classList.contains('hidden');
            toggleSearch(isHidden);
        });
    }
    
    if (elements.app.searchInput) {
        elements.app.searchInput.addEventListener('input', debounce(searchUsers, 300));
        elements.app.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchUsers();
        });
    }
    
    if (elements.app.clearSearchBtn) {
        elements.app.clearSearchBtn.addEventListener('click', () => {
            toggleSearch(false);
        });
    }
    
    // Новый чат
    if (elements.app.newChatBtn) {
        elements.app.newChatBtn.addEventListener('click', () => {
            showModal('createGroup');
        });
    }
    
    // Меню профиля
    if (elements.app.menuBtn) {
        elements.app.menuBtn.addEventListener('click', async () => {
            // Загружаем текущие данные
            const { data: profile } = await supabase
                .from('profiles')
                .select('username, status')
                .eq('id', currentUser.id)
                .single();
            
            if (profile) {
                elements.modals.editUsername.value = profile.username || '';
                elements.modals.editStatus.value = profile.status || '';
            }
            
            showModal('editProfile');
        });
    }
    
    // Сообщения
    if (elements.chat.messageInput) {
        elements.chat.messageInput.addEventListener('input', updateSendButton);
        elements.chat.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    
    if (elements.chat.sendBtn) {
        elements.chat.sendBtn.addEventListener('click', sendMessage);
    }
    
    // Назад из чата
    if (elements.chat.backBtn) {
        elements.chat.backBtn.addEventListener('click', () => {
            showScreen('app');
            currentChat = null;
            
            if (realtimeSubscription) {
                supabase.removeChannel(realtimeSubscription);
                realtimeSubscription = null;
            }
        });
    }
    
    // Модальные окна
    if (elements.modals.saveProfileBtn) {
        elements.modals.saveProfileBtn.addEventListener('click', saveProfile);
    }
    
    if (elements.modals.cancelEditBtn) {
        elements.modals.cancelEditBtn.addEventListener('click', () => {
            hideModal('editProfile');
        });
    }
    
    if (elements.modals.createGroupBtn) {
        elements.modals.createGroupBtn.addEventListener('click', async () => {
            const groupName = elements.modals.groupNameInput.value.trim();
            
            if (!groupName) {
                showError('Введите название группы');
                return;
            }
            
            try {
                const { data: group } = await supabase
                    .from('chats')
                    .insert({
                        type: 'group',
                        name: groupName,
                        created_by: currentUser.id,
                        created_at: new Date().toISOString()
                    })
                    .select()
                    .single();
                
                // Добавляем создателя
                await supabase.from('chat_members').insert({
                    chat_id: group.id,
                    user_id: currentUser.id,
                    role: 'admin'
                });
                
                hideModal('createGroup');
                elements.modals.groupNameInput.value = '';
                
                openChat(group.id, 'group', groupName);
                
                showSuccess(`Группа "${groupName}" создана!`);
                
            } catch (error) {
                console.error('Ошибка создания группы:', error);
                showError('Не удалось создать группу');
            }
        });
    }
    
    if (elements.modals.cancelGroupBtn) {
        elements.modals.cancelGroupBtn.addEventListener('click', () => {
            hideModal('createGroup');
            elements.modals.groupNameInput.value = '';
        });
    }
    
    // Нижнее меню
    elements.app.bottomNavBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.app.bottomNavBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Здесь можно добавить переключение контента
        });
    });
    
    // Supabase auth изменения
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
            currentUser = session.user;
            initializeUser();
            showScreen('app');
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            showScreen('auth');
        }
    });
    
    // Обработка Enter в OTP
    document.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && elements.auth.otpInput && 
            !elements.auth.otpInput.classList.contains('hidden') &&
            elements.auth.otpInput.value.length === 6) {
            verifyEmailOTP();
        }
    });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Глобальные функции для onclick
window.startChatWithUser = startChatWithUser;
window.openChat = openChat;
window.editMessage = editMessage;
window.deleteMessage = deleteMessage;

console.log('✅ Absgram готов к работе!');

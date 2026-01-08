// security.js - Система безопасности Absgram

const SECURITY_CONFIG = {
    // Защита от DDoS
    rateLimit: {
        maxRequestsPerMinute: 60, // Максимум запросов в минуту
        messageCooldown: 1000,    // Задержка между сообщениями (мс)
    },
    
    // Защита от XSS
    xssProtection: {
        sanitizeInput: true,
        maxMessageLength: 2000,
        forbiddenTags: ['script', 'iframe', 'object', 'embed']
    },
    
    // Мониторинг активности
    activityMonitoring: {
        logSuspiciousActivity: true,
        maxFailedLogins: 5,
        autoBlockDuration: 300000 // 5 минут блокировки
    },
    
    // Шифрование
    encryption: {
        enableMessageHash: true,
        sessionTimeout: 3600000 // 1 час
    }
};

class AbsgramSecurity {
    constructor() {
        this.requestTimestamps = [];
        this.failedLogins = {};
        this.suspiciousActivities = [];
        
        this.initProtection();
        console.log('🔒 Security system initialized');
    }
    
    // Инициализация защиты
    initProtection() {
        this.setupRequestMonitoring();
        this.setupXSSProtection();
        this.setupActivityLogging();
        this.setupSessionProtection();
    }
    
    // ===== ЗАЩИТА ОТ DDoS =====
    setupRequestMonitoring() {
        // Мониторинг частоты запросов
        const originalFetch = window.fetch;
        
        window.fetch = async (...args) => {
            const now = Date.now();
            const minuteAgo = now - 60000;
            
            // Фильтруем старые запросы
            this.requestTimestamps = this.requestTimestamps.filter(
                timestamp => timestamp > minuteAgo
            );
            
            // Проверяем лимит
            if (this.requestTimestamps.length >= SECURITY_CONFIG.rateLimit.maxRequestsPerMinute) {
                this.logSuspiciousActivity('DDoS protection triggered', {
                    requestsPerMinute: this.requestTimestamps.length,
                    url: args[0]
                });
                
                throw new Error('Too many requests. Please wait.');
            }
            
            // Добавляем текущий запрос
            this.requestTimestamps.push(now);
            
            return originalFetch(...args);
        };
    }
    
    // ===== ЗАЩИТА ОТ XSS =====
    setupXSSProtection() {
        // Переопределяем innerHTML для безопасности
        const originalInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML').set;
        
        Object.defineProperty(Element.prototype, 'innerHTML', {
            set: function(value) {
                if (SECURITY_CONFIG.xssProtection.sanitizeInput) {
                    value = AbsgramSecurity.sanitizeHTML(value);
                }
                return originalInnerHTML.call(this, value);
            }
        });
    }
    
    static sanitizeHTML(str) {
        if (!str) return '';
        
        // Удаляем опасные теги
        SECURITY_CONFIG.xssProtection.forbiddenTags.forEach(tag => {
            const regex = new RegExp(`<${tag}[^>]*>.*?</${tag}>`, 'gi');
            str = str.replace(regex, '');
        });
        
        // Экранируем HTML символы
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    
    // ===== ЗАЩИТА СООБЩЕНИЙ =====
    static validateMessage(content) {
        if (!content || typeof content !== 'string') {
            return { valid: false, reason: 'Invalid message format' };
        }
        
        // Проверка длины
        if (content.length > SECURITY_CONFIG.xssProtection.maxMessageLength) {
            return { 
                valid: false, 
                reason: `Message too long (max ${SECURITY_CONFIG.xssProtection.maxMessageLength} chars)` 
            };
        }
        
        // Проверка на XSS
        if (SECURITY_CONFIG.xssProtection.forbiddenTags.some(tag => 
            content.toLowerCase().includes(`<${tag}`))) {
            return { valid: false, reason: 'Message contains forbidden tags' };
        }
        
        // Проверка на спам (многократные повторения)
        if (this.detectSpam(content)) {
            return { valid: false, reason: 'Possible spam detected' };
        }
        
        return { valid: true, sanitized: this.sanitizeHTML(content) };
    }
    
    static detectSpam(text) {
        // Простая проверка на спам (повторяющиеся символы/слова)
        const repeatedChars = /(.)\1{10,}/; // 10+ одинаковых символов подряд
        const repeatedWords = /(\b\w+\b)(?:\s+\1){5,}/i; // 5+ одинаковых слов
        
        return repeatedChars.test(text) || repeatedWords.test(text);
    }
    
    // ===== МОНИТОРИНГ АКТИВНОСТИ =====
    setupActivityLogging() {
        // Логируем все ошибки
        window.addEventListener('error', (event) => {
            this.logSecurityEvent('JavaScript Error', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });
        
        // Логируем необработанные промисы
        window.addEventListener('unhandledrejection', (event) => {
            this.logSecurityEvent('Unhandled Promise Rejection', {
                reason: event.reason
            });
        });
        
        // Мониторинг изменений DOM (защита от инжектов)
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.addedNodes.length > 0) {
                    this.checkForMaliciousNodes(mutation.addedNodes);
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    checkForMaliciousNodes(nodes) {
        nodes.forEach(node => {
            if (node.nodeType === 1) { // Element node
                const tagName = node.tagName.toLowerCase();
                
                if (SECURITY_CONFIG.xssProtection.forbiddenTags.includes(tagName)) {
                    this.logSuspiciousActivity('Forbidden tag injected', {
                        tag: tagName,
                        content: node.outerHTML.substring(0, 200)
                    });
                    
                    node.remove(); // Удаляем опасный элемент
                }
                
                // Проверяем атрибуты на XSS
                if (node.hasAttributes()) {
                    const attrs = node.attributes;
                    for (let i = 0; i < attrs.length; i++) {
                        if (attrs[i].value.toLowerCase().includes('javascript:')) {
                            this.logSuspiciousActivity('XSS in attribute', {
                                attribute: attrs[i].name,
                                value: attrs[i].value
                            });
                            
                            node.remove();
                            break;
                        }
                    }
                }
            }
        });
    }
    
    // ===== ЗАЩИТА СЕССИИ =====
    setupSessionProtection() {
        // Таймаут неактивности
        let inactivityTimer;
        
        const resetTimer = () => {
            clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(() => {
                this.logSecurityEvent('Session timeout due to inactivity');
                
                // Можно добавить выход из системы
                if (window.supabaseClient?.auth) {
                    window.supabaseClient.auth.signOut();
                }
            }, SECURITY_CONFIG.encryption.sessionTimeout);
        };
        
        // Сброс таймера при активности
        ['click', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
            document.addEventListener(event, resetTimer, false);
        });
        
        resetTimer();
    }
    
    // ===== ОБРАБОТКА НЕУДАЧНЫХ ВХОДОВ =====
    trackFailedLogin(email) {
        if (!this.failedLogins[email]) {
            this.failedLogins[email] = {
                count: 0,
                firstAttempt: Date.now(),
                blockedUntil: 0
            };
        }
        
        const loginData = this.failedLogins[email];
        loginData.count++;
        
        // Блокировка после 5 неудачных попыток
        if (loginData.count >= SECURITY_CONFIG.activityMonitoring.maxFailedLogins) {
            loginData.blockedUntil = Date.now() + SECURITY_CONFIG.activityMonitoring.autoBlockDuration;
            
            this.logSuspiciousActivity('Account blocked due to failed logins', {
                email: email,
                attempts: loginData.count,
                blockedUntil: new Date(loginData.blockedUntil).toISOString()
            });
            
            return {
                blocked: true,
                message: 'Too many failed attempts. Account temporarily blocked.',
                waitTime: SECURITY_CONFIG.activityMonitoring.autoBlockDuration
            };
        }
        
        return { blocked: false, attempts: loginData.count };
    }
    
    resetFailedLogins(email) {
        if (this.failedLogins[email]) {
            delete this.failedLogins[email];
        }
    }
    
    isAccountBlocked(email) {
        const loginData = this.failedLogins[email];
        
        if (loginData && loginData.blockedUntil > Date.now()) {
            return {
                blocked: true,
                remainingTime: loginData.blockedUntil - Date.now()
            };
        }
        
        return { blocked: false };
    }
    
    // ===== ЛОГИРОВАНИЕ =====
    logSecurityEvent(type, data = {}) {
        const event = {
            timestamp: new Date().toISOString(),
            type: type,
            data: data,
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        this.suspiciousActivities.push(event);
        
        // Храним только последние 100 событий
        if (this.suspiciousActivities.length > 100) {
            this.suspiciousActivities.shift();
        }
        
        // Отправляем на сервер, если нужно
        if (SECURITY_CONFIG.activityMonitoring.logSuspiciousActivity) {
            this.sendSecurityLog(event);
        }
        
        console.log('🔒 Security Event:', event);
    }
    
    logSuspiciousActivity(reason, details = {}) {
        this.logSecurityEvent('Suspicious Activity', {
            reason: reason,
            ...details
        });
    }
    
    async sendSecurityLog(event) {
        try {
            // Отправляем логи на ваш сервер (опционально)
            if (window.supabaseClient) {
                await window.supabaseClient
                    .from('security_logs')
                    .insert({
                        event_type: event.type,
                        event_data: event.data,
                        user_agent: event.userAgent,
                        created_at: event.timestamp
                    });
            }
        } catch (error) {
            console.error('Failed to send security log:', error);
        }
    }
    
    // ===== УТИЛИТЫ =====
    static generateMessageHash(content, timestamp) {
        // Простая хеш-функция для проверки целостности сообщений
        let hash = 0;
        const str = content + timestamp;
        
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        
        return hash.toString(36);
    }
    
    static validateMessageHash(content, timestamp, expectedHash) {
        const actualHash = this.generateMessageHash(content, timestamp);
        return actualHash === expectedHash;
    }
    
    // Получить статистику безопасности
    getSecurityStats() {
        return {
            totalRequestsLastMinute: this.requestTimestamps.length,
            failedLoginAttempts: Object.keys(this.failedLogins).length,
            suspiciousActivities: this.suspiciousActivities.length,
            blockedAccounts: Object.values(this.failedLogins).filter(
                acc => acc.blockedUntil > Date.now()
            ).length
        };
    }
    
    // Экспорт логов (для админа)
    exportSecurityLogs() {
        return {
            config: SECURITY_CONFIG,
            activities: this.suspiciousActivities,
            failedLogins: this.failedLogins,
            stats: this.getSecurityStats(),
            exportTime: new Date().toISOString()
        };
    }
}

// Инициализация системы безопасности
let securitySystem = null;

function initSecurity() {
    if (!securitySystem) {
        securitySystem = new AbsgramSecurity();
    }
    return securitySystem;
}

// Экспорт для использования
window.AbsgramSecurity = {
    init: initSecurity,
    validateMessage: AbsgramSecurity.validateMessage,
    sanitizeHTML: AbsgramSecurity.sanitizeHTML,
    generateMessageHash: AbsgramSecurity.generateMessageHash,
    validateMessageHash: AbsgramSecurity.validateMessageHash
};

// Автоматическая инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    window.absgramSecurity = initSecurity();
    console.log('✅ Security system ready');
});

// server.js
const WebSocket = require('ws');
const PORT = process.env.PORT || 7070;
const wss = new WebSocket.Server({ port: PORT });

let players = [];

console.log(`[H.A.Z.E. СИГНАЛИНГ] Сервер запущен на порту ${PORT}`);

// Функция для очистки и уведомления об отключении игрока
function handlePlayerDisconnect(playerId) {
    const initialLength = players.length;
    players = players.filter(p => p.id !== playerId);
    
    if (players.length !== initialLength) {
        console.log(`[ОТКЛЮЧЕНИЕ] Игрок ${playerId} удален из системы`);
        // Уведомляем всех оставшихся участников сети
        players.forEach(p => {
            if (p.ws.readyState === WebSocket.OPEN) {
                p.ws.send(JSON.stringify({ type: "player_disconnected", id: playerId }));
            }
        });
    }
}

wss.on('connection', (ws) => {
    // Метка для проверки активности (Heartbeat)
    ws.isAlive = true;
    
    // Перехватываем понг от клиента
    ws.on('pong', () => {
        ws.isAlive = true;
    });

    // Определяем ID (Если игроков нет — первый зашедший всегда Хост (ID 1))
    let playerId = 1;
    if (players.some(p => p.id === 1)) {
        playerId = Math.floor(Math.random() * 1000000) + 2;
    }

    const playerObj = { id: playerId, ws: ws };
    players.push(playerObj);
    console.log(`[ПОДКЛЮЧЕНИЕ] Игрок зарегистрирован под ID: ${playerId}`);

    // 1. Отправляем игроку его личный ID
    ws.send(JSON.stringify({ type: "id", id: playerId }));

    // 2. Мгновенно отправляем новому игроку список всех, кто уже онлайн
    players.forEach(oldPlayer => {
        if (oldPlayer.id !== playerId) {
            ws.send(JSON.stringify({ type: "player_connected", id: oldPlayer.id }));
            // Уведомляем старого игрока о новом коннекте
            if (oldPlayer.ws.readyState === WebSocket.OPEN) {
                oldPlayer.ws.send(JSON.stringify({ type: "player_connected", id: playerId }));
            }
        }
    });

    // Обработка входящих пакетов маршрутизации WebRTC
    ws.on('message', (rawMessage) => {
        try {
            const textMessage = rawMessage.toString('utf8');
            const data = JSON.parse(textMessage);
            if (data.target) {
                const targetPlayer = players.find(p => p.id === parseInt(data.target));
                if (targetPlayer && targetPlayer.ws.readyState === WebSocket.OPEN) {
                    data.sender = playerId;
                    targetPlayer.ws.send(JSON.stringify(data));
                }
            }
        } catch (e) {
            console.error(`[ОШИБКА] Сбой парсинга пакета от игрока ${playerId}:`, e.message);
        }
    });

    // Штатное закрытие соединения
    ws.on('close', () => {
        handlePlayerDisconnect(playerId);
    });

    // Обработка системных ошибок сокета
    ws.on('error', (err) => {
        console.error(`[ОШИБКА СОКЕТА] Игрок ${playerId}:`, err.message);
        handlePlayerDisconnect(playerId);
    });
});

// --- МЕХАНИЗМ HEARTBEAT (ОЧИСТКА ЗАВИСШИХ СЕССИЙ) ---
// Каждые 30 секунд опрашиваем всех клиентов. Если кто-то не прислал 'pong', закрываем сокет.
const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            console.log("[HEARTBEAT] Обнаружен мертвый сокет. Принудительное закрытие...");
            return ws.terminate(); // Вызовет событие 'close', которое запустит handlePlayerDisconnect
        }
        
        ws.isAlive = false;
        ws.ping(); // Отправляем ping. Клиент (Godot или браузер) автоматически ответит pong
    });
}, 30000);

// Защита от утечки памяти при остановке сервера
wss.on('close', () => {
    clearInterval(interval);
});

// server.js
const WebSocket = require('ws');
const PORT = process.env.PORT || 7070;
const wss = new WebSocket.Server({ port: PORT });

let players = [];

console.log(`[H.A.Z.E. СИГНАЛИНГ] Сервер запущен на порту ${PORT}`);

wss.on('connection', (ws) => {
    // Если игроков нет, первый зашедший ВСЕГДА Хост (ID 1)
    let playerId = 1;
    
    // Если Хост уже есть, выдаем клиенту случайный ID
    if (players.some(p => p.id === 1)) {
        playerId = Math.floor(Math.random() * 1000000) + 2;
    }

    const playerObj = { id: playerId, ws: ws };
    players.push(playerObj);
    
    console.log(`[ПОДКЛЮЧЕНИЕ] Игрок зарегистрирован под ID: ${playerId}`);
    
    // 1. Отправляем игроку его личный ID
    ws.send(JSON.stringify({ type: "id", id: playerId }));

    // 2. ИСПРАВЛЕНИЕ: Мгновенно отправляем новому игроку список ВСЕХ, кто уже онлайн на сервере!
    // Это заставит WebRTC в Godot сразу начать сопряжение, не дожидаясь чужих сигналов.
    players.forEach(oldPlayer => {
        if (oldPlayer.id !== playerId) {
            ws.send(JSON.stringify({ type: "player_connected", id: oldPlayer.id }));
            // Также уведомляем старого игрока о новом коннекте
            oldPlayer.ws.send(JSON.stringify({ type: "player_connected", id: playerId }));
        }
    });

    ws.on('message', (rawMessage) => {
        try {
            const textMessage = rawMessage.toString('utf8');
            const data = JSON.parse(textMessage);
            
            if (data.target) {
                const targetPlayer = players.find(p => p.id === parseInt(data.target));
                if (targetPlayer) {
                    data.sender = playerId;
                    targetPlayer.ws.send(JSON.stringify(data));
                }
            }
        } catch (e) {
            console.error("[ОШИБКА] Сбой пакета:", e.message);
        }
    });

    ws.on('close', () => {
        players = players.filter(p => p.id !== playerId);
        console.log(`[ОТКЛЮЧЕНИЕ] Игрок ${playerId} вышел`);
        
        // Уведомляем оставшихся
        players.forEach(p => {
            if (p.ws.readyState === WebSocket.OPEN) {
                p.ws.send(JSON.stringify({ type: "player_disconnected", id: playerId }));
            }
        });
    });
});

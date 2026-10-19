const WebSocket = require('ws');
const PORT = process.env.PORT || 7070;
const wss = new WebSocket.Server({ port: PORT });

let players = [];

console.log(`[H.A.Z.E. СИГНАЛИНГ] Сервер запущен на порту ${PORT}`);

wss.on('connection', (ws) => {
    let playerId = Math.floor(Math.random() * 1000000) + 2; // ID клиента (от 2 и выше)
    
    // Если подключается самый первый игрок в комнату, мы можем назначить его Хостом (ID: 1)
    if (players.length === 0) {
        playerId = 1;
    }

    const playerObj = { id: playerId, ws: ws };
    players.push(playerObj);
    
    console.log(`[ПОДКЛЮЧЕНИЕ] Игрок зарегистрирован под ID: ${playerId}`);
    ws.send(JSON.stringify({ type: "id", id: playerId }));

    // Уведомляем остальных, что зашел новый участник
    broadcast({ type: "player_connected", id: playerId }, playerId);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            // Пересылаем сетевые WebRTC-данные конкретному адресату
            if (data.target) {
                const targetPlayer = players.find(p => p.id === parseInt(data.target));
                if (targetPlayer) {
                    data.sender = playerId;
                    targetPlayer.ws.send(JSON.stringify(data));
                }
            }
        } catch (e) {
            console.error("Ошибка парсинга сообщения:", e);
        }
    });

    ws.on('close', () => {
        players = players.filter(p => p.id !== playerId);
        console.log(`[ОТКЛЮЧЕНИЕ] Игрок ${playerId} покинул комнату`);
        broadcast({ type: "player_disconnected", id: playerId });
    });
});

function broadcast(data, excludeId = null) {
    players.forEach(p => {
        if (p.id !== excludeId && p.ws.readyState === WebSocket.OPEN) {
            p.ws.send(JSON.stringify(data));
        }
    });
}

const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const MEMORY_FILE = 'memory.json';
let memory = {};

// 載入記憶檔案
function loadMemory() {
    if (fs.existsSync(MEMORY_FILE)) {
        try {
            const data = fs.readFileSync(MEMORY_FILE, 'utf-8');
            let loaded = JSON.parse(data);
            
            // 遷移舊資料結構或初始化新結構
            if (!loaded.responses && !loaded.counters) {
                // 如果是舊的扁平結構
                memory = {
                    responses: loaded,
                    counters: {}
                };
            } else {
                memory = loaded;
            }
            
            if (!memory.responses) memory.responses = {};
            if (!memory.counters) memory.counters = {};
            
        } catch (err) {
            console.error('❌ 讀取記憶檔失敗:', err);
            memory = { responses: {}, counters: {} };
        }
    } else {
        memory = { responses: {}, counters: {} };
    }
}

// 儲存記憶到檔案
function saveMemory() {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2), 'utf-8');
}

client.once('ready', () => {
    console.log(`✅ Bot 上線：${client.user.tag}`);
    loadMemory();
});

client.on('messageCreate', message => {
    if (message.author.bot) return;

    const content = message.content.trim();

    // 處理指令
    if (content.startsWith('..del')) {
        const remaining = content.substring(5).trim();
        
        // 刪除計數器：..del count [關鍵字]
        if (remaining.startsWith('count ')) {
            const keyword = remaining.substring(6).trim();
            if (memory.counters[keyword]) {
                delete memory.counters[keyword];
                saveMemory();
                message.channel.send(`✅ 已刪除「${keyword}」的計數器及相關資料`);
            } else {
                message.channel.send(`⚠️ 找不到「${keyword}」的計數器`);
            }
            return;
        }
        
        // 原有的刪除記憶：..del [關鍵字]
        if (remaining in memory.responses) {
            delete memory.responses[remaining];
            saveMemory();
            message.channel.send(`已刪除「${remaining}」的記憶`);
        } else {
            message.channel.send(`找不到「${remaining}」的記憶`);
        }
        return;
    }
    
    if (content.startsWith('...')) {
        const keyword = content.substring(3).trim();
        
        // 先檢查是否為計數器的統計呼叫
        const counterEntry = Object.entries(memory.counters).find(([kw, cfg]) => cfg.display === keyword);
        if (counterEntry) {
            const [kw, cfg] = counterEntry;
            let response = `📊 「${cfg.display}」統計結果：\n`;
            const stats = Object.entries(cfg.data);
            if (stats.length === 0) {
                response += '目前尚無人達成此紀錄。';
            } else {
                // 依次數降序排列
                stats.sort((a, b) => b[1] - a[1]);
                for (const [userId, count] of stats) {
                    response += `<@${userId}>: ${count} 次\n`;
                }
            }
            message.channel.send(response);
            return;
        }

        // 原有的反應邏輯
        if (keyword in memory.responses) {
            const responses = memory.responses[keyword];
            const randomResponse = Array.isArray(responses) ? responses[Math.floor(Math.random() * responses.length)] : responses;
            message.channel.send(randomResponse);
        } else {
            message.channel.send(`找不到「${keyword}」`);
        }
        return;
    }
    
    if (content.startsWith('..')) {
        const parts = content.substring(2).trim().split(/\s+/);
        
        // 新增計數器：..add count [關鍵字] [統計顯示名稱]
        if (parts[0] === 'add' && parts[1] === 'count' && parts.length >= 4) {
            const keyword = parts[2];
            const display = parts[3];
            memory.counters[keyword] = {
                display: display,
                data: {}
            };
            saveMemory();
            message.channel.send(`✅ 已新增計數器：偵測「${keyword}」，統計指令「...${display}」`);
            return;
        }

        // 原有的儲存記憶：..[關鍵字] [回應]
        if (parts.length >= 2) {
            const keyword = parts[0];
            const response = parts.slice(1).join(' ');
            if (memory.responses[keyword]) {
                if (!Array.isArray(memory.responses[keyword])) {
                    memory.responses[keyword] = [memory.responses[keyword]];
                }
                memory.responses[keyword].push(response);
            } else {
                memory.responses[keyword] = response;
            }
            saveMemory();
            message.channel.send(`已儲存「${keyword}」為「${response}」`);
        } else if (parts.length === 1 && parts[0] !== '') {
             // 處理只有關鍵字但沒內容的情況
             message.channel.send('⚠️ 格式錯誤，用法：`..關鍵字 內容` 或 `..add count 關鍵字 標籤`');
        }
        return;
    }

    // 非指令訊息：執行計數器偵測
    let updated = false;
    for (const [keyword, config] of Object.entries(memory.counters)) {
        if (content.includes(keyword)) {
            const userId = message.author.id;
            if (!config.data[userId]) {
                config.data[userId] = 0;
            }
            config.data[userId]++;
            updated = true;
        }
    }
    if (updated) {
        saveMemory();
    }
});

client.login(process.env.DISCORD_TOKEN);

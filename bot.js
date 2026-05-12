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
            
            // 遷移舊資料結構：確保有 responses 和 counters 分類
            if (!loaded.responses && !loaded.counters) {
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
    const guildId = message.guildId || 'dm'; // 支援私訊，但通常此類 bot 用於伺服器

    // 處理指令
    if (content.startsWith('..del')) {
        const remaining = content.substring(5).trim();
        
        // 刪除計數器：..del count [關鍵字]
        if (remaining.startsWith('count ')) {
            const keyword = remaining.substring(6).trim();
            if (memory.counters[guildId] && memory.counters[guildId][keyword]) {
                delete memory.counters[guildId][keyword];
                saveMemory();
                message.channel.send(`✅ [此伺服器] 已刪除「${keyword}」的計數器及相關資料`);
            } else {
                message.channel.send(`⚠️ 找不到「${keyword}」的計數器`);
            }
            return;
        }
        
        // 原有的刪除記憶：..del [關鍵字] (全域)
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
        
        // 檢查此伺服器的計數器統計呼叫
        if (memory.counters[guildId]) {
            const counterEntry = Object.entries(memory.counters[guildId]).find(([kw, cfg]) => cfg.display === keyword);
            if (counterEntry) {
                const [kw, cfg] = counterEntry;
                let response = `📊 「${cfg.display}」統計結果：\n`;
                const stats = Object.entries(cfg.data);
                if (stats.length === 0) {
                    response += '目前尚無人達成此紀錄。';
                } else {
                    stats.sort((a, b) => b[1] - a[1]);
                    for (const [userId, count] of stats) {
                        response += `<@${userId}>: ${count} 次\n`;
                    }
                }
                message.channel.send(response);
                return;
            }
        }

        // 原有的反應邏輯 (全域)
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
        
        // 新增計數器：..add count [關鍵字] [偵測後回話] [統計顯示名稱]
        if (parts[0] === 'add' && parts[1] === 'count' && parts.length >= 5) {
            const keyword = parts[2];
            const botReply = parts[3];
            const display = parts[4];
            
            if (!memory.counters[guildId]) memory.counters[guildId] = {};
            
            memory.counters[guildId][keyword] = {
                reply: botReply,
                display: display,
                data: {}
            };
            saveMemory();
            message.channel.send(`✅ 已新增計數器：\n偵測「${keyword}」時會回「${botReply}」\n統計指令「...${display}」`);
            return;
        }

        // 原有的儲存記憶：..[關鍵字] [回應] (全域)
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
             message.channel.send('⚠️ 格式錯誤\n新增計數器：`..add count 關鍵字 回話 標籤`\n新增記憶：`..關鍵字 內容`');
        }
        return;
    }

    // 非指令訊息：執行計數器偵測 (依伺服器分開)
    if (memory.counters[guildId]) {
        let updated = false;
        for (const [keyword, config] of Object.entries(memory.counters[guildId])) {
            if (content.includes(keyword)) {
                const userId = message.author.id;
                if (!config.data[userId]) {
                    config.data[userId] = 0;
                }
                config.data[userId]++;
                
                // 偵測後回話，支援 {count}
                if (config.reply) {
                    const finalReply = config.reply.replace(/{count}/g, config.data[userId]);
                    message.channel.send(finalReply);
                }
                
                updated = true;
            }
        }
        if (updated) {
            saveMemory();
        }
    }
});

client.login(process.env.DISCORD_TOKEN);

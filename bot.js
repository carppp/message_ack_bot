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
            memory = JSON.parse(data);
        } catch (err) {
            console.error('❌ 讀取記憶檔失敗:', err);
            memory = {};
        }
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
    if (content.startsWith('..del')) {
        const keyword = content.substring(4).trim();
        if (keyword in memory) {
            delete memory[keyword];
            saveMemory();
            message.channel.send(`已刪除「${keyword}」的記憶`);
        } else {
            message.channel.send(`找不到「${keyword}」的記憶`);
        }
    }
    else if (content.startsWith('..')) {
        const keyword = content.substring(2).trim();
        if (keyword in memory) {
            message.channel.send(memory[keyword]);
        } else {
            message.channel.send(`找不到「${keyword}」`);
        }
    }
    else if (content.startsWith('..')) {
        const parts = content.substring(2).trim().split(' ');
        if (parts.length >= 2) {
            const keyword = parts[0];
            const response = parts.slice(1).join(' ');
            memory[keyword] = response;
            saveMemory();
            message.channel.send(`已儲存「${keyword}」為「${response}」`);
        } else {
            message.channel.send('⚠️ 格式錯誤，用法：`..關鍵字 內容`');
        }
    }

    
});

client.login(process.env.DISCORD_TOKEN);

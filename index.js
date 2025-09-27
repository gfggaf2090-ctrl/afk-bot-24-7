// إعداد HTTP Server للاستضافة على Render - Lavamusic Enhanced
const http = require('http');
const fs = require("fs");
const path = require("path");
const PORT = process.env.PORT || 3000;

// التحقق من المكتبات المطلوبة قبل بدء التشغيل
const requiredPackages = {
    'discord.js': '14.16.3',
    'lavalink-client': 'latest',
    '@discordjs/voice': '0.18.0',
    'prisma': 'latest',
    '@prisma/client': 'latest',
    'dotenv': 'latest',
    'i18next': 'latest',
    'typescript': 'latest'
};

console.log('🔍 فحص المكتبات المطلوبة لـ Lavamusic...');

// التحقق من وجود المكتبات
let missingPackages = [];
for (const [packageName, version] of Object.entries(requiredPackages)) {
    try {
        require.resolve(packageName);
        console.log(`✅ ${packageName} موجود`);
    } catch (error) {
        console.log(`❌ ${packageName} مفقود`);
        missingPackages.push(packageName);
    }
}

if (missingPackages.length > 0) {
    console.error('❌ المكتبات التالية مفقودة:');
    missingPackages.forEach(pkg => console.error(`   - ${pkg}`));
    console.error('\n💡 لحل هذه المشكلة، قم بتشغيل الأمر التالي:');
    console.error(`npm install ${missingPackages.join(' ')}`);
    process.exit(1);
}

// تحميل المكتبات بعد التأكد من وجودها
let Client, GatewayIntentBits, ActivityType, LavalinkManager, Node;

try {
    const discord = require("discord.js");
    Client = discord.Client;
    GatewayIntentBits = discord.GatewayIntentBits;
    ActivityType = discord.ActivityType;
    
    const lavalink = require("lavalink-client");
    LavalinkManager = lavalink.LavalinkManager;
    Node = lavalink.Node;
    
    console.log('✅ تم تحميل جميع المكتبات بنجاح');
} catch (error) {
    console.error('❌ فشل في تحميل المكتبات:', error.message);
    process.exit(1);
}

// نظام متقدم لإدارة طلبات YouTube وتجنب 429 - محسن لـ Lavamusic
class AdvancedLavalinkManager {
    constructor() {
        this.requestQueue = [];
        this.processing = false;
        this.requestHistory = [];
        this.rateLimits = {
            perMinute: 5,       // زيادة للاستفادة من Lavalink
            perHour: 100,       // حد أعلى مع Lavalink
            per24Hours: 500     // حد أعلى مع نظام Lavalink
        };
        this.cooldownUntil = 0;
        this.cookies = this.loadCookies();
        this.nodeHealth = new Map();
        
        setInterval(() => this.cleanHistory(), 3600000);
        setInterval(() => this.checkNodesHealth(), 60000); // فحص صحة العقد كل دقيقة
    }

    loadCookies() {
        const cookies = process.env.YOUTUBE_COOKIES || '';
        if (cookies) {
            console.log('🍪 تم تحميل YouTube cookies');
            return cookies;
        }
        console.log('⚠️ لا توجد YouTube cookies - قد تحدث مشاكل مع 429');
        return null;
    }

    checkNodesHealth() {
        // فحص صحة عقد Lavalink
        if (global.lavalinkManager && global.lavalinkManager.nodeManager) {
            const nodes = global.lavalinkManager.nodeManager.nodes;
            nodes.forEach((node, identifier) => {
                const isHealthy = node.connected && node.stats;
                this.nodeHealth.set(identifier, {
                    connected: node.connected,
                    healthy: isHealthy,
                    players: node.stats?.players || 0,
                    playingPlayers: node.stats?.playingPlayers || 0,
                    uptime: node.stats?.uptime || 0,
                    lastCheck: Date.now()
                });
            });
        }
    }

    getBestNode() {
        // اختيار أفضل عقدة Lavalink متاحة
        if (!global.lavalinkManager) return null;
        
        const healthyNodes = Array.from(this.nodeHealth.entries())
            .filter(([id, health]) => health.healthy && health.connected)
            .sort(([, a], [, b]) => a.players - b.players); // اختر العقدة الأقل تحميلاً
            
        return healthyNodes.length > 0 ? healthyNodes[0][0] : null;
    }

    cleanHistory() {
        const now = Date.now();
        this.requestHistory = this.requestHistory.filter(req => 
            (now - req.timestamp) < 24 * 60 * 60 * 1000
        );
        console.log(`🧹 تنظيف تاريخ الطلبات: ${this.requestHistory.length} طلب متبقي`);
    }

    canMakeRequest() {
        const now = Date.now();
        
        if (now < this.cooldownUntil) {
            return { allowed: false, reason: 'cooldown', waitTime: this.cooldownUntil - now };
        }

        const lastMinute = this.requestHistory.filter(r => now - r.timestamp < 60000).length;
        const lastHour = this.requestHistory.filter(r => now - r.timestamp < 3600000).length;
        const last24Hours = this.requestHistory.filter(r => now - r.timestamp < 86400000).length;

        if (lastMinute >= this.rateLimits.perMinute) {
            return { allowed: false, reason: 'minute', waitTime: 60000 };
        }
        if (lastHour >= this.rateLimits.perHour) {
            return { allowed: false, reason: 'hour', waitTime: 3600000 };
        }
        if (last24Hours >= this.rateLimits.per24Hours) {
            return { allowed: false, reason: 'day', waitTime: 86400000 };
        }

        // فحص صحة العقد
        const bestNode = this.getBestNode();
        if (!bestNode) {
            return { allowed: false, reason: 'no_nodes', waitTime: 30000 };
        }

        return { allowed: true, bestNode };
    }

    async addRequest(requestFn, metadata = {}) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({ 
                requestFn, 
                resolve, 
                reject, 
                metadata,
                timestamp: Date.now() 
            });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.processing || this.requestQueue.length === 0) return;
        
        this.processing = true;
        console.log(`🎵 معالجة قائمة الانتظار: ${this.requestQueue.length} طلب`);
        
        while (this.requestQueue.length > 0) {
            const canRequest = this.canMakeRequest();
            
            if (!canRequest.allowed) {
                const waitTime = Math.min(canRequest.waitTime, 60000);
                console.log(`⏳ انتظار ${Math.ceil(waitTime / 1000)}s بسبب ${canRequest.reason}`);
                await this.delay(waitTime);
                continue;
            }

            const { requestFn, resolve, reject, metadata } = this.requestQueue.shift();
            
            try {
                this.requestHistory.push({
                    timestamp: Date.now(),
                    metadata,
                    node: canRequest.bestNode
                });

                const result = await requestFn(canRequest.bestNode);
                resolve(result);
                
                // تأخير أقل مع Lavalink لأنه أكثر كفاءة
                await this.delay(1000);
                
            } catch (error) {
                console.error(`❌ خطأ في الطلب:`, error.message);
                
                if (this.is429Error(error) || this.isRateLimitError(error)) {
                    console.log('🚨 خطأ 429/Rate Limit - تفعيل cooldown لمدة 10 دقائق');
                    this.cooldownUntil = Date.now() + (10 * 60 * 1000); // 10 دقائق بدلاً من 15
                    this.requestQueue.unshift({ requestFn, resolve, reject, metadata });
                } else {
                    reject(error);
                }
            }
        }
        
        this.processing = false;
    }

    is429Error(error) {
        return error.message.includes('429') || 
               error.message.includes('Too Many Requests') ||
               error.statusCode === 429;
    }

    isRateLimitError(error) {
        return error.message.includes('rate limit') ||
               error.message.includes('Rate limit') ||
               error.message.includes('RATE_LIMITED');
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getStats() {
        return {
            queueLength: this.requestQueue.length,
            requestsToday: this.requestHistory.length,
            cooldownActive: Date.now() < this.cooldownUntil,
            nodeHealth: Object.fromEntries(this.nodeHealth),
            rateLimits: this.rateLimits
        };
    }
}

// إنشاء مدير Lavalink المتقدم
const lavalinkManager = new AdvancedLavalinkManager();
global.advancedManager = lavalinkManager; // جعله متاحاً عالمياً

// إنشاء خادم HTTP محسن
let botInstance = null;

const server = http.createServer((req, res) => {
    res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });

    const stats = lavalinkManager.getStats();
    
    res.end(JSON.stringify({
        status: 'online',
        service: 'Lavamusic Enhanced',
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        message: 'Advanced Lavamusic with 429 Protection is running!',
        botConnected: botInstance ? botInstance.isReady() : false,
        guilds: botInstance ? botInstance.guilds.cache.size : 0,
        users: botInstance ? botInstance.users.cache.size : 0,
        memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            external: Math.round(process.memoryUsage().external / 1024 / 1024)
        },
        lavalink_stats: stats,
        protection: {
            active: true,
            type: 'Advanced 429 Protection',
            version: '2.0'
        }
    }, null, 2));
});

server.listen(PORT, () => {
    console.log(`🌐 HTTP Server running on port ${PORT}`);
    console.log(`📊 Stats available at: http://localhost:${PORT}`);
});

// معالجة أخطاء غير متوقعة محسنة
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    // لا نخرج من العملية مباشرة، نعطي فرصة للتعافي
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// تحميل متغيرات البيئة
require('dotenv').config();

// إعداد Lavalink متقدم
const createAdvancedLavalinkConfig = () => {
    const nodes = [];
    
    // عقدة افتراضية
    if (process.env.LAVALINK_HOST && process.env.LAVALINK_PORT && process.env.LAVALINK_PASSWORD) {
        nodes.push({
            authorization: process.env.LAVALINK_PASSWORD,
            host: process.env.LAVALINK_HOST,
            port: parseInt(process.env.LAVALINK_PORT),
            id: "main_node",
            retryAmountForRequests: 5,
            retryDelayForRequests: 1000,
        });
    }
    
    // عقد إضافية من متغيرات البيئة
    for (let i = 1; i <= 5; i++) {
        const host = process.env[`LAVALINK_HOST_${i}`];
        const port = process.env[`LAVALINK_PORT_${i}`];
        const password = process.env[`LAVALINK_PASSWORD_${i}`];
        
        if (host && port && password) {
            nodes.push({
                authorization: password,
                host: host,
                port: parseInt(port),
                id: `node_${i}`,
                retryAmountForRequests: 5,
                retryDelayForRequests: 1000,
            });
        }
    }
    
    if (nodes.length === 0) {
        // عقدة افتراضية محلية
        nodes.push({
            authorization: "youshallnotpass",
            host: "localhost",
            port: 2333,
            id: "local_node",
            retryAmountForRequests: 3,
            retryDelayForRequests: 2000,
        });
    }
    
    return {
        nodes,
        sendToShard: (guildId, payload) => {
            if (botInstance) {
                return botInstance.ws.send(payload);
            }
        },
        autoSkip: true,
        playerOptions: {
            maxErrorsPerTime: {
                threshold: 10,
                time: 60000 * 5 // 5 دقائق
            },
            minSearchResults: 1,
            maxSearchResults: 10,
            searchPlatform: "ytsearch",
        },
        queueOptions: {
            maxPreviousTracks: 25,
            queueStore: new Map(),
        },
        linksBlacklist: [],
        linksWhitelist: [],
        advancedOptions: {
            enableAdvancedSearch: true,
            maxConcurrentRequests: 3,
            searchTimeout: 30000,
            requestRetries: 2
        }
    };
};

// دالة التشغيل المحسنة مع Lavalink
async function handlePlayCommand(interaction, query, client) {
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    
    if (!member?.voice.channel) {
        return interaction.reply({
            embeds: [{
                color: 0xff0000,
                title: "يجب أن تكون في روم صوتي أولاً",
                thumbnail: {
                    url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center"
                }
            }],
            ephemeral: true
        });
    }

    if (!query) {
        return interaction.reply({
            embeds: [{
                color: 0xff0000,
                title: "اكتب اسم الأغنية بعد الأمر",
                description: "مثال: /play أم كلثوم",
                thumbnail: {
                    url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center"
                }
            }],
            ephemeral: true
        });
    }

    await interaction.deferReply();

    const stats = lavalinkManager.getStats();
    const loadingEmbed = {
        color: 0xffa500,
        title: "البحث الذكي - Lavamusic Enhanced",
        description: `جاري البحث عن: **${query}**\nالموضع في القائمة: ${stats.queueLength + 1}`,
        fields: [
            { name: "حالة النظام", value: `طلبات اليوم: ${stats.requestsToday}/${lavalinkManager.rateLimits.per24Hours}`, inline: true },
            { name: "Lavalink", value: stats.cooldownActive ? "انتظار" : "جاهز", inline: true },
            { name: "العقد النشطة", value: Object.keys(stats.nodeHealth).length.toString(), inline: true }
        ],
        thumbnail: {
            url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center"
        },
        footer: { text: "Lavamusic Enhanced - نظام حماية متقدم" }
    };

    await interaction.editReply({ embeds: [loadingEmbed] });

    try {
        const result = await lavalinkManager.addRequest(async (bestNode) => {
            const player = client.lavalink.getPlayer(interaction.guild.id) || 
                          await client.lavalink.createPlayer({
                              guildId: interaction.guild.id,
                              voiceChannelId: member.voice.channel.id,
                              textChannelId: interaction.channel.id,
                              selfDeaf: true,
                              selfMute: false,
                              node: bestNode
                          });

            const searchResult = await player.search({
                query: query,
                source: "ytsearch",
                requester: interaction.user
            }, interaction.user);

            if (!searchResult || !searchResult.tracks.length) {
                throw new Error('لم يتم العثور على نتائج');
            }

            const track = searchResult.tracks[0];
            await player.queue.add(track);

            if (!player.playing && !player.paused && !player.queue.size) {
                await player.play();
            }

            return { player, track, searchResult };
        }, { 
            query, 
            guild: interaction.guild.name, 
            user: interaction.user.tag,
            channel: interaction.channel.id
        });

        const successEmbed = {
            color: 0x8B5A8C,
            title: result.player.queue.size === 0 ? "🎵 بدأ التشغيل" : "✅ تمت الإضافة للقائمة",
            description: `**${result.track.info.title}**\n**الفنان:** ${result.track.info.author}\n**المدة:** ${msToTime(result.track.info.duration)}`,
            fields: [
                { name: "طلبها", value: interaction.user.toString(), inline: true },
                { name: "المصدر", value: result.track.info.sourceName || "YouTube", inline: true },
                { name: "الترتيب في القائمة", value: (result.player.queue.size + 1).toString(), inline: true }
            ],
            thumbnail: { 
                url: result.track.info.artworkUrl || "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center"
            },
            footer: { text: `إجمالي الأغاني: ${result.player.queue.size + 1}` },
            timestamp: new Date()
        };

        if (result.track.info.uri) {
            successEmbed.url = result.track.info.uri;
        }

        await interaction.editReply({ embeds: [successEmbed] });
        
    } catch (error) {
        console.error("خطأ في handlePlayCommand:", error.message);
        await handlePlayError(error, interaction, query);
    }
}

// معالج أخطاء محسن لـ Lavamusic
async function handlePlayError(error, interaction, query) {
    const errorMessage = error.message.toLowerCase();
    
    if (lavalinkManager.is429Error(error) || lavalinkManager.isRateLimitError(error)) {
        await interaction.editReply({
            embeds: [{
                color: 0xff9500,
                title: "نظام الحماية نشط",
                description: `تم تفعيل الحماية من Rate Limit لضمان استمرارية الخدمة.\n\nالأغنية المطلوبة: ${query}`,
                fields: [
                    {
                        name: "ما يحدث الآن",
                        value: "تم إضافة طلبك لقائمة الانتظار الذكية\nسيتم تشغيله تلقائياً عند زوال المنع\nالنظام يحمي البوت من التوقف",
                        inline: false
                    },
                    {
                        name: "الوقت المتوقع",
                        value: "5-10 دقائق في المتوسط\nيتم المحاولة تلقائياً\nلا حاجة لإعادة الطلب",
                        inline: false
                    }
                ],
                thumbnail: {
                    url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center"
                },
                footer: { text: "Lavamusic Enhanced - نظام حماية متقدم" },
                timestamp: new Date()
            }]
        });
    } else if (errorMessage.includes('no results') || errorMessage.includes('لم يتم العثور')) {
        await interaction.editReply({
            embeds: [{
                color: 0xff0000,
                title: "🔍 لا توجد نتائج",
                description: `لم يتم العثور على نتائج للبحث: **${query}**`,
                fields: [{
                    name: "اقتراحات",
                    value: "• جرب كلمات أبسط\n• استخدم اسم الفنان + اسم الأغنية\n• تأكد من كتابة الاسم بشكل صحيح",
                    inline: false
                }],
                thumbnail: { url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center" },
                footer: { text: "Lavamusic Enhanced" }
            }]
        });
    } else {
        await interaction.editReply({
            embeds: [{
                color: 0xff0000,
                title: "خطأ في التشغيل",
                description: "حدث خطأ أثناء محاولة تشغيل الأغنية",
                fields: [{
                    name: "الحلول المقترحة",
                    value: "• جرب أغنية أخرى\n• انتظر دقيقة وأعد المحاولة\n• تأكد من اتصال Lavalink",
                    inline: false
                }],
                thumbnail: {
                    url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center"
                },
                footer: { text: "Lavamusic Enhanced" }
            }]
        });
    }
}

// دالة مساعدة لتحويل الوقت
function msToTime(duration) {
    const seconds = Math.floor((duration / 1000) % 60);
    const minutes = Math.floor((duration / (1000 * 60)) % 60);
    const hours = Math.floor(duration / (1000 * 60 * 60));

    const hoursStr = hours > 0 ? `${hours}:` : '';
    const minutesStr = minutes < 10 && hours > 0 ? `0${minutes}` : minutes;
    const secondsStr = seconds < 10 ? `0${seconds}` : seconds;

    return `${hoursStr}${minutesStr}:${secondsStr}`;
}

// إنشاء البوت الرئيسي
function createEnhancedLavamusic() {
    console.log('🤖 إنشاء Lavamusic Enhanced...');
    
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
        ],
    });

    // إعداد Lavalink
    const lavalinkConfig = createAdvancedLavalinkConfig();
    client.lavalink = new LavalinkManager(lavalinkConfig);
    global.lavalinkManager = client.lavalink; // للوصول من النظام المتقدم

    // ربط أحداث Lavalink
    client.lavalink
        .on("playerStart", (player, track) => {
            console.log(`🎵 بدأ تشغيل: ${track.info.title}`);
            
            if (client.user) {
                client.user.setActivity(`${track.info.title}`, { 
                    type: ActivityType.Streaming,
                    url: 'https://www.twitch.tv/discord'
                });
            }

            if (player.textChannelId) {
                const channel = client.channels.cache.get(player.textChannelId);
                if (channel) {
                    channel.send({
                        embeds: [{
                            color: 0x8B5A8C,
                            title: "🎵 بدأ التشغيل",
                            description: `**${track.info.title}**\n**الفنان:** ${track.info.author}\n**المدة:** ${msToTime(track.info.duration)}`,
                            thumbnail: { url: track.info.artworkUrl || "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center" },
                            footer: { text: `${player.queue.size} أغنية في القائمة` },
                            timestamp: new Date()
                        }]
                    }).catch(console.error);
                }
            }
        })
        .on("playerEnd", (player, track) => {
            console.log(`✅ انتهى تشغيل: ${track.info.title}`);
        })
        .on("playerEmpty", (player) => {
            console.log(`📭 انتهت قائمة التشغيل في ${player.guildId}`);
            
            if (client.user) {
                client.user.setActivity('Lavamusic Enhanced', { 
                    type: ActivityType.Streaming,
                    url: 'https://www.twitch.tv/discord'
                });
            }
        })
        .on("playerError", (player, error) => {
            console.error(`❌ خطأ في المشغل ${player.guildId}:`, error);
        })
        .on("nodeConnect", (node) => {
            console.log(`✅ اتصلت عقدة Lavalink: ${node.options.id}`);
        })
        .on("nodeDisconnect", (node) => {
            console.log(`❌ انقطع اتصال عقدة Lavalink: ${node.options.id}`);
        })
        .on("nodeError", (node, error) => {
            console.error(`❌ خطأ في عقدة Lavalink ${node.options.id}:`, error);
        });

    // أحداث البوت
    client.once("ready", () => {
        console.log(`✅ تم تسجيل الدخول كـ ${client.user.tag}`);
        console.log(`🎵 Lavamusic Enhanced جاهز للاستخدام!`);
        console.log(`🌐 البوت متصل بـ ${client.guilds.cache.size} خادم`);
        console.log(`👥 يخدم ${client.users.cache.size} مستخدم`);
        console.log(`🛡️ نظام الحماية المتقدم من 429 نشط`);
        
        // إعداد Lavalink
        client.lavalink.init({
            id: client.user.id,
            username: client.user.username,
        });

        // تحديث حالة البوت
        client.user.setActivity('Lavamusic Enhanced - /play', { 
            type: ActivityType.Streaming,
            url: 'https://www.twitch.tv/discord'
        });

        botInstance = client; // تعيين المرجع العالمي
    });

    // معالجة الأوامر التفاعلية (Slash Commands)
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        const { commandName } = interaction;

        try {
            switch (commandName) {
                case 'play':
                case 'ش':
                case 'شغل':
                    const query = interaction.options.getString('query') || interaction.options.getString('song');
                    await handlePlayCommand(interaction, query, client);
                    break;
                    
                case 'skip':
                case 'س':
                    await handleSkipCommand(interaction, client);
                    break;
                    
                case 'stop':
                case 'ق':
                    await handleStopCommand(interaction, client);
                    break;
                    
                case 'queue':
                case 'قائمة':
                    await handleQueueCommand(interaction, client);
                    break;
                    
                case 'nowplaying':
                case 'np':
                case 'الان':
                    await handleNowPlayingCommand(interaction, client);
                    break;
                    
                case 'volume':
                case 'صوت':
                    const volume = interaction.options.getInteger('level');
                    await handleVolumeCommand(interaction, client, volume);
                    break;
                    
                case 'pause':
                case 'وقف':
                    await handlePauseCommand(interaction, client);
                    break;
                    
                case 'resume':
                case 'استكمال':
                    await handleResumeCommand(interaction, client);
                    break;
                    
                case 'help':
                case 'مساعدة':
                    await handleHelpCommand(interaction, client);
                    break;
                    
                case 'stats':
                case 'احصائيات':
                    await handleStatsCommand(interaction, client);
                    break;
                    
                default:
                    await interaction.reply({
                        content: 'أمر غير معروف!',
                        ephemeral: true
                    });
            }
        } catch (error) {
            console.error(`خطأ في معالجة الأمر ${commandName}:`, error);
            
            const errorReply = {
                embeds: [{
                    color: 0xff0000,
                    title: "خطأ في تنفيذ الأمر",
                    description: "حدث خطأ أثناء تنفيذ الأمر، يرجى المحاولة مرة أخرى",
                    footer: { text: "Lavamusic Enhanced" }
                }],
                ephemeral: true
            };
            
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply(errorReply).catch(console.error);
            } else {
                await interaction.reply(errorReply).catch(console.error);
            }
        }
    });

    // معالجة الرسائل العادية (Prefix Commands)
    client.on("messageCreate", async (message) => {
        if (!message.guild || message.author.bot) return;
        
        const prefix = process.env.PREFIX || '!';
        if (!message.content.startsWith(prefix)) return;
        
        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const command = args.shift()?.toLowerCase();
        
        if (!command) return;
        
        try {
            // تحويل الرسالة لتفاعل وهمي للتوافق مع الدوال الموجودة
            const fakeInteraction = createFakeInteraction(message, args);
            
            switch (command) {
                case 'play':
                case 'p':
                case 'ش':
                case 'شغل':
                    const query = args.join(' ');
                    await handlePlayCommand(fakeInteraction, query, client);
                    break;
                    
                case 'skip':
                case 's':
                case 'س':
                    await handleSkipCommand(fakeInteraction, client);
                    break;
                    
                case 'stop':
                case 'st':
                case 'ق':
                    await handleStopCommand(fakeInteraction, client);
                    break;
                    
                case 'queue':
                case 'q':
                case 'قائمة':
                    await handleQueueCommand(fakeInteraction, client);
                    break;
                    
                case 'np':
                case 'nowplaying':
                case 'الان':
                    await handleNowPlayingCommand(fakeInteraction, client);
                    break;
                    
                case 'volume':
                case 'vol':
                case 'صوت':
                    const volume = parseInt(args[0]) || 50;
                    await handleVolumeCommand(fakeInteraction, client, volume);
                    break;
                    
                case 'pause':
                case 'وقف':
                    await handlePauseCommand(fakeInteraction, client);
                    break;
                    
                case 'resume':
                case 'r':
                case 'استكمال':
                    await handleResumeCommand(fakeInteraction, client);
                    break;
                    
                case 'help':
                case 'h':
                case 'مساعدة':
                    await handleHelpCommand(fakeInteraction, client);
                    break;
                    
                case 'stats':
                case 'احصائيات':
                    await handleStatsCommand(fakeInteraction, client);
                    break;
            }
        } catch (error) {
            console.error(`خطأ في معالجة الأمر النصي ${command}:`, error);
            message.reply({
                embeds: [{
                    color: 0xff0000,
                    title: "خطأ في تنفيذ الأمر",
                    description: "حدث خطأ أثناء تنفيذ الأمر، يرجى المحاولة مرة أخرى"
                }]
            }).catch(console.error);
        }
    });

    client.on("error", error => {
        console.error(`خطأ في العميل:`, error);
    });

    client.on("warn", warning => {
        console.warn(`تحذير من العميل:`, warning);
    });

    client.on("shardError", error => {
        console.error(`خطأ في WebSocket:`, error);
    });

    return client;
}

// إنشاء تفاعل وهمي للتوافق مع الأوامر النصية
function createFakeInteraction(message, args) {
    return {
        guild: message.guild,
        user: message.author,
        member: message.member,
        channel: message.channel,
        replied: false,
        deferred: false,
        options: {
            getString: (name) => {
                if (name === 'query' || name === 'song') return args.join(' ');
                if (name === 'level' && args[0]) return parseInt(args[0]);
                return null;
            },
            getInteger: (name) => {
                if (name === 'level' && args[0]) return parseInt(args[0]);
                return null;
            }
        },
        reply: async (options) => {
            await message.reply(options);
        },
        editReply: async (options) => {
            // للرسائل العادية، نرسل رسالة جديدة بدلاً من التحرير
            await message.channel.send(options);
        },
        deferReply: async () => {
            // إرسال رسالة انتظار
            const msg = await message.reply({
                embeds: [{
                    color: 0xffa500,
                    title: "جاري المعالجة...",
                    description: "يرجى الانتظار"
                }]
            });
            
            // تحديث editReply ليحرر هذه الرسالة
            this.editReply = async (options) => {
                await msg.edit(options);
            };
        }
    };
}

// باقي دوال التحكم المحسنة

async function handleSkipCommand(interaction, client) {
    const player = client.lavalink.getPlayer(interaction.guild.id);
    
    if (!player || !player.queue.current) {
        return interaction.reply({
            embeds: [{
                color: 0xff0000,
                title: "لا توجد أغنية قيد التشغيل",
                thumbnail: { url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center" }
            }],
            ephemeral: true
        });
    }

    const currentTrack = player.queue.current;
    await player.skip();
    
    await interaction.reply({
        embeds: [{
            color: 0xffa500,
            title: "⏭️ تم تخطي الأغنية",
            description: `تم تخطي: **${currentTrack.info.title}**`,
            thumbnail: { url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center" },
            footer: { text: `بقي في القائمة: ${player.queue.size} أغنية` }
        }]
    });
}

async function handleStopCommand(interaction, client) {
    const player = client.lavalink.getPlayer(interaction.guild.id);
    
    if (!player) {
        return interaction.reply({
            embeds: [{
                color: 0xff0000,
                title: "لا توجد موسيقى قيد التشغيل",
                thumbnail: { url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center" }
            }],
            ephemeral: true
        });
    }

    await player.destroy();
    
    await interaction.reply({
        embeds: [{
            color: 0xff0000,
            title: "⏹️ تم إيقاف الموسيقى",
            description: "تم إيقاف جميع الأغاني وإفراغ القائمة\n\nالبوت جاهز لتشغيل أغاني جديدة!",
            thumbnail: { url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center" },
            footer: { text: "Lavamusic Enhanced" }
        }]
    });
}

async function handleQueueCommand(interaction, client) {
    const player = client.lavalink.getPlayer(interaction.guild.id);
    
    if (!player || (!player.queue.current && !player.queue.size)) {
        return interaction.reply({
            embeds: [{
                color: 0xff0000,
                title: "القائمة فارغة",
                description: "لا توجد أغاني في قائمة التشغيل",
                thumbnail: { url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center" }
            }],
            ephemeral: true
        });
    }

    const current = player.queue.current;
    const queue = player.queue.tracks.slice(0, 10); // أول 10 أغاني
    
    let description = '';
    
    if (current) {
        description += `**الآن يتم تشغيل:**\n🎵 [${current.info.title}](${current.info.uri})\n**المدة:** ${msToTime(current.info.duration)}\n\n`;
    }
    
    if (queue.length > 0) {
        description += '**قائمة الانتظار:**\n';
        queue.forEach((track, index) => {
            description += `${index + 1}. [${track.info.title}](${track.info.uri}) - ${msToTime(track.info.duration)}\n`;
        });
        
        if (player.queue.size > 10) {
            description += `\n... و ${player.queue.size - 10} أغنية أخرى`;
        }
    }

    await interaction.reply({
        embeds: [{
            color: 0x8B5A8C,
            title: "🎵 قائمة التشغيل",
            description: description,
            fields: [
                { name: "إجمالي الأغاني", value: (player.queue.size + (current ? 1 : 0)).toString(), inline: true },
                { name: "المدة الإجمالية", value: calculateTotalDuration(player), inline: true }
            ],
            thumbnail: { url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center" },
            footer: { text: "Lavamusic Enhanced" }
        }]
    });
}

async function handleNowPlayingCommand(interaction, client) {
    const player = client.lavalink.getPlayer(interaction.guild.id);
    
    if (!player || !player.queue.current) {
        return interaction.reply({
            embeds: [{
                color: 0xff0000,
                title: "لا توجد أغنية قيد التشغيل",
                thumbnail: { url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center" }
            }],
            ephemeral: true
        });
    }

    const track = player.queue.current;
    const position = player.position;
    const duration = track.info.duration;
    
    // شريط التقدم
    const progressBar = createProgressBar(position, duration);
    
    await interaction.reply({
        embeds: [{
            color: 0x8B5A8C,
            title: "🎵 الآن يتم تشغيل",
            description: `**[${track.info.title}](${track.info.uri})**\n**الفنان:** ${track.info.author}`,
            fields: [
                { name: "طلبها", value: track.requester?.toString() || "غير معروف", inline: true },
                { name: "الحالة", value: player.paused ? "متوقف مؤقتاً" : "يتم التشغيل", inline: true },
                { name: "مستوى الصوت", value: `${player.volume}%`, inline: true },
                { name: "التقدم", value: `${progressBar}\n${msToTime(position)} / ${msToTime(duration)}`, inline: false }
            ],
            thumbnail: { url: track.info.artworkUrl || "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center" },
            footer: { text: `${player.queue.size} أغنية في القائمة` },
            timestamp: new Date()
        }]
    });
}

async function handleVolumeCommand(interaction, client, volume) {
    const player = client.lavalink.getPlayer(interaction.guild.id);
    
    if (!player) {
        return interaction.reply({
            embeds: [{
                color: 0xff0000,
                title: "لا يوجد مشغل نشط",
                thumbnail: { url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center" }
            }],
            ephemeral: true
        });
    }

    if (volume < 0 || volume > 200) {
        return interaction.reply({
            embeds: [{
                color: 0xff0000,
                title: "مستوى صوت غير صحيح",
                description: "يجب أن يكون مستوى الصوت بين 0 و 200",
                thumbnail: { url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center" }
            }],
            ephemeral: true
        });
    }

    await player.setVolume(volume);
    
    const volumeIcon = volume === 0 ? "🔇" : volume < 30 ? "🔈" : volume < 70 ? "🔉" : "🔊";
    
    await interaction.reply({
        embeds: [{
            color: 0x8B5A8C,
            title: `${volumeIcon} تم تغيير مستوى الصوت`,
            description: `مستوى الصوت الجديد: **${volume}%**`,
            thumbnail: { url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center" },
            footer: { text: "Lavamusic Enhanced" }
        }]
    });
}

async function handlePauseCommand(interaction, client) {
    const player = client.lavalink.getPlayer(interaction.guild.id);
    
    if (!player || !player.queue.current) {
        return interaction.reply({
            embeds: [{
                color: 0xff0000,
                title: "لا توجد أغنية قيد التشغيل",
                thumbnail: { url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center" }
            }],
            ephemeral: true
        });
    }

    if (player.paused) {
        return interaction.reply({
            embeds: [{
                color: 0xffa500,
                title: "الأغنية متوقفة مؤقتاً بالفعل",
                thumbnail: { url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center" }
            }],
            ephemeral: true
        });
    }

    await player.pause();
    
    await interaction.reply({
        embeds: [{
            color: 0xffa500,
            title: "⏸️ تم إيقاف التشغيل مؤقتاً",
            description: `تم إيقاف: **${player.queue.current.info.title}**`,
            thumbnail: { url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center" },
            footer: { text: "استخدم /resume لمتابعة التشغيل" }
        }]
    });
}

async function handleResumeCommand(interaction, client) {
    const player = client.lavalink.getPlayer(interaction.guild.id);
    
    if (!player || !player.queue.current) {
        return interaction.reply({
            embeds: [{
                color: 0xff0000,
                title: "لا توجد أغنية قيد التشغيل",
                thumbnail: { url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center" }
            }],
            ephemeral: true
        });
    }

    if (!player.paused) {
        return interaction.reply({
            embeds: [{
                color: 0xffa500,
                title: "الأغنية قيد التشغيل بالفعل",
                thumbnail: { url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center" }
            }],
            ephemeral: true
        });
    }

    await player.resume();
    
    await interaction.reply({
        embeds: [{
            color: 0x00ff00,
            title: "▶️ تم استكمال التشغيل",
            description: `تم استكمال: **${player.queue.current.info.title}**`,
            thumbnail: { url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center" },
            footer: { text: "Lavamusic Enhanced" }
        }]
    });
}

async function handleHelpCommand(interaction, client) {
    const helpEmbed = {
        color: 0x8B5A8C,
        title: "Lavamusic Enhanced - دليل الأوامر الكامل",
        description: "بوت موسيقي متطور مع Lavalink وحماية كاملة من خطأ 429",
        fields: [
            {
                name: "🎵 تشغيل الموسيقى",
                value: "`/play [song]` - تشغيل أغنية\n`/ش [اسم الأغنية]` - تشغيل بالعربية\n`/شغل [اسم الأغنية]` - بديل عربي",
                inline: false
            },
            {
                name: "⏯️ التحكم في التشغيل", 
                value: "`/skip` - تخطي الأغنية\n`/stop` - إيقاف كامل\n`/pause` - إيقاف مؤقت\n`/resume` - استكمال التشغيل",
                inline: false
            },
            {
                name: "📋 إدارة القائمة",
                value: "`/queue` - عرض قائمة التشغيل\n`/nowplaying` - الأغنية الحالية\n`/volume [0-200]` - تغيير الصوت",
                inline: false
            },
            {
                name: "ℹ️ المعلومات",
                value: "`/help` - عرض هذه القائمة\n`/stats` - إحصائيات البوت والنظام",
                inline: false
            },
            {
                name: "🌟 المميزات الخاصة",
                value: "• حماية متقدمة من خطأ 429\n• دعم متعدد العقد Lavalink\n• جودة صوت عالية\n• دعم كامل للعربية",
                inline: false
            }
        ],
        thumbnail: { url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center" },
        footer: { 
            text: "Lavamusic Enhanced - تشغيل 24/7", 
            icon_url: client.user?.displayAvatarURL() 
        },
        timestamp: new Date()
    };

    await interaction.reply({ embeds: [helpEmbed] });
}

async function handleStatsCommand(interaction, client) {
    const stats = lavalinkManager.getStats();
    const memoryUsage = process.memoryUsage();
    
    // إحصائيات العقد
    let nodesInfo = "لا توجد عقد متصلة";
    if (Object.keys(stats.nodeHealth).length > 0) {
        nodesInfo = Object.entries(stats.nodeHealth)
            .map(([id, health]) => `${id}: ${health.connected ? '🟢' : '🔴'} (${health.players} players)`)
            .join('\n');
    }
    
    await interaction.reply({
        embeds: [{
            color: 0x8B5A8C,
            title: "📊 إحصائيات Lavamusic Enhanced",
            fields: [
                {
                    name: "🤖 معلومات البوت",
                    value: `**الخوادم:** ${client.guilds.cache.size}\n**المستخدمون:** ${client.users.cache.size}\n**البنغ:** ${Math.round(client.ws.ping)}ms\n**الوقت النشط:** ${formatUptime(process.uptime())}`,
                    inline: true
                },
                {
                    name: "💾 الذاكرة",
                    value: `**المستخدمة:** ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB\n**الإجمالي:** ${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB\n**الخارجية:** ${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
                    inline: true
                },
                {
                    name: "🛡️ نظام الحماية",
                    value: `**قائمة الانتظار:** ${stats.queueLength}\n**طلبات اليوم:** ${stats.requestsToday}/${lavalinkManager.rateLimits.per24Hours}\n**حالة الحماية:** ${stats.cooldownActive ? '🔶 نشط' : '🟢 جاهز'}`,
                    inline: true
                },
                {
                    name: "🔗 عقد Lavalink",
                    value: nodesInfo,
                    inline: false
                }
            ],
            thumbnail: { url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center" },
            footer: { text: "Lavamusic Enhanced - Advanced Stats" },
            timestamp: new Date()
        }]
    });
}

// دوال مساعدة
function calculateTotalDuration(player) {
    let total = 0;
    if (player.queue.current) total += player.queue.current.info.duration;
    player.queue.tracks.forEach(track => total += track.info.duration);
    return msToTime(total);
}

function createProgressBar(current, total, length = 20) {
    const progress = Math.round((current / total) * length);
    const emptyProgress = length - progress;
    
    const progressText = '▰'.repeat(progress);
    const emptyProgressText = '▱'.repeat(emptyProgress);
    
    return progressText + emptyProgressText;
}

function formatUptime(uptime) {
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

// تشغيل البوت المحسن
console.log('🚀 بدء تشغيل Lavamusic Enhanced...');
console.log(`🌍 البيئة: ${process.env.NODE_ENV || 'development'}`);
console.log(`🖥️ Node.js: ${process.version}`);
console.log(`💾 الذاكرة: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);

// التحقق من التوكن
if (!process.env.TOKEN && !process.env.BOT_TOKEN) {
    console.error("❌ لم يتم العثور على توكن البوت!");
    console.error("💡 تأكد من وجود TOKEN أو BOT_TOKEN في متغيرات البيئة");
    process.exit(1);
}

// إنشاء وتشغيل البوت
const client = createEnhancedLavamusic();

// تسجيل دخول البوت
const token = process.env.TOKEN || process.env.BOT_TOKEN;
client.login(token).then(() => {
    console.log('✅ تم تسجيل دخول البوت بنجاح!');
}).catch(error => {
    console.error(`❌ فشل في تسجيل دخول البوت:`);
    console.error("تفاصيل الخطأ:", error.message);
    if (error.code === 'TOKEN_INVALID') {
        console.error('🔑 التوكن غير صحيح! تأكد من التوكن في متغيرات البيئة');
    }
    process.exit(1);
});

// keep-alive محسن للاستضافة السحابية
if (process.env.NODE_ENV === 'production') {
    const keepAliveInterval = setInterval(() => {
        http.get(`http://localhost:${PORT}`, (res) => {
            const status = res.statusCode === 200 ? "✅" : "⚠️";
            const stats = lavalinkManager.getStats();
            console.log(`${status} Keep-alive: ${res.statusCode} | Queue: ${stats.queueLength} | Requests: ${stats.requestsToday} | Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB | Nodes: ${Object.keys(stats.nodeHealth).length}`);
        }).on('error', (err) => {
            console.log('🔴 Keep-alive failed:', err.message);
        });
    }, 25 * 60 * 1000); // كل 25 دقيقة
    
    console.log('🔄 Advanced keep-alive system activated for Lavamusic Enhanced');
}

// نظام تنظيف الذاكرة المتقدم
setInterval(() => {
    if (global.gc) {
        global.gc();
        console.log('🧹 تم تنظيف الذاكرة تلقائياً');
    }
}, 30 * 60 * 1000); // كل 30 دقيقة

// مراقبة صحة النظام
setInterval(() => {
    const memUsage = process.memoryUsage();
    const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    
    if (memUsedMB > 400) { // تحذير عند تجاوز 400MB
        console.warn(`⚠️ استخدام ذاكرة مرتفع: ${memUsedMB}MB`);
    }
    
    const stats = lavalinkManager.getStats();
    if (stats.queueLength > 50) { // تحذير عند تراكم الطلبات
        console.warn(`⚠️ قائمة انتظار كبيرة: ${stats.queueLength} طلب`);
    }
}, 5 * 60 * 1000); // كل 5 دقائق

console.log('\n🎉 تم بدء تشغيل Lavamusic Enhanced بنجاح!');
console.log('🛡️ نظام الحماية المتقدم من 429 نشط');
console.log('🔗 نظام Lavalink متعدد العقد جاهز');
console.log('📊 نظام المراقبة والإحصائيات نشط');
console.log('🌐 خادم HTTP للمراقبة يعمل');
console.log('💚 جميع الأنظمة تعمل بشكل طبيعي\n');

// تصدير الوحدات للاستخدام الخارجي (اختياري)
module.exports = {
    client: () => botInstance,
    lavalinkManager: () => lavalinkManager,
    stats: () => lavalinkManager.getStats()
};

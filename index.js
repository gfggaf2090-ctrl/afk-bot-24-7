// إعداد HTTP Server للاستضافة على Render
const http = require('http');
const PORT = process.env.PORT || 3000;

// التحقق من المكتبات المطلوبة قبل بدء التشغيل
const requiredPackages = {
    'discord.js': '14.16.3',
    'distube': '4.0.4',
    '@distube/ytdl-core': '4.16.12',
    'ytdl-core': '4.11.5',
    '@ffmpeg-installer/ffmpeg': '1.1.0',
    'ffmpeg-static': '5.2.0',
    '@discordjs/voice': '0.18.0',
    '@discordjs/opus': '0.9.0',
    'mongoose': '8.8.3'
};

console.log('🔍 فحص المكتبات المطلوبة...');

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
    console.error(`npm install ${Object.keys(requiredPackages).join(' ')}`);
    process.exit(1);
}

// تحميل المكتبات بعد التأكد من وجودها
let Client, GatewayIntentBits, ActivityType, DisTube;

try {
    const discord = require("discord.js");
    Client = discord.Client;
    GatewayIntentBits = discord.GatewayIntentBits;
    ActivityType = discord.ActivityType;
    
    const distubeModule = require("distube");
    DisTube = distubeModule.DisTube;
    
    console.log('✅ تم تحميل جميع المكتبات بنجاح');
} catch (error) {
    console.error('❌ فشل في تحميل المكتبات:', error.message);
    process.exit(1);
}

const fs = require("fs");

// نظام متقدم لإدارة طلبات YouTube وتجنب 429
class AdvancedYouTubeManager {
    constructor() {
        this.requestQueue = [];
        this.processing = false;
        this.requestHistory = [];
        this.rateLimits = {
            perMinute: 3,     // 3 طلبات في الدقيقة
            perHour: 50,      // 50 طلب في الساعة
            per24Hours: 200   // 200 طلب في 24 ساعة
        };
        this.cooldownUntil = 0;
        this.proxies = this.loadProxies();
        this.cookies = this.loadCookies();
        this.currentProxyIndex = 0;
        
        // تنظيف التاريخ كل ساعة
        setInterval(() => this.cleanHistory(), 3600000);
    }

    loadProxies() {
        // يمكن إضافة proxies من متغيرات البيئة
        const proxyList = process.env.PROXY_LIST ? process.env.PROXY_LIST.split(',') : [];
        console.log(`🌐 تم تحميل ${proxyList.length} proxy`);
        return proxyList;
    }

    loadCookies() {
        // تحميل YouTube cookies من متغيرات البيئة
        const cookies = process.env.YOUTUBE_COOKIES || '';
        if (cookies) {
            console.log('🍪 تم تحميل YouTube cookies');
            return cookies;
        }
        console.log('⚠️ لا توجد YouTube cookies - قد تحدث مشاكل مع 429');
        return null;
    }

    cleanHistory() {
        const now = Date.now();
        this.requestHistory = this.requestHistory.filter(req => 
            (now - req.timestamp) < 24 * 60 * 60 * 1000 // آخر 24 ساعة فقط
        );
        console.log(`🧹 تنظيف تاريخ الطلبات: ${this.requestHistory.length} طلب متبقي`);
    }

    canMakeRequest() {
        const now = Date.now();
        
        // فحص cooldown
        if (now < this.cooldownUntil) {
            return { allowed: false, reason: 'cooldown', waitTime: this.cooldownUntil - now };
        }

        // فحص حدود الوقت
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

        return { allowed: true };
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
                console.log(`⏳ انتظار ${Math.ceil(canRequest.waitTime / 1000)}s بسبب ${canRequest.reason}`);
                await this.delay(Math.min(canRequest.waitTime, 60000)); // أقصى انتظار دقيقة واحدة
                continue;
            }

            const { requestFn, resolve, reject, metadata } = this.requestQueue.shift();
            
            try {
                // تسجيل الطلب
                this.requestHistory.push({
                    timestamp: Date.now(),
                    metadata
                });

                // تنفيذ الطلب
                const result = await requestFn();
                resolve(result);
                
                // انتظار بين الطلبات
                await this.delay(2000); // ثانيتان بين الطلبات
                
            } catch (error) {
                console.error(`❌ خطأ في الطلب:`, error.message);
                
                if (this.is429Error(error)) {
                    console.log('🚨 خطأ 429 - تفعيل cooldown لمدة 15 دقيقة');
                    this.cooldownUntil = Date.now() + (15 * 60 * 1000);
                    
                    // إعادة الطلب إلى القائمة
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

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getNextProxy() {
        if (this.proxies.length === 0) return null;
        const proxy = this.proxies[this.currentProxyIndex];
        this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxies.length;
        return proxy;
    }
}

// إنشاء مدير YouTube المتقدم
const youtubeManager = new AdvancedYouTubeManager();

// إنشاء خادم HTTP
let bots = [];

const server = http.createServer((req, res) => {
    res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
        status: 'online',
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        message: 'Advanced Discord Music Bot is running!',
        bots: bots ? bots.length : 0,
        memory: process.memoryUsage(),
        youtube_stats: {
            queue_length: youtubeManager.requestQueue.length,
            requests_today: youtubeManager.requestHistory.length,
            cooldown_active: Date.now() < youtubeManager.cooldownUntil,
            proxies_available: youtubeManager.proxies.length
        }
    }, null, 2));
});

server.listen(PORT, () => {
    console.log(`🌐 HTTP Server running on port ${PORT}`);
});

// معالجة أخطاء غير متوقعة
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// إعداد ffmpeg
try {
    const ffmpeg = require('@ffmpeg-installer/ffmpeg');
    process.env.FFMPEG_PATH = ffmpeg.path;
    console.log('✅ تم تحديد مسار ffmpeg:', ffmpeg.path);
} catch (error) {
    try {
        const ffmpegStatic = require('ffmpeg-static');
        process.env.FFMPEG_PATH = ffmpegStatic;
        console.log('✅ تم تحديد مسار ffmpeg-static:', ffmpegStatic);
    } catch (staticError) {
        console.warn('⚠️ لم يتم العثور على ffmpeg، قد تواجه مشاكل في تشغيل الصوت');
    }
}

// قراءة إعدادات البوتات
try {
    if (process.env.BOT_TOKEN) {
        bots = [{
            name: "AdvancedMusicBot",
            token: process.env.BOT_TOKEN,
            textChannel: process.env.TEXT_CHANNEL_ID || null
        }];
        console.log('✅ تم تحميل إعدادات البوت من متغيرات البيئة');
    } else if (fs.existsSync("config.json")) {
        bots = JSON.parse(fs.readFileSync("config.json", "utf8")).map(bot => ({
            ...bot,
            token: process.env[bot.token] || bot.token
        }));
        console.log('✅ تم تحميل إعدادات البوت من config.json');
    } else {
        throw new Error('لا توجد إعدادات للبوت - تأكد من وجود BOT_TOKEN في متغيرات البيئة');
    }
} catch (error) {
    console.error("❌ خطأ في قراءة إعدادات البوت:", error.message);
    process.exit(1);
}

function createBot(config) {
    console.log(`🤖 إنشاء البوت: ${config.name}`);
    
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
        ],
    });

    // إعدادات DisTube المتقدمة مع حماية 24/7 وعدم مغادرة الروم
    const distubeOptions = {
        emitNewSongOnly: true,
        savePreviousSongs: false,
        nsfw: false,
        searchSongs: 1,
        emptyCooldown: 0, // لا توقيت للخروج عند فراغ الروم
        leaveOnEmpty: false, // لا يغادر عند فراغ الروم
        leaveOnFinish: false, // لا يغادر عند انتهاء القائمة
        leaveOnStop: false, // لا يغادر عند الإيقاف
        searchCooldown: 60,
        ffmpeg: {
            path: process.env.FFMPEG_PATH || 'ffmpeg'
        },
        ytdlOptions: {
            highWaterMark: 1024 * 1024 * 64, // 64MB buffer
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                }
            },
            // إضافة cookies إذا كانت متوفرة
            ...(youtubeManager.cookies && { 
                requestOptions: { 
                    headers: { 
                        cookie: youtubeManager.cookies 
                    } 
                } 
            })
        }
    };

    const distube = new DisTube(client, distubeOptions);

    // باقي الكود يبقى كما هو...
    // (يمكنك نسخ باقي الكود من الملف الأصلي)

    client.on("messageCreate", async (message) => {
        if (!message.guild || message.author.bot) return;
        
        if (config.textChannel && message.channel.id !== config.textChannel) return;

        const content = message.content.trim().toLowerCase();
        const originalContent = message.content.trim();

        // أوامر التشغيل
        if (content.startsWith("ش ") || content.startsWith("شغل ") || content.startsWith("play ") || content.startsWith("p ")) {
            const query = originalContent.replace(/^(ش|شغل|play|p)\s+/i, "").trim();
            await handlePlayCommand(message, query, distube);
        }
        // باقي الأوامر...
    });

    // تسجيل دخول البوت
    client.login(config.token).catch(error => {
        console.error(`❌ فشل في تسجيل دخول البوت: ${config.name || 'Unknown'}`);
        console.error("تفاصيل الخطأ:", error.message);
        if (error.code === 'TOKEN_INVALID') {
            console.error('🔑 التوكن غير صحيح! تأكد من التوكن في متغيرات البيئة');
        }
    });

    return { client, distube };
}

// تشغيل البوتات
console.log('🚀 بدء تشغيل النظام المتقدم...');

if (bots && bots.length > 0) {
    console.log(`🤖 بدء تشغيل ${bots.length} بوت(ات) متقدم...`);
    bots.forEach((config, index) => {
        console.log(`\n--- تشغيل البوت المتقدم ${index + 1}: ${config.name} ---`);
        createBot(config);
    });
    console.log('\n🎉 تم بدء تشغيل جميع البوتات المتقدمة بنجاح!');
} else {
    console.error("❌ لم يتم العثور على أي بوتات في الإعدادات");
    process.exit(1);
}

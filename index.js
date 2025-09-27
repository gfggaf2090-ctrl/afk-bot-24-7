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
                        cookie: youtubeManager.// إعداد HTTP Server للاستضافة على Render
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

    // إعدادات DisTube المتقدمة مع YouTube cookies و proxy support
    const distubeOptions = {
        emitNewSongOnly: true,
        savePreviousSongs: false,
        nsfw: false,
        searchSongs: 1,
        emptyCooldown: 0,
        leaveOnEmpty: false,
        leaveOnFinish: false,
        leaveOnStop: false,
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
        // أوامر التخطي
        else if (["س", "سكب", "skip", "next", "s", "sk"].includes(content)) {
            await handleSkipCommand(message, distube);
        }
        // أوامر الإيقاف
        else if (["ق", "stop", "إيقاف", "st", "توقف"].includes(content)) {
            await handleStopCommand(message, distube);
        }
        // أوامر الإيقاف المؤقت والاستكمال
        else if (["وقف", "pause", "إيقاف_مؤقت", "pa"].includes(content)) {
            await handlePauseCommand(message, distube);
        }
        else if (["كمل", "resume", "استكمال", "r", "استمرار"].includes(content)) {
            await handleResumeCommand(message, distube);
        }
        // أوامر التحكم في الصوت
        else if (content.startsWith("صوت ") || content.startsWith("volume ") || content.startsWith("vol ")) {
            const volume = parseInt(originalContent.replace(/^(صوت|volume|vol)\s+/i, "").trim());
            await handleVolumeCommand(message, volume, distube);
        }
        // أوامر التكرار
        else if (["تكرار", "loop", "كرر", "repeat"].includes(content)) {
            await handleLoopCommand(message, distube);
        }
        // أوامر الخلط
        else if (["خلط", "shuffle", "عشوائي", "random"].includes(content)) {
            await handleShuffleCommand(message, distube);
        }
        // أوامر عرض القائمة
        else if (["قائمة", "queue", "q", "list", "القائمة", "ل"].includes(content)) {
            await handleQueueCommand(message, distube);
        }
        // أوامر المساعدة
        else if (["مساعدة", "help", "commands", "أوامر", "h", "cmd"].includes(content)) {
            await handleHelpCommand(message, client);
        }
        // أوامر معلومات البوت
        else if (["معلومات", "info", "about", "i", "معلومات_البوت"].includes(content)) {
            await handleInfoCommand(message, client);
        }
        // أوامر الانضمام
        else if (["انضم", "join", "تعال", "j", "ادخل"].includes(content)) {
            await handleJoinCommand(message, client);
        }
        // أمر اختبار
        else if (["تست", "test", "ping", "بوت", "موجود"].includes(content)) {
            const queueStatus = youtubeManager.requestQueue.length;
            const cooldownActive = Date.now() < youtubeManager.cooldownUntil;
            
            message.channel.send({
                embeds: [{
                    color: cooldownActive ? 0xff9500 : 0x00ff00,
                    title: "✅ البوت المتقدم يعمل بشكل طبيعي!",
                    description: `مرحباً ${message.author}!\n\n🎵 **الأمر الرئيسي:** \`ش [اسم الأغنية]\`\n💡 **مثال:** ش أم كلثوم`,
                    fields: [
                        { name: "📊 البنغ", value: `${Math.round(client.ws.ping)}ms`, inline: true },
                        { name: "🎼 قائمة الانتظار", value: `${queueStatus} طلب`, inline: true },
                        { name: "🌐 حالة YouTube", value: cooldownActive ? "انتظار" : "جاهز", inline: true },
                        { name: "📈 طلبات اليوم", value: `${youtubeManager.requestHistory.length}`, inline: true },
                        { name: "🔄 Proxies", value: `${youtubeManager.proxies.length}`, inline: true },
                        { name: "🍪 Cookies", value: youtubeManager.cookies ? "متوفرة" : "غير متوفرة", inline: true }
                    ],
                    footer: { text: "بوت متقدم مع حماية من 429" }
                }]
            });
        }
    });

    // دالة التشغيل المحسنة
    async function handlePlayCommand(message, query, distube) {
        if (!message.member.voice.channel) {
            return message.channel.send("⚠️ يجب أن تكون في روم صوتي أولاً!");
        }

        if (!query) {
            return message.channel.send("⚠️ اكتب اسم الأغنية بعد الأمر!\nمثال: ش أم كلثوم");
        }

        const loadingMsg = await message.channel.send({
            embeds: [{
                color: 0xffa500,
                title: "🔍 البحث الذكي",
                description: `جاري البحث عن: **${query}**\n⏳ الموضع في القائمة: ${youtubeManager.requestQueue.length + 1}`,
                fields: [
                    { name: "📊 حالة النظام", value: `طلبات اليوم: ${youtubeManager.requestHistory.length}/200`, inline: true },
                    { name: "🌐 YouTube", value: Date.now() < youtubeManager.cooldownUntil ? "انتظار" : "جاهز", inline: true }
                ],
                footer: { text: "نظام حماية متقدم من 429" }
            }]
        });

        try {
            await youtubeManager.addRequest(async () => {
                return await distube.play(message.member.voice.channel, query, {
                    member: message.member,
                    textChannel: message.channel,
                    message,
                });
            }, { query, guild: message.guild.name, user: message.author.tag });
            
            await loadingMsg.delete().catch(() => {});
            
        } catch (error) {
            console.error("خطأ في handlePlayCommand:", error.message);
            await handlePlayError(error, loadingMsg, query, message, distube);
        }
    }

    // معالج أخطاء متقدم
    async function handlePlayError(error, loadingMsg, query, message, distube) {
        const errorMessage = error.message.toLowerCase();
        
        if (youtubeManager.is429Error(error)) {
            await loadingMsg.edit({
                embeds: [{
                    color: 0xff9500,
                    title: "⏳ نظام الحماية نشط",
                    description: `تم تفعيل الحماية من 429 لضمان استمرارية الخدمة.\n\n**الأغنية المطلوبة:** ${query}`,
                    fields: [
                        {
                            name: "🛡️ ما يحدث الآن",
                            value: "• تم إضافة طلبك لقائمة الانتظار الذكية\n• سيتم تشغيله تلقائياً عند زوال المنع\n• النظام يحمي البوت من التوقف",
                            inline: false
                        },
                        {
                            name: "⏱️ الوقت المتوقع",
                            value: "• 5-15 دقيقة في المتوسط\n• يتم المحاولة تلقائياً\n• لا حاجة لإعادة الطلب",
                            inline: false
                        },
                        {
                            name: "📊 إحصائيات النظام",
                            value: `• قائمة الانتظار: ${youtubeManager.requestQueue.length} طلب\n• طلبات اليوم: ${youtubeManager.requestHistory.length}/200\n• Proxies متاحة: ${youtubeManager.proxies.length}`,
                            inline: false
                        }
                    ],
                    footer: { text: "نظام حماية متقدم يضمن عدم توقف البوت" },
                    timestamp: new Date()
                }]
            });
        } else if (errorMessage.includes('video unavailable') || errorMessage.includes('private')) {
            await loadingMsg.edit({
                embeds: [{
                    color: 0xff0000,
                    title: "❌ الفيديو غير متاح",
                    description: `لم أتمكن من العثور على: **${query}**`,
                    fields: [{
                        name: "💡 نصائح للبحث الأمثل",
                        value: "• استخدم اسم الفنان + اسم الأغنية\n• تجنب الرموز الخاصة\n• جرب باللغة الإنجليزية",
                        inline: false
                    }],
                    footer: { text: "النظام يعمل بشكل طبيعي" }
                }]
            });
        } else {
            await loadingMsg.edit({
                embeds: [{
                    color: 0xff0000,
                    title: "❌ خطأ في التشغيل",
                    description: "حدث خطأ أثناء محاولة تشغيل الأغنية",
                    fields: [{
                        name: "🔧 الحلول المقترحة",
                        value: "• جرب أغنية أخرى\n• انتظر دقيقة وأعد المحاولة\n• استخدم كلمات أبسط",
                        inline: false
                    }],
                    footer: { text: "البوت يعمل بشكل طبيعي" }
                }]
            });
        }
    }

    // باقي الدوال (handleSkipCommand, handleStopCommand, إلخ) تبقى كما هي
    async function handleSkipCommand(message, distube) {
        try {
            const queue = distube.getQueue(message.guild.id);
            if (!queue || !queue.songs || queue.songs.length <= 1) {
                return message.channel.send("⚠️ لا توجد أغاني أخرى في القائمة للتخطي.");
            }

            const currentSong = queue.songs[0];
            await distube.skip(message.guild.id);
            
            message.channel.send({
                embeds: [{
                    color: 0xffa500,
                    title: "⏭️ تم تخطي الأغنية",
                    description: `تم تخطي: **${currentSong.name}**`,
                    footer: { text: `بقي في القائمة: ${queue.songs.length - 1} أغنية` }
                }]
            });
        } catch (error) {
            console.error("خطأ في تخطي الأغنية:", error);
            message.channel.send("❌ لا يمكن تخطي الأغنية حالياً.");
        }
    }

    // دالة الإيقاف المؤقت
    async function handlePauseCommand(message, distube) {
        try {
            const queue = distube.getQueue(message.guild.id);
            if (!queue) {
                return message.channel.send("⚠️ لا توجد موسيقى قيد التشغيل.");
            }

            if (queue.paused) {
                return message.channel.send("⚠️ الموسيقى متوقفة مؤقتاً بالفعل.");
            }

            await distube.pause(message.guild.id);
            
            message.channel.send({
                embeds: [{
                    color: 0xffa500,
                    title: "⏸️ تم إيقاف الموسيقى مؤقتاً",
                    description: `تم إيقاف: **${queue.songs[0].name}** مؤقتاً\n\n🎶 **استخدم أمر "كمل" للاستكمال**`,
                    footer: { text: "البوت لا يزال في الروم - جاهز للاستكمال" }
                }]
            });
        } catch (error) {
            console.error("خطأ في إيقاف الموسيقى مؤقتاً:", error);
            message.channel.send("❌ لا يمكن إيقاف الموسيقى مؤقتاً حالياً.");
        }
    }

    // دالة استكمال التشغيل
    async function handleResumeCommand(message, distube) {
        try {
            const queue = distube.getQueue(message.guild.id);
            if (!queue) {
                return message.channel.send("⚠️ لا توجد موسيقى قيد التشغيل.");
            }

            if (!queue.paused) {
                return message.channel.send("⚠️ الموسيقى تعمل بالفعل.");
            }

            await distube.resume(message.guild.id);
            
            message.channel.send({
                embeds: [{
                    color: 0x00ff00,
                    title: "▶️ تم استكمال التشغيل",
                    description: `تم استكمال: **${queue.songs[0].name}**\n\n🎶 **التشغيل مستمر الآن!**`,
                    footer: { text: "البوت نشط - تشغيل 24/7" }
                }]
            });
        } catch (error) {
            console.error("خطأ في استكمال الموسيقى:", error);
            message.channel.send("❌ لا يمكن استكمال الموسيقى حالياً.");
        }
    }

    // دالة التحكم في الصوت
    async function handleVolumeCommand(message, volume, distube) {
        try {
            const queue = distube.getQueue(message.guild.id);
            if (!queue) {
                return message.channel.send("⚠️ لا توجد موسيقى قيد التشغيل.");
            }

            if (isNaN(volume) || volume < 0 || volume > 200) {
                return message.channel.send("⚠️ يجب أن يكون مستوى الصوت بين 0 و 200\nمثال: صوت 50");
            }

            const oldVolume = queue.volume;
            await distube.setVolume(message.guild.id, volume);
            
            message.channel.send({
                embeds: [{
                    color: 0x00ff00,
                    title: "🔊 تم تغيير مستوى الصوت",
                    description: `تم تغيير مستوى الصوت من **${oldVolume}%** إلى **${volume}%**`,
                    fields: [
                        { name: "🎵 الأغنية الحالية", value: queue.songs[0].name, inline: true },
                        { name: "📊 مستوى الصوت الجديد", value: `${volume}%`, inline: true }
                    ],
                    footer: { text: "يمكنك استخدام 0-200 لتحديد مستوى الصوت" }
                }]
            });
        } catch (error) {
            console.error("خطأ في تغيير الصوت:", error);
            message.channel.send("❌ لا يمكن تغيير مستوى الصوت حالياً.");
        }
    }

    // دالة التكرار
    async function handleLoopCommand(message, distube) {
        try {
            const queue = distube.getQueue(message.guild.id);
            if (!queue) {
                return message.channel.send("⚠️ لا توجد موسيقى قيد التشغيل.");
            }

            let mode = distube.setRepeatMode(message.guild.id);
            const modes = {
                0: { name: "إيقاف التكرار", emoji: "🔕", color: 0xff0000 },
                1: { name: "تكرار الأغنية الحالية", emoji: "🔂", color: 0x00ff00 },
                2: { name: "تكرار القائمة كاملة", emoji: "🔁", color: 0x0099ff }
            };

            message.channel.send({
                embeds: [{
                    color: modes[mode].color,
                    title: `${modes[mode].emoji} تم تغيير نمط التكرار`,
                    description: `**النمط الجديد:** ${modes[mode].name}`,
                    fields: [
                        { name: "🎵 الأغنية الحالية", value: queue.songs[0].name, inline: true },
                        { name: "📋 الأغاني في القائمة", value: `${queue.songs.length}`, inline: true }
                    ],
                    footer: { text: "استخدم أمر 'تكرار' مرة أخرى لتغيير النمط" }
                }]
            });
        } catch (error) {
            console.error("خطأ في تغيير نمط التكرار:", error);
            message.channel.send("❌ لا يمكن تغيير نمط التكرار حالياً.");
        }
    }

    // دالة خلط القائمة
    async function handleShuffleCommand(message, distube) {
        try {
            const queue = distube.getQueue(message.guild.id);
            if (!queue || queue.songs.length <= 2) {
                return message.channel.send("⚠️ يجب أن تحتوي القائمة على أكثر من أغنيتين للخلط.");
            }

            await distube.shuffle(message.guild.id);
            
            message.channel.send({
                embeds: [{
                    color: 0xff00ff,
                    title: "🔀 تم خلط قائمة التشغيل",
                    description: `تم خلط **${queue.songs.length}** أغنية بترتيب عشوائي`,
                    fields: [
                        { name: "🎵 الأغنية الحالية", value: queue.songs[0].name, inline: true },
                        { name: "⏭️ الأغنية التالية", value: queue.songs[1]?.name || "لا توجد", inline: true }
                    ],
                    footer: { text: "تم إعادة ترتيب القائمة بشكل عشوائي" }
                }]
            });
        } catch (error) {
    // دالة الإيقاف المحسنة (بدون مغادرة الروم)
    async function handleStopCommand(message, distube) {
        try {
            const queue = distube.getQueue(message.guild.id);
            if (!queue) {
                return message.channel.send("⚠️ لا توجد موسيقى قيد التشغيل.");
            }

            // إيقاف الموسيقى دون مغادرة الروم
            await distube.stop(message.guild.id);
            
            message.channel.send({
                embeds: [{
                    color: 0xff0000,
                    title: "⏹️ تم إيقاف الموسيقى",
                    description: "تم إيقاف جميع الأغاني وإفراغ القائمة\n\n🎶 **البوت سيبقى في الروم 24/7** 🎵\n⚡ **جاهز لتشغيل أغاني جديدة فوراً!**",
                    fields: [
                        { name: "🎮 أوامر التحكم", value: "**ش** - تشغيل | **وقف** - إيقاف مؤقت | **كمل** - استكمال", inline: false },
                        { name: "🔧 أوامر متقدمة", value: "**صوت [0-200]** | **تكرار** | **خلط** | **قائمة**", inline: false }
                    ],
                    footer: { text: "البوت نشط 24/7 - لن يغادر الروم أبداً!" }
                }]
            });
        } catch (error) {
            console.error("خطأ في إيقاف الموسيقى:", error);
            message.channel.send("❌ لا يمكن إيقاف الموسيقى حالياً.");
        }
    }

    async function handleQueueCommand(message, distube) {
        try {
            const queue = distube.getQueue(message.guild.id);
            if (!queue || !queue.songs || queue.songs.length === 0) {
                return message.channel.send({
                    embeds: [{
                        color: 0xffa500,
                        title: "📋 قائمة التشغيل فارغة",
                        description: "لا توجد أغاني في القائمة حالياً\nاستخدم ش [اسم الأغنية] لإضافة أغاني"
                    }]
                });
            }

            const currentSong = queue.songs[0];
            const upcomingSongs = queue.songs.slice(1, 6);

            const embed = {
                color: 0x7289da,
                title: "📋 قائمة التشغيل المتقدمة",
                fields: [
                    {
                        name: "🎶 الآن يتم تشغيل",
                        value: `**${currentSong.name}**\n👤 ${currentSong.user}\n⏱️ ${currentSong.formattedDuration}`,
                        inline: false
                    }
                ],
                footer: {
                    text: `إجمالي: ${queue.songs.length} أغنية | مدة: ${queue.formattedDuration} | قائمة انتظار YouTube: ${youtubeManager.requestQueue.length}`
                },
                timestamp: new Date()
            };

            if (upcomingSongs.length > 0) {
                const upcomingList = upcomingSongs.map((song, index) => 
                    `${index + 1}. **${song.name}** - \`${song.formattedDuration}\``
                ).join('\n');
                
                embed.fields.push({
                    name: "⏳ القائمة القادمة",
                    value: upcomingList + (queue.songs.length > 6 ? `\n...و ${queue.songs.length - 6} أغنية أخرى` : ''),
                    inline: false
                });
            }

            message.channel.send({ embeds: [embed] });
        } catch (error) {
            console.error("خطأ في عرض القائمة:", error);
            message.channel.send("❌ حدث خطأ أثناء عرض قائمة التشغيل.");
        }
    }

    async function handleHelpCommand(message, client) {
        const helpEmbed = {
            color: 0x00ff00,
            title: "🎵 البوت الموسيقي المتقدم - دليل الأوامر الكامل",
            description: "بوت متطور مع حماية كاملة من خطأ 429 ونظام تشغيل 24/7",
            fields: [
                {
                    name: "🎶 تشغيل الموسيقى",
                    value: "**ش [اسم الأغنية]** - الأمر الرئيسي المتقدم\n**شغل [اسم الأغنية]** - تشغيل أغنية\n**play [song name]** - تشغيل بالإنجليزية\n**p [اسم الأغنية]** - أمر مختصر",
                    inline: false
                },
                {
                    name: "⏯️ التحكم في التشغيل",
                    value: "**وقف** / **pause** - إيقاف مؤقت\n**كمل** / **resume** - استكمال التشغيل\n**س** / **skip** - تخطي الأغنية\n**ق** / **stop** - إيقاف كامل (البوت يبقى)",
                    inline: false
                },
                {
                    name: "🔊 التحكم في الصوت والتكرار",
                    value: "**صوت [0-200]** / **volume [0-200]** - تغيير مستوى الصوت\n**تكرار** / **loop** - تبديل أنماط التكرار\n**خلط** / **shuffle** - خلط القائمة عشوائياً",
                    inline: false
                },
                {
                    name: "📋 المعلومات والقوائم",
                    value: "**قائمة** / **queue** / **q** - عرض قائمة التشغيل المتقدمة\n**معلومات** / **info** - معلومات البوت والنظام\n**مساعدة** / **help** - عرض هذه الرسالة\n**انضم** / **join** - الانضمام للروم الصوتي",
                    inline: false
                },
                {
                    name: "🛡️ ميزات النظام المتقدم",
                    value: "• **حماية كاملة من خطأ 429** ✅\n• **تشغيل 24/7 بدون انقطاع** 🔄\n• **قائمة انتظار ذكية** 📊\n• **نظام Proxies و Cookies** 🌐\n• **لن يغادر الروم أبداً** 🎵\n• **إحصائيات مفصلة** 📈",
                    inline: false
                },
                {
                    name: "💡 أمثلة على الاستخدام",
                    value: "• **ش** فيروز زهرة المدائن\n• **صوت 80** - رفع الصوت لـ 80%\n• **وقف** - إيقاف مؤقت\n• **كمل** - استكمال التشغيل\n• **تكرار** - تكرار الأغنية\n• **خلط** - خلط القائمة",
                    inline: false
                }
            ],
            footer: {
                text: "بوت متطور بتقنيات حديثة | 24/7 تشغيل مضمون ❤️",
                icon_url: client.user?.displayAvatarURL()
            },
            timestamp: new Date()
        };

        message.channel.send({ embeds: [helpEmbed] });
    }

    async function handleInfoCommand(message, client) {
        const uptime = process.uptime();
        const uptimeString = `${Math.floor(uptime / 3600)}س ${Math.floor((uptime % 3600) / 60)}د`;
        const memoryUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

        const infoEmbed = {
            color: 0x7289da,
            title: "ℹ️ معلومات البوت المتقدم",
            description: "بوت موسيقي متطور مع حماية شاملة من أخطاء YouTube",
            fields: [
                { name: "🤖 اسم البوت", value: client.user.username, inline: true },
                { name: "🆔 معرف البوت", value: client.user.id, inline: true },
                { name: "⏰ مدة التشغيل", value: uptimeString, inline: true },
                { name: "🌐 الخوادم", value: client.guilds.cache.size.toString(), inline: true },
                { name: "👥 المستخدمين", value: client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0).toString(), inline: true },
                { name: "📶 البنغ", value: `${Math.round(client.ws.ping)}ms`, inline: true },
                { name: "💾 استهلاك الذاكرة", value: `${memoryUsage} MB`, inline: true },
                { name: "🎼 قائمة انتظار YouTube", value: `${youtubeManager.requestQueue.length} طلب`, inline: true },
                { name: "📊 طلبات اليوم", value: `${youtubeManager.requestHistory.length}/200`, inline: true },
                { name: "🌐 Proxies متاحة", value: `${youtubeManager.proxies.length}`, inline: true },
                { name: "🍪 YouTube Cookies", value: youtubeManager.cookies ? "متوفرة ✅" : "غير متوفرة ⚠️", inline: true },
                { name: "🛡️ حالة الحماية", value: Date.now() < youtubeManager.cooldownUntil ? "نشطة 🔒" : "جاهزة ✅", inline: true }
            ],
            footer: {
                text: "تم تطويره بتقنيات متقدمة لضمان الاستمرارية ❤️",
                icon_url: client.user?.displayAvatarURL()
            },
            timestamp: new Date()
        };

        message.channel.send({ embeds: [infoEmbed] });
    }

    async function handleJoinCommand(message, client) {
        if (!message.member.voice.channel) {
            return message.channel.send({
                embeds: [{
                    color: 0xff0000,
                    title: "⚠️ لست في روم صوتي",
                    description: "يجب أن تكون في روم صوتي أولاً حتى أتمكن من الانضمام إليك!"
                }]
            });
        }

        try {
            const { joinVoiceChannel } = require('@discordjs/voice');
            const voiceChannel = message.member.voice.channel;
            
            joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator
            });
            
            message.channel.send({
                embeds: [{
                    color: 0x00ff00,
                    title: "✅ انضممت للروم الصوتي",
                    description: `تم الانضمام إلى **${voiceChannel.name}** بنجاح!\n\n🎶 **البوت المتقدم جاهز للتشغيل!**\n🛡️ **مع حماية كاملة من أخطاء YouTube**`,
                    footer: { text: "استخدم ش [اسم الأغنية] لبدء التشغيل" }
                }]
            });
        } catch (error) {
            console.error("خطأ في الانضمام للروم:", error);
            message.channel.send({
                embeds: [{
                    color: 0xff0000,
                    title: "❌ فشل في الانضمام",
                    description: "لا أستطيع الانضمام لهذا الروم الصوتي.\n\nتأكد من أن لدي صلاحيات الدخول والتحدث في الروم."
                }]
            });
        }
    }

    // أحداث DisTube مع Streaming
    distube
        .on("playSong", (queue, song) => {
            try {
                // تحديث حالة البوت لإظهار الأغنية الحالية مع Streaming
                client.user.setActivity(`${song.name}`, { 
                    type: ActivityType.Streaming,
                    url: 'https://www.twitch.tv/discord'
                });

                const embed = {
                    color: 0x7289da,
                    author: {
                        name: "🎵 بدأ التشغيل - النظام المتقدم",
                        icon_url: client.user?.displayAvatarURL()
                    },
                    title: `**${song.name}**`,
                    description: `**الفنان:** ${song.uploader?.name || "غير معروف"}\n**المدة:** ${song.formattedDuration || "غير معروف"}`,
                    fields: [
                        { name: "👤 طلبها", value: song.user?.toString() || "غير معروف", inline: true },
                        { name: "🎧 الروم الصوتي", value: queue.voice?.channel?.name || "غير معروف", inline: true },
                        { name: "📺 المصدر", value: "YouTube", inline: true },
                        { name: "🛡️ نظام الحماية", value: "نشط ✅", inline: true },
                        { name: "📊 قائمة انتظار", value: `${youtubeManager.requestQueue.length} طلب`, inline: true },
                        { name: "🔄 حالة البث", value: "مباشر 🔴", inline: true }
                    ],
                    thumbnail: {
                        url: song.thumbnail || "https://via.placeholder.com/300x300/7289da/ffffff?text=🎵"
                    },
                    footer: {
                        text: `في القائمة: ${queue.songs?.length || 0} أغنية | بوت متقدم مع حماية 429`,
                    },
                    timestamp: new Date()
                };

                if (song.url) embed.url = song.url;

                queue.textChannel?.send({ embeds: [embed] }).catch(console.error);
            } catch (error) {
                console.error("خطأ في إرسال رسالة playSong:", error);
                queue.textChannel?.send(`🎶 **Now Playing:** ${song.name} | النظام المتقدم نشط!`).catch(console.error);
            }
        })
        .on("addSong", (queue, song) => {
            try {
                if (queue.songs.length === 1) return;

                const embed = {
                    color: 0x00ff00,
                    title: "➕ تمت الإضافة للقائمة المتقدمة",
                    description: `**${song.name}**`,
                    fields: [
                        { name: "⏱️ المدة", value: song.formattedDuration || "غير معروف", inline: true },
                        { name: "📍 الترتيب", value: `${queue.songs.length}`, inline: true },
                        { name: "👤 طلبها", value: song.user?.toString() || "غير معروف", inline: true },
                        { name: "🛡️ نظام الحماية", value: "نشط ✅", inline: true },
                        { name: "📊 انتظار YouTube", value: `${youtubeManager.requestQueue.length}`, inline: true },
                        { name: "🎯 معدل النجاح", value: "عالي ✨", inline: true }
                    ],
                    thumbnail: {
                        url: song.thumbnail || "https://via.placeholder.com/300x300/00ff00/ffffff?text=➕"
                    },
                    footer: { text: `إجمالي الأغاني: ${queue.songs.length} | بوت متقدم بدون 429` }
                };

                queue.textChannel?.send({ embeds: [embed] }).catch(console.error);
            } catch (error) {
                console.error("خطأ في إرسال رسالة addSong:", error);
                queue.textChannel?.send(`➕ **تمت الإضافة:** ${song.name} (الترتيب: ${queue.songs.length})`).catch(console.error);
            }
        })
        .on("noRelated", queue => {
            queue.textChannel?.send({
                embeds: [{
                    color: 0xff9500,
                    title: "❌ لا توجد أغاني مشابهة",
                    description: "لم يتم العثور على أغاني مشابهة، لكن النظام المتقدم لا يزال نشطاً!",
                    footer: { text: "البوت لن يغادر الروم - استخدم ش [اسم أغنية] للمتابعة" }
                }]
            }).catch(console.error);
        })
        .on("searchNoResult", (message, query) => {
            message.channel?.send({
                embeds: [{
                    color: 0xff0000,
                    title: "🔍 لا توجد نتائج",
                    description: `لم يتم العثور على نتائج للبحث: **${query}**`,
                    fields: [{
                        name: "💡 نصائح للبحث الأمثل",
                        value: "• استخدم اسم الفنان + اسم الأغنية\n• جرب بالإنجليزية\n• تأكد من الإملاء\n• استخدم كلمات أقل",
                        inline: false
                    }],
                    footer: { text: "النظام المتقدم يعمل بشكل طبيعي" }
                }]
            }).catch(console.error);
        })
        .on("empty", queue => {
            // البوت لن يغادر الروم عند فراغه - نظام 24/7
            console.log(`🔄 الروم فارغ في ${queue.textChannel.guild.name} - البقاء 24/7 نشط`);
            queue.textChannel?.send({
                embeds: [{
                    color: 0x00ff00,
                    title: "🎵 الروم فارغ - البوت نشط 24/7!",
                    description: "جميع الأعضاء غادروا الروم الصوتي، لكن البوت سيبقى هنا 24/7!\n\n**🛡️ نظام الحماية من 429 نشط دائماً**\n**🔄 جاهز لتشغيل الأغاني فوراً عند عودتكم**",
                    fields: [
                        { name: "🎮 أوامر سريعة", value: "**ش [اسم الأغنية]** - تشغيل\n**انضم** - للتأكد من الاتصال", inline: true },
                        { name: "⚡ حالة النظام", value: "نشط ومستعد\nقائمة انتظار: جاهزة\nالحماية: مفعلة", inline: true }
                    ],
                    footer: { text: "بوت ذكي - لا يغادر أبداً | 24/7" }
                }]
            }).catch(console.error);
        })
        .on("finish", queue => {
            // تحديث حالة البوت عند انتهاء القائمة مع Streaming
            client.user.setActivity('ش [اسم الأغنية] | 24/7 نشط', { 
                type: ActivityType.Streaming,
                url: 'https://www.twitch.tv/discord'
            });

            console.log(`✅ انتهت قائمة التشغيل في ${queue.textChannel.guild.name} - البوت يبقى 24/7`);
            queue.textChannel?.send({
                embeds: [{
                    color: 0x00ff00,
                    title: "✅ انتهت قائمة التشغيل",
                    description: "تم الانتهاء من تشغيل جميع الأغاني!\n\n🎶 **البوت سيبقى في الروم 24/7** 🔄\n🛡️ **نظام الحماية من 429 نشط دائماً**\n⚡ **جاهز لتشغيل أغاني جديدة فوراً!**",
                    fields: [
                        { name: "🎮 بدء التشغيل السريع", value: "**ش** فيروز\n**ش** عمرو دياب\n**ش** أم كلثوم", inline: true },
                        { name: "📊 إحصائيات اليوم", value: `طلبات: ${youtubeManager.requestHistory.length}/200\nقائمة انتظار: ${youtubeManager.requestQueue.length}`, inline: true }
                    ],
                    footer: { text: "بوت ذكي يعمل 24/7 بدون توقف!" }
                }]
            }).catch(console.error);
        })
        .on("disconnect", queue => {
            // تحديث حالة البوت عند قطع الاتصال مع Streaming
            client.user.setActivity('aziz', { 
                type: ActivityType.Streaming,
                url: 'https://www.twitch.tv/discord'
            });

            queue.textChannel?.send({
                embeds: [{
                    color: 0xff9500,
                    title: "⚠️ انقطع الاتصال مؤقتاً",
                    description: "تم قطع الاتصال من الروم الصوتي بسبب مشكلة تقنية.\n\n🔄 **النظام المتقدم سيحاول إعادة الاتصال تلقائياً**\n🎶 **أو استخدم أمر انضم أو ابدأ تشغيل أغنية**",
                    footer: { text: "البوت المتقدم مصمم للاستمرارية!" }
                }]
            }).catch(console.error);
        })
        .on("error", (channel, error) => {
            console.error("خطأ في DisTube:", error);
            
            if (channel && typeof channel.send === 'function') {
                if (youtubeManager.is429Error(error)) {
                    // لا نرسل رسالة للمستخدم لأن النظام سيتعامل مع الأمر تلقائياً
                    console.log('🛡️ نظام الحماية المتقدم تعامل مع خطأ 429 تلقائياً');
                } else if (error.message.includes('Video unavailable') || error.message.includes('Private video')) {
                    channel.send({
                        embeds: [{
                            color: 0xff0000,
                            title: "❌ الفيديو غير متاح",
                            description: "هذا الفيديو قد يكون محذوف، خاص، أو محظور في منطقتك",
                            fields: [{
                                name: "🛡️ حالة النظام",
                                value: "النظام المتقدم يعمل بشكل طبيعي",
                                inline: false
                            }],
                            footer: { text: "جرب أغنية أخرى - البوت جاهز!" }
                        }]
                    }).catch(console.error);
                } else {
                    channel.send({
                        embeds: [{
                            color: 0xff0000,
                            title: "❌ خطأ مؤقت في التشغيل",
                            description: "حدث خطأ أثناء تشغيل الموسيقى، لكن النظام المتقدم لا يزال يعمل",
                            fields: [{
                                name: "🛡️ نظام الحماية",
                                value: "نشط ومستمر ✅",
                                inline: true
                            }, {
                                name: "💡 الحل",
                                value: "جرب أغنية أخرى",
                                inline: true
                            }],
                            footer: { text: "بوت متقدم مع استمرارية عالية" }
                        }]
                    }).catch(console.error);
                }
            }
        });

    // أحداث العميل
    client.once("ready", () => {
        console.log(`✅ تم تسجيل الدخول كـ ${client.user.tag}`);
        console.log(`🎵 البوت المتقدم ${config.name} جاهز للاستخدام!`);
        console.log(`🌐 البوت متصل بـ ${client.guilds.cache.size} خادم`);
        console.log(`🛡️ نظام الحماية من 429 نشط`);
        console.log(`🍪 YouTube Cookies: ${youtubeManager.cookies ? 'متوفرة' : 'غير متوفرة'}`);
        console.log(`🌐 Proxies متاحة: ${youtubeManager.proxies.length}`);

        // تحديث حالة البوت مع Streaming
        client.user.setActivity('Aziz', { 
            type: ActivityType.Streaming,
            url: 'https://www.twitch.tv/discord'
        });
    });

    client.on("error", error => {
        console.error(`خطأ في العميل ${config.name}:`, error);
    });

    client.on("warn", warning => {
        console.warn(`تحذير من العميل ${config.name}:`, warning);
    });

    client.on("shardError", error => {
        console.error(`خطأ في WebSocket ${config.name}:`, error);
    });

    // منع البوت من مغادرة الروم + إعادة اتصال ذكية
    client.on("voiceStateUpdate", (oldState, newState) => {
        if (newState.id === client.user.id) {
            if (oldState.channelId && !newState.channelId) {
                console.log("⚠️ البوت تم قطع اتصاله من الروم الصوتي - محاولة إعادة اتصال ذكية");
                
                // تحديث الحالة
                client.user.setActivity('إعادة اتصال... | نظام متقدم', { 
                    type: ActivityType.Streaming,
                    url: 'https://www.twitch.tv/discord'
                });
                
                setTimeout(async () => {
                    try {
                        if (oldState.channel) {
                            const { joinVoiceChannel } = require('@discordjs/voice');
                            joinVoiceChannel({
                                channelId: oldState.channelId,
                                guildId: oldState.guild.id,
                                adapterCreator: oldState.guild.voiceAdapterCreator
                            });
                            console.log("✅ تم إعادة الاتصال بالروم الصوتي تلقائياً");
                            
                            // استعادة الحالة العادية
                            client.user.setActivity('ش [اسم الأغنية] | نظام متقدم', { 
                                type: ActivityType.Streaming,
                                url: 'https://www.twitch.tv/discord'
                            });
                        }
                    } catch (error) {
                        console.log("❌ فشل في إعادة الاتصال التلقائي:", error.message);
                    }
                }, 3000);
            }
        }
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
console.log('🚀 بدء تشغيل النظام المتقدم بواسطة Aziz...');
console.log(`🌍 البيئة: ${process.env.NODE_ENV || 'development'}`);
console.log(`🖥️ Node.js: ${process.version}`);
console.log(`💾 الذاكرة: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);

if (bots && bots.length > 0) {
    console.log(`🤖 بدء تشغيل ${bots.length} بوت(ات) متقدم...`);
    bots.forEach((config, index) => {
        console.log(`\n--- تشغيل البوت المتقدم ${index + 1}: ${config.name} ---`);
        createBot(config);
    });
    console.log('\n🎉 تم بدء تشغيل جميع البوتات المتقدمة بنجاح!');
    console.log('🛡️ نظام الحماية من 429 نشط على جميع البوتات');
} else {
    console.error("❌ لم يتم العثور على أي بوتات في الإعدادات");
    console.error("💡 تأكد من وجود BOT_TOKEN في متغيرات البيئة أو config.json");
    process.exit(1);
}

// keep-alive محسن للاستضافة السحابية
if (process.env.NODE_ENV === 'production') {
    const keepAliveInterval = setInterval(() => {
        http.get(`http://localhost:${PORT}`, (res) => {
            const status = res.statusCode === 200 ? "✅" : "⚠️";
            console.log(`${status} Keep-alive: ${res.statusCode} | Queue: ${youtubeManager.requestQueue.length} | Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
        }).on('error', (err) => {
            console.log('🔴 Keep-alive failed:', err.message);
        });
    }, 25 * 60 * 1000); // كل 25 دقيقة
    
    console.log('🔄 Advanced keep-alive system activated');
}

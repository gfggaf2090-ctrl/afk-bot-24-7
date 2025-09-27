// إعداد HTTP Server للاستضافة على Render
const http = require('http');
const fs = require("fs");
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
    '@discordjs/opus': '0.9.0'
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

// نظام متقدم لإدارة طلبات YouTube وتجنب 429
class AdvancedYouTubeManager {
    constructor() {
        this.requestQueue = [];
        this.processing = false;
        this.requestHistory = [];
        this.rateLimits = {
            perMinute: 3,
            perHour: 50,
            per24Hours: 200
        };
        this.cooldownUntil = 0;
        this.cookies = this.loadCookies();
        
        setInterval(() => this.cleanHistory(), 3600000);
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
                await this.delay(Math.min(canRequest.waitTime, 60000));
                continue;
            }

            const { requestFn, resolve, reject, metadata } = this.requestQueue.shift();
            
            try {
                this.requestHistory.push({
                    timestamp: Date.now(),
                    metadata
                });

                const result = await requestFn();
                resolve(result);
                
                await this.delay(2000);
                
            } catch (error) {
                console.error(`❌ خطأ في الطلب:`, error.message);
                
                if (this.is429Error(error)) {
                    console.log('🚨 خطأ 429 - تفعيل cooldown لمدة 15 دقيقة');
                    this.cooldownUntil = Date.now() + (15 * 60 * 1000);
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
            cooldown_active: Date.now() < youtubeManager.cooldownUntil
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
            name: "Anxiety",
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

// دالة التشغيل المحسنة
async function handlePlayCommand(message, query, distube) {
    if (!message.member.voice.channel) {
        return message.channel.send({
            embeds: [{
                color: 0xff0000,
                title: "يجب أن تكون في روم صوتي أولاً",
                thumbnail: {
                    url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center"
                }
            }]
        });
    }

    if (!query) {
        return message.channel.send({
            embeds: [{
                color: 0xff0000,
                title: "اكتب اسم الأغنية بعد الأمر",
                description: "مثال: ش أم كلثوم",
                thumbnail: {
                    url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center"
                }
            }]
        });
    }

    const loadingMsg = await message.channel.send({
        embeds: [{
            color: 0xffa500,
            title: "البحث الذكي",
            description: `جاري البحث عن: **${query}**\nالموضع في القائمة: ${youtubeManager.requestQueue.length + 1}`,
            fields: [
                { name: "حالة النظام", value: `طلبات اليوم: ${youtubeManager.requestHistory.length}/200`, inline: true },
                { name: "YouTube", value: Date.now() < youtubeManager.cooldownUntil ? "انتظار" : "جاهز", inline: true }
            ],
            thumbnail: {
                url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center"
            },
            footer: { text: "Anxiety - نظام حماية متقدم" }
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
    if (youtubeManager.is429Error(error)) {
        await loadingMsg.edit({
            embeds: [{
                color: 0xff9500,
                title: "نظام الحماية نشط",
                description: `تم تفعيل الحماية من 429 لضمان استمرارية الخدمة.\n\nالأغنية المطلوبة: ${query}`,
                fields: [
                    {
                        name: "ما يحدث الآن",
                        value: "تم إضافة طلبك لقائمة الانتظار الذكية\nسيتم تشغيله تلقائياً عند زوال المنع\nالنظام يحمي البوت من التوقف",
                        inline: false
                    },
                    {
                        name: "الوقت المتوقع",
                        value: "5-15 دقيقة في المتوسط\nيتم المحاولة تلقائياً\nلا حاجة لإعادة الطلب",
                        inline: false
                    }
                ],
                thumbnail: {
                    url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center"
                },
                footer: { text: "Anxiety - نظام حماية متقدم" },
                timestamp: new Date()
            }]
        });
    } else {
        await loadingMsg.edit({
            embeds: [{
                color: 0xff0000,
                title: "خطأ في التشغيل",
                description: "حدث خطأ أثناء محاولة تشغيل الأغنية",
                fields: [{
                    name: "الحلول المقترحة",
                    value: "جرب أغنية أخرى\nانتظر دقيقة وأعد المحاولة\nاستخدم كلمات أبسط",
                    inline: false
                }],
                thumbnail: {
                    url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center"
                },
                footer: { text: "Anxiety Bot" }
            }]
        });
    }
}

// باقي دوال التحكم
async function handleSkipCommand(message, distube) {
    try {
        const queue = distube.getQueue(message.guild.id);
        if (!queue || !queue.songs || queue.songs.length <= 1) {
            return message.channel.send({
                embeds: [{
                    color: 0xff0000,
                    title: "لا توجد أغاني أخرى للتخطي",
                    thumbnail: { url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center" }
                }]
            });
        }

        const currentSong = queue.songs[0];
        await distube.skip(message.guild.id);
        
        message.channel.send({
            embeds: [{
                color: 0xffa500,
                title: "تم تخطي الأغنية",
                description: `تم تخطي: **${currentSong.name}**`,
                thumbnail: { url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center" },
                footer: { text: `بقي في القائمة: ${queue.songs.length - 1} أغنية` }
            }]
        });
    } catch (error) {
        console.error("خطأ في تخطي الأغنية:", error);
        message.channel.send("لا يمكن تخطي الأغنية حالياً.");
    }
}

async function handleStopCommand(message, distube) {
    try {
        const queue = distube.getQueue(message.guild.id);
        if (!queue) {
            return message.channel.send("لا توجد موسيقى قيد التشغيل.");
        }

        await distube.stop(message.guild.id);
        
        message.channel.send({
            embeds: [{
                color: 0xff0000,
                title: "تم إيقاف الموسيقى",
                description: "تم إيقاف جميع الأغاني وإفراغ القائمة\n\nالبوت سيبقى في الروم 24/7\nجاهز لتشغيل أغاني جديدة فوراً!",
                thumbnail: { url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center" },
                footer: { text: "Anxiety - البوت نشط 24/7" }
            }]
        });
    } catch (error) {
        console.error("خطأ في إيقاف الموسيقى:", error);
        message.channel.send("لا يمكن إيقاف الموسيقى حالياً.");
    }
}

async function handleHelpCommand(message, client) {
    const helpEmbed = {
        color: 0x8B5A8C,
        title: "Anxiety - دليل الأوامر الكامل",
        description: "بوت موسيقي متطور مع حماية كاملة من خطأ 429",
        fields: [
            {
                name: "تشغيل الموسيقى",
                value: "**ش [اسم الأغنية]** - الأمر الرئيسي\n**شغل [اسم الأغنية]** - تشغيل أغنية\n**play [song name]** - تشغيل بالإنجليزية",
                inline: false
            },
            {
                name: "التحكم في التشغيل", 
                value: "**س** / **skip** - تخطي الأغنية\n**ق** / **stop** - إيقاف كامل",
                inline: false
            },
            {
                name: "المعلومات",
                value: "**مساعدة** - عرض هذه القائمة\n**معلومات** - معلومات البوت\n**تست** - اختبار البوت",
                inline: false
            }
        ],
        thumbnail: { url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center" },
        footer: { text: "Anxiety Music Bot - تشغيل 24/7", icon_url: client.user?.displayAvatarURL() },
        timestamp: new Date()
    };

    message.channel.send({ embeds: [helpEmbed] });
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
            highWaterMark: 1024 * 1024 * 64,
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                }
            }
        }
    };

    const distube = new DisTube(client, distubeOptions);

    client.on("messageCreate", async (message) => {
        if (!message.guild || message.author.bot) return;
        
        if (config.textChannel && message.channel.id !== config.textChannel) return;

        const content = message.content.trim().toLowerCase();
        const originalContent = message.content.trim();

        if (content.startsWith("ش ") || content.startsWith("شغل ") || content.startsWith("play ") || content.startsWith("p ")) {
            const query = originalContent.replace(/^(ش|شغل|play|p)\s+/i, "").trim();
            await handlePlayCommand(message, query, distube);
        }
        else if (["س", "سكب", "skip", "next", "s", "sk"].includes(content)) {
            await handleSkipCommand(message, distube);
        }
        else if (["ق", "stop", "إيقاف", "st", "توقف"].includes(content)) {
            await handleStopCommand(message, distube);
        }
        else if (["مساعدة", "help", "commands", "أوامر", "h", "cmd"].includes(content)) {
            await handleHelpCommand(message, client);
        }
        else if (["تست", "test", "ping", "بوت", "موجود"].includes(content)) {
            const queueStatus = youtubeManager.requestQueue.length;
            const cooldownActive = Date.now() < youtubeManager.cooldownUntil;
            
            message.channel.send({
                embeds: [{
                    color: cooldownActive ? 0xff9500 : 0x8B5A8C,
                    title: "البوت Anxiety يعمل بشكل طبيعي",
                    description: `مرحباً ${message.author}!\n\nالأمر الرئيسي: \`ش [اسم الأغنية]\`\nمثال: ش أم كلثوم`,
                    fields: [
                        { name: "البنغ", value: `${Math.round(client.ws.ping)}ms`, inline: true },
                        { name: "قائمة الانتظار", value: `${queueStatus} طلب`, inline: true },
                        { name: "حالة YouTube", value: cooldownActive ? "انتظار" : "جاهز", inline: true }
                    ],
                    thumbnail: { url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center" },
                    footer: { text: "Anxiety Music Bot" }
                }]
            });
        }
    });

    // أحداث DisTube
    distube
        .on("playSong", (queue, song) => {
            try {
                client.user.setActivity(`${song.name}`, { 
                    type: ActivityType.Streaming,
                    url: 'https://www.twitch.tv/discord'
                });

                const embed = {
                    color: 0x8B5A8C,
                    title: "🎵 بدأ التشغيل",
                    description: `**${song.name}**\n**المدة:** ${song.formattedDuration || "غير معروف"}`,
                    fields: [
                        { name: "طلبها", value: song.user?.toString() || "غير معروف", inline: true },
                        { name: "المدة", value: song.formattedDuration || "غير معروف", inline: true }
                    ],
                    thumbnail: { url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center" },
                    footer: { text: `${queue.songs?.length || 0} أغنية في القائمة` },
                    timestamp: new Date()
                };

                if (song.url) embed.url = song.url;

                queue.textChannel?.send({ embeds: [embed] }).catch(console.error);
            } catch (error) {
                console.error("خطأ في إرسال رسالة playSong:", error);
                queue.textChannel?.send(`🎶 **الآن يتم تشغيل:** ${song.name} | Anxiety نشط!`).catch(console.error);
            }
        })
        .on("addSong", (queue, song) => {
            try {
                if (queue.songs.length === 1) return;

                queue.textChannel?.send({
                    embeds: [{
                        color: 0x8B5A8C,
                        title: "✅ تمت الإضافة للقائمة",
                        description: `**${song.name}**`,
                        fields: [
                            { name: "المدة", value: song.formattedDuration || "غير معروف", inline: true },
                            { name: "الترتيب", value: `${queue.songs.length}`, inline: true }
                        ],
                        thumbnail: { url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center" },
                        footer: { text: `إجمالي الأغاني: ${queue.songs.length}` }
                    }]
                }).catch(console.error);
            } catch (error) {
                console.error("خطأ في إرسال رسالة addSong:", error);
            }
        })
        .on("searchNoResult", (message, query) => {
            message.channel?.send({
                embeds: [{
                    color: 0xff0000,
                    title: "🔍 لا توجد نتائج",
                    description: `لم يتم العثور على نتائج للبحث: **${query}**`,
                    thumbnail: { url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center" },
                    footer: { text: "جرب كلمات مختلفة للبحث" }
                }]
            }).catch(console.error);
        })
        .on("error", (channel, error) => {
            console.error("خطأ في DisTube:", error);
            
            if (channel && typeof channel.send === 'function') {
                if (!youtubeManager.is429Error(error)) {
                    channel.send({
                        embeds: [{
                            color: 0xff0000,
                            title: "❌ خطأ في التشغيل",
                            description: "حدث خطأ أثناء تشغيل الموسيقى، جرب أغنية أخرى",
                            thumbnail: { url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&h=300&fit=crop&crop=center" },
                            footer: { text: "Anxiety يعمل بشكل طبيعي" }
                        }]
                    }).catch(console.error);
                }
            }
        });

    // أحداث العميل
    client.once("ready", () => {
        console.log(`✅ تم تسجيل الدخول كـ ${client.user.tag}`);
        console.log(`🎵 البوت ${config.name} جاهز للاستخدام!`);
        console.log(`🌐 البوت متصل بـ ${client.guilds.cache.size} خادم`);
        console.log(`🛡️ نظام الحماية من 429 نشط`);
        console.log(`🍪 YouTube Cookies: ${youtubeManager.cookies ? 'متوفرة' : 'غير متوفرة'}`);

        // تحديث حالة البوت مع Streaming to Aziz
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
console.log('🚀 بدء تشغيل بوت Anxiety...');
console.log(`🌍 البيئة: ${process.env.NODE_ENV || 'development'}`);
console.log(`🖥️ Node.js: ${process.version}`);
console.log(`💾 الذاكرة: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);

if (bots && bots.length > 0) {
    console.log(`🤖 بدء تشغيل ${bots.length} بوت...`);
    bots.forEach((config, index) => {
        console.log(`\n--- تشغيل البوت ${index + 1}: ${config.name} ---`);
        createBot(config);
    });
    console.log('\n🎉 تم بدء تشغيل بوت Anxiety بنجاح!');
    console.log('🛡️ نظام الحماية من 429 نشط');
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

// إعداد HTTP Server للاستضافة على Render
const http = require('http');
const PORT = process.env.PORT || 3000;

// التحقق من المكتبات المطلوبة قبل بدء التشغيل
const requiredPackages = {
    'discord.js': '14.14.1',
    'distube': '4.2.0',
    '@distube/ytdl-core': '4.13.5',
    'ytdl-core': '4.11.5',
    '@ffmpeg-installer/ffmpeg': '1.1.0',
    'ffmpeg-static': '5.2.0',
    '@discordjs/voice': '0.16.1',
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
    console.error('\nأو إنشاء package.json بالمحتوى التالي:');
    console.error(JSON.stringify({
        "name": "arabic-discord-music-bot",
        "version": "2.0.0",
        "description": "Arabic Discord Music Bot with DisTube",
        "main": "index.js",
        "scripts": {
            "start": "node index.js",
            "dev": "nodemon index.js"
        },
        "dependencies": requiredPackages,
        "engines": {
            "node": ">=16.0.0"
        }
    }, null, 2));
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
    console.error('💡 تأكد من تثبيت جميع المكتبات المطلوبة');
    process.exit(1);
}

const fs = require("fs");

// إنشاء خادم HTTP بسيط للحفاظ على الخدمة نشطة
let bots = []; // تعريف المتغير مبكراً

const server = http.createServer((req, res) => {
    res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
        status: 'online',
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        message: 'Discord Arabic Music Bot by Aziz is running!',
        bots: bots ? bots.length : 0,
        memory: process.memoryUsage(),
        packages_status: 'loaded'
    }, null, 2));
});

server.listen(PORT, () => {
    console.log(`🌐 HTTP Server running on port ${PORT}`);
});

// منع النوم التلقائي للخطة المجانية
if (process.env.NODE_ENV === 'production') {
    const keepAlive = () => {
        setInterval(() => {
            http.get(`http://localhost:${PORT}`, (res) => {
                console.log(`✅ Keep-alive ping: ${res.statusCode} at ${new Date().toLocaleTimeString()}`);
            }).on('error', (err) => {
                console.log('⚠️ Keep-alive ping failed:', err.message);
            });
        }, 25 * 60 * 1000); // كل 25 دقيقة
    };
    
    // بدء keep-alive بعد 30 ثانية
    setTimeout(keepAlive, 30000);
    console.log('🔄 Keep-alive system activated for production');
}

// معالجة أخطاء غير متوقعة
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    // لا نخرج من العملية في البيئة السحابية
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// تنظيف الذاكرة كل ساعة
setInterval(() => {
    if (global.gc) {
        global.gc();
        console.log('🧹 Memory cleanup performed');
    }
}, 60 * 60 * 1000);

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
    // للاستضافة على Render - استخدام متغيرات البيئة
    if (process.env.BOT_TOKEN) {
        bots = [{
            name: "MusicBot",
            token: process.env.BOT_TOKEN,
            textChannel: process.env.TEXT_CHANNEL_ID || null
        }];
        console.log('✅ تم تحميل إعدادات البوت من متغيرات البيئة');
    } else if (fs.existsSync("config.json")) {
        // للتطوير المحلي - استخدام config.json
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

// دالة الانضمام للروم الصوتي
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
                description: `تم الانضمام إلى **${voiceChannel.name}** بنجاح! 🎵\n\n**سأبقى هنا منتظراً الأوامر!** 🎶`,
                                    footer: { text: "استخدم أمر 'aziz' لتشغيل الموسيقى" }
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

// دالة تشغيل الروابط المباشرة
async function handleDirectPlayCommand(message, url, distube) {
    if (!message.member.voice.channel) {
        return message.channel.send("⚠️ يجب أن تكون في روم صوتي أولاً!");
    }

    const loadingMsg = await message.channel.send(`🎵 جاري تشغيل الرابط المباشر...`);

    try {
        await distube.play(message.member.voice.channel, url, {
            member: message.member,
            textChannel: message.channel,
            message,
        });
        await loadingMsg.delete().catch(() => {});
    } catch (error) {
        console.error("خطأ في تشغيل الرابط المباشر:", error.message);
        await loadingMsg.edit({
            embeds: [{
                color: 0xff0000,
                title: "❌ فشل في تشغيل الرابط",
                description: "لم أتمكن من تشغيل هذا الرابط.",
                fields: [
                    {
                        name: "الأسباب المحتملة",
                        value: "• الفيديو محذوف أو خاص\n• الرابط غير صحيح\n• مشكلة مؤقتة مع YouTube",
                        inline: false
                    }
                ],
                footer: { text: "تأكد من أن الرابط يعمل في المتصفح" }
            }]
        });
    }
}

function createBot(config) {
    // التحقق من صحة التوكن
    console.log(`🔍 فحص توكن البوت: ${config.name || 'Unknown'}...`);
    
    if (!config.token) {
        console.error("❌ التوكن مفقود في الإعدادات");
        return;
    }
    
    if (config.token.length < 50 || !config.token.includes('.') || config.token.split('.').length !== 3) {
        console.error(`❌ تنسيق التوكن غير صحيح للبوت: ${config.name}`);
        console.error(`   - الطول: ${config.token.length} (متوقع ~70)`);
        console.error(`   - يحتوي على نقاط: ${config.token.includes('.')}`);
        console.error(`   - عدد الأجزاء: ${config.token.split('.').length} (متوقع 3)`);
        return;
    }
    
    console.log(`✅ التوكن صحيح للبوت ${config.name} (${config.token.length} حرف، 3 أجزاء)`);

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
        ],
    });

    // إعداد DisTube مع خيارات محسنة لتجنب خطأ 429
    const distube = new DisTube(client, {
        emitNewSongOnly: true,
        savePreviousSongs: false,
        nsfw: false,
        searchSongs: 1,
        emptyCooldown: 0,
        leaveOnEmpty: false,
        leaveOnFinish: false,
        leaveOnStop: false,
        searchCooldown: 30, // زيادة التأخير بين البحثات لتجنب 429
        customFilters: {},
        ffmpeg: {
            path: process.env.FFMPEG_PATH || 'ffmpeg'
        }
    });

    client.on("messageCreate", async (message) => {
        if (!message.guild || message.author.bot) return;
        
        // التحقق من القناة المخصصة (إذا كانت محددة)
        if (config.textChannel && message.channel.id !== config.textChannel) return;

        const content = message.content.trim().toLowerCase();
        const originalContent = message.content.trim();

        // أمر "aziz" → البحث وتشغيل الأغنية
        if (content.startsWith("ش ")) {
            await handlePlayCommand(message, originalContent.replace(/^aziz\s+/, "").trim(), distube);
        }
        // أمر "aziz" بدون كلام → رسالة تنبيه
        else if (content === "ش") {
            message.channel.send("⚠️ اكتب اسم الأغنية بعد الأمر!\nمثال: ش أم كلثوم");
        }
        // أمر التشغيل بالبحث (متعدد)
        else if (content.startsWith("شغل ") || content.startsWith("play ") || content.startsWith("p ")) {
            const query = originalContent.replace(/^(شغل|play|p)\s+/i, "").trim();
            await handlePlayCommand(message, query, distube);
        }
        // أوامر التخطي (متعددة)
        else if (["س", "سكب", "skip", "next", "s", "sk"].includes(content)) {
            await handleSkipCommand(message, distube);
        }
        // أوامر الإيقاف (متعددة)
        else if (["ق", "stop", "إيقاف", "st", "وقف"].includes(content)) {
            await handleStopCommand(message, distube);
        }
        // أوامر عرض القائمة (متعددة)
        else if (["قائمة", "queue", "q", "list", "القائمة", "ل"].includes(content)) {
            await handleQueueCommand(message, distube);
        }
        // أوامر المساعدة (متعددة)
        else if (["مساعدة", "help", "commands", "أوامر", "h", "cmd"].includes(content)) {
            await handleHelpCommand(message, client);
        }
        // أوامر معلومات البوت (متعددة)
        else if (["معلومات", "info", "about", "i", "معلومات_البوت"].includes(content)) {
            await handleInfoCommand(message, client);
        }
        // أوامر الانضمام للروم (متعددة)
        else if (["انضم", "join", "تعال", "j", "ادخل"].includes(content)) {
            await handleJoinCommand(message, client);
        }
        // أمر اختبار استجابة البوت
        else if (["تست", "test", "ping", "بوت", "موجود"].includes(content)) {
            message.channel.send({
                embeds: [{
                    color: 0x00ff00,
                    title: "✅ البوت يعمل بشكل طبيعي!",
                    description: `مرحباً ${message.author}!\n\n🎵 **أوامر التشغيل:**\n• \`aziz [اسم الأغنية]\` - الأمر الرئيسي\n• \`شغل [اسم الأغنية]\` - أمر بديل\n• \`play [اسم الأغنية]\` - أمر بديل\n\n💡 **مثال:** aziz أم كلثوم`,
                    footer: { text: `البنغ: ${Math.round(client.ws.ping)}ms` }
                }]
            });
        }
    });

    // دالة تشغيل الأغاني مع معالجة محسنة لخطأ 429
    async function handlePlayCommand(message, query, distube) {
        if (!message.member.voice.channel) {
            return message.channel.send("⚠️ يجب أن تكون في روم صوتي أولاً!");
        }

        if (!query) {
            return message.channel.send("⚠️ اكتب اسم الأغنية بعد الأمر!\nمثال: ش أم كلثوم");
        }

        const loadingMsg = await message.channel.send(`🔍 جاري البحث عن: **${query}**...`);

        // تأخير أطول لتجنب خطأ 429
        await new Promise(resolve => setTimeout(resolve, 3000));

        try {
            // محاولة مع استراتيجيات متعددة للتعامل مع 429
            await attemptPlay(message, query, distube, loadingMsg, 1);
        } catch (error) {
            console.error("خطأ في handlePlayCommand:", error.message);
            await loadingMsg.edit({
                embeds: [{
                    color: 0xff0000,
                    title: "❌ خطأ عام في التشغيل",
                    description: "حدث خطأ غير متوقع. جرب مرة أخرى لاحقاً.",
                    footer: { text: "تأكد من أن البوت لديه صلاحيات كافية" }
                }]
            });
        }
    }

    // دالة محاولة التشغيل مع إدارة أفضل لخطأ 429
    async function attemptPlay(message, query, distube, loadingMsg, attemptNumber) {
        try {
            await distube.play(message.member.voice.channel, query, {
                member: message.member,
                textChannel: message.channel,
                message,
            });
            await loadingMsg.delete().catch(() => {});
        } catch (error) {
            console.error(`المحاولة ${attemptNumber} فشلت:`, error.message);
            
            // معالجة خطأ 429 بشكل أكثر تفصيلاً
            if (error.message.includes('429') || error.statusCode === 429) {
                if (attemptNumber === 1) {
                    // المحاولة الأولى - انتظار أطول
                    await loadingMsg.edit(`⏳ YouTube مشغول... محاولة ${attemptNumber + 1}/3`);
                    await new Promise(resolve => setTimeout(resolve, 15000)); // 15 ثانية
                    
                    const simpleQuery = query.split(' ').slice(0, 2).join(' ');
                    await attemptPlay(message, simpleQuery, distube, loadingMsg, 2);
                } else if (attemptNumber === 2) {
                    // المحاولة الثانية - كلمة واحدة فقط
                    await loadingMsg.edit(`🔄 محاولة أخيرة مع كلمة واحدة...`);
                    await new Promise(resolve => setTimeout(resolve, 20000)); // 20 ثانية
                    
                    const firstWord = query.split(' ')[0];
                    await attemptPlay(message, firstWord, distube, loadingMsg, 3);
                } else {
                    // المحاولة الأخيرة فشلت
                    await loadingMsg.edit({
                        embeds: [{
                            color: 0xff9500,
                            title: "⏳ YouTube محدود حالياً",
                            description: `YouTube يرفض الطلبات حالياً بسبب كثرة الاستخدام.\n\n**الأغنية المطلوبة:** ${query}`,
                            fields: [
                                {
                                    name: "⏰ متى يمكنني المحاولة مرة أخرى؟",
                                    value: "• انتظر 10-15 دقيقة\n• جرب في وقت لاحق عندما يقل الازدحام\n• استخدم رابط YouTube مباشر إن أمكن",
                                    inline: false
                                },
                                {
                                    name: "💡 نصائح لتجنب هذا الخطأ",
                                    value: "• لا تكرر الطلبات بسرعة\n• استخدم كلمات بسيطة\n• انتظر بين الأغاني",
                                    inline: false
                                }
                            ],
                            footer: { text: "هذا ليس خطأ من البوت، بل من قيود YouTube" },
                            timestamp: new Date()
                        }]
                    });
                }
            } else if (error.message.includes('Video unavailable') || error.message.includes('Private')) {
                await loadingMsg.edit({
                    embeds: [{
                        color: 0xff0000,
                        title: "❌ الفيديو غير متاح",
                        description: `لم أتمكن من العثور على: **${query}**\n\nقد يكون الفيديو محذوف أو خاص أو محظور.`,
                        fields: [{
                            name: "💡 اقتراحات",
                            value: "• جرب كلمات أخرى\n• تأكد من كتابة اسم الأغنية بشكل صحيح\n• جرب أغنية أخرى",
                            inline: false
                        }],
                        footer: { text: "جرب البحث بكلمات مختلفة" }
                    }]
                });
            } else {
                // أخطاء أخرى
                if (attemptNumber < 2) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    const retryQuery = query.split(' ').slice(0, 3).join(' ');
                    await attemptPlay(message, retryQuery, distube, loadingMsg, attemptNumber + 1);
                } else {
                    await loadingMsg.edit({
                        embeds: [{
                            color: 0xff0000,
                            title: "❌ فشل في البحث",
                            description: `لم أتمكن من العثور على: **${query}**`,
                            fields: [{
                                name: "🔍 نصائح للبحث الأفضل",
                                value: "• استخدم كلمات أبسط\n• جرب اسم الفنان فقط\n• استخدم الإنجليزية إن أمكن\n• تأكد من الإملاء الصحيح",
                                inline: false
                            }],
                            footer: { text: "جرب مرة أخرى بكلمات مختلفة" }
                        }]
                    });
                }
            }
        }
    }

    // دالة التخطي
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

    // دالة الإيقاف (بدون مغادرة الروم)
    async function handleStopCommand(message, distube) {
        try {
            const queue = distube.getQueue(message.guild.id);
            if (!queue) {
                return message.channel.send("⚠️ لا توجد موسيقى قيد التشغيل.");
            }

            // إيقاف الموسيقى بدون مغادرة الروم
            await distube.stop(message.guild.id);
            
            message.channel.send({
                embeds: [{
                    color: 0xff0000,
                    title: "⏹️ تم إيقاف الموسيقى",
                    description: "تم إيقاف جميع الأغاني وإفراغ القائمة\n\n🎶 **سأبقى في الروم منتظراً أغاني جديدة!** 🎵",
                    footer: { text: "استخدم أمر التشغيل لبدء أغنية جديدة" }
                }]
            });
        } catch (error) {
            console.error("خطأ في إيقاف الموسيقى:", error);
            message.channel.send("❌ لا يمكن إيقاف الموسيقى حالياً.");
        }
    }

    // دالة عرض القائمة
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
            const upcomingSongs = queue.songs.slice(1, 6); // أول 5 أغاني قادمة

            const embed = {
                color: 0x7289da,
                title: "📋 قائمة التشغيل",
                fields: [
                    {
                        name: "🎶 الآن يتم تشغيل",
                        value: `**${currentSong.name}**\n👤 ${currentSong.user}\n⏱️ ${currentSong.formattedDuration}`,
                        inline: false
                    }
                ],
                footer: {
                    text: `إجمالي الأغاني: ${queue.songs.length} | المدة الإجمالية: ${queue.formattedDuration}`
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

    // دالة المساعدة
    async function handleHelpCommand(message, client) {
        const helpEmbed = {
            color: 0x00ff00,
            title: "🎵 أوامر البوت الموسيقي",
            description: "مرحباً! إليك جميع الأوامر المتاحة:",
            fields: [
                {
                    name: "🎶 تشغيل الموسيقى",
                    value: "**ش [اسم الأغنية]** - البحث وتشغيل أغنية\n**شغل [اسم الأغنية]** - تشغيل أغنية\n**play [song name]** - تشغيل أغنية",
                    inline: false
                },
                {
                    name: "⏯️ التحكم في التشغيل",
                    value: "**س** / **سكب** / **skip** - تخطي الأغنية\n**ق** / **stop** - إيقاف الموسيقى وإفراغ القائمة",
                    inline: false
                },
                {
                    name: "📋 المعلومات والقوائم",
                    value: "**قائمة** / **queue** / **q** - عرض قائمة التشغيل\n**معلومات** / **info** - معلومات البوت\n**مساعدة** / **help** - عرض هذه الرسالة\n**انضم** / **join** - الانضمام للروم الصوتي",
                    inline: false
                },
                {
                    name: "💡 أمثلة على البحث الأمثل",
                    value: "• ش فيروز\n• ش عمرو دياب\n• ش adele hello\n• ش محمد عبده",
                    inline: false
                },
                {
                    name: "🔧 نصائح لتجنب الأخطاء",
                    value: "• استخدم كلمات قصيرة وبسيطة\n• ابدأ باسم الفنان فقط\n• تجنب الكلمات الطويلة أو المعقدة\n• انتظر قليلاً بين الطلبات\n• **البوت لن يغادر الروم أبداً!** 🎵",
                    inline: false
                }
            ],
            footer: {
                text: "تم تطويره بواسطة Aziz ❤️ | استمتع بالموسيقى! 🎵",
                icon_url: client.user?.displayAvatarURL()
            },
            timestamp: new Date()
        };

        message.channel.send({ embeds: [helpEmbed] });
    }

    // دالة معلومات البوت
    async function handleInfoCommand(message, client) {
        const uptime = process.uptime();
        const uptimeString = `${Math.floor(uptime / 3600)}س ${Math.floor((uptime % 3600) / 60)}د`;

        const infoEmbed = {
            color: 0x7289da,
            title: "ℹ️ معلومات البوت",
            fields: [
                { name: "🤖 اسم البوت", value: client.user.username, inline: true },
                { name: "🆔 معرف البوت", value: client.user.id, inline: true },
                { name: "⏰ مدة التشغيل", value: uptimeString, inline: true },
                { name: "🌐 الخوادم", value: client.guilds.cache.size.toString(), inline: true },
                { name: "👥 المستخدمين", value: client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0).toString(), inline: true },
                { name: "📶 البنغ", value: `${Math.round(client.ws.ping)}ms`, inline: true }
            ],
            footer: {
                text: "تم تطويره بواسطة Aziz ❤️",
                icon_url: client.user?.displayAvatarURL()
            },
            timestamp: new Date()
        };

        message.channel.send({ embeds: [infoEmbed] });
    }

    // أحداث DisTube
    distube
        .on("playSong", (queue, song) => {
            try {
                // تحديث حالة البوت لإظهار الأغنية الحالية مع Streaming
                client.user.setActivity(`${song.name}`, { 
                    type: ActivityType.Streaming,
                    url: 'https://www.twitch.tv/discord' // URL مطلوب للـ Streaming
                });

                const embed = {
                    color: 0x7289da,
                    author: {
                        name: "🎵 بدأ التشغيل",
                        icon_url: client.user?.displayAvatarURL()
                    },
                    title: `**${song.name}**`,
                    description: `**الفنان:** ${song.uploader?.name || "غير معروف"}\n**المدة:** ${song.formattedDuration || "غير معروف"}`,
                    fields: [
                        { name: "👤 طلبها", value: song.user?.toString() || "غير معروف", inline: true },
                        { name: "🎧 الروم الصوتي", value: queue.voice?.channel?.name || "غير معروف", inline: true },
                        { name: "📺 المصدر", value: "YouTube", inline: true }
                    ],
                    thumbnail: {
                        url: song.thumbnail || "https://via.placeholder.com/300x300/7289da/ffffff?text=🎵"
                    },
                    footer: {
                        text: `في القائمة: ${queue.songs?.length || 0} أغنية | البوت لن يغادر الروم!`,
                    },
                    timestamp: new Date()
                };

                if (song.url) embed.url = song.url;

                queue.textChannel?.send({ embeds: [embed] }).catch(console.error);
            } catch (error) {
                console.error("خطأ في إرسال رسالة playSong:", error);
                // رسالة بسيطة في حالة فشل الـ embed
                queue.textChannel?.send(`🎶 **Now Playing:** ${song.name} | البوت لن يغادر الروم!`).catch(console.error);
            }
        })
        .on("addSong", (queue, song) => {
            try {
                if (queue.songs.length === 1) return; // لا تظهر رسالة للأغنية الأولى

                const embed = {
                    color: 0x00ff00,
                    title: "➕ تمت الإضافة للقائمة",
                    description: `**${song.name}**`,
                    fields: [
                        { name: "⏱️ المدة", value: song.formattedDuration || "غير معروف", inline: true },
                        { name: "📍 الترتيب", value: `${queue.songs.length}`, inline: true },
                        { name: "👤 طلبها", value: song.user?.toString() || "غير معروف", inline: true }
                    ],
                    thumbnail: {
                        url: song.thumbnail || "https://via.placeholder.com/300x300/00ff00/ffffff?text=➕"
                    },
                    footer: { text: `إجمالي الأغاني: ${queue.songs.length} | البوت لن يغادر الروم!` }
                };

                queue.textChannel?.send({ embeds: [embed] }).catch(console.error);
            } catch (error) {
                console.error("خطأ في إرسال رسالة addSong:", error);
                queue.textChannel?.send(`➕ **تمت الإضافة:** ${song.name} (الترتيب: ${queue.songs.length})`).catch(console.error);
            }
        })
        .on("noRelated", queue => {
            queue.textChannel?.send("❌ لم يتم العثور على أغاني مشابهة. البوت لا يزال في الروم!").catch(console.error);
        })
        .on("searchNoResult", (message, query) => {
            message.channel?.send(`❌ لم يتم العثور على نتائج للبحث: **${query}**\n🔍 جرب كلمات مختلفة`).catch(console.error);
        })
        .on("empty", queue => {
            // البوت لن يغادر الروم عند فراغه
            queue.textChannel?.send({
                embeds: [{
                    color: 0x00ff00,
                    title: "🎵 الروم فارغ لكنني هنا!",
                    description: "جميع الأعضاء غادروا الروم الصوتي، لكنني سأبقى هنا منتظراً عودتكم! 🎶\n\n**لن أغادر الروم أبداً** ✨",
                    footer: { text: "استخدم أمر التشغيل عند العودة!" }
                }]
            }).catch(console.error);
        })
        .on("finish", queue => {
            // تحديث حالة البوت عند انتهاء القائمة مع Streaming
            client.user.setActivity('Aziz', { 
                type: ActivityType.Streaming,
                url: 'https://www.twitch.tv/discord'
            });

            queue.textChannel?.send({
                embeds: [{
                    color: 0x00ff00,
                    title: "✅ انتهت قائمة التشغيل",
                    description: "تم الانتهاء من تشغيل جميع الأغاني!\n\n🎶 **سأبقى في الروم منتظراً أغاني جديدة** 🎵\n\nأضف المزيد باستخدام أمر التشغيل.",
                    footer: { text: "البوت لن يغادر الروم!" }
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
                    title: "⚠️ انقطع الاتصال",
                    description: "تم قطع الاتصال من الروم الصوتي بسبب مشكلة تقنية.\n\n🎶 استخدم أمر **انضم** أو ابدأ تشغيل أغنية للعودة!",
                    footer: { text: "سأحاول البقاء متصلاً دائماً!" }
                }]
            }).catch(console.error);
        })
        .on("error", (channel, error) => {
            console.error("خطأ في DisTube:", error);
            
            if (channel && typeof channel.send === 'function') {
                // معالجة خاصة لخطأ 429
                if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
                    channel.send({
                        embeds: [{
                            color: 0xff9500,
                            title: "⏳ مشكلة مؤقتة مع YouTube",
                            description: "YouTube يحد من الطلبات حالياً. جرب مرة أخرى خلال بضع دقائق.",
                            fields: [
                                {
                                    name: "💡 بدائل",
                                    value: "• استخدم رابط YouTube مباشر\n• انتظر 5-10 دقائق\n• جرب أغنية أخرى",
                                    inline: false
                                }
                            ],
                            footer: { text: "هذا خطأ مؤقت من YouTube | البوت لا يزال يعمل" }
                        }]
                    }).catch(console.error);
                } else if (error.message.includes('Video unavailable') || error.message.includes('Private video')) {
                    channel.send({
                        embeds: [{
                            color: 0xff0000,
                            title: "❌ الفيديو غير متاح",
                            description: "هذا الفيديو قد يكون:\n• محذوف أو خاص\n• محظور في منطقتك\n• مقيد بحقوق الطبع",
                            footer: { text: "جرب أغنية أخرى | البوت لا يزال يعمل" }
                        }]
                    }).catch(console.error);
                } else {
                    channel.send({
                        embeds: [{
                            color: 0xff0000,
                            title: "❌ خطأ في تشغيل الموسيقى",
                            description: "حدث خطأ أثناء تشغيل الموسيقى. جرب مرة أخرى بكلمات أبسط.",
                            fields: [
                                {
                                    name: "نصائح للبحث الأفضل",
                                    value: "• استخدم كلمات قصيرة\n• جرب اسم الفنان فقط\n• انتظر قليلاً ثم جرب مرة أخرى",
                                    inline: false
                                }
                            ],
                            footer: { text: "البوت يعمل بشكل طبيعي، المشكلة من YouTube" }
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

    // منع البوت من مغادرة الروم عند حدوث أخطاء
    client.on("voiceStateUpdate", (oldState, newState) => {
        // إذا كان البوت هو الذي تغير حالته الصوتية
        if (newState.id === client.user.id) {
            // إذا تم قطع الاتصال أو الانتقال لقناة أخرى
            if (oldState.channelId && !newState.channelId) {
                console.log("⚠️ البوت تم قطع اتصاله من الروم الصوتي");
                // محاولة إعادة الاتصال بعد ثانيتين
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
                        }
                    } catch (error) {
                        console.log("❌ فشل في إعادة الاتصال التلقائي:", error.message);
                    }
                }, 2000);
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
console.log('🚀 بدء تشغيل نظام البوت بواسطة Aziz...');
console.log(`🌍 البيئة: ${process.env.NODE_ENV || 'development'}`);
console.log(`🖥️ Node.js: ${process.version}`);
console.log(`💾 الذاكرة: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);

if (bots && bots.length > 0) {
    console.log(`🤖 بدء تشغيل ${bots.length} بوت(ات)...`);
    bots.forEach((config, index) => {
        console.log(`\n--- تشغيل البوت ${index + 1}: ${config.name} ---`);
        createBot(config);
    });
    console.log('\n🎉 تم بدء تشغيل جميع البوتات بنجاح!');
} else {
    console.error("❌ لم يتم العثور على أي بوتات في الإعدادات");
    console.error("💡 تأكد من وجود BOT_TOKEN في متغيرات البيئة أو config.json");
    process.exit(1);
}

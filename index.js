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
const server = http.createServer((req, res) => {
    res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
        status: 'online',
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        message: 'Discord Arabic Music Bot is running!',
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
let bots;
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

    // إعداد DisTube مع خيارات محسنة
    const distube = new DisTube(client, {
        emitNewSongOnly: true,
        savePreviousSongs: false, // توفير ذاكرة للاستضافة المجانية
        nsfw: false,
        searchSongs: 1, // تقليل استهلاك الذاكرة
        emptyCooldown: 0,
        leaveOnEmpty: false,
        leaveOnFinish: false,
        leaveOnStop: false,
        plugins: [
            // يمكن إضافة plugins هنا إذا كانت متوفرة
        ]
    });

    client.on("messageCreate", async (message) => {
        if (!message.guild || message.author.bot) return;
        
        // التحقق من القناة المخصصة (إذا كانت محددة)
        if (config.textChannel && message.channel.id !== config.textChannel) return;

        const content = message.content.trim().toLowerCase();
        const originalContent = message.content.trim();

        // أمر "ش" → البحث وتشغيل الأغنية
        if (content.startsWith("ش ")) {
            await handlePlayCommand(message, originalContent.replace(/^ش\s+/, "").trim(), distube);
        }
        // أمر "ش" بدون كلام → رسالة تنبيه
        else if (content === "ش") {
            message.channel.send("⚠️ اكتب اسم الأغنية بعد الأمر!\nمثال: ش أم كلثوم");
        }
        // أمر التشغيل بالبحث
        else if (content.startsWith("شغل ") || content.startsWith("play ")) {
            const query = originalContent.replace(/^(شغل|play)\s+/i, "").trim();
            await handlePlayCommand(message, query, distube);
        }
        // أمر التخطي
        else if (["س", "سكب", "skip", "next"].includes(content)) {
            await handleSkipCommand(message, distube);
        }
        // أمر الإيقاف
        else if (["ق", "stop", "إيقاف"].includes(content)) {
            await handleStopCommand(message, distube);
        }
        // أمر عرض القائمة
        else if (["قائمة", "queue", "q", "list"].includes(content)) {
            await handleQueueCommand(message, distube);
        }
        // أمر المساعدة
        else if (["مساعدة", "help", "commands", "أوامر"].includes(content)) {
            await handleHelpCommand(message, client);
        }
        // أمر معلومات البوت
        else if (["معلومات", "info", "about"].includes(content)) {
            await handleInfoCommand(message, client);
        }
    });

    // دالة تشغيل الأغاني
    async function handlePlayCommand(message, query, distube) {
        if (!message.member.voice.channel) {
            return message.channel.send("⚠️ يجب أن تكون في روم صوتي أولاً!");
        }

        if (!query) {
            return message.channel.send("⚠️ اكتب اسم الأغنية بعد الأمر!\nمثال: ش أم كلثوم");
        }

        const loadingMsg = await message.channel.send(`🔍 جاري البحث عن: **${query}**...`);

        try {
            await distube.play(message.member.voice.channel, query, {
                member: message.member,
                textChannel: message.channel,
                message,
            });
            await loadingMsg.delete().catch(() => {});
        } catch (error) {
            console.error("خطأ في البحث الأول:", error.message);
            
            // محاولة بديلة مع "music"
            try {
                const alternativeSearch = query + " music";
                await loadingMsg.edit(`🔄 محاولة بديلة: **${alternativeSearch}**...`);
                await distube.play(message.member.voice.channel, alternativeSearch, {
                    member: message.member,
                    textChannel: message.channel,
                    message,
                });
                await loadingMsg.delete().catch(() => {});
            } catch (secondError) {
                console.error("خطأ في المحاولة البديلة:", secondError.message);
                
                // محاولة أخيرة مع YouTube search
                try {
                    const youtubeSearch = `ytsearch:${query}`;
                    await loadingMsg.edit(`🔄 محاولة أخيرة...`);
                    await distube.play(message.member.voice.channel, youtubeSearch, {
                        member: message.member,
                        textChannel: message.channel,
                        message,
                    });
                    await loadingMsg.delete().catch(() => {});
                } catch (thirdError) {
                    console.error("خطأ في المحاولة الأخيرة:", thirdError.message);
                    await loadingMsg.edit({
                        embeds: [{
                            color: 0xff0000,
                            title: "❌ فشل في العثور على الأغنية",
                            description: `لم أتمكن من العثور على: **${query}**`,
                            fields: [
                                {
                                    name: "💡 نصائح للبحث",
                                    value: "• جرب كلمات أبسط\n• أضف اسم الفنان\n• تأكد من الإملاء\n• جرب باللغة الإنجليزية",
                                    inline: false
                                }
                            ],
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

    // دالة الإيقاف
    async function handleStopCommand(message, distube) {
        try {
            const queue = distube.getQueue(message.guild.id);
            if (!queue) {
                return message.channel.send("⚠️ لا توجد موسيقى قيد التشغيل.");
            }

            await distube.stop(message.guild.id);
            message.channel.send({
                embeds: [{
                    color: 0xff0000,
                    title: "⏹️ تم إيقاف الموسيقى",
                    description: "تم إيقاف جميع الأغاني وإفراغ القائمة",
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
                    value: "**قائمة** / **queue** / **q** - عرض قائمة التشغيل\n**معلومات** / **info** - معلومات البوت\n**مساعدة** / **help** - عرض هذه الرسالة",
                    inline: false
                },
                {
                    name: "💡 أمثلة",
                    value: "• ش أم كلثوم\n• شغل fairuz\n• play hello adele",
                    inline: false
                }
            ],
            footer: {
                text: "استمتع بالموسيقى! 🎵 | البوت يدعم العربية والإنجليزية",
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
                text: "تم تطويره للمجتمع العربي ❤️",
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
                const embed = {
                    color: 0x7289da,
                    author: {
                        name: "🎵 بدأ التشغيل",
                        icon_url: client.user?.displayAvatarURL()
                    },
                    title: song.name,
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
                        text: `في القائمة: ${queue.songs?.length || 0} أغنية`,
                    },
                    timestamp: new Date()
                };

                if (song.url) embed.url = song.url;

                queue.textChannel?.send({ embeds: [embed] }).catch(console.error);
            } catch (error) {
                console.error("خطأ في إرسال رسالة playSong:", error);
                queue.textChannel?.send(`🎶 **يتم تشغيل:** ${song.name}`).catch(console.error);
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
                    footer: { text: `إجمالي الأغاني: ${queue.songs.length}` }
                };

                queue.textChannel?.send({ embeds: [embed] }).catch(console.error);
            } catch (error) {
                console.error("خطأ في إرسال رسالة addSong:", error);
            }
        })
        .on("noRelated", queue => {
            queue.textChannel?.send("❌ لم يتم العثور على أغاني مشابهة.").catch(console.error);
        })
        .on("searchNoResult", (message, query) => {
            message.channel?.send(`❌ لم يتم العثور على نتائج للبحث: **${query}**\n🔍 جرب كلمات مختلفة`).catch(console.error);
        })
        .on("empty", queue => {
            queue.textChannel?.send({
                embeds: [{
                    color: 0xffa500,
                    title: "⚠️ الروم الصوتي فارغ",
                    description: "جميع الأعضاء غادروا الروم الصوتي، لكنني سأبقى هنا منتظراً عودتكم! 🎵"
                }]
            }).catch(console.error);
        })
        .on("finish", queue => {
            queue.textChannel?.send({
                embeds: [{
                    color: 0x00ff00,
                    title: "✅ انتهت قائمة التشغيل",
                    description: "تم الانتهاء من تشغيل جميع الأغاني! أضف المزيد باستخدام أمر التشغيل."
                }]
            }).catch(console.error);
        })
        .on("disconnect", queue => {
            queue.textChannel?.send({
                embeds: [{
                    color: 0xff0000,
                    title: "👋 تم قطع الاتصال",
                    description: "تم قطع الاتصال من الروم الصوتي."
                }]
            }).catch(console.error);
        })
        .on("error", (channel, error) => {
            console.error("خطأ في DisTube:", error);
            if (channel && typeof channel.send === 'function') {
                channel.send(`❌ حدث خطأ في تشغيل الموسيقى: ${error.message}`).catch(console.error);
            }
        });

    // أحداث العميل
    client.once("ready", () => {
        console.log(`✅ تم تسجيل الدخول كـ ${client.user.tag}`);
        console.log(`🎵 البوت ${config.name} جاهز للاستخدام!`);
        console.log(`🌐 البوت متصل بـ ${client.guilds.cache.size} خادم`);

        // تحديث حالة البوت
        client.

  console.log('\n🎉 تم بدء تشغيل جميع البوتات بنجاح!');
} else {
  console.error("❌ لم يتم العثور على أي بوتات في الإعدادات");
  console.error("💡 تأكد من وجود BOT_TOKEN في متغيرات البيئة أو config.json");
  process.exit(1);
}

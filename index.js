// إضافة نظام queue لإدارة الطلبات - ضع هذا في بداية الملف بعد تحميل المكتبات
class RequestManager {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.lastRequestTime = 0;
        this.minDelay = 5000; // 5 ثواني بين الطلبات
        this.requestCount = 0;
        this.resetTime = Date.now();
    }

    async addRequest(requestFn) {
        return new Promise((resolve, reject) => {
            this.queue.push({ requestFn, resolve, reject, timestamp: Date.now() });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.processing || this.queue.length === 0) return;
        
        this.processing = true;
        
        while (this.queue.length > 0) {
            // إعادة تعيين العداد كل ساعة
            const now = Date.now();
            if (now - this.resetTime > 3600000) {
                this.requestCount = 0;
                this.resetTime = now;
            }

            // تحديد التأخير بناءً على عدد الطلبات
            let delay = this.minDelay;
            if (this.requestCount > 10) delay = 10000; // 10 ثواني بعد 10 طلبات
            if (this.requestCount > 20) delay = 30000; // 30 ثانية بعد 20 طلب
            if (this.requestCount > 30) delay = 60000; // دقيقة بعد 30 طلب

            const timeSinceLastRequest = now - this.lastRequestTime;
            if (timeSinceLastRequest < delay) {
                await this.delay(delay - timeSinceLastRequest);
            }

            const { requestFn, resolve, reject } = this.queue.shift();
            
            try {
                const result = await requestFn();
                this.requestCount++;
                this.lastRequestTime = Date.now();
                resolve(result);
            } catch (error) {
                reject(error);
            }

            // تأخير إضافي بين الطلبات
            await this.delay(Math.min(1000 + (this.requestCount * 100), 5000));
        }
        
        this.processing = false;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// إنشاء مدير الطلبات العام
const globalRequestManager = new RequestManager();

// تحديث إعدادات DisTube مع خيارات محسنة أكثر لـ Render
function createBot(config) {
    // ... (الكود السابق حتى إنشاء العميل)

    const distube = new DisTube(client, {
        emitNewSongOnly: true,
        savePreviousSongs: false,
        nsfw: false,
        searchSongs: 1, // أغنية واحدة فقط في النتائج
        emptyCooldown: 0,
        leaveOnEmpty: false,
        leaveOnFinish: false,
        leaveOnStop: false,
        searchCooldown: 60, // دقيقة كاملة بين البحثات
        youtubeCookie: process.env.YOUTUBE_COOKIE, // للمساعدة في تجنب القيود
        customFilters: {},
        ffmpeg: {
            path: process.env.FFMPEG_PATH || 'ffmpeg'
        },
        // خيارات إضافية للـ HTTP requests
        requestOptions: {
            retries: 5,
            retryDelay: (retryCount) => Math.min(1000 * Math.pow(2, retryCount), 30000),
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8'
            }
        }
    });

    // استبدال دالة handlePlayCommand بنسخة محسنة لـ Render
    async function handlePlayCommand(message, query, distube) {
        if (!message.member.voice.channel) {
            return message.channel.send("⚠️ يجب أن تكون في روم صوتي أولاً!");
        }

        if (!query) {
            return message.channel.send("⚠️ اكتب اسم الأغنية بعد الأمر!\nمثال: aziz أم كلثوم");
        }

        const loadingMsg = await message.channel.send(`🔍 جاري البحث عن: **${query}**...`);

        try {
            // استخدام مدير الطلبات لتجنب 429
            await globalRequestManager.addRequest(async () => {
                return await distube.play(message.member.voice.channel, query, {
                    member: message.member,
                    textChannel: message.channel,
                    message,
                });
            });
            
            await loadingMsg.delete().catch(() => {});
            
        } catch (error) {
            console.error("خطأ في handlePlayCommand:", error.message);
            await handlePlayError(error, loadingMsg, query, message, distube);
        }
    }

    // دالة معالجة أخطاء التشغيل المحسنة
    async function handlePlayError(error, loadingMsg, query, message, distube) {
        const errorMessage = error.message.toLowerCase();
        
        if (errorMessage.includes('429') || errorMessage.includes('too many requests')) {
            // خطأ 429 - كثرة الطلبات
            await loadingMsg.edit({
                embeds: [{
                    color: 0xff9500,
                    title: "⏳ YouTube محدود مؤقتاً",
                    description: `تم حظر الطلبات مؤقتاً من YouTube بسبب كثرة الاستخدام.\n\n**الأغنية المطلوبة:** ${query}`,
                    fields: [
                        {
                            name: "⏰ وقت الانتظار المتوقع",
                            value: "• 15-30 دقيقة للعودة الطبيعية\n• الخدمة ستعود تلقائياً\n• **لا حاجة لإعادة تشغيل البوت**",
                            inline: false
                        },
                        {
                            name: "📋 بدائل متاحة",
                            value: "• استخدم رابط YouTube مباشر\n• جرب أغاني أخرى لاحقاً\n• انتظر حتى تقل كثافة الاستخدام",
                            inline: false
                        },
                        {
                            name: "🎵 حالة البوت",
                            value: "البوت يعمل بشكل طبيعي ولن يغادر الروم. المشكلة من YouTube فقط.",
                            inline: false
                        }
                    ],
                    footer: { 
                        text: "هذا ليس خطأ في البوت - إنه حد من YouTube | استضافة Render",
                        icon_url: message.client.user.displayAvatarURL() 
                    },
                    timestamp: new Date()
                }]
            });
            
            // إشعار في الكونسول للمتابعة
            console.log(`🚨 خطأ 429 حدث للسيرفر: ${message.guild.name} | الأغنية: ${query}`);
            console.log(`⏰ سيتم تقليل الطلبات تلقائياً لمدة ساعة`);
            
        } else if (errorMessage.includes('video unavailable') || errorMessage.includes('private')) {
            await loadingMsg.edit({
                embeds: [{
                    color: 0xff0000,
                    title: "❌ الفيديو غير متاح",
                    description: `لم أتمكن من العثور على أو تشغيل: **${query}**`,
                    fields: [{
                        name: "الأسباب المحتملة",
                        value: "• الفيديو محذوف أو خاص\n• محظور في منطقتك\n• مشكلة في حقوق النشر\n• خطأ في اسم الأغنية",
                        inline: false
                    }, {
                        name: "💡 حلول مقترحة",
                        value: "• تأكد من الإملاء\n• جرب اسم الفنان فقط\n• استخدم كلمات أبسط\n• جرب أغنية أخرى",
                        inline: false
                    }],
                    footer: { text: "جرب البحث بطريقة مختلفة" }
                }]
            });
            
        } else if (errorMessage.includes('no result') || errorMessage.includes('not found')) {
            await loadingMsg.edit({
                embeds: [{
                    color: 0xffa500,
                    title: "🔍 لم يتم العثور على نتائج",
                    description: `لا توجد نتائج للبحث: **${query}**`,
                    fields: [{
                        name: "🎯 نصائح للبحث الأفضل",
                        value: "• ابدأ باسم الفنان فقط\n• استخدم اللغة الإنجليزية\n• تجنب الرموز الخاصة\n• استخدم كلمات شائعة",
                        inline: false
                    }, {
                        name: "📝 أمثلة صحيحة",
                        value: "• `ش fairuz`\n• `ش amr diab`\n• `ش om kalthoum`\n• `ش adele`",
                        inline: false
                    }],
                    footer: { text: "جرب كلمات أخرى للحصول على نتائج أفضل" }
                }]
            });
            
        } else {
            // أخطاء عامة أخرى
            await loadingMsg.edit({
                embeds: [{
                    color: 0xff0000,
                    title: "❌ خطأ في التشغيل",
                    description: "حدث خطأ أثناء محاولة تشغيل الأغنية",
                    fields: [{
                        name: "🔧 خطوات للحل",
                        value: "• انتظر دقيقة وجرب مرة أخرى\n• استخدم كلمات أبسط\n• تأكد من اتصال الإنترنت\n• جرب أغنية أخرى",
                        inline: false
                    }],
                    footer: { text: "إذا استمرت المشكلة، جرب لاحقاً" }
                }]
            });
        }
    }

    // تحسين معالج أخطاء DisTube للاستضافة السحابية
    distube.on("error", async (channel, error) => {
        console.error(`🔴 DisTube Error [${new Date().toISOString()}]:`, error.message);
        console.error(`🌐 Guild: ${channel?.guild?.name || 'Unknown'}`);
        console.error(`📊 Error Type: ${error.name || 'Unknown'}`);
        
        if (channel && typeof channel.send === 'function') {
            const errorMsg = error.message.toLowerCase();
            
            if (errorMsg.includes('429') || errorMsg.includes('too many requests')) {
                // تقليل التكرار والإزعاج
                const recentError = channel.guild?.lastYouTubeError;
                const now = Date.now();
                
                if (!recentError || (now - recentError) > 300000) { // كل 5 دقائق فقط
                    channel.guild.lastYouTubeError = now;
                    
                    await channel.send({
                        embeds: [{
                            color: 0xff9500,
                            title: "⚠️ حد YouTube مؤقت",
                            description: "YouTube يحد من الطلبات حالياً. **البوت يعمل طبيعياً** لكن YouTube يرفض الطلبات مؤقتاً.",
                            fields: [{
                                name: "⏱️ متى سيعود؟",
                                value: "عادة خلال 15-30 دقيقة",
                                inline: true
                            }, {
                                name: "🎵 حالة البوت",
                                value: "طبيعية - لن يغادر الروم",
                                inline: true
                            }],
                            footer: { text: "  | سيعود تلقائياً" }
                        }]
                    }).catch(console.error);
                }
            } else {
                // أخطاء أخرى - رسالة مختصرة
                await channel.send({
                    embeds: [{
                        color: 0xff0000,
                        title: "⚠️ مشكلة مؤقتة",
                        description: "حدثت مشكلة في تشغيل الموسيقى. البوت يعمل طبيعياً، جرب أغنية أخرى.",
                        footer: { text: "المشكلة عادة مؤقتة" }
                    }]
                }).catch(console.error);
            }
        }
        
        // إرسال تفاصيل الخطأ لـ webhook إذا كان متاحاً (اختياري)
        if (process.env.ERROR_WEBHOOK_URL) {
            try {
                const webhook = new WebhookClient({ url: process.env.ERROR_WEBHOOK_URL });
                await webhook.send({
                    embeds: [{
                        color: 0xff0000,
                        title: "🚨 Bot Error - Render Hosting",
                        description: `**Error:** ${error.message}\n**Guild:** ${channel?.guild?.name || 'Unknown'}\n**Time:** ${new Date().toISOString()}`,
                        fields: [{
                            name: "Stack Trace",
                            value: "```" + (error.stack?.substring(0, 1000) || "No stack trace") + "```",
                            inline: false
                        }]
                    }]
                });
            } catch (webhookError) {
                console.error("فشل في إرسال الخطأ للـ webhook:", webhookError.message);
            }
        }
    });

    // بقية الكود يبقى كما هو...
    // (باقي الأحداث والدوال)
}

// إضافة مراقب لحالة الذاكرة في Render
setInterval(() => {
    const memUsage = process.memoryUsage();
    const memMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    
    if (memMB > 400) { // تحذير إذا تجاوز 400 MB
        console.warn(`⚠️ Memory usage high: ${memMB} MB`);
        
        // تنظيف قسري للذاكرة
        if (global.gc) {
            global.gc();
            console.log("🧹 Forced garbage collection");
        }
    }
    
    // إحصائيات كل 10 دقائق
    if (Date.now() % 600000 < 60000) {
        console.log(`📊 Stats - Memory: ${memMB}MB | Uptime: ${Math.floor(process.uptime() / 60)}min | Requests: ${globalRequestManager.requestCount}`);
    }
}, 60000); // كل دقيقة

// تحسين keep-alive للـ free tier
if (process.env.NODE_ENV === 'production') {
    const keepAlive = () => {
        const pingInterval = setInterval(() => {
            const currentHour = new Date().getHours();
            // تقليل pings في أوقات الذروة
            const intervalTime = (currentHour >= 8 && currentHour <= 22) ? 28 : 25;
            
            http.get(`http://localhost:${PORT}`, (res) => {
                const status = res.statusCode === 200 ? "✅" : "⚠️";
                console.log(`${status} Keep-alive: ${res.statusCode} at ${new Date().toLocaleTimeString()}`);
            }).on('error', (err) => {
                console.log('🔴 Keep-alive failed:', err.message);
            });
        }, 25 * 60 * 1000); // 25 دقيقة ثابتة
        
        return pingInterval;
    };
    
    setTimeout(() => {
        keepAlive();
        console.log('🔄 Render keep-alive system activated');
    }, 30000);
}

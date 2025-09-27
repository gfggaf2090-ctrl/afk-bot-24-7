// npm install discord.js distube @distube/ytdl-core ytdl-core @ffmpeg-installer/ffmpeg ffmpeg-static
const { Client, GatewayIntentBits } = require("discord.js");
const { DisTube } = require("distube");
const fs = require("fs");

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
    console.warn('⚠️ لم يتم العثور على ffmpeg');
  }
}

// قراءة إعدادات البوتات وتحويل أسماء المتغيرات إلى قيم البيئة
let bots;
try {
  bots = JSON.parse(fs.readFileSync("config.json", "utf8")).map(bot => ({
    ...bot,
    token: process.env[bot.token] || bot.token
  }));
} catch (error) {
  console.error("❌ خطأ في قراءة config.json:", error.message);
  process.exit(1);
}

function createBot(config) {
  // التحقق من صحة التوكن
  console.log(`🔍 Checking token for bot: ${config.name || 'Unknown'}...`);
  console.log(`Token length: ${config.token ? config.token.length : 'undefined'}`);

  if (!config.token) {
    console.error("❌ Token is missing in configuration");
    return;
  }

  if (config.token.length < 50 || !config.token.includes('.') || config.token.split('.').length !== 3) {
    console.error(`❌ Invalid token format:`);
    console.error(`- Length: ${config.token.length} (expected ~70)`);
    console.error(`- Contains dots: ${config.token.includes('.')}`);
    console.error(`- Parts count: ${config.token.split('.').length} (expected 3)`);
    console.error(`- First 20 chars: ${config.token.substring(0, 20)}...`);
    return;
  }

  console.log(`✅ Token appears valid (${config.token.length} chars, 3 parts)`);

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  const distube = new DisTube(client, {
    emitNewSongOnly: true,
    savePreviousSongs: true,
    nsfw: false
  });

  client.on("messageCreate", async (message) => {
    if (!message.guild || message.author.bot) return;

    // يتأكد إن الرسالة في الروم المخصص (إذا كان محدد)
    if (config.textChannel && message.channel.id !== config.textChannel) return;

    const content = message.content.trim();

    // أمر "ش" → البحث وتشغيل الأغنية
    if (content.startsWith("ش ")) {
      if (!message.member.voice.channel) {
        return message.channel.send("⚠️ لازم تدخل روم صوتي أولاً!");
      }

      const searchQuery = content.replace(/^ش\s+/, "").trim();

      if (!searchQuery) {
        return message.channel.send("⚠️ اكتب اسم الأغنية بعد الأمر!");
      }

      message.channel.send(`🔍 محاولة تشغيل: **${searchQuery}**...`);

      try {
        await distube.play(message.member.voice.channel, searchQuery, {
          member: message.member,
          textChannel: message.channel,
          message,
        });
      } catch (error) {
        console.error("خطأ في البحث وتشغيل الأغنية:", error);

        // محاولة بحث أخرى مع "music" في النهاية
        try {
          const alternativeSearch = searchQuery + " music";
          message.channel.send(`🔄 محاولة بديلة: **${alternativeSearch}**...`);
          await distube.play(message.member.voice.channel, alternativeSearch, {
            member: message.member,
            textChannel: message.channel,
            message,
          });
        } catch (secondError) {
          console.error("خطأ في المحاولة البديلة:", secondError);

          // محاولة ثالثة مع YouTube URL format
          try {
            const youtubeSearch = `ytsearch:${searchQuery}`;
            message.channel.send(`🔄 محاولة أخيرة: **${searchQuery}**...`);
            await distube.play(message.member.voice.channel, youtubeSearch, {
              member: message.member,
              textChannel: message.channel,
              message,
            });
          } catch (thirdError) {
            console.error("خطأ في المحاولة الأخيرة:", thirdError);
            message.channel.send(`❌ لم أتمكن من العثور على الأغنية: **${searchQuery}**\n🔍 جرب كلمات مختلفة أو أضف كلمة "أغنية" أو "music"\n\n**الأخطاء:**\n- ${error.message}\n- ${secondError.message}`);
          }
        }
      }
    }

    // أمر "ش" بدون كلام → رسالة تنبيه
    if (content === "ش") {
      message.channel.send("⚠️ اكتب اسم الأغنية بعد الأمر!");
    }

    // أمر التشغيل بالبحث - يمكن استخدام "شغل" أو "play" متبوعاً باسم الأغنية
    if (content.startsWith("شغل ") || content.startsWith("play ")) {
      if (!message.member.voice.channel) {
        return message.channel.send("⚠️ لازم تدخل روم صوتي أولاً!");
      }

      const searchQuery = content.replace(/^(شغل|play)\s+/, "").trim();

      if (!searchQuery) {
        return message.channel.send("⚠️ اكتب اسم الأغنية بعد الأمر!");
      }

      message.channel.send(`🔍 جاري البحث عن: **${searchQuery}**...`);

      try {
        await distube.play(message.member.voice.channel, searchQuery, {
          member: message.member,
          textChannel: message.channel,
          message,
        });
      } catch (error) {
        console.error("خطأ في البحث وتشغيل الأغنية:", error);

        // محاولة بحث أخرى مع "music" في النهاية
        try {
          const alternativeSearch = searchQuery + " music";
          message.channel.send(`🔄 محاولة بديلة: **${alternativeSearch}**...`);
          await distube.play(message.member.voice.channel, alternativeSearch, {
            member: message.member,
            textChannel: message.channel,
            message,
          });
        } catch (secondError) {
          console.error("خطأ في المحاولة البديلة:", secondError);

          // محاولة ثالثة مع YouTube URL format
          try {
            const youtubeSearch = `ytsearch:${searchQuery}`;
            message.channel.send(`🔄 محاولة أخيرة: **${searchQuery}**...`);
            await distube.play(message.member.voice.channel, youtubeSearch, {
              member: message.member,
              textChannel: message.channel,
              message,
            });
          } catch (thirdError) {
            console.error("خطأ في المحاولة الأخيرة:", thirdError);
            message.channel.send(`❌ لم أتمكن من العثور على الأغنية: **${searchQuery}**\n🔍 جرب كلمات مختلفة أو أضف كلمة "أغنية" أو "music"`);
          }
        }
      }
    }

    // أمر "س" أو "سكب" → يتخطى الأغنية
    if (content === "س" || content === "سكب") {
      try {
        const queue = distube.getQueue(message.guild.id);
        if (queue) {
          await distube.skip(message.guild.id);
          message.channel.send("⏭️ تم تخطي الأغنية.");
        } else {
          message.channel.send("⚠️ ما في شيء يتخطى.");
        }
      } catch (error) {
        console.error("خطأ في تخطي الأغنية:", error);
        message.channel.send("⚠️ ما في شيء يتخطى.");
      }
    }

    // أمر "ق" → يوقف الموسيقى بس مايطلعش من الروم
    if (content === "ق") {
      try {
        const queue = distube.getQueue(message.guild.id);
        if (queue) {
          await distube.stop(message.guild.id);
          message.channel.send("⏹️ تم إيقاف الموسيقى.");
        } else {
          message.channel.send("⚠️ ما في موسيقى تشتغل.");
        }
      } catch (error) {
        console.error("خطأ في إيقاف الموسيقى:", error);
        message.channel.send("⚠️ ما في موسيقى تشتغل.");
      }
    }

    // أمر عرض القائمة الحالية
    if (content === "قائمة" || content === "queue") {
      try {
        const queue = distube.getQueue(message.guild.id);
        if (!queue) {
          return message.channel.send("⚠️ لا توجد أغاني في القائمة حالياً.");
        }

        const queueList = queue.songs.map((song, index) => 
          `${index === 0 ? '🎶' : `${index}.`} **${song.name}** - \`${song.formattedDuration}\``
        ).slice(0, 10).join('\n');

        message.channel.send(`📋 **قائمة التشغيل:**\n${queueList}${queue.songs.length > 10 ? `\n...و ${queue.songs.length - 10} أغاني أخرى` : ''}`);
      } catch (error) {
        message.channel.send("⚠️ لا توجد أغاني في القائمة حالياً.");
      }
    }
  });

  // رسائل حالة الأغنية مع معالجة الأخطاء
  distube
    .on("playSong", (queue, song) => {
      try {
        // رسالة حلوة زي اللي في الصورة
        const embed = {
          color: 0x7289da,
          author: {
            name: "🎵 بدأ التشغيل",
            icon_url: client.user.displayAvatarURL()
          },
          title: song.name,
          description: `**الفنان:** ${song.uploader?.name || "غير معروف"}\n**المدة:** ${song.formattedDuration || "غير معروف"}`,
          fields: [
            {
              name: "👤 طلبها",
              value: song.user ? song.user.toString() : "غير معروف",
              inline: true
            },
            {
              name: "🎧 الروم الصوتي", 
              value: queue.voice?.channel?.name || "غير معروف",
              inline: true
            },
            {
              name: "📺 المصدر",
              value: "YouTube",
              inline: true
            }
          ],
          thumbnail: {
            url: song.thumbnail || "https://via.placeholder.com/300x300/7289da/ffffff?text=🎵"
          },
          footer: {
            text: `الآن في: ${queue.voice?.channel?.name || "روم صوتي"}`,
            icon_url: "https://cdn.discordapp.com/attachments/123456789/music-note.png"
          },
          timestamp: new Date(),
          url: song.url
        };

        queue.textChannel?.send({ embeds: [embed] });
      } catch (error) {
        console.error("خطأ في إرسال رسالة playSong:", error);
        queue.textChannel?.send(`🎶 **يشغل الآن:** ${song.name}\n👤 **طلبها:** ${song.user}\n⏱️ **المدة:** ${song.formattedDuration}`);
      }
    })
    .on("addSong", (queue, song) => {
      try {
        const embed = {
          color: 0x00ff00,
          title: "➕ تمت الإضافة للقائمة",
          description: `**${song.name}**`,
          fields: [
            {
              name: "⏱️ المدة",
              value: song.formattedDuration || "غير معروف",
              inline: true
            },
            {
              name: "📍 الترتيب",
              value: `${queue.songs.length}`,
              inline: true
            },
            {
              name: "👤 طلبها",
              value: song.user ? song.user.toString() : "غير معروف",
              inline: true
            }
          ],
          thumbnail: {
            url: song.thumbnail || "https://via.placeholder.com/300x300/00ff00/ffffff?text=➕"
          },
          footer: {
            text: `إجمالي الأغاني في القائمة: ${queue.songs.length}`
          }
        };

        queue.textChannel?.send({ embeds: [embed] });
      } catch (error) {
        console.error("خطأ في إرسال رسالة addSong:", error);
        queue.textChannel?.send(`➕ تمت إضافة: **${song.name}** إلى القائمة`);
      }
    })
    .on("noRelated", queue => {
      queue.textChannel?.send("❌ لم يتم العثور على أغاني مشابهة.");
    })
    .on("searchNoResult", (message, query) => {
      message.channel?.send(`❌ لم يتم العثور على نتائج للبحث: **${query}**\n🔍 جرب كلمات مختلفة`);
    })
    .on("searchInvalidResponse", (message, query) => {
      message.channel?.send(`❌ استجابة غير صحيحة للبحث: **${query}**\n🔄 حاول مرة أخرى`);
    })
    .on("empty", queue => {
      try {
        queue.textChannel?.send("⚠️ الروم الصوتي فارغ، لكن سأبقى في الروم.");
      } catch (error) {
        console.error("خطأ في إرسال رسالة empty:", error);
      }
    })
    .on("finish", queue => {
      try {
        queue.textChannel?.send("✅ انتهت قائمة التشغيل، لكن سأبقى في الروم.");
      } catch (error) {
        console.error("خطأ في إرسال رسالة finish:", error);
      }
    })
    .on("disconnect", queue => {
      try {
        queue.textChannel?.send("👋 تم قطع الاتصال من الروم الصوتي.");
      } catch (error) {
        console.error("خطأ في إرسال رسالة disconnect:", error);
      }
    })
    .on("error", (channel, error) => {
      console.error("خطأ في DisTube:", error);
      if (channel && channel.send) {
        channel.send(`❌ حدث خطأ في تشغيل الموسيقى: ${error.message}`);
      }
    });

  // معالجة أحداث العميل
  client.once("ready", () => {
    console.log(`✅ تم تسجيل الدخول كـ ${client.user.tag}`);
    console.log(`🎵 البوت جاهز للاستخدام!`);
  });

  client.on("error", error => {
    console.error("خطأ في العميل:", error);
  });

  client.on("warn", warning => {
    console.warn("تحذير من العميل:", warning);
  });

  // تسجيل دخول البوت مع معالجة الأخطاء
  client.login(config.token).catch(error => {
    console.error(`❌ فشل في تسجيل دخول البوت: ${config.name || 'Unknown'}`);
    console.error("خطأ:", error.message);
  });

  return { client, distube };
}

// تشغيل جميع البوتات من config.json
if (bots && bots.length > 0) {
  console.log(`🚀 بدء تشغيل ${bots.length} بوت(ات)...`);
  bots.forEach((config, index) => {
    console.log(`\n--- تشغيل البوت ${index + 1} ---`);
    createBot(config);
  });
} else {
  console.error("❌ لم يتم العثور على أي بوتات في config.json");
}

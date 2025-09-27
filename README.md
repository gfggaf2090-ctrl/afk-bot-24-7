# 🎵 Lavamusic Enhanced

[![Discord.js Version](https://img.shields.io/badge/discord.js-v14.16.3-blue.svg)](https://www.npmjs.com/package/discord.js)
[![Node.js Version](https://img.shields.io/badge/node.js-18.x-green.svg)](https://nodejs.org/)
[![Lavalink](https://img.shields.io/badge/Lavalink-v4.0+-purple.svg)](https://github.com/lavalink-devs/Lavalink)
[![License](https://img.shields.io/badge/license-GPL--3.0-red.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-stable-brightgreen.svg)]()

بوت موسيقي متطور لديسكورد مع **نظام حماية متقدم من خطأ 429** وتقنية Lavalink المتطورة

## ✨ المميزات الرئيسية

### 🛡️ نظام الحماية المتقدم
- **حماية كاملة من خطأ 429** مع قائمة انتظار ذكية
- **إدارة متقدمة للطلبات** مع حدود زمنية مرنة
- **نظام تعافي تلقائي** عند حدوث أخطاء
- **مراقبة مستمرة** لصحة النظام

### 🔗 تقنية Lavalink المتقدمة
- **دعم متعدد العقد** للحصول على أفضل أداء
- **توزيع الأحمال الذكي** بين العقد المختلفة
- **جودة صوت عالية** مع تقليل التأخير
- **استقرار عالي** مع إعادة الاتصال التلقائي

### 🎵 مميزات الموسيقى
- **تشغيل من مصادر متعددة**: YouTube, Spotify, SoundCloud, Apple Music
- **12+ فلتر صوتي متقدم**: Bass Boost, Nightcore, 8D, Karaoke وغيرها
- **إدارة قوائم تشغيل متطورة** مع حفظ وتحميل
- **تشغيل 24/7** مع الحفاظ على الاستقرار
- **بحث ذكي** مع نتائج محسنة

### 🌍 دعم متعدد اللغات
- **دعم كامل للعربية** في جميع الأوامر والرسائل
- **أوامر مختلطة** - استخدم العربية أو الإنجليزية
- **رسائل محلية** حسب لغة المستخدم

### ⚡ أداء متفوق
- **استهلاك ذاكرة محسن** مع تنظيف تلقائي
- **معالجة متزامنة** للطلبات المتعددة
- **تخزين مؤقت ذكي** لتسريع الاستجابة
- **مراقبة الأداء** مع تقارير تفصيلية

## 🚀 التثبيت والإعداد

### المتطلبات الأساسية
```bash
# Node.js 18.x أو أحدث
node --version

# npm 8.x أو أحدث  
npm --version

# Git
git --version
```

### 1. استنساخ المشروع
```bash
git clone https://github.com/yourusername/lavamusic-enhanced.git
cd lavamusic-enhanced
```

### 2. تثبيت التبعيات
```bash
npm install
```

### 3. إعداد قاعدة البيانات
```bash
# إنشاء ملف قاعدة البيانات
npm run db:push

# إنتاج Prisma Client
npm run db:generate
```

### 4. إعداد متغيرات البيئة
```bash
# نسخ ملف المثال
cp .env.example .env

# تحرير الملف وإضافة بياناتك
nano .env
```

### 5. إعداد Lavalink
```bash
# تحميل Lavalink
wget https://github.com/lavalink-devs/Lavalink/releases/latest/download/Lavalink.jar

# تشغيل Lavalink
java -jar Lavalink.jar
```

### 6. نشر الأوامر التفاعلية
```bash
npm run deploy:commands
```

### 7. تشغيل البوت
```bash
# للإنتاج
npm start

# للتطوير
npm run dev
```

## 🎮 الأوامر المتاحة

### 🎵 أوامر التشغيل
| الأمر | الوصف | المثال |
|-------|--------|---------|
| `/play [song]` | تشغيل أغنية | `/play أم كلثوم` |
| `/ش [الأغنية]` | تشغيل أغنية (عربي) | `/ش فيروز` |
| `/search [query]` | البحث والاختيار | `/search محمد عبده` |

### ⏯️ أوامر التحكم
| الأمر | الوصف |
|-------|--------|
| `/skip` أو `/س` | تخطي الأغنية الحالية |
| `/stop` أو `/ق` | إيقاف التشغيل نهائياً |
| `/pause` أو `/وقف` | إيقاف مؤقت |
| `/resume` أو `/استكمال` | استكمال التشغيل |

### 🔊 أوامر الصوت
| الأمر | الوصف | المثال |
|-------|--------|---------|
| `/volume [level]` | تغيير مستوى الصوت | `/volume 75` |
| `/filter [type]` | تطبيق فلتر صوتي | `/filter bassboost` |

### 📋 أوامر المعلومات
| الأمر | الوصف |
|-------|--------|
| `/queue` أو `/قائمة` | عرض قائمة التشغيل |
| `/nowplaying` أو `/الان` | الأغنية الحالية |
| `/stats` أو `/احصائيات` | إحصائيات البوت |

### 🎛️ أوامر متقدمة
| الأمر | الوصف |
|-------|--------|
| `/loop [mode]` | تكرار الأغاني |
| `/shuffle` | خلط القائمة |
| `/clear` | مسح القائمة |
| `/remove [position]` | حذف أغنية معينة |

## 🔧 إعداد متغيرات البيئة

### إعدادات أساسية
```env
# بيانات البوت
TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
PREFIX=!

# إعدادات الخادم
PORT=3000
NODE_ENV=production

# قاعدة البيانات
DATABASE_URL="file:./dev.db"
```

### إعدادات Lavalink
```env
# العقدة الرئيسية
LAVALINK_HOST=localhost
LAVALINK_PORT=2333
LAVALINK_PASSWORD=youshallnotpass

# عقد إضافية (اختيارية)
LAVALINK_HOST_1=node1.example.com
LAVALINK_PORT_1=2333
LAVALINK_PASSWORD_1=password1
```

### نظام الحماية من 429
```env
# YouTube Cookies للحماية المتقدمة
YOUTUBE_COOKIES="your_cookies_here"

# حدود الطلبات
RATE_LIMIT_PER_MINUTE=5
RATE_LIMIT_PER_HOUR=100
RATE_LIMIT_PER_DAY=500

# إعدادات الحماية
ENABLE_ADVANCED_PROTECTION=true
AUTO_COOLDOWN_DURATION=600000
```

## 🐳 النشر باستخدام Docker

### إنشاء الحاوية
```bash
docker build -t lavamusic-enhanced .
```

### تشغيل البوت
```bash
docker run -d \
  --name lavamusic \
  -p 3000:3000 \
  --env-file .env \
  lavamusic-enhanced
```

### استخدام Docker Compose
```bash
docker-compose up -d
```

## ☁️ النشر السحابي

### Render
1. ربط المستودع بـ Render
2. اختيار "Web Service"
3. إضافة متغيرات البيئة
4. النشر التلقائي

### Railway
```bash
# تثبيت Railway CLI
npm install -g @railway/cli

# تسجيل الدخول
railway login

# النشر
railway up
```

### Heroku
```bash
# تسجيل الدخول
heroku login

# إنشاء تطبيق
heroku create your-bot-name

# إضافة متغيرات البيئة
heroku config:set TOKEN=your_token

# النشر
git push heroku main
```

## 📊 المراقبة والإحصائيات

### واجهة المراقبة
- **الرابط**: `http://localhost:3000/`
- **المعلومات المتاحة**:
  - حالة البوت والذاكرة
  - إحصائيات قائمة الانتظار
  - صحة عقد Lavalink
  - طلبات اليوم والحدود

### تسجيل الأحداث
```bash
# عرض السجلات
tail -f logs/lavamusic.log

# مراقبة الأخطاء
grep "ERROR" logs/lavamusic.log
```

## 🛠️ استكشاف الأخطاء

### مشاكل شائعة وحلولها

#### البوت لا يتصل
```bash
# تحقق من التوكن
echo $TOKEN

# تحقق من اتصال الإنترنت
ping discord.com
```

#### خطأ 429 مستمر
```bash
# تحقق من الكوكيز
echo $YOUTUBE_COOKIES

# خفض حدود الطلبات
RATE_LIMIT_PER_MINUTE=3
```

#### Lavalink لا يعمل
```bash
# تحقق من حالة Lavalink
curl http://localhost:2333/version

# إعادة تشغيل Lavalink
pkill -f Lavalink && java -jar Lavalink.jar
```

### سجلات التشخيص
```bash
# تفعيل السجلات المفصلة
DEBUG=true
VERBOSE_LOGGING=true

# عرض سجلات النظام
npm run logs
```

## 🔐 الأمان

### إعدادات الأمان
- **عدم مشاركة التوكن** أبداً
- **استخدام متغيرات البيئة** لجميع البيانات الحساسة
- **تحديث التبعيات** بانتظام
- **مراقبة السجلات** للأنشطة المشبوهة

### فحص الأمان
```bash
# فحص الثغرات
npm audit

# إصلاح الثغرات
npm audit fix
```

## 🤝 المساهمة

### كيفية المساهمة
1. Fork المشروع
2. إنشاء فرع جديد (`git checkout -b feature/amazing-feature`)
3. تطبيق التغييرات (`git commit -m 'Add amazing feature'`)
4. رفع الفرع (`git push origin feature/amazing-feature`)
5. إنشاء Pull Request

### معايير الكود
- استخدام ESLint للتنسيق
- كتابة تعليقات واضحة
- اختبار جميع المميزات الجديدة
- اتباع نمط الكود الموجود

## 📄 الترخيص

هذا المشروع مرخص تحت [GPL-3.0 License](LICENSE) - انظر ملف LICENSE للتفاصيل.

## 🙏 الشكر والتقدير

- [Discord.js](https://discord.js.org/) - مكتبة Discord
- [Lavalink](https://github.com/lavalink-devs/Lavalink) - تقنية تشغيل الصوت
- [Prisma](https://prisma.io/) - ORM قاعدة البيانات
- جميع المساهمين في المشروع

## 📞 الدعم

- **Discord**: [رابط الخادم](https://discord.gg/your-server)
- **GitHub Issues**: [رابط المشاكل](https://github.com/yourusername/lavamusic-enhanced/issues)
- **Documentation**: [رابط التوثيق](https://docs.your-site.com)

## 🚧 خطة التطوير

### المميزات القادمة
- [ ] دعم البث المباشر
- [ ] نظام DJ متقدم
- [ ] إنجازات المستخدمين
- [ ] لوحة تحكم ويب
- [ ] دعم المزيد من المصادر

### التحديثات الأخيرة
- ✅ نظام حماية 429 محسن
- ✅ دعم متعدد العقد
- ✅ واجهة مراقبة محسنة
- ✅ أوامر عربية كاملة

---

<div align="center">

**صنع بـ ❤️ للمجتمع العربي**

[![GitHub Stars](https://img.shields.io/github/stars/yourusername/lavamusic-enhanced.svg?style=social)](https://github.com/yourusername/lavamusic-enhanced/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/yourusername/lavamusic-enhanced.svg?style=social)](https://github.com/yourusername/lavamusic-enhanced/network/members)

</div>

# D# 🎵 Discord Arabic Music Bot

بوت Discord للموسيقى باللغة العربية مع دعم كامل للاستضافة المجانية على Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

## ✨ المميزات الجديدة v2.1.0

- 🌐 **محسن للاستضافة المجانية** على Render
- 🔄 **نظام Keep-Alive** لمنع النوم التلقائي
- 🎨 **واجهة محسنة** مع Embeds جميلة
- 🔍 **بحث ذكي** مع محاولات متعددة
- 📊 **معلومات تفصيلية** للبوت والخوادم
- ⚡ **استهلاك ذاكرة محسن** للخطط المجانية
- 🛡️ **معالجة أخطاء متقدمة**

## 🎮 الأوامر

### 🎶 تشغيل الموسيقى
- `ش [اسم الأغنية]` - البحث وتشغيل أغنية
- `شغل [اسم الأغنية]` - تشغيل أغنية  
- `play [song name]` - تشغيل أغنية

### ⏯️ التحكم
- `س` / `سكب` / `skip` - تخطي الأغنية
- `ق` / `stop` - إيقاف الموسيقى

### 📋 المعلومات  
- `قائمة` / `queue` / `q` - عرض قائمة التشغيل
- `معلومات` / `info` - معلومات البوت
- `مساعدة` / `help` - عرض الأوامر

## 🚀 النشر السريع على Render

### الطريقة السريعة (موصى بها)
1. **Fork هذا المشروع** على GitHub
2. **اذهب إلى [Render](https://render.com)**
3. **ربط GitHub** وأختر المشروع
4. **إعداد Environment Variables:**
   ```
   BOT_TOKEN = توكن البوت الخاص بك
   NODE_ENV = production
   PORT = 3000
   ```
5. **اضغط Deploy** وانتظر!

### التفاصيل الكاملة

#### 1. إعداد البوت في Discord
```
1. اذهب إلى Discord Developer Portal
2. أنشئ New Application
3. اذهب إلى Bot → Reset Token
4. انسخ التوكن (احتفظ به سرياً!)
5. فعل MESSAGE CONTENT INTENT
6. أنشئ رابط دعوة مع هذه الصلاحيات:
   ✅ Send Messages
   ✅ Embed Links  
   ✅ Read Message History
   ✅ Connect (Voice)
   ✅ Speak (Voice)
   ✅ Use Voice Activity
```

#### 2. إعداد Render
```
Service Type: Web Service
Name: discord-music-bot
Environment: Node
Build Command: npm install  
Start Command: npm start
Plan: Free ($0/month)
```

#### 3. Environment Variables في Render
| Key | Value | ملاحظات |
|-----|--------|---------|
| `BOT_TOKEN` | `توكن البوت` | **مطلوب** |
| `NODE_ENV` | `production` | للتحسين |
| `PORT` | `3000` | تلقائي |
| `TEXT_CHANNEL_ID` | `معرف القناة` | اختياري |

#### 4. النشر
- اضغط **"Create Web Service"**
- انتظر اكتمال البناء (2-5 دقائق)
- ستحصل على رابط مثل: `https://your-bot.onrender.com`

## 🔧 التشغيل المحلي

```bash
# 1. استنساخ المشروع
git clone https://github.com/gfggaf2090-ctrl/afk-bot-24-7.git
cd afk-bot-24-7

# 2. تثبيت الحزم
npm install

# 3. إعداد التكوين
cp .env.example .env
# أو أنشئ config.json

# 4. تشغيل البوت
npm start
```

### config.json (للتطوير المحلي)
```json
[
  {
    "name": "MusicBot",
    "token": "توكن_البوت_هنا",
    "textChannel": null
  }
]
```

## 📊 مراقبة الأداء

### في Render Dashboard:
- **Logs** - مراقبة نشاط البوت
- **Metrics** - استهلاك المعالج والذاكرة
- **Events** - سجل النشر والأخطاء

### مؤشرات الأداء:
```javascript
// البوت يعرض تلقائياً:
✅ مدة التشغيل
📊 استهلاك الذاكرة  
🌐 عدد الخوادم
👥 عدد المستخدمين
📶 زمن الاستجابة
```

## 🔄 Keep-Alive للخطة المجانية

البوت يتضمن نظام تلقائي لمنع النوم:
- **Ping كل 25 دقيقة** للحفاظ على النشاط
- **HTTP Server** لاستقبال طلبات المراقبة
- **تنظيف تلقائي للذاكرة** كل ساعة

## 🚨 استكشاف الأخطاء

### مشاكل شائعة:

#### البوت غير متصل
```bash
# تحقق من:
1. التوكن صحيح في Environment Variables
2. البوت مدعو للخادم مع الصلاحيات المطلوبة
3. لا توجد أخطاء في Render Logs
```

#### لا يستجيب للأوامر  
```bash
# تحقق من:
1. البوت لديه صلاحية Read Messages
2. TEXT_CHANNEL_ID صحيح (إذا كان محدد)
3. الأوامر مكتوبة بالشكل الصحيح
```

#### مشاكل الصوت
```bash
# تحقق من:
1. البوت لديه صلاحيات Connect و Speak
2. أنت في روم صوتي
3. الروم الصوتي غير ممتلئ
```

#### خطأ "Application failed to respond"
```bash
# الحل:
- البوت يتضمن HTTP server تلقائياً
- تأكد من PORT=3000 في Environment Variables
```

## 💰 الخطط والحدود

### Free Plan (مجاني):
- ✅ 512MB RAM
- ✅ مشاركة CPU  
- ✅ 750 ساعة/شهر
- ⚠️ ينام بعد 15 دقيقة من عدم النشاط
- 🔄 Keep-alive مدمج للتغلب على هذا

### Starter Plan ($7/شهر):
- ✅ 1GB RAM
- ✅ معالج مخصص
- ✅ تشغيل 24/7 بدون نوم
- ✅ دعم فني أسرع

## 🛠️ التخصيص

### إضافة أوامر جديدة:
```javascript
// في دالة client.on("messageCreate")
else if (content === "أمر_جديد") {
  message.channel.send("رد الأمر الجديد");
}
```

### تغيير رسائل البوت:
```javascript
// ابحث عن النصوص في الكود واستبدلها
"🎵 بدأ التشغيل" → "🎶 النص الجديد"
```

### إضافة قنوات محددة:
```env
TEXT_CHANNEL_ID=123456789012345678
```

## 🔧 تحسينات الأداء

البوت محسن للاستضافة المجانية:
- **تقليل استهلاك الذاكرة**
- **تنظيف تلقائي للكاش**  
- **بحث محسن** مع أقل طلبات API
- **معالجة أخطاء ذكية**

## 🤝 المساهمة

نرحب بالمساهمات! يرجى:
1. Fork المشروع
2. أنشئ branch للميزة الجديدة
3. Commit التغييرات  
4. Push وأنشئ Pull Request

## 📄 الترخيص

هذا المشروع مرخص تحت [MIT License](LICENSE)

## 🆘 الدعم

- **Discord**: P@@l
- **Email**: support@example.com

## 🙏 شكر خاص

- **DisTube** - مكتبة الموسيقى الرائعة
- **Discord.js** - مكتبة Discord للـ Node.js  
- **Render** - الاستضافة المجانية الموثوقة
- **المجتمع العربي** - للدعم والتشجيع

---

## 📈 إحصائيات المشروع

![GitHub stars](https://img.shields.io/github/stars/gfggaf2090-ctrl/afk-bot-24-7)
![GitHub forks](https://img.shields.io/github/forks/gfggaf2090-ctrl/afk-bot-24-7)  
![GitHub issues](https://img.shields.io/github/issues/gfggaf2090-ctrl/afk-bot-24-7)
![GitHub license](https://img.shields.io/github/license/gfggaf2090-ctrl/afk-bot-24-7)

**⭐ أعجبك المشروع؟ لا تنسى إعطاؤه نجمة!**

---

**🎵 تم بناؤه بـ ❤️ للمجتمع العربي 🎵**

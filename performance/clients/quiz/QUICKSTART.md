# Быстрый старт Quiz Platform

## ✅ Что уже готово (клиентская часть)

Квиз полностью готов к работе:
- ✅ Meta Pixel (PageView + Lead)
- ✅ Яндекс.Метрика (счётчик + цель)
- ✅ UTM-парсинг
- ✅ Валидация формы
- ✅ Кнопки "Назад"
- ✅ OG-теги для соцсетей
- ✅ Payload с quiz_id и всеми данными

**Файл:** `seainside/1.html`

---

## 🚀 Запуск за 3 шага (25 минут)

### Шаг 1: Google Sheets (15 мин)

1. [Создать Google Sheets](https://sheets.google.com) → назвать `Quiz Leads`
2. Первая строка (заголовки):
   ```
   timestamp | quiz_id | name | phone | q1_goal | q2_timeline | utm_source | utm_medium | utm_campaign | utm_content | utm_term | quiz_url
   ```
3. **Расширения** → **Apps Script**
4. Вставить код из `infrastructure/sheets/apps-script.js`
5. **Deploy** → **New deployment** → **Web app**:
   - Execute as: **Me**
   - Access: **Anyone**
6. **Скопировать URL** (понадобится в Шаге 2)

### Шаг 2: Cloudflare Worker (10 мин)

1. [Зарегистрироваться на Cloudflare](https://dash.cloudflare.com/sign-up)
2. **Workers & Pages** → **Create Worker** → назвать `quiz-proxy`
3. **Deploy** → **Edit code**
4. Вставить код из `infrastructure/worker/worker.js`
5. Заменить в коде:
   ```javascript
   sheets: {
     url: 'ВСТАВИТЬ_URL_ИЗ_ШАГА_1', // ← URL Google Sheets Web App
   },
   ```
6. **Save and Deploy**
7. **Скопировать URL Worker** (понадобится в Шаге 3)

### Шаг 3: Подключить к квизу (2 мин)

Открыть `seainside/1.html`, найти:

```javascript
const CONFIG = {
  quizId: 'seainside-1',
  // ...
  proxyUrl: 'https://YOUR_PROXY_URL', // ← ВСТАВИТЬ URL ИЗ ШАГА 2
};
```

Найти `submitForm()` и **раскомментировать** блок fetch:

```javascript
// Было:
// fetch(CONFIG.proxyUrl, {

// Стало:
fetch(CONFIG.proxyUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
}).then(response => {
  if (response.ok) {
    document.getElementById('progress-section').style.display = 'none';
    goToStep('success');
  } else {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
    alert('Произошла ошибка, попробуйте ещё раз');
  }
}).catch(() => {
  submitBtn.textContent = originalText;
  submitBtn.disabled = false;
  alert('Произошла ошибка, попробуйте ещё раз');
});

// Удалить временные строки:
// document.getElementById('progress-section').style.display = 'none';
// goToStep('success');
```

---

## 🧪 Тест

1. Открыть `seainside/1.html` в браузере
2. Пройти квиз
3. Заполнить форму
4. Нажать "Получить подборку"

### Проверить:

- ✅ **Google Sheets** → появилась новая строка
- ✅ **Albato** → новый лид в истории webhook
- ✅ **Meta Events Manager** → событие Lead (browser + server)
- ✅ **Яндекс.Метрика** → цель Leads_quiz

---

## 📁 Структура проекта

```
quiz/
├── seainside/
│   └── 1.html                    ← Готовый квиз
├── infrastructure/
│   ├── sheets/
│   │   └── apps-script.js        ← Google Apps Script
│   ├── worker/
│   │   └── worker.js             ← Cloudflare Worker
│   └── README.md                 ← Подробная инструкция
└── QUICKSTART.md                 ← Этот файл
```

---

## 🔧 Настройки (TODO перед продакшеном)

В `seainside/1.html`:

1. **OG-теги** (строки 10-20):
   ```html
   <meta property="og:url" content="https://ваш-домен.com/quiz">
   <meta property="og:image" content="https://ваш-домен.com/preview.jpg">
   ```

2. **Title** (строка 6):
   ```html
   <title>Название квиза для SEO</title>
   ```

---

## 🎯 Создание нового квиза

1. Скопировать папку:
   ```bash
   cp -r seainside/ naiton/
   ```

2. Изменить **только** quiz_id:
   ```javascript
   quizId: 'naiton-1'  // было: 'seainside-1'
   ```

3. Всё! Worker, Sheets, Albato остаются те же.

4. Настроить маршрутизацию в Albato по quiz_id:
   ```
   Если quiz_id = "seainside-1" → CRM Клиента А
   Если quiz_id = "naiton-1" → CRM Клиента Б
   ```

---

## 📊 Где смотреть лиды

### Google Sheets
Все лиды в одной таблице. Фильтр по `quiz_id`:
- `seainside-1` → клиент Seainside
- `naiton-1` → клиент Naiton

### Albato
История webhook → все лиды со всех квизов.
Маршрутизация по `quiz_id` в правилах.

### Cloudflare Worker Logs
Dashboard → Workers → quiz-proxy → Logs
Видно успех/ошибку каждой отправки.

---

## ❓ Частые вопросы

**Q: Можно ли использовать без Worker?**
A: Да, но небезопасно (webhook URL в коде). Для теста можно, для продакшена — нет.

**Q: Сколько это стоит?**
A: **Бесплатно** до 100,000 лидов/день (лимиты Cloudflare Workers).

**Q: Как добавить новый квиз?**
A: Скопировать файл, поменять quiz_id. Worker/Sheets остаются те же.

**Q: Куда идут UTM-метки?**
A: Во все три места: Albato, Google Sheets, Meta CAPI.

**Q: Что если Albato упадёт?**
A: Лиды сохранятся в Google Sheets (резерв). Не потеряются.

---

## 📞 Поддержка

Подробная документация: `infrastructure/README.md`

Troubleshooting: `infrastructure/README.md` → раздел "Troubleshooting"

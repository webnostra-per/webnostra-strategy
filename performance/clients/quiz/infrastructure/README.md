# Quiz Platform Infrastructure

Серверная инфраструктура для безопасной обработки и сохранения лидов.

## Архитектура

```
Квиз (браузер) → Cloudflare Worker → 3 параллельных отправки:
                                    ├─→ Albato (CRM)
                                    ├─→ Google Sheets (резерв)
                                    └─→ Meta CAPI (аналитика)
```

---

## Шаг 1: Настройка Google Sheets (15 минут)

### 1.1. Создать таблицу

1. Открыть [Google Sheets](https://sheets.google.com)
2. Создать новую таблицу
3. Назвать: `Quiz Leads - All`

### 1.2. Добавить заголовки

В первую строку вставить заголовки:

```
timestamp | quiz_id | name | phone | q1_goal | q2_timeline | utm_source | utm_medium | utm_campaign | utm_content | utm_term | quiz_url
```

### 1.3. Установить Apps Script

1. В таблице: **Расширения** → **Apps Script**
2. Удалить весь код по умолчанию
3. Скопировать код из `sheets/apps-script.js`
4. Вставить в редактор
5. Сохранить (Ctrl+S)

### 1.4. Deploy Web App

1. **Deploy** → **New deployment**
2. Тип: **Web app**
3. Настройки:
   - Execute as: **Me** (ваш email)
   - Who has access: **Anyone**
4. **Deploy**
5. **Authorize access** → выбрать аккаунт → разрешить доступ
6. **Скопировать Web App URL** (выглядит как `https://script.google.com/...`)

### 1.5. Тест

1. В Apps Script: **Run** → **test**
2. Проверить таблицу — должна появиться тестовая строка
3. Если появилась → всё работает! ✅

---

## Шаг 2: Деплой Cloudflare Worker (10 минут)

### 2.1. Регистрация

1. Зарегистрироваться на [cloudflare.com](https://dash.cloudflare.com/sign-up)
2. Перейти: **Workers & Pages**

### 2.2. Создать Worker

1. **Create Worker**
2. Имя: `quiz-proxy` (или любое другое)
3. **Deploy** (с кодом по умолчанию)

### 2.3. Заменить код

1. **Edit code**
2. Удалить весь код
3. Скопировать из `worker/worker.js`
4. Вставить в редактор

### 2.4. Настроить CONFIG

В коде Worker найти раздел `CONFIG` и заменить:

```javascript
const CONFIG = {
  albato: {
    url: 'https://h.albato.ru/wh/38/1lfbu2f/Gl8Ji635t32TgsHVJNYRYT1tmvQ1vVH6xVknsLcCzKc/',
    // ...
  },

  sheets: {
    url: 'ВСТАВИТЬ_URL_ИЗ_ШАГА_1.4', // ← вставить URL Google Sheets Web App
    // ...
  },

  meta: {
    pixelId: '1399100830794020',
    accessToken: 'EAAN8iGHohbABOZCpcyaXHY8vY13BFuYxKxRZBFpPzoh42ZBWw4piYKNitiDQxV7H2ZBZAHpLv9DBuYdZBHH3L35doSXhrfxvkJlAhrwHWu2YcWHBvy76vpOEXl81gnZAI4Q9OXzDbTQh8yZBZBJbDj5LAsivCkDhbZC5DrOe2Tbitbc7cNeJekf5CNafH5603s9vXm8wZDZD',
    // ...
  },

  allowedOrigins: [
    'https://ваш-домен.com', // ← вставить реальный домен квиза
    'http://localhost'
  ]
};
```

### 2.5. Deploy

1. **Save and Deploy**
2. **Скопировать Worker URL** (выглядит как `https://quiz-proxy.ваш-аккаунт.workers.dev`)

---

## Шаг 3: Подключить Worker к квизу

Открыть файл квиза `seainside/1.html` и заменить:

```javascript
const CONFIG = {
  quizId: 'seainside-1',
  pixelId: '1399100830794020',
  metrikaId: 96858541,
  metrikaGoal: 'Leads_quiz',

  proxyUrl: 'ВСТАВИТЬ_URL_ИЗ_ШАГА_2.5', // ← вставить URL Worker
};
```

В функции `submitForm` раскомментировать блок отправки:

```javascript
// Было:
// fetch(CONFIG.proxyUrl, {
//   method: 'POST',
//   ...
// })

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
```

---

## Тестирование

### Тест 1: Отправка тестового лида

1. Открыть квиз в браузере
2. Пройти все шаги
3. Заполнить форму (имя + телефон)
4. Нажать "Получить подборку"

### Проверка результатов:

**✅ Google Sheets:**
- Открыть таблицу
- Должна появиться новая строка с данными

**✅ Cloudflare Worker:**
- Dashboard → Workers → quiz-proxy → Logs
- Должны быть записи: `Albato: success`, `Sheets: success`, `Meta CAPI: success`

**✅ Albato:**
- Открыть Albato
- Проверить историю webhook
- Должен появиться новый лид

**✅ Meta Events Manager:**
- [Facebook Events Manager](https://business.facebook.com/events_manager)
- Pixel: 1399100830794020
- Event: Lead
- Должно быть 2 события (browser + server) с одинаковым event_id → дедупликация работает

**✅ Яндекс.Метрика:**
- [Метрика счётчик 96858541](https://metrika.yandex.ru/dashboard?id=96858541)
- Цели → Leads_quiz
- Должна быть конверсия

---

## Безопасность

### ✅ Что защищено:

- **Webhook URL Albato** — только в Worker, не светится в коде квиза
- **Google Sheets URL** — только в Worker
- **Meta Access Token** — только в Worker
- **CORS** — Worker принимает запросы только с разрешённых доменов

### ⚠️ Что НЕ защищено:

- **Meta Pixel ID** — виден в коде (это нормально, он публичный)
- **Яндекс.Метрика ID** — виден в коде (это нормально)

---

## Масштабирование на новые квизы

### Создание нового квиза:

1. Скопировать `seainside/1.html` → `новая-папка/1.html`
2. Изменить только `quizId`:
   ```javascript
   quizId: 'новый-квиз-1'
   ```
3. Всё! Worker, Sheets, Albato остаются те же.

### Маршрутизация в Albato:

Настроить фильтры в Albato по `quiz_id`:

```
Если quiz_id = "seainside-1" → CRM Клиента А
Если quiz_id = "naiton-1" → CRM Клиента Б
Если quiz_id = "bali-1" → CRM Клиента В
```

---

## Troubleshooting

### Лиды не приходят в Sheets

1. Проверить: Apps Script → Deploy → Web App URL скопирован правильно
2. Проверить: Apps Script → Execute as = **Me**
3. Проверить: Apps Script → Who has access = **Anyone**
4. Cloudflare Worker Logs → должна быть ошибка с деталями

### Лиды не приходят в Albato

1. Проверить: Worker CONFIG → albato.url правильный
2. Cloudflare Worker Logs → ошибка `Albato returned XXX`
3. Проверить в Albato: History → должны быть входящие запросы

### Meta CAPI не работает

1. Проверить: Worker CONFIG → meta.accessToken актуальный (токены истекают)
2. Проверить: Pixel ID правильный
3. Events Manager → должны быть ошибки если что-то не так

---

## Мониторинг

### Cloudflare Worker Dashboard

- **Requests** — количество запросов
- **Success rate** — процент успешных
- **Logs** — подробные логи каждой отправки

### Google Sheets

- Каждый лид = новая строка
- Можно делать фильтры по `quiz_id`, `utm_source`
- Экспорт в CSV для анализа

---

## Стоимость

- **Google Sheets** — бесплатно (до 10 млн ячеек)
- **Google Apps Script** — бесплатно (до 20,000 вызовов/день)
- **Cloudflare Workers** — бесплатно (до 100,000 запросов/день)

Для масштаба: 100,000 лидов/день = полностью бесплатно.

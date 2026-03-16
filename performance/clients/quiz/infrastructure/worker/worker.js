/**
 * Cloudflare Worker - Прокси для Quiz Platform
 *
 * Один Worker на все квизы. Отправляет данные в:
 * 1. Albato webhook (основной канал в CRM)
 * 2. Google Sheets (резервное хранилище)
 * 3. Meta Conversions API (серверная аналитика)
 *
 * Deploy:
 * 1. Зарегистрироваться на cloudflare.com
 * 2. Workers & Pages → Create Worker
 * 3. Вставить этот код
 * 4. Deploy
 * 5. Скопировать URL и вставить в CONFIG.proxyUrl квиза
 */

// ========== КОНФИГУРАЦИЯ ==========
const CONFIG = {
  // Albato webhook - ОДИН на все квизы
  albato: {
    url: 'https://h.albato.ru/wh/38/1lfbu2f/Gl8Ji635t32TgsHVJNYRYT1tmvQ1vVH6xVknsLcCzKc/',
    retries: 2,
    timeout: 10000
  },

  // Google Sheets Apps Script URL
  sheets: {
    url: 'https://script.google.com/macros/s/AKfycbzWhy-1EwIoL8lTHHYE7o4k4xAhfw6L-vQkjB4R33MrequYAZEsZqu2AqpJpyXOMqpbEg/exec',
    timeout: 10000
  },

  // Meta Conversions API
  meta: {
    pixelId: '1399100830794020',
    accessToken: 'EAAN8iGHohbABOZCpcyaXHY8vY13BFuYxKxRZBFpPzoh42ZBWw4piYKNitiDQxV7H2ZBZAHpLv9DBuYdZBHH3L35doSXhrfxvkJlAhrwHWu2YcWHBvy76vpOEXl81gnZAI4Q9OXzDbTQh8yZBZBJbDj5LAsivCkDhbZC5DrOe2Tbitbc7cNeJekf5CNafH5603s9vXm8wZDZD',
    timeout: 10000
  },

  // Разрешённые домены (для безопасности)
  allowedOrigins: [
    'https://yourdomain.com',
    'http://localhost',
    'file://' // для локальной разработки
  ]
};

// ========== CORS заголовки ==========
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ========== Главный обработчик ==========
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Только POST
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    // Парсим данные от квиза
    const payload = await request.json();

    // Валидация обязательных полей
    if (!payload.quiz_id || !payload.name || !payload.phone) {
      return jsonResponse({ error: 'Missing required fields' }, 400);
    }

    // Получаем IP клиента
    const clientIp = request.headers.get('CF-Connecting-IP') ||
                     request.headers.get('X-Real-IP') ||
                     'unknown';

    // Обогащаем данные
    const enrichedPayload = {
      ...payload,
      client_ip: clientIp
    };

    // Параллельно отправляем в три места
    const results = await Promise.allSettled([
      sendToAlbato(enrichedPayload),
      sendToGoogleSheets(enrichedPayload),
      sendToMetaCAPI(enrichedPayload)
    ]);

    // Считаем успехом, если хотя бы Sheets записал
    const sheetsOk = results[1].status === 'fulfilled';
    const albatoOk = results[0].status === 'fulfilled';

    console.log('Results:', {
      albato: results[0].status,
      sheets: results[1].status,
      meta: results[2].status,
      quiz_id: payload.quiz_id
    });

    if (sheetsOk || albatoOk) {
      return jsonResponse({
        status: 'ok',
        quiz_id: payload.quiz_id,
        saved_to: {
          albato: albatoOk,
          sheets: sheetsOk,
          meta: results[2].status === 'fulfilled'
        }
      });
    } else {
      throw new Error('All endpoints failed');
    }

  } catch (error) {
    console.error('Worker error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}

// ========== Отправка в Albato с retry ==========
async function sendToAlbato(payload, attempt = 0) {
  try {
    const response = await fetch(CONFIG.albato.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(CONFIG.albato.timeout)
    });

    if (!response.ok) {
      throw new Error(`Albato returned ${response.status}`);
    }

    console.log('Albato: success', payload.quiz_id);
    return { success: true, service: 'albato' };

  } catch (error) {
    console.error(`Albato: attempt ${attempt + 1} failed:`, error.message);

    // Retry если не последняя попытка
    if (attempt < CONFIG.albato.retries) {
      await sleep(2000); // ждём 2 секунды
      return sendToAlbato(payload, attempt + 1);
    }

    throw error;
  }
}

// ========== Отправка в Google Sheets ==========
async function sendToGoogleSheets(payload) {
  if (!CONFIG.sheets.url || CONFIG.sheets.url === 'YOUR_GOOGLE_SHEETS_WEB_APP_URL') {
    console.warn('Sheets: URL not configured, skipping');
    throw new Error('Sheets URL not configured');
  }

  try {
    const response = await fetch(CONFIG.sheets.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(CONFIG.sheets.timeout)
    });

    if (!response.ok) {
      throw new Error(`Sheets returned ${response.status}`);
    }

    console.log('Sheets: success', payload.quiz_id);
    return { success: true, service: 'sheets' };

  } catch (error) {
    console.error('Sheets error:', error.message);
    throw error;
  }
}

// ========== Отправка в Meta Conversions API ==========
async function sendToMetaCAPI(payload) {
  try {
    // SHA-256 хеш телефона
    const phoneHash = await sha256(payload.phone.replace(/\D/g, ''));

    const capiPayload = {
      data: [{
        event_name: 'Lead',
        event_time: Math.floor(new Date(payload.timestamp).getTime() / 1000),
        event_id: payload.event_id,
        event_source_url: payload.quiz_url,
        action_source: 'website',
        user_data: {
          client_ip_address: payload.client_ip,
          client_user_agent: payload.user_agent,
          ph: [phoneHash], // SHA-256 телефона
          fbc: payload.fbc || undefined,
          fbp: payload.fbp || undefined
        },
        custom_data: {
          content_name: payload.quiz_id,
          value: 0,
          currency: 'USD'
        }
      }]
    };

    const url = `https://graph.facebook.com/v21.0/${CONFIG.meta.pixelId}/events?access_token=${CONFIG.meta.accessToken}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(capiPayload),
      signal: AbortSignal.timeout(CONFIG.meta.timeout)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Meta CAPI returned ${response.status}: ${errorText}`);
    }

    console.log('Meta CAPI: success', payload.quiz_id);
    return { success: true, service: 'meta' };

  } catch (error) {
    console.error('Meta CAPI error:', error.message);
    throw error;
  }
}

// ========== Вспомогательные функции ==========

// SHA-256 хеш
async function sha256(str) {
  const buffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// JSON response с CORS
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

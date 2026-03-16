/**
 * Cloudflare Worker - Упрощённая версия
 * Только Albato + Google Sheets
 */

// ========== КОНФИГУРАЦИЯ ==========
const CONFIG = {
  // Albato webhook
  albato: {
    url: 'https://h.albato.ru/wh/38/1lfbu2f/Gl8Ji635t32TgsHVJNYRYT1tmvQ1vVH6xVknsLcCzKc/',
    retries: 2,
    timeout: 10000
  },

  // Google Sheets Apps Script URL
  sheets: {
    url: 'https://script.google.com/macros/s/AKfycbzWhy-1EwIoL8lTHHYE7o4k4xAhfw6L-vQkjB4R33MrequYAZEsZqu2AqpJpyXOMqpbEg/exec',
    timeout: 10000
  }
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

    // Параллельно отправляем в Albato и Sheets
    const results = await Promise.allSettled([
      sendToAlbato(enrichedPayload),
      sendToGoogleSheets(enrichedPayload)
    ]);

    // Считаем успехом, если хотя бы Sheets записал
    const sheetsOk = results[1].status === 'fulfilled';
    const albatoOk = results[0].status === 'fulfilled';

    console.log('Results:', {
      albato: results[0].status,
      sheets: results[1].status,
      quiz_id: payload.quiz_id
    });

    if (sheetsOk || albatoOk) {
      return jsonResponse({
        status: 'ok',
        quiz_id: payload.quiz_id,
        saved_to: {
          albato: albatoOk,
          sheets: sheetsOk
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

// ========== Вспомогательные функции ==========

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

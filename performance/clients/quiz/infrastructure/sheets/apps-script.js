/**
 * Google Apps Script для резервного хранилища лидов
 */

// Обработка GET запросов
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'Use POST method' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    // Получаем активный лист
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // Парсим данные из запроса
    const data = JSON.parse(e.postData.contents);

    // Добавляем строку с данными
    sheet.appendRow([
      data.timestamp || new Date().toISOString(),
      data.quiz_id || '',
      data.name || '',
      data.phone || '',
      data.q1_goal || '',
      data.q2_timeline || '',
      data.utm_source || '',
      data.utm_medium || '',
      data.utm_campaign || '',
      data.utm_content || '',
      data.utm_term || '',
      data.quiz_url || ''
    ]);

    // Логируем успешную запись
    Logger.log('Lead saved: ' + data.quiz_id + ' - ' + data.name);

    // Возвращаем успех с CORS заголовками
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', quiz_id: data.quiz_id }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    // Логируем ошибку
    Logger.log('Error: ' + error.toString());

    // Возвращаем ошибку
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Тестовая функция для проверки
 * Выполнить: Run → test
 */
function test() {
  const testData = {
    postData: {
      contents: JSON.stringify({
        quiz_id: 'test-1',
        name: 'Тестовый Лид',
        phone: '+79001234567',
        q1_goal: 'investment',
        q2_timeline: '1month',
        utm_source: 'test',
        utm_campaign: 'test-campaign',
        quiz_url: 'https://example.com/quiz',
        timestamp: new Date().toISOString()
      })
    }
  };

  const result = doPost(testData);
  Logger.log('Test result: ' + result.getContent());
}

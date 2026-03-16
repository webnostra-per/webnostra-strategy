function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok", message: "Use POST method" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);

    sheet.appendRow([
      data.timestamp || new Date().toISOString(),
      data.quiz_id || "",
      data.name || "",
      data.phone || "",
      data.q1_goal || "",
      data.q2_timeline || "",
      data.utm_source || "",
      data.utm_medium || "",
      data.utm_campaign || "",
      data.utm_content || "",
      data.utm_term || "",
      data.quiz_url || ""
    ]);

    Logger.log("Lead saved: " + data.quiz_id + " - " + data.name);

    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok", quiz_id: data.quiz_id }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log("Error: " + error.toString());

    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function test() {
  var testData = {
    postData: {
      contents: JSON.stringify({
        quiz_id: "test-1",
        name: "Test Lead",
        phone: "+79001234567",
        q1_goal: "investment",
        q2_timeline: "1month",
        utm_source: "test",
        utm_campaign: "test-campaign",
        quiz_url: "https://example.com/quiz",
        timestamp: new Date().toISOString()
      })
    }
  };

  var result = doPost(testData);
  Logger.log("Test result: " + result.getContent());
}

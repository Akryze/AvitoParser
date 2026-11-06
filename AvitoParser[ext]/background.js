chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fetchPage") {
        fetch(request.url, {
            headers: {
                "User-Agent": navigator.userAgent
            }
        })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.text();
        })
        .then(html => sendResponse({ success: true, html: html }))
        .catch(error => sendResponse({ success: false, error: error.message }));

        return true; // Указывает, что ответ будет асинхронным
    }
});
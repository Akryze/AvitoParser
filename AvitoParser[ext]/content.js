(function () {
    'use strict';

    // Создаем плашку интерфейса
    const panel = document.createElement('div');
    panel.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 999999;
        background: #222;
        color: #fff;
        padding: 15px;
        border-radius: 10px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.5);
        font-family: Arial, sans-serif;
        font-size: 13px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 220px;
    `;

    panel.innerHTML = `
        <div style="font-weight:bold; color:#04E061; margin-bottom:5px;">📊 Avito Manifest Parser</div>
        <button id="parse-current-btn" style="padding:6px; background:#04E061; border:none; border-radius:5px; cursor:pointer; font-weight:bold; color:#000;">Парсить эту страницу</button>
        <div style="display:flex; gap:5px; align-items:center;">
            <input type="number" id="page-count-input" value="3" min="1" max="20" style="width:50px; padding:5px; border-radius:4px; border:1px solid #555; background:#333; color:#fff;">
            <button id="parse-multi-btn" style="flex:1; padding:6px; background:#00AAFF; border:none; border-radius:5px; cursor:pointer; font-weight:bold; color:#fff;">Парсить N стр.</button>
        </div>
        <div id="parser-status" style="font-size:11px; color:#aaa;">Готов к работе</div>
    `;

    document.body.appendChild(panel);
    const statusEl = panel.querySelector('#parser-status');

    // Функция сбора карточек из готового DOM-документа
   function extractDataFromDoc(doc) {
    const items = doc.querySelectorAll('[data-marker="item"]');
    const results = [];

    items.forEach(card => {
        // Название и Ссылка
        const titleEl = card.querySelector('[data-marker="item-title"]') || card.querySelector('a[aria-label]');
        const title = titleEl ? titleEl.innerText.trim() : 'Без названия';
        const link = titleEl && titleEl.href ? titleEl.href : (card.querySelector('a')?.href || '');

        // Цена
        const priceEl = card.querySelector('[data-marker="item-price"]');
        const price = priceEl ? priceEl.innerText.replace(/\s+/g, ' ').trim() : 'Цена не указана';

        // Ищем описание: в режиме списка текст находится в теге <p> внутри карточки, 
        // у которого задано ограничение строк (например, стиль --module-max-lines-size или похожий класс)
        let description = '';
        const descEl = card.querySelector('p[style*="--module-max-lines-size"]') || card.querySelector('[class*="paragraph"]');
        if (descEl) {
            description = descEl.innerText.replace(/\s+/g, ' ').trim();
        }

        if (title && link) {
            results.push({ title, price, link, description });
        }
    });

    return results;
}

    // Скачивание файла JSON
    function downloadJSON(data, filename = 'avito_parsed.json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    // Генерация ссылки для нужной страницы
    function getPageUrl(pageNumber) {
        const url = new URL(window.location.href);
        url.searchParams.set('p', pageNumber);
        return url.toString();
    }

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    // Кнопка: Парсить текущую страницу
    panel.querySelector('#parse-current-btn').addEventListener('click', () => {
        statusEl.innerText = 'Парсинг текущей...';
        const data = extractDataFromDoc(document);
        statusEl.innerText = `Найдено: ${data.length} шт.`;
        downloadJSON(data, `avito_page_1.json`);
    });

    // Кнопка: Парсить несколько страниц через background script
    panel.querySelector('#parse-multi-btn').addEventListener('click', async () => {
        const pagesToParse = parseInt(panel.querySelector('#page-count-input').value) || 1;
        let allData = [];

        for (let i = 1; i <= pagesToParse; i++) {
            statusEl.innerText = `Загрузка стр. ${i} из ${pagesToParse}...`;
            const pageUrl = getPageUrl(i);

            try {
                // Отправляем запрос фоновому скрипту, чтобы он скачал HTML страницы
                const response = await new Promise((resolve) => {
                    chrome.runtime.sendMessage({ action: "fetchPage", url: pageUrl }, resolve);
                });

                if (!response || !response.success) {
                    throw new Error(response.error || 'Ошибка загрузки');
                }

                // Превращаем полученный текст в DOM
                const parser = new DOMParser();
                const doc = parser.parseFromString(response.html, 'text/html');

                const pageData = extractDataFromDoc(doc);
                allData = allData.concat(pageData);

                if (i < pagesToParse) {
                    const delay = Math.floor(Math.random() * 1000) + 1500;
                    statusEl.innerText = `Пауза ${Math.round(delay/1000)}с...`;
                    await sleep(delay);
                }
            } catch (err) {
                console.error(`Ошибка на странице ${i}:`, err);
                statusEl.innerText = `Ошибка на стр. ${i}`;
            }
        }

        statusEl.innerText = `Готово! Всего: ${allData.length}`;
        downloadJSON(allData, `avito_${pagesToParse}_pages.json`);
    });

})();
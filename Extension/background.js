chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'FETCH') {
    const { url, options } = request;
    fetch(url, { credentials: 'include', ...options })
      .then(async (response) => {
        const text = await response.text();
        sendResponse({
          status: response.status,
          statusText: response.statusText,
          responseText: text,
          headers: Object.fromEntries(response.headers.entries())
        });
      })
      .catch((error) => {
        console.error('Fetch error:', error, 'URL:', url);
        sendResponse({ error: error.message });
      });
    return true;
  }

  if (request.type === 'GET_COOKIES') {
    chrome.cookies.getAll({}, (cookies) => {
      sendResponse(cookies);
    });
    return true;
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'exportData') {
    const domain = message.domain;
    const tabId = message.tabId;

    chrome.cookies.getAll({}, (cookies) => {
      chrome.scripting.executeScript({
        target: {tabId: tabId},
        function: fillCookies,
        args: [cookies]
      });
    });
  }
});

// 监听标签页更新事件
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const active = tab.url.includes("vjudge.net") || tab.url.includes("vjudge.net.cn");
    chrome.action.setIcon({
      tabId: tabId,
      path: {
        "48": active ? "images/color_icon.png" : "images/gray_icon.png"
      }
    });
  }
});

function fillCookies(cookies) {
  document.querySelectorAll('table.vap tbody tr').forEach(row => {
    const domain = row.querySelector('td:nth-child(2)').textContent;
    const name = row.querySelector('td:nth-child(3)').textContent;
    const cookie = getCookie(cookies, domain, name);
    if (cookie) {
      row.querySelector('td:nth-child(4) input').value = cookie.value;
    }
  });

  function getCookie(cookies, domain, name) {
    for (const cookie of cookies) {
      if (cookie.name === name && cookie.domain.replace(/^\./, '') === domain.replace(/^\./, '')) {
        return cookie;
      }
    }
    return null;
  }
}
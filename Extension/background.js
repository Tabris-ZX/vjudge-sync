
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
				target: { tabId: tabId },
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
	try {
		const inputs = document.querySelectorAll('input[data-vjudge-helper-autofill="cookie"]');

		inputs.forEach(input => {
			const domain = input.getAttribute('data-vjudge-helper-cookie-domain');
			const name = input.getAttribute('data-vjudge-helper-cookie-name');
			const cookie = getCookie(cookies, domain, name);
			if (cookie) {
				input.value = cookie.value;
				input.dispatchEvent(new Event('input', { bubbles: true }));
			}else alert(`未找到 Cookie,请先在此浏览器登录一次`);
		});

		function getCookie(cookies, domain, name) {
			for (const cookie of cookies) {
				const cDomain = cookie.domain.replace(/^\./, '');
				const tDomain = domain.replace(/^\./, '');
				if (cookie.name === name && cDomain === tDomain) return cookie;
			}
			return null;
		}
		console.log('填充 Cookie 成功');
	} catch (error) {
		console.error('填充 Cookie 失败:', error);
	}
}
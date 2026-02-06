document.getElementById('vj-autofill-btn').addEventListener('click', () => {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    const tabId = tabs[0].id;         // 获取当前标签页ID
    const domain = new URL(tabs[0].url).hostname;  // 获取域名
    chrome.runtime.sendMessage({action: 'exportData', tabId: tabId, domain: domain});
  });
});

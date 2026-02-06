(async function () {
    'use strict';

    const logBox = document.getElementById('vj-sync-log');
    const syncBtn = document.getElementById('vj-sync-btn');
    const autofillBtn = document.getElementById('vj-autofill-btn');
    const pinBtn = document.getElementById('vj-pin-btn');

    /* ================= 1. UI 日志处理 ================= */
    function log(msg, type = 'info') {
        logBox.style.display = 'block';
        const icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : '🔹');
        logBox.innerHTML += `<div>${icon} ${msg}</div>`;
        logBox.scrollTop = logBox.scrollHeight;
    }

    /* ================= 1.1 固定窗口逻辑 ================= */
    // 检查是否已经是窗口模式
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'window') {
        pinBtn.style.display = 'none';
        document.body.style.width = '340px'; // 窗口模式下稍微宽一点
    }

    pinBtn.onclick = () => {
        const url = chrome.runtime.getURL('src/popup/popup.html?mode=window');
        chrome.windows.create({
            url: url,
            type: 'popup',
            width: 360,
            height: 600
        });
        window.close(); // 关闭当前的 popup 气泡
    };

    /* ================= 2. 获取 VJudge 用户名 ================= */
    async function getVJudgeTab() {
        // 尝试获取当前激活的 VJudge 标签页
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab?.url && (activeTab.url.includes('vjudge.net') || activeTab.url.includes('vjudge.net.cn'))) {
            return activeTab;
        }

        // 如果当前页不是 VJudge（例如在小窗模式下），则搜索所有窗口中的 VJudge 标签页
        const tabs = await chrome.tabs.query({ url: ["*://vjudge.net/*", "*://vjudge.net.cn/*"] });
        return tabs.length > 0 ? tabs[0] : null;
    }

    async function getVJudgeUsername() {
        const tab = await getVJudgeTab();
        if (!tab) return null;

        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                const urlMatch = location.pathname.match(/\/user\/([^\/]+)/);
                if (urlMatch) return urlMatch[1];
                const userLink = document.querySelector('a[href^="/user/"]');
                if (userLink) {
                    const match = userLink.getAttribute('href').match(/\/user\/([^\/]+)/);
                    if (match) return match[1];
                }
                return null;
            }
        });

        return results[0]?.result || null;
    }

    /* ================= 3. 状态恢复与保存 ================= */
    const ojs = ['vj-lg', 'vj-cf', 'vj-atc', 'vj-qoj', 'vj-nc', 'vj-uoj'];
    const storage = await chrome.storage.local.get(ojs.map(id => id + '_checked'));

    ojs.forEach(id => {
        const el = document.getElementById(id);
        if (storage[id + '_checked'] === true) {
            el.checked = true;
        }
        el.addEventListener('change', (e) => {
            chrome.storage.local.set({ [id + '_checked']: e.target.checked });
        });
    });

    /* ================= 4. 按钮事件 ================= */
    syncBtn.onclick = async function () {
        const username = await getVJudgeUsername();
        if (!username) {
            log('请在 VJudge 个人主页或设置页面使用此功能', 'error');
            return;
        }

        syncBtn.disabled = true;
        syncBtn.textContent = '正在同步中...';
        logBox.innerHTML = '';
        log('开始同步 VJudge 数据...', 'info');
        try{
            const success = await fetchVJudgeArchived(username, (msg) => log(msg, 'info'));
            if (!success) {
                log('获取 VJudge 归档失败', 'error');
                syncBtn.disabled = false;
                syncBtn.textContent = '一键同步 AC 记录';
                return;
            }

            // 顺序执行各个 OJ 的同步任务，避免并发过高导致卡顿或失败
            if (document.getElementById('vj-lg').checked) {
                const acc = await verifyAccount('洛谷', log);
                if (acc) await fetchLuogu(acc.match(/\/user\/(\d+)/)[1], log);
            }
            
            if (document.getElementById('vj-nc').checked) {
                const acc = await verifyAccount('牛客', log);
                if (acc) await fetchNowCoder(acc.match(/\/profile\/(\d+)/)[1], log);
            }

            if (document.getElementById('vj-cf').checked) {
                const acc = await verifyAccount('CodeForces', log);
                if (acc) await fetchCodeForces(acc.replace(/<[^>]*>/g, ''), log);
            }

            if (document.getElementById('vj-atc').checked) {
                const acc = await verifyAccount('AtCoder', log);
                if (acc) await fetchAtCoder(acc.replace(/<[^>]*>/g, ''), log);
            }

            if (document.getElementById('vj-qoj').checked) {
                const acc = await verifyAccount('QOJ', log);
                if (acc) await fetchQOJ(acc.replace(/<[^>]*>/g, ''), log);
            }

            if (document.getElementById('vj-uoj').checked) {
                const acc = await verifyAccount('UniversalOJ', log);
                if (acc) await fetchUOJ(acc.replace(/<[^>]*>/g, ''), log);
            }

            log('所有同步任务已完成！', 'success');
        } catch (err) {
            log(`同步发生错误: ${err.message}`, 'error');
        } finally {
            syncBtn.disabled = false;
            syncBtn.textContent = '一键同步 AC 记录';
        }
    };
})();

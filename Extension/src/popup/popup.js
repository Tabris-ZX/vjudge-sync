(async function () {
    'use strict';

    const logBox = document.getElementById('vj-sync-log');
    const syncBtn = document.getElementById('vj-sync-btn');
    const autofillBtn = document.getElementById('vj-autofill-btn');
    const pinBtn = document.getElementById('vj-pin-btn');
    const speedBtn = document.getElementById('vj-speed-btn');
    const speedPanel = document.getElementById('vj-speed-panel');
    const speedRange = document.getElementById('vj-speed-range');
    const speedValue = document.getElementById('vj-speed-value');
    const SYNC_DELAY_KEY = 'sync_delay_ms';
    const DEFAULT_SYNC_DELAY = 1000;
    const MIN_SYNC_DELAY = 500;
    const MAX_SYNC_DELAY = 5000;

    function normalizeSyncDelay(value) {
        const delay = Number(value);
        if (!Number.isFinite(delay)) return DEFAULT_SYNC_DELAY;
        return Math.min(MAX_SYNC_DELAY, Math.max(MIN_SYNC_DELAY, Math.round(delay / 100) * 100));
    }

    function updateSpeedView(value) {
        const delay = normalizeSyncDelay(value);
        speedRange.value = delay;
        speedValue.textContent = `${delay} ms/题`;
        if (typeof setSyncDelay === 'function') setSyncDelay(delay);
        return delay;
    }

    /* ================= 1. UI 日志处理 ================= */
    function log(msg, type = 'info') {
        logBox.style.display = 'block';
        const icon = type === 'success' ? '🎈' : (type === 'error' ? '❌' : '💬');
        logBox.innerHTML += `<div>${icon} ${msg}</div>`;
        logBox.scrollTop = logBox.scrollHeight;
    }

    /* ================= 1.1 固定窗口逻辑 ================= */
    // 检查是否已经是窗口模式
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'window') {
        pinBtn.style.display = 'none';
        document.body.style.width = '300px'; // 窗口模式下稍微宽一点
    }

    pinBtn.onclick = () => {
        const url = chrome.runtime.getURL('src/popup/popup.html?mode=window');
        chrome.windows.create({
            url: url,
            type: 'popup',
            width: 330,
            height: 580
        });
        window.close(); // 关闭当前的 popup 气泡
    };

    /* ================= 2. 获取 VJudge 用户名 ================= */
    async function getVJudgeTab() {
        // 1. 查当前窗口激活的
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab?.url?.match(/vjudge\.net/)) return activeTab;

        const tabs = await chrome.tabs.query({ url: ["*://vjudge.net/*", "*://vjudge.net.cn/*"] });
        return tabs[0] || null;
    }

    async function getVJudgeUsername() {
        const tab = await getVJudgeTab();
        if (!tab) return null;

        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                const userElement = document.getElementById('userNameDropdown');
                if (userElement) return userElement.innerText.trim();
                if (urlMatch) return urlMatch[1];
                return null;
            }
        });
        return results[0]?.result || null;
    }

    /* ================= 3. 状态恢复与保存 ================= */

    const ojs = ['vj-lg', 'vj-cf', 'vj-atc', 'vj-qoj', 'vj-nc', 'vj-uoj'];
    const storage = await chrome.storage.local.get([...ojs.map(id => id + '_checked'), SYNC_DELAY_KEY]);

    ojs.forEach(id => {
        const el = document.getElementById(id);
        if (storage[id + '_checked'] === true) {
            el.checked = true;
        }
        el.addEventListener('change', (e) => {
            chrome.storage.local.set({ [id + '_checked']: e.target.checked });
        });
    });

    updateSpeedView(storage[SYNC_DELAY_KEY]);

    speedBtn.onclick = () => {
        speedPanel.classList.toggle('speed-panel-hidden');
        speedBtn.textContent = speedPanel.classList.contains('speed-panel-hidden') ? '调节同步速率' : '收起速率设置';
    };

    speedRange.addEventListener('input', async (e) => {
        const delay = updateSpeedView(e.target.value);
        await chrome.storage.local.set({ [SYNC_DELAY_KEY]: delay });
    });

    /* ================= 按钮事件 ================= */

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
        log(`当前提交间隔: ${getSyncDelay()} ms/题`, 'info');
        try {
            const success = await fetchVJudgeArchived(username, (msg) => log(msg, 'info'));
            if (!success) {
                log('获取 VJudge 归档失败', 'error');
                syncBtn.disabled = false;
                syncBtn.textContent = '一键同步 AC 记录';
                return;
            }

            // 顺序执行各个 OJ 的同步任务，避免并发过高导致卡顿或失败
            if (document.getElementById('vj-lg').checked) {
                const acc = await checkAccount('洛谷', log);
                if (acc) await fetchLuogu(acc, log);
            }

            if (document.getElementById('vj-nc').checked) {
                const acc = await checkAccount('牛客', log);
                if (acc) await fetchNowCoder(acc, log);
            }

            if (document.getElementById('vj-cf').checked) {
                const acc = await checkAccount('CodeForces', log);
                if (acc) await fetchCodeForces(acc, log);
            }

            if (document.getElementById('vj-atc').checked) {
                const acc = await checkAccount('AtCoder', log);
                if (acc) await fetchAtCoder(acc, log);
            }

            if (document.getElementById('vj-qoj').checked) {
                const acc = await checkAccount('QOJ', log);
                if (acc) await fetchQOJ(acc, log);
            }

            if (document.getElementById('vj-uoj').checked) {
                const acc = await checkAccount('UniversalOJ', log);
                if (acc) await fetchUOJ(acc, log);
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

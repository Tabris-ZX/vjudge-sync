// ==UserScript==
// @name         VJudge-Sync
// @namespace    https://github.com/Tabris-ZX/vjudge-sync
// @version      2.3.1
// @description  VJudge 一键同步归档已绑定的 OJ 过题记录，并支持同步速率调节
// @author       Tabris_ZX
// @match        https://vjudge.net/*
// @match        https://vjudge.net.cn/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      vjudge.net
// @connect      vjudge.net.cn
// @connect      luogu.com.cn
// @connect      nowcoder.com
// @connect      codeforces.com
// @connect      kenkoooo.com
// @connect      qoj.ac
// @connect      uoj.ac
// @license      AGPL-3.0
// @downloadURL https://update.greasyfork.org/scripts/559149/VJudge-Sync.user.js
// @updateURL https://update.greasyfork.org/scripts/559149/VJudge-Sync.meta.js
// ==/UserScript==

(function () {
    'use strict';

    if (!/vjudge\.net(\.cn)?$/.test(location.hostname)) return;

    const DEFAULT_SYNC_DELAY = 1000;
    const MIN_SYNC_DELAY = 500;
    const MAX_SYNC_DELAY = 5000;
    const SYNC_DELAY_KEY = 'sync_delay_ms';
    const PANEL_POS_KEY = 'vj_panel_pos';
    const PANEL_COLLAPSED_KEY = 'vj_panel_collapsed';
    const OJ_IDS = ['vj-lg', 'vj-cf', 'vj-atc', 'vj-qoj', 'vj-nc', 'vj-uoj'];

    let vjArchived = {};
    let syncDelay = DEFAULT_SYNC_DELAY;
    const syncBody = {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'method=2&language=&open=0&source='
    };

    GM_addStyle(`
#vj-sync-panel {
    position: fixed;
    top: 100px;
    right: 20px;
    width: 300px;
    background: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #1f2937;
    overflow: hidden;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    z-index: 99999;
}

#vj-sync-header {
    padding: 12px 16px;
    background: #fdfdfd;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: move;
    user-select: none;
}

.vj-header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    font-size: 15px;
    color: #2565dc;
}

.vj-header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}

.vj-icon-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    font-size: 14px;
    border-radius: 4px;
    transition: background 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
}

.vj-icon-btn:hover {
    background: #f3f4f6;
}

.vj-version {
    font-size: 10px;
    color: #6b7280;
    background: #f3f4f6;
    padding: 2px 6px;
    border-radius: 10px;
}

#vj-sync-body {
    padding: 16px;
}

.vj-hidden {
    display: none !important;
}

.vj-tip-section {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 10px;
    background: #eff6ff;
    border-radius: 8px;
    margin-bottom: 16px;
    font-size: 12px;
    color: #1e40af;
    line-height: 1.4;
}

.vj-oj-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
    margin-bottom: 20px;
}

.vj-oj-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
}

.vj-oj-item:hover {
    background: #f3f4f6;
    border-color: #d1d5db;
}

.vj-oj-item input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: #2565dc;
}

.vj-oj-name {
    font-size: 13px;
    font-weight: 500;
}

.vj-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.vj-btn {
    width: 100%;
    padding: 10px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    transition: all 0.2s;
    text-align: center;
}

.vj-btn:hover {
    transform: translateY(-1px);
}

.vj-btn:active {
    transform: translateY(0);
}

.vj-btn:disabled {
    background: #9ca3af !important;
    color: white !important;
    cursor: not-allowed;
    transform: none;
}

#vj-sync-btn {
    background: #2565dc;
    color: white;
}

#vj-speed-btn {
    background: #f3f4f6;
    color: #1f2937;
    border: 1px solid #e5e7eb;
}

#vj-speed-panel {
    margin-top: 12px;
    padding: 12px;
    background: #f8fafc;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
}

.vj-speed-panel-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 10px;
}

#vj-speed-range {
    width: 100%;
    accent-color: #2565dc;
}

#vj-sync-log {
    margin-top: 16px;
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 11px;
    line-height: 1.5;
    max-height: 150px;
    overflow-y: auto;
    background: #f8fafc;
    padding: 10px;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    display: none;
    word-break: break-all;
}

#vj-sync-log div {
    margin-bottom: 4px;
}

#vj-sync-log::-webkit-scrollbar {
    width: 5px;
}

#vj-sync-log::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 10px;
}
`);

    const panel = document.createElement('div');
    panel.id = 'vj-sync-panel';
    panel.innerHTML = `
<div id="vj-sync-header">
    <div class="vj-header-title">
        <span>VJのAC自动机</span>
    </div>
    <div class="vj-header-actions">
        <div class="vj-version">v2.3.1</div>
        <button id="vj-toggle-btn" title="收起/展开" class="vj-icon-btn">−</button>
    </div>
</div>
<div id="vj-sync-body">
    <div class="vj-tip-section">
        <div>💬💡🎈同步前请确保已绑定相应OJ账号哦~</div>
    </div>

    <div class="vj-oj-grid">
        <label class="vj-oj-item">
            <input type="checkbox" id="vj-lg" />
            <span class="vj-oj-name">洛谷</span>
        </label>
        <label class="vj-oj-item">
            <input type="checkbox" id="vj-nc" />
            <span class="vj-oj-name">牛客</span>
        </label>
        <label class="vj-oj-item">
            <input type="checkbox" id="vj-cf" />
            <span class="vj-oj-name">CodeForces</span>
        </label>
        <label class="vj-oj-item">
            <input type="checkbox" id="vj-atc" />
            <span class="vj-oj-name">AtCoder</span>
        </label>
        <label class="vj-oj-item">
            <input type="checkbox" id="vj-qoj" />
            <span class="vj-oj-name">QOJ</span>
        </label>
        <label class="vj-oj-item">
            <input type="checkbox" id="vj-uoj" />
            <span class="vj-oj-name">UniversalOJ</span>
        </label>
    </div>

    <div class="vj-actions">
        <button id="vj-sync-btn" class="vj-btn">一键同步 AC 记录</button>
        <button id="vj-speed-btn" class="vj-btn" type="button">调节同步速率</button>
    </div>

    <div id="vj-speed-panel" class="vj-hidden">
        <div class="vj-speed-panel-title">
            <span>提交间隔</span>
            <span id="vj-speed-value">1000 ms/题</span>
        </div>
        <input type="range" id="vj-speed-range" min="500" max="5000" step="100" value="1000" />
    </div>

    <div id="vj-sync-log"></div>
</div>`;
    document.body.appendChild(panel);

    const header = document.getElementById('vj-sync-header');
    const toggleBtn = document.getElementById('vj-toggle-btn');
    const content = document.getElementById('vj-sync-body');
    const logBox = document.getElementById('vj-sync-log');
    const syncBtn = document.getElementById('vj-sync-btn');
    const speedBtn = document.getElementById('vj-speed-btn');
    const speedPanel = document.getElementById('vj-speed-panel');
    const speedRange = document.getElementById('vj-speed-range');
    const speedValue = document.getElementById('vj-speed-value');

    function normalizeSyncDelay(value) {
        const delay = Number(value);
        if (!Number.isFinite(delay)) return DEFAULT_SYNC_DELAY;
        return Math.min(MAX_SYNC_DELAY, Math.max(MIN_SYNC_DELAY, Math.round(delay / 100) * 100));
    }

    function setSyncDelay(value) {
        syncDelay = normalizeSyncDelay(value);
        return syncDelay;
    }

    function getSyncDelay() {
        return syncDelay;
    }

    function updateSpeedView(value) {
        const delay = setSyncDelay(value);
        speedRange.value = delay;
        speedValue.textContent = `${delay} ms/题`;
        return delay;
    }

    function log(msg, type = 'info') {
        logBox.style.display = 'block';
        const icon = type === 'success' ? '🎈' : (type === 'error' ? '❌' : '💬');
        logBox.innerHTML += `<div>${icon} ${msg}</div>`;
        logBox.scrollTop = logBox.scrollHeight;
    }

    function getVJudgeUsername() {
        const userElement = document.getElementById('userNameDropdown');
        if (userElement?.innerText?.trim()) return userElement.innerText.trim();

        const urlMatch = location.pathname.match(/\/user\/([^/]+)/);
        if (urlMatch) return urlMatch[1];

        const userLink = document.querySelector('a[href^="/user/"]');
        if (userLink) {
            const match = userLink.getAttribute('href')?.match(/\/user\/([^/]+)/);
            if (match) return match[1];
        }
        return null;
    }

    function restorePanelState() {
        const savedPos = JSON.parse(localStorage.getItem(PANEL_POS_KEY) || '{"top":"100px","right":"20px"}');
        if (parseInt(savedPos.top, 10) > window.innerHeight - 50) savedPos.top = '100px';
        panel.style.top = savedPos.top || '100px';
        panel.style.left = savedPos.left || 'auto';
        panel.style.right = savedPos.left ? 'auto' : (savedPos.right || '20px');

        const isCollapsed = localStorage.getItem(PANEL_COLLAPSED_KEY) === 'true';
        if (isCollapsed) {
            content.classList.add('vj-hidden');
            toggleBtn.textContent = '+';
        }

        OJ_IDS.forEach(id => {
            const saved = localStorage.getItem(`${id}_checked`);
            if (saved === 'true') {
                const el = document.getElementById(id);
                if (el) el.checked = true;
            }
        });

        updateSpeedView(localStorage.getItem(SYNC_DELAY_KEY));
    }

    restorePanelState();

    OJ_IDS.forEach(id => {
        document.getElementById(id).addEventListener('change', (e) => {
            localStorage.setItem(`${id}_checked`, String(e.target.checked));
        });
    });

    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const willCollapse = !content.classList.contains('vj-hidden');
        content.classList.toggle('vj-hidden', willCollapse);
        toggleBtn.textContent = willCollapse ? '+' : '−';
        localStorage.setItem(PANEL_COLLAPSED_KEY, String(willCollapse));
    });

    speedBtn.addEventListener('click', () => {
        const willHide = !speedPanel.classList.contains('vj-hidden');
        speedPanel.classList.toggle('vj-hidden', willHide);
        speedBtn.textContent = willHide ? '调节同步速率' : '收起速率设置';
    });

    speedRange.addEventListener('input', (e) => {
        const delay = updateSpeedView(e.target.value);
        localStorage.setItem(SYNC_DELAY_KEY, String(delay));
    });

    let isDragging = false;
    let dragStart = { x: 0, y: 0 };
    let panelStart = { x: 0, y: 0 };

    header.addEventListener('mousedown', (e) => {
        if (e.target === toggleBtn) return;
        isDragging = true;
        dragStart = { x: e.clientX, y: e.clientY };
        const rect = panel.getBoundingClientRect();
        panelStart = { x: rect.left, y: rect.top };
        header.style.cursor = 'grabbing';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        panel.style.left = panelStart.x + dx + 'px';
        panel.style.top = panelStart.y + dy + 'px';
        panel.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        header.style.cursor = 'move';
        localStorage.setItem(PANEL_POS_KEY, JSON.stringify({
            left: panel.style.left,
            top: panel.style.top,
            right: panel.style.right
        }));
    });

    async function Fetch(url, options = {}) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: options.method || 'GET',
                url,
                headers: options.headers || {},
                data: options.body,
                anonymous: options.credentials === 'omit',
                onload: (response) => resolve({
                    status: response.status,
                    statusText: response.statusText,
                    responseText: response.responseText,
                    headers: response.responseHeaders
                }),
                onerror: (error) => reject(new Error(error?.error || '请求失败'))
            });
        });
    }

    async function fetchVJudgeArchived(username) {
        if (!username) {
            log('VJudge 未登录', 'error');
            return false;
        }
        try {
            const res = await Fetch(`https://vjudge.net/user/solveDetail/${username}`);
            const json = JSON.parse(res.responseText);
            vjArchived = json.acRecords || {};
            let total = 0;
            for (const k in vjArchived) total += vjArchived[k].length;
            log(`VJudge 已同步 ${total} 题`);
            return true;
        } catch (err) {
            log('获取 VJ 记录失败', 'error');
            return false;
        }
    }

    async function checkAccount(oj) {
        log(`💡正在检查${oj}账号信息...`);
        try {
            const verifyRes = await Fetch(`https://vjudge.net/user/remoteAccounts/list?oj=${encodeURIComponent(oj)}`);
            const verifyData = JSON.parse(verifyRes.responseText);
            if (!verifyData?.groups || !verifyData.groups[oj] || Object.keys(verifyData.groups).length < 1) return null;
            const binding = verifyData.groups[oj].defaultBinding;
            if (!binding?.id) return null;

            const check = await Fetch('https://vjudge.net/user/remoteAccounts/check', {
                method: 'POST',
                body: JSON.stringify({ bindingId: binding.id }),
                headers: { 'Content-Type': 'application/json' }
            });
            const checkData = JSON.parse(check.responseText);
            return checkData.success ? binding.accountId : null;
        } catch (err) {
            log(`❌ ${oj} 账号为空或cookie已失效`);
            return null;
        }
    }

    async function submitVJ(oj, pids) {
        const archivedSet = new Set(vjArchived[oj] || []);
        const toSubmit = pids.filter(pid => !archivedSet.has(pid));
        log(`${oj}:共AC ${pids.length} 题, 发现${toSubmit.length}未同步AC`);
        if (toSubmit.length === 0) {
            log(`🎈${oj}: 所有题目已同步`, 'success');
            return;
        }

        let successCount = 0;
        for (let i = 0; i < toSubmit.length; ++i) {
            const problem = toSubmit[i];
            const pid = `${oj}-${problem}`;

            if (i > 0) await new Promise(resolve => setTimeout(resolve, syncDelay));
            try {
                const resp = await Fetch(`https://vjudge.net/problem/submit/${pid}`, syncBody);
                const result = JSON.parse(resp.responseText);
                if (result?.runId) {
                    log(`🎈 ${oj} ${problem} success`, 'success');
                    successCount++;
                } else if (result?.error?.i18nKey?.includes('not_found')) {
                    log(`${oj} ${problem} 不存在, 尝试抓取并等待6秒重试...`);
                    await Fetch(`https://vjudge.net/problem/data?length=1&OJId=${encodeURIComponent(oj)}&probNum=${encodeURIComponent(problem)}`);
                    await new Promise(resolve => setTimeout(resolve, 6000));

                    const retryResp = await Fetch(`https://vjudge.net/problem/submit/${pid}`, syncBody);
                    const retryResult = JSON.parse(retryResp.responseText);
                    if (retryResult?.runId) {
                        log(`🎈 ${oj} ${problem} success (retry)`, 'success');
                        successCount++;
                    } else {
                        log(`❌${oj} ${problem} 重试失败: ${retryResult?.error?.i18nKey || retryResult?.error || '未知错误'}`, 'error');
                    }
                } else {
                    log(`❌${oj} ${problem} failed: ${result?.error?.i18nKey || result?.error || '未知错误'}`, 'error');
                }
            } catch (err) {
                log(`❌${oj} ${problem} error: ${err.message}`, 'error');
                return;
            }
        }
        log(`🎈 ${oj}: 同步完成，更新 ${successCount} 题`, 'success');
    }

    async function fetchLuogu(user) {
        log('💡正在获取洛谷数据...');
        try {
            const res = await Fetch(`https://www.luogu.com.cn/user/${user}/practice`, { headers: { 'X-Lentille-Request': 'content-only' } });
            const json = JSON.parse(res.responseText);
            const passed = json?.data?.passed || [];
            await submitVJ('洛谷', passed.map(x => x.pid));
        } catch (err) {
            log('洛谷数据解析失败', 'error');
        }
    }

    async function fetchCodeForces(user) {
        log('💡正在获取CF数据...');
        try {
            const res = await Fetch(`https://codeforces.com/api/user.status?handle=${encodeURIComponent(user)}`);
            const result = JSON.parse(res.responseText).result || [];
            const pids = result.filter(r => r.verdict === 'OK').map(r => `${r.problem.contestId}${r.problem.index}`);
            await submitVJ('CodeForces', [...new Set(pids)]);
        } catch (err) {
            log('CF数据解析失败', 'error');
        }
    }

    async function fetchAtCoder(user) {
        log('💡正在获取AtCoder数据...');
        try {
            const pids = new Set();
            let fromSecond = 0;
            while (true) {
                const res = await Fetch(`https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=${encodeURIComponent(user)}&from_second=${fromSecond}`);
                const list = JSON.parse(res.responseText) || [];
                list.filter(r => r.result === 'AC').forEach(r => pids.add(r.problem_id));
                const lastEpoch = list[list.length - 1]?.epoch_second;
                if (list.length <= 10 || !lastEpoch || lastEpoch - 1 >= fromSecond) break;
                fromSecond = lastEpoch - 1;
            }
            await submitVJ('AtCoder', [...pids]);
        } catch (err) {
            log('ATC数据解析失败', 'error');
        }
    }

    async function fetchQOJ(user) {
        log('💡正在获取QOJ数据...');
        try {
            const res = await Fetch(`https://qoj.ac/user/profile/${encodeURIComponent(user)}`);
            const doc = new DOMParser().parseFromString(res.responseText, 'text/html');
            const pids = [];
            const headings = doc.querySelectorAll('h4.list-group-item-heading');
            headings.forEach(h4 => {
                if (h4.textContent.includes('AC 过的题目')) {
                    const p = h4.nextElementSibling;
                    if (p && p.classList.contains('list-group-item-text')) {
                        p.querySelectorAll('a').forEach(a => {
                            const pid = a.textContent.trim();
                            if (pid) pids.push(pid);
                        });
                    }
                }
            });
            await submitVJ('QOJ', pids);
        } catch (err) {
            log('QOJ解析失败', 'error');
        }
    }

    async function fetchUOJ(user) {
        log('💡正在获取UOJ数据...');
        try {
            const res = await Fetch(`https://uoj.ac/user/profile/${encodeURIComponent(user)}`);
            const doc = new DOMParser().parseFromString(res.responseText, 'text/html');
            const pids = [];
            doc.querySelectorAll('ul.uoj-ac-problems-list li a').forEach(a => {
                const match = a.getAttribute('href')?.match(/\/problem\/(\d+)/);
                if (match) pids.push(match[1]);
            });
            await submitVJ('UniversalOJ', pids);
        } catch (err) {
            log('UOJ解析失败', 'error');
        }
    }

    async function fetchNowCoder(user) {
        log('💡正在获取牛客数据...');
        try {
            const fst = await Fetch(`https://ac.nowcoder.com/acm/contest/profile/${encodeURIComponent(user)}/practice-coding?pageSize=1&statusTypeFilter=5&page=1`);
            const cnt = new DOMParser().parseFromString(fst.responseText, 'text/html');
            const totalPage = Math.ceil(Number(cnt.querySelector('.my-state-item .state-num')?.innerText) / 200);

            const tasks = [];
            for (let i = 1; i <= totalPage; i++) {
                tasks.push(Fetch(`https://ac.nowcoder.com/acm/contest/profile/${encodeURIComponent(user)}/practice-coding?pageSize=200&statusTypeFilter=5&page=${i}`));
            }

            let pids = [];
            const results = await Promise.all(tasks);
            results.forEach(res => {
                const doc = new DOMParser().parseFromString(res.responseText, 'text/html');
                doc.querySelectorAll('table.table-hover tbody tr').forEach(tr => {
                    const tds = tr.querySelectorAll('td');
                    if (tds.length < 8) return;
                    const problemLink = tds[1].querySelector('a')?.getAttribute('href') || '';
                    const problemId = problemLink.split('/').pop();
                    pids.push(problemId);
                });
            });

            const preUniquePids = [...new Set(pids)];
            const checkPromises = preUniquePids.map(async (id) => {
                const res = await Fetch(`https://ac.nowcoder.com/acm/problem/${id}`, { credentials: 'omit' });
                const html = res.responseText || '';
                if (html.includes('没有查看题目的权限哦')) return null;
                return id;
            });
            const finalResults = await Promise.all(checkPromises);
            const uniquePids = finalResults.filter(item => item !== null);
            await submitVJ('牛客', uniquePids);
        } catch (err) {
            log('牛客获取数据失败', 'error');
        }
    }

    syncBtn.addEventListener('click', async () => {
        const username = getVJudgeUsername();
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
            const success = await fetchVJudgeArchived(username);
            if (!success) return;

            if (document.getElementById('vj-lg').checked) {
                const acc = await checkAccount('洛谷');
                if (acc) await fetchLuogu(acc);
            }
            if (document.getElementById('vj-nc').checked) {
                const acc = await checkAccount('牛客');
                if (acc) await fetchNowCoder(acc);
            }
            if (document.getElementById('vj-cf').checked) {
                const acc = await checkAccount('CodeForces');
                if (acc) await fetchCodeForces(acc);
            }
            if (document.getElementById('vj-atc').checked) {
                const acc = await checkAccount('AtCoder');
                if (acc) await fetchAtCoder(acc);
            }
            if (document.getElementById('vj-qoj').checked) {
                const acc = await checkAccount('QOJ');
                if (acc) await fetchQOJ(acc);
            }
            if (document.getElementById('vj-uoj').checked) {
                const acc = await checkAccount('UniversalOJ');
                if (acc) await fetchUOJ(acc);
            }

            log('所有同步任务已完成！', 'success');
        } catch (err) {
            log(`同步发生错误: ${err.message}`, 'error');
        } finally {
            syncBtn.disabled = false;
            syncBtn.textContent = '一键同步 AC 记录';
        }
    });
})();
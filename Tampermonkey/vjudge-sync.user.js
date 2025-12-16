// ==UserScript==
// @name         VJudgeのAC自动机
// @namespace    https://github.com/Tabris-ZX/vjudge-sync
// @version      2.1
// @description  VJudge 题目一键同步,目前支持洛谷,cf,atc,qoj
// @match        https://vjudge.net/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      raw.githubusercontent.com
// @updateURL    https://raw.githubusercontent.com/Tabris-ZX/vjudge-sync/main/Tampermonkey/vjudge-sync.user.js
// @downloadURL  https://raw.githubusercontent.com/Tabris-ZX/vjudge-sync/main/Tampermonkey/vjudge-sync.user.js

// @connect      vjudge.net
// @connect      luogu.com.cn
// @connect      codeforces.com
// @connect      kenkoooo.com
// @connect      qoj.ac

// ==/UserScript==
(function () {
    'use strict';
    if (!location.host.includes('vjudge.net')) return;

    const GITHUB_CSS_URL = 'https://raw.githubusercontent.com/Tabris-ZX/vjudge-sync/main/Tampermonkey/panel.css';
    
    /* ================= 加载 CSS 样式 ================= */
    function injectCSS(cssText) {
        if (typeof GM_addStyle !== 'undefined') {
            GM_addStyle(cssText);
        } else {
            const styleEl = document.createElement('style');
            styleEl.innerHTML = cssText;
            document.head.appendChild(styleEl);
        }
    }
    function loadCSS() {
        GM_xmlhttpRequest({
                method: 'GET',
                url: GITHUB_CSS_URL,
                onload: function(res) {
                    if (res.status === 200) injectCSS(res.responseText);
                     else console.error('GitHub CSS加载失败，状态码:', res.status);
                },
                onerror: function(err) {
                    console.error('GitHub CSS请求失败:', err);
                }
            });
    }
    loadCSS();

    /* ================= 2. 构建 UI DOM ================= */
    const panel = document.createElement('div');
    panel.id = 'vj-sync-panel';
    panel.innerHTML = `
        <div id="vj-sync-header">
            <span>vjのAC自动机</span>
            <span id="vj-toggle-btn" class="vj-btn-icon" title="收起/展开">−</span>
        </div>
        <div id="vj-sync-body">
        <span>同步前确保vj上已经绑定好相应oj的账号</span>
            <div class="vj-input-group">
                <label><input type="checkbox" id="vj-lg" /> 洛谷</label>
            </div>
            <div class="vj-input-group">
                <label><input type="checkbox" id="vj-cf" /> CodeForces</label>
            </div>
            <div class="vj-input-group">
                <label><input type="checkbox" id="vj-atc" /> AtCoder</label>
            </div>
            <div class="vj-input-group">
                <label><input type="checkbox" id="vj-qoj" /> QOJ</label>
            </div>
            <div class="vj-input-group">
                <label><input type="checkbox" id="vj-nc" /> 牛客(严肃开发中...)</label>
            </div>
            <button id="vj-sync-btn">一键全同步</button>
            <div id="vj-sync-log"></div>
        </div>
    `;
    document.body.appendChild(panel);

    /* ================= 3. 交互逻辑 (拖拽、折叠、存储) ================= */
    const header = document.getElementById('vj-sync-header');
    const toggleBtn = document.getElementById('vj-toggle-btn');
    const content = document.getElementById('vj-sync-body');
    const logBox = document.getElementById('vj-sync-log');

    // --- 恢复位置 ---
    const savedPos = JSON.parse(localStorage.getItem('vj_panel_pos') || '{"top":"100px","right":"20px"}');
    // 简单的防止溢出屏幕检查
    if(parseInt(savedPos.top) > window.innerHeight - 50) savedPos.top = '100px'; 
    panel.style.top = savedPos.top;
    panel.style.right = 'auto';
    panel.style.left = savedPos.left || 'auto';
    if (!savedPos.left) panel.style.right = savedPos.right;

    let isCollapsed = localStorage.getItem('vj_panel_collapsed') === 'true';
    if (isCollapsed) {
        content.style.display = 'none';
        toggleBtn.textContent = '+';
    }
    // 恢复各 OJ 的勾选状态
    ['vj-lg', 'vj-cf','vj-atc','vj-qoj','vj-nc'].forEach(id => {
        const saved = localStorage.getItem(id + '_checked');
        if (saved === 'true') {
            const el = document.getElementById(id);
            if (el) el.checked = true;
        }
    });

    // 勾选变化时保存到 localStorage
    ['vj-lg', 'vj-cf','vj-atc','vj-qoj','vj-nc'].forEach(id => {
        document.getElementById(id).addEventListener('change', (e) => {
            localStorage.setItem(id + '_checked', e.target.checked);
        });
    });

    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isCollapsed = !isCollapsed;
        content.style.display = isCollapsed ? 'none' : 'block';
        toggleBtn.textContent = isCollapsed ? '+' : '−';
        localStorage.setItem('vj_panel_collapsed', isCollapsed);
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
        
        const newLeft = panelStart.x + dx;
        const newTop = panelStart.y + dy;

        panel.style.left = newLeft + 'px';
        panel.style.top = newTop + 'px';
        panel.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            header.style.cursor = 'move';
            localStorage.setItem('vj_panel_pos', JSON.stringify({
                left: panel.style.left,
                top: panel.style.top
            }));
        }
    });

    let vjArchived = {};

    function log(msg) {
        logBox.style.display = 'block';
        logBox.innerHTML += `<div>${msg}</div>`;
        logBox.scrollTop = logBox.scrollHeight;
    }

    function getVJudgeUsername() {
        const urlMatch = location.pathname.match(/\/user\/([^\/]+)/);
        if (urlMatch) return urlMatch[1];
        const userLink = document.querySelector('a[href^="/user/"]');
        if (userLink) {
            const match = userLink.getAttribute('href').match(/\/user\/([^\/]+)/);
            if (match) return match[1];
        }
        return null;
    }

    function fetchVJudgeArchived(callback) {
        const username = getVJudgeUsername();
        if (!username) {
            log('未找到VJ用户名');
            vjArchived = {};
            if (callback) callback();
            return;
        }

        GM_xmlhttpRequest({
            method: 'GET',
            url: `https://vjudge.net/user/solveDetail/${username}`,
            onload: res => {
                try {
                    const json = JSON.parse(res.responseText);
                    vjArchived = json.acRecords || {};
                    let total = 0;
                    for (let k in vjArchived) total += vjArchived[k].length;
                    log(`VJ已AC ${total} 题`);
                    if (callback) callback();
                } catch (err) {
                    log('获取VJ记录失败');
                    if (callback) callback();
                }
            }
        });
    }

    // --- 各个OJ的获取逻辑 ---

    function fetchLuogu(user) {
        log('正在同步洛谷数据...');
        GM_xmlhttpRequest({
            method: 'GET',
            url: `https://www.luogu.com.cn/user/${encodeURIComponent(user)}/practice`,
            headers: { 'X-Lentille-Request': 'content-only' },
            onload: res => {
                try {
                    const json = JSON.parse(res.responseText);
                    const passed = json?.data?.passed || [];
                    const pids = passed.map(x => x.pid);
                    log(`洛谷: 发现 ${pids.length} AC`);
                    submitVJ('洛谷', pids);
                } catch(err) { log('洛谷数据解析失败'); }
            },
            onerror: () => log('洛谷请求失败')
        });
    }

    function fetchCodeForces(user) {
        log('正在同步CF数据...');
        GM_xmlhttpRequest({
            method: 'GET',
            url: `https://codeforces.com/api/user.status?handle=${user}`,
            onload: res => {
                try {
                    const result = JSON.parse(res.responseText).result || [];
                    const pids = result
                        .filter(r => r.verdict === 'OK')
                        .map(r => `${r.problem.contestId}${r.problem.index}`);
                    const uniquePids = [...new Set(pids)];
                    log(`CF: 发现 ${uniquePids.length} AC`);
                    submitVJ('CodeForces', uniquePids);
                } catch(err) { log('CF数据解析失败'); }
            },
            onerror: () => log('CF请求失败')
        });
    }

    //数据来源:https://github.com/kenkoooo/AtCoderProblems
    function fetchAtCoder(user){
        log('正在同步AtCoder数据...');
        GM_xmlhttpRequest({
            method: 'GET',
            url: `https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=${user}&from_second=0`,
            onload: res => {
                try {
                    const list = JSON.parse(res.responseText) || [];
                    const pids = list
                        .filter(r => r.result === 'AC')
                        .map(r => `${r.problem_id}`);
                    const uniquePids = [...new Set(pids)];
                    log(`ATC: 发现 ${uniquePids.length} AC`);
                    submitVJ('AtCoder', uniquePids);
                } catch(err) { log('ATC数据解析失败'); }
            },
            onerror: () => log('ATC请求失败')
        });
    }

    function fetchQOJ(user) {
        log('正在同步QOJ数据...');
        GM_xmlhttpRequest({
            method: 'GET',
            url: `https://qoj.ac/user/profile/${user}`,
            onload: res => {
                try {
                    const doc = new DOMParser().parseFromString(res.responseText, 'text/html');
                    const pids = [];
                    doc.querySelectorAll('p.list-group-item-text a').forEach(a => pids.push(a.textContent.trim()));
                    console.log(pids)
                    log(`QOJ: 发现 ${pids.length} AC`);
                    submitVJ('QOJ', pids);
                } catch(err) { log('QOJ解析失败'); }
            },
            onerror: () => log('QOJ请求失败')
        });
    }

    // 检查 VJudge 上是否已绑定指定 OJ 账号，返回 Promise<string|null>
    function verifyAccount(oj) {
        log(`正在检查${oj}账号信息...`);
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://vjudge.net/user/verifiedAccount?oj=${encodeURIComponent(oj)}`,
                onload: res => {
                    try {
                        const data = JSON.parse(res.responseText);
                        const account = data && data.accountDisplay ? data.accountDisplay : null;
                        resolve(account);
                    } catch (err) {
                        resolve(null);
                    }
                },
                onerror: () => log(`${oj}请求失败`)
            });
        });
    }

    //解析用户名
    function extractTextFromHtml(account) {
        const temp = document.createElement('div');
        temp.innerHTML = account;
        return temp.textContent || temp.innerText || '';
    }

    // --- 提交逻辑 ---
    const submitted = new Set();
    async function submitVJ(oj, pids) {

        const archived = vjArchived[oj] || [];
        const archivedSet = new Set(archived);
        let successCnt = 0;

        for (const pid of pids) {
            if (archivedSet.has(pid)) continue; // 已提交过
            const key = `${oj}-${pid}`;
            if (submitted.has(key)) continue;    // 本次已提交
            submitted.add(key);
            try {
                const res = await fetch(`https://vjudge.net/problem/submit/${key}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: 'method=2&language=&open=0&source='
                });
                if (res.ok) {
                    successCnt++;
                    log(`${oj} ${pid} success!`);
                }
                else log(`${oj} ${pid} failed!`);
            } catch (err) {
                log(`${oj} ${pid} 提交失败:`, err);
            }
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        log(`${oj}: 同步完成，更新 ${successCnt} 题`);
    } 

    // --- 按钮事件 ---
    document.getElementById('vj-sync-btn').onclick = async function() {
        const btn = this;
        btn.disabled = true;
        btn.textContent = '同步中...';
        logBox.innerHTML = '';
        
        submitted.clear();
        vjArchived = {};
        
        const needLg  = document.getElementById('vj-lg').checked;
        const needCf  = document.getElementById('vj-cf').checked;
        const needAtc = document.getElementById('vj-atc').checked;
        const needQoj = document.getElementById('vj-qoj').checked;

        fetchVJudgeArchived(() => {
            const tasks = [];
            if (needLg) {
                tasks.push(
                    verifyAccount('洛谷').then(account => {
                        const user = account.match(/\/user\/(\d+)/);
                        if (user) fetchLuogu(user[1]);
                        else log('未找到洛谷账号信息');
                    })
                );
            }
            if (needCf) {
                tasks.push(
                    verifyAccount('CodeForces').then(account => {
                        const user = extractTextFromHtml(account);
                        if (user) fetchCodeForces(user);
                        else log('未找到CodeForces账号信息');
                    })
                );
            }
            if (needAtc) {
                tasks.push(
                    verifyAccount('AtCoder').then(account => {
                        const user = extractTextFromHtml(account);
                        if (user) fetchAtCoder(user);
                        else log('未找到AtCoder账号信息');
                    })
                );
            }
            if (needQoj) {
                tasks.push(
                    verifyAccount('QOJ').then(account => {
                        const user = extractTextFromHtml(account);
                        if (user) fetchQOJ(user);
                        else log('未找到QOJ账号信息');
                    })
                );
            }

            Promise.all(tasks).finally(() => {
                btn.disabled = false;
                btn.textContent = '一键全同步';
                log('同步完成');
            });
        });
    };
})();
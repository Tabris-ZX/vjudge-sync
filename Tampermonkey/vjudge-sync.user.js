// ==UserScript==
// @name         VJudge-Sync
// @namespace    https://github.com/Tabris-ZX/vjudge-sync
// @version      2.2.5
// @description  VJudge 一键同步归档已绑定的oj过题记录,目前支持洛谷,牛客,cf,atc,qoj,uoj
// @author       Tabris_ZX
// @match        https://vjudge.net/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      raw.githubusercontent.com
// @license      AGPL-3.0

// @connect      vjudge.net
// @connect      luogu.com.cn
// @connect      nowcoder.com
// @connect      codeforces.com
// @connect      kenkoooo.com
// @connect      qoj.ac
// @connect      uoj.ac

// @downloadURL https://update.greasyfork.org/scripts/559149/VJudge-Sync.user.js
// @updateURL https://update.greasyfork.org/scripts/559149/VJudge-Sync.meta.js
// ==/UserScript==
(function () {
    'use strict';
    if (!location.host.includes('vjudge.net')) return;

    /*配置项*/
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
            onload: function (res) {
                if (res.status === 200) injectCSS(res.responseText);
                else console.error('GitHub CSS加载失败，状态码:', res.status);
            },
            onerror: function (err) {
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
        <label><input type="checkbox" id="vj-nc" /> 牛客</label>
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
        <label><input type="checkbox" id="vj-uoj" /> UOJ</label>
    </div>
    <button id="vj-sync-btn">一键同步</button>
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
    if (parseInt(savedPos.top) > window.innerHeight - 50) savedPos.top = '100px';
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
    ['vj-lg', 'vj-cf', 'vj-atc', 'vj-qoj', 'vj-nc', 'vj-uoj'].forEach(id => {
        const saved = localStorage.getItem(id + '_checked');
        if (saved === 'true') {
            const el = document.getElementById(id);
            if (el) el.checked = true;
        }
    });

    ['vj-lg', 'vj-cf', 'vj-atc', 'vj-qoj', 'vj-nc', 'vj-uoj'].forEach(id => {
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
    // --- 按钮事件 ---
    document.getElementById('vj-sync-btn').onclick = async function () {
        const btn = this;
        btn.disabled = true;
        btn.textContent = '同步中...';
        logBox.innerHTML = '';

        vjArchived = {};
        const needLg = document.getElementById('vj-lg').checked;
        const needCf = document.getElementById('vj-cf').checked;
        const needAtc = document.getElementById('vj-atc').checked;
        const needQoj = document.getElementById('vj-qoj').checked;
        const needNc = document.getElementById('vj-nc').checked;
        const needUoj = document.getElementById('vj-uoj').checked;

        fetchVJudgeArchived(() => {
            const tasks = [];
            if (needLg) {
                tasks.push(checkAccount('洛谷').then(account => {
                    if (account == null) log('❌未找到洛谷账号信息');
                    else fetchLuogu(account.match(/\/user\/(\d+)/)[1]);
                })
                );
            }
            if (needCf) {
                tasks.push(checkAccount('CodeForces').then(account => {
                    if (account == null) log('❌未找到CodeForces账号信息');
                    else fetchCodeForces(account.replace(/<[^>]*>/g, ''));
                })
                );
            }
            if (needAtc) {
                tasks.push(checkAccount('AtCoder').then(account => {
                    if (account == null) log('❌未找到AtCoder账号信息');
                    else fetchAtCoder(account.replace(/<[^>]*>/g, ''));
                })
                );
            }
            if (needQoj) {
                tasks.push(checkAccount('QOJ').then(account => {
                    if (account == null) log('❌未找到QOJ账号信息');
                    else fetchQOJ(account.replace(/<[^>]*>/g, ''));
                })
                );
            }
            if (needNc) {
                tasks.push(checkAccount('牛客').then(account => {
                    if (account == null) log('❌未找到牛客账号信息');
                    else fetchNowCoder(account.match(/\/profile\/(\d+)/)[1]);
                })
                );
            }
            if (needUoj) {
                tasks.push(checkAccount('UniversalOJ').then(account => {
                    if (account == null) log('❌未找到UOJ账号信息');
                    else fetchUOJ(account.replace(/<[^>]*>/g, ''));
                })
                );
            }
            Promise.all(tasks).finally(() => {
                btn.disabled = false;
                btn.textContent = '一键同步';
            });
        });
    };

    let vjArchived = {};

    function log(msg) {
        logBox.style.display = 'block';
        logBox.innerHTML += `<div>${msg}</div>`;
        logBox.scrollTop = logBox.scrollHeight;
    }

    //*****业务逻辑*******

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

    /**
     * 
     * 检查vj登录状态 
     */
    function fetchVJudgeArchived(callback) {
        const username = getVJudgeUsername();
        if (!username) {
            log('VJudge未登录');
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
                    log(`VJudge已AC ${total} 题`);
                    if (callback) callback();
                } catch (err) {
                    log('获取VJ记录失败');
                    console.log(err);
                    if (callback) callback();
                }
            }
        });
    }

    //获取各个oj数据
    async function fetchLuogu(user) {
        log('🔄正在获取洛谷数据...');
        const headers= {'X-Lentille-Request': 'content-only'}
        Get(`https://www.luogu.com.cn/user/${user}/practice`,headers).then(res => {
                try {
                    const json = JSON.parse(res.responseText);
                    const passed = json?.data?.passed || [];
                    const pids = passed.map(x => x.pid);
                    submitVJ('洛谷', pids);
                } catch (err) {
                    log('洛谷数据解析失败');
                    console.log('洛谷 '+err)
                }
            }).catch(() => log('洛谷请求失败'));
    };

    async function fetchCodeForces(user) {
        log('🔄正在获取CF数据...');
        Get(`https://codeforces.com/api/user.status?handle=${user}`).then(res => {
            try {
                const result = JSON.parse(res.responseText).result || [];
                const pids = result
                    .filter(r => r.verdict === 'OK')
                    .map(r => `${r.problem.contestId}${r.problem.index}`);
                const uniquePids = [...new Set(pids)];
                submitVJ('CodeForces', uniquePids);
            } catch (err) {
                log('CF数据解析失败');
                console.log(err)
            }
        }).catch(() => log('CF请求失败'));
    };

    //数据来源:https://github.com/kenkoooo/AtCoderProblems
    async function fetchAtCoder(user) {
        log('🔄正在获取AtCoder数据...');
        Get(`https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=${user}&from_second=0`).then(res => {
            try {
                const list = JSON.parse(res.responseText) || [];
                const pids = list
                    .filter(r => r.result === 'AC')
                    .map(r => `${r.problem_id}`);
                const uniquePids = [...new Set(pids)];
                submitVJ('AtCoder', uniquePids);
            } catch (err) {
                log('ATC数据解析失败');
                console.log(err)
            }
        }).catch(() => log('ATC请求失败'));
    };

    async function fetchQOJ(user) {
        log('🔄正在获取QOJ数据...');
        Get(`https://qoj.ac/user/profile/${user}`).then(res => {
                try {
                    const doc = new DOMParser().parseFromString(res.responseText, 'text/html');
                    const pids = [];
                    doc.querySelectorAll('p.list-group-item-text a').forEach(a => pids.push(a.textContent.trim()));
                    submitVJ('QOJ', pids);
                } catch (err) {
                    log('QOJ解析失败');
                    console.log(err)
                }
            }).catch(() => log('QOJ请求失败'));
    };

    async function fetchUOJ(user) {
        log('🔄正在获取UOJ数据...');
        Get(`https://uoj.ac/user/profile/${user}`).then(res => {
                try {
                    const doc = new DOMParser().parseFromString(res.responseText, 'text/html');
                    const pids = [];
                    doc.querySelectorAll('ul.uoj-ac-problems-list li a').forEach(a => {
                        const match = a.getAttribute('href').match(/\/problem\/(\d+)/);
                        if (match) pids.push(match[1]);
                    });
                    submitVJ('UniversalOJ', pids);
                } catch (err) {
                    log('UOJ解析失败');
                    console.log(err)
                }
            }).catch(() => log('UOJ请求失败'));
    };

    async function fetchNowCoder(user) {
        log('🔄正在获取牛客数据...');
        //获取总页数
        try {
            const fst = await Get(`https://ac.nowcoder.com/acm/contest/profile/${user}/practice-coding?pageSize=1&statusTypeFilter=5&page=1`);
            const cnt = new DOMParser().parseFromString(fst.responseText, "text/html");
            const totalPage = Math.ceil(Number(cnt.querySelector(".my-state-item .state-num")?.innerText) / 200);

            //获取题目
            let pids = [],tasks = [];
            for (let i = 1; i <= totalPage; i++)
                tasks.push(Get(`https://ac.nowcoder.com/acm/contest/profile/${user}/practice-coding?pageSize=200&statusTypeFilter=5&page=${i}`));

            const passed = await Promise.all(tasks);
            passed.forEach(res => {
                try {
                    const problems = getNcPids(res);
                    pids = pids.concat(problems);
                } catch (err) {
                    log('NowCoder解析失败');
                    console.log(err)
                }
            });
            // 去重，并发检查所有题目的权限
            const preUniquePids = [...new Set(pids)];
            const checkPromises = preUniquePids.map(async (id) => {
                const res = await Get(`https://ac.nowcoder.com/acm/problem/${id}`,null,true);
                const html = res.responseText || '';
                if (html.includes('没有查看题目的权限哦')) return null;
                return id;
            });
            const results = await Promise.all(checkPromises);
            const uniquePids = results.filter(item => item !== null);
            await submitVJ('牛客', uniquePids);
        } catch (err) { log(err) }
    }

    /**
     * 检查所提交oj账号状态
     * @param {oj} oj名 
     * @returns 
     */
    async function checkAccount(oj) {
        log(`🔄正在检查${oj}账号信息...`);
        try {
            const check = await Get(`https://vjudge.net/user/checkAccount?oj=${oj}`);
            const checkData = JSON.parse(check.responseText);
            if (checkData?.result !== 'success') return null;
            const verify = await Get(`https://vjudge.net/user/verifiedAccount?oj=${oj}`);
            const verifyData = JSON.parse(verify.responseText);
            const account = verifyData && verifyData.accountDisplay ? verifyData.accountDisplay : null;
            return account;
        } catch (err) {
            log(`${oj}账号为空或cookie已失效`);
            console.log(`${oj}请求失败`);
            return null;
        }
    }

    /**
     * vj提交逻辑
     * @param {*} oj 
     * @param {*} pids 
     * @returns 
     */
    async function submitVJ(oj, pids) {
        const archivedSet = new Set(vjArchived[oj] || []);
        const toSubmit = pids.filter(pid => !archivedSet.has(pid));
        log(`${oj}:发现${toSubmit.length}未同步AC`);
        if (toSubmit.length === 0) {
            log(`✅${oj}: 所有题目已同步`);
            return;
        }

        // 串行提交
        let successful = 0;
        for (let i = 0; i < toSubmit.length; i++) {
            const problem = toSubmit[i], pid = `${oj}-${problem}`;
            if (i > 0) await new Promise(resolve => setTimeout(resolve, 1000));
            try {
                const resp = await fetch(`https://vjudge.net/problem/submit/${pid}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: 'method=2&language=&open=0&source='
                });
                const result = await resp.json();
                if (result?.runId) {
                    log(`✅${oj} ${problem} success`);
                    successful++;
                } else if (result?.error?.includes('exists')) {
                    log(`${oj} ${problem} 不存在, 尝试触发抓取并等待5秒重试...`);
                    await Get(`https://vjudge.net/problem/data?length=1&OJId=${oj}&probNum=${problem}`);
                    await new Promise(resolve => setTimeout(resolve, 5000));

                    const retryResp = await fetch(`https://vjudge.net/problem/submit/${pid}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: 'method=2&language=&open=0&source='
                    });
                    const retryResult = await retryResp.json();
                    if (retryResult?.runId) {
                        log(`✅${oj} ${problem} success (retry)`);
                        successful++;
                    } else {
                        log(`❌${oj} ${problem} 重试失败: ${retryResult?.error || '未知错误'}`);
                    }
                } else {
                    log(`❌${oj} ${problem} failed:\n ${result.error}`);
                }
            } catch (err) {
                log(`❌${oj} ${problem} error: \n${err.message}`);
            }
        }
        log(`🌟${oj}: 同步完成，更新 ${successful} 题`);
    }

    /**
     * 统一的get方法
     * @param {*} url 
     * @param {*} headers 
     * @returns 
     */
    async function Get(url,headers=null,anonymous=false) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                headers: headers,
                anonymous: anonymous,
                url: url,
                onload: (res) => resolve(res),
                onerror: (err) => reject(err)
            });
        });
    }

    /**
     * 牛客专用，用于获取ac情况
     * @param {*} data 
     * @returns 
     */
    function getNcPids(data) {
        const result = [];
        const doc = new DOMParser().parseFromString(data.responseText, "text/html");
        doc.querySelectorAll("table.table-hover tbody tr").forEach(tr => {
            const tds = tr.querySelectorAll("td");
            if (tds.length < 8) return;
            const problemLink = tds[1].querySelector("a")?.getAttribute("href") || "";
            const problemId = problemLink.split("/").pop();
            result.push(problemId);
        });
        return result;
    }
}
)
    ();
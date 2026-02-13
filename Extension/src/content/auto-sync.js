
/* ================= 1. 跨域请求处理 ================= */
async function Fetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'FETCH', url, options }, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else if (response.error) {
                reject(new Error(response.error));
            } else {
                resolve(response);
            }
        });
    });
}

/* ================= 2. 业务逻辑状态 ================= */
let vjArchived = {};

/* ================= 3. 同步核心函数 ================= */

async function fetchVJudgeArchived(username, log) {
    if (!username) {
        log('❌ 请先打开 VJudge 个人主页或登录');
        return false;
    }
    try {
        const res = await Fetch(`https://vjudge.net/user/solveDetail/${username}`);
        const json = JSON.parse(res.responseText);
        vjArchived = json.acRecords || {};
        let total = 0;
        for (let k in vjArchived) total += vjArchived[k].length;
        log(`VJudge已AC ${total} 题`);
        return true;
    } catch (err) {
        log('获取VJ记录失败');
        console.error(err);
        return false;
    }
}

async function verifyAccount(oj, log) {
    log(`🔄正在检查${oj}账号信息...`);
    try {
        const checkRes = await Fetch(`https://vjudge.net/user/checkAccount?oj=${oj}`);
        const checkData = JSON.parse(checkRes.responseText);
        if (checkData?.result !== 'success') {
            log(`${oj} 账号未绑定或检测失败`, 'error');
            return null;
        }

        const verifyRes = await Fetch(`https://vjudge.net/user/verifiedAccount?oj=${oj}`);
        const verifyData = JSON.parse(verifyRes.responseText);
        return verifyData && verifyData.accountDisplay ? verifyData.accountDisplay : null;
    } catch (err) {
        log(`${oj}账号为空或cookie已失效`);
        return null;
    }
}

async function submitVJ(oj, pids, log) {
    const archivedSet = new Set(vjArchived[oj] || []);
    const toSubmit = pids.filter(pid => !archivedSet.has(pid));
    log(`${oj}:发现${toSubmit.length}未同步AC`);
    if (toSubmit.length === 0) {
        log(`✅${oj}: 所有题目已同步`);
        return;
    }

    let successful = 0;
    for (let i = 0; i < toSubmit.length; i++) {
        const problem = toSubmit[i];
        const pid = `${oj}-${problem}`;
        
        // 固定的 1 秒延时，防止请求频率过高
        if (i > 0) await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
            const resp = await Fetch(`https://vjudge.net/problem/submit/${pid}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'method=2&language=&open=0&source='
            });
            const result = JSON.parse(resp.responseText);
            if (result?.runId) {
                log(`✅${oj} ${problem} success`);
                successful++;
            } else if (result?.error?.includes('exist')) {
                log(`${oj} ${problem} 不存在, 尝试触发抓取并等待5秒重试...`);
                // 这里的 pid 在 VJudge 接口中通常是 OJ-ProblemId 格式，例如 Luogu-P1001
                await Fetch(`https://vjudge.net/problem/data?length=1&OJId=${oj}&probNum=${problem}`);
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                // 再次尝试提交
                const retryResp = await Fetch(`https://vjudge.net/problem/submit/${pid}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: 'method=2&language=&open=0&source='
                });
                const retryResult = JSON.parse(retryResp.responseText);
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
            return;
        }
    }
    log(`🌟${oj}: 同步完成，更新 ${successful} 题`);
}

// --- 各个 OJ 获取数据逻辑 ---
async function fetchLuogu(user, log) {
    log('🔄正在获取洛谷数据...');
    try {
        const res = await Fetch(`https://www.luogu.com.cn/user/${user}/practice`, {
            headers: { 'X-Lentille-Request': 'content-only' }
        });
        const json = JSON.parse(res.responseText);
        const passed = json?.data?.passed || [];
        const pids = passed.map(x => x.pid);
        await submitVJ('洛谷', pids, log);
    } catch (err) { log('洛谷数据解析失败'); }
}

async function fetchCodeForces(user, log) {
    log('🔄正在获取CF数据...');
    try {
        const res = await Fetch(`https://codeforces.com/api/user.status?handle=${user}`);
        const result = JSON.parse(res.responseText).result || [];
        const pids = result
            .filter(r => r.verdict === 'OK')
            .map(r => `${r.problem.contestId}${r.problem.index}`);
        const uniquePids = [...new Set(pids)];
        await submitVJ('CodeForces', uniquePids, log);
    } catch (err) { log('CF数据解析失败'); }
}

async function fetchAtCoder(user, log) {
    log('🔄正在获取AtCoder数据...');
    try {
        const res = await Fetch(`https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=${user}&from_second=0`);
        const list = JSON.parse(res.responseText) || [];
        const pids = list
            .filter(r => r.result === 'AC')
            .map(r => `${r.problem_id}`);
        const uniquePids = [...new Set(pids)];
        await submitVJ('AtCoder', uniquePids, log);
    } catch (err) { log('ATC数据解析失败'); }
}

async function fetchQOJ(user, log) {
    log('🔄正在获取QOJ数据...');
    try {
        const res = await Fetch(`https://qoj.ac/user/profile/${user}`);
        const doc = new DOMParser().parseFromString(res.responseText, 'text/html');
        const pids = [];
        doc.querySelectorAll('p.list-group-item-text a').forEach(a => pids.push(a.textContent.trim()));
        await submitVJ('QOJ', pids, log);
    } catch (err) { log('QOJ解析失败'); }
}

async function fetchUOJ(user, log) {
    log('🔄正在获取UOJ数据...');
    try {
        const res = await Fetch(`https://uoj.ac/user/profile/${user}`);
        const doc = new DOMParser().parseFromString(res.responseText, 'text/html');
        const pids = [];
        doc.querySelectorAll('ul.uoj-ac-problems-list li a').forEach(a => {
            const match = a.getAttribute('href').match(/\/problem\/(\d+)/);
            if (match) pids.push(match[1]);
        });
        await submitVJ('UniversalOJ', pids, log);
    } catch (err) { log('UOJ解析失败'); }
}

async function fetchNowCoder(user, log) {
    log('🔄正在获取牛客数据...');
    try {
        const fst = await Fetch(`https://ac.nowcoder.com/acm/contest/profile/${user}/practice-coding?pageSize=1&statusTypeFilter=5&page=1`);
        const cnt = new DOMParser().parseFromString(fst.responseText, "text/html");
        const totalPage = Math.ceil(Number(cnt.querySelector(".my-state-item .state-num")?.innerText) / 200);

        let pids = [], tasks = [];
        for (let i = 1; i <= totalPage; i++) {
            tasks.push(Fetch(`https://ac.nowcoder.com/acm/contest/profile/${user}/practice-coding?pageSize=200&statusTypeFilter=5&page=${i}`));
        }

        const results = await Promise.all(tasks);
        results.forEach(res => {
            const doc = new DOMParser().parseFromString(res.responseText, "text/html");
            doc.querySelectorAll("table.table-hover tbody tr").forEach(tr => {
                const tds = tr.querySelectorAll("td");
                if (tds.length < 8) return;
                const problemLink = tds[1].querySelector("a")?.getAttribute("href") || "";
                const problemId = problemLink.split("/").pop();
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
        await submitVJ('牛客', uniquePids, log);
    } catch (err) { log('牛客获取数据失败'); }
}


//配置项
let vjArchived = {};
let vjBindings = {}; // oj -> bindingId 缓存
let pendingCrawlTasks = [];
const DEFAULT_SYNC_DELAY = 8000;
const MIN_SYNC_DELAY = 2000;
const MAX_SYNC_DELAY = 10000;
let syncDelay = DEFAULT_SYNC_DELAY;
let syncBody = {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'method=2&language=&open=0&source='
}

function normalizeSyncDelay(value) {
    const delay = Number(value);
    if (!Number.isFinite(delay)) return DEFAULT_SYNC_DELAY;
    return Math.min(MAX_SYNC_DELAY, Math.max(MIN_SYNC_DELAY, Math.round(delay / 100) * 100));
}
function setSyncDelay(value) {syncDelay = normalizeSyncDelay(value);return syncDelay;}
function getSyncDelay() {return syncDelay;}

// 跨域请求处理

async function Fetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'FETCH', url, options }, (response) => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else if (response.error) reject(new Error(response.error));
            else resolve(response);
        });
    });
}

// 归档核心函数

async function fetchVJudgeArchived(username, log) {
    if (!username) {
        log('❌ VJudge 未登录');
        return false;
    }
    try {
        const res = await Fetch(`https://vjudge.net/user/solveDetail/${username}`);
        const json = JSON.parse(res.responseText);
        vjArchived = json.acRecords || {};
        let total = 0;
        for (let k in vjArchived) total += vjArchived[k].length;
        log(`VJudge 已加载归档记录，共 ${total} 题`);
        return true;
    } catch (err) {
        log('获取 VJ 记录失败');
        return false;
    }
}

function getVJudgeArchivedRecords() {
    return vjArchived;
}

async function getBinding(oj) {
    if (vjBindings[oj]) return vjBindings[oj];
    try {
        const res = await Fetch(`https://vjudge.net/user/remoteAccounts/list?oj=${oj}`);
        const data = JSON.parse(res.responseText);
        const binding = data.groups?.[oj]?.bindings?.[0];
        if (binding) vjBindings[oj] = binding;
        return binding || null;
    } catch {
        return null;
    }
}

async function checkAccount(oj, log) {
    log(`💡正在检查${oj}账号信息...`);
    try {
        const binding = await getBinding(oj);
        if (!binding) return null;
        if (binding.runtimeStatus !== "READY") {
            log(`❌ ${oj} 账号状态异常, 请检查账号是否已绑定`);
            return null;
        }
        //检查cookie可用性
        const check = await Fetch(`https://vjudge.net/user/remoteAccounts/check`, {
            method: 'POST', body: JSON.stringify({ bindingId: binding.id }),
            headers: { 'Content-Type': 'application/json' },
        });
        const checkData = JSON.parse(check.responseText);
        if (checkData.success) return binding.accountId;
        else {
            log(`❌ ${oj} 账号验证失败,请检查绑定是否失效: ${checkData.errorKey}`);
            return null;
        }
    } catch (err) {
        log(`❌ ${oj} 账号为空或cookie已失效`);
        return null;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function startCrawlProblem(oj, problem, binding, log) {
    try {
        const crawlResp = await Fetch('https://vjudge.net/problem/crawl/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                remoteOj: oj,
                remoteProblemId: String(problem),
                accountMode: 'BINDING',
                bindingId: binding.id
            })
        });
        const crawlResult = JSON.parse(crawlResp.responseText || '{}');
        if (!crawlResult.success || !crawlResult.runId) {
            log(`❌${oj} ${problem} 抓取任务创建失败`, 'error');
            return null;
        }
        return { oj, problem, runId: crawlResult.runId, bindingId: binding.id };
    } catch (err) {
        log(`❌${oj} ${problem} 抓取任务创建失败: ${err.message}`, 'error');
        return null;
    }
}

async function submitCrawledProblem(task, log) {
    const pid = `${task.oj}-${task.problem}`;
    try {
        const resp = await Fetch(`https://vjudge.net/problem/submit/${pid}`, {
            ...syncBody,
            body: `${syncBody.body}&bindingId=${encodeURIComponent(task.bindingId)}`
        });
        const result = JSON.parse(resp.responseText || '{}');
        if (result?.runId) {
            log(`🎈 ${task.oj} ${task.problem} 抓取后归档成功`, 'success');
            return true;
        }
        log(`❌${task.oj} ${task.problem} 抓取后归档失败: ${result?.error?.i18nKey || '未知错误'}`, 'error');
    } catch (err) {
        log(`❌${task.oj} ${task.problem} 抓取后归档异常: ${err.message}`, 'error');
    }
    return false;
}

async function checkCrawlProblems(tasks, log) {
    if (tasks.length === 0) return;
    try {
        const statusResp = await Fetch('https://vjudge.net/problem/crawl/tasks/dataById', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tasks.map(task => `runIds%5B%5D=${encodeURIComponent(task.runId)}`).join('&')
        });
        const statusData = JSON.parse(statusResp.responseText || '{}');
        const successfulTasks = [];
        tasks.forEach(task => {
            if (statusData?.[task.runId]?.status === 'SUCCEEDED') {
                log(`🎈 ${task.oj} ${task.problem} 抓取成功`, 'success');
                successfulTasks.push(task);
            } else {
                log(`❌${task.oj} ${task.problem} 抓取失败`, 'error');
            }
        });
        for (const task of successfulTasks) {
            await sleep(syncDelay);
            await submitCrawledProblem(task, log);
        }
    } catch (err) {
        log(`❌抓取题目状态检查失败: ${err.message}`, 'error');
    }
}

async function submitVJ(oj, pids, log) {
    const archivedSet = new Set(vjArchived[oj] || []);
    const toSubmit = pids.filter(pid => !archivedSet.has(pid));
    log(`${oj}:共AC ${pids.length} 题, 发现${toSubmit.length}未归档AC`);
    if (toSubmit.length === 0) {
        log(`🎈${oj}: 所有题目已归档`);
        return;
    }
    const binding = await getBinding(oj);
    if (!binding) {
        log(`❌${oj}: 未找到绑定的账号(bindingId)`);
        return;
    }
    const body = `${syncBody.body}&bindingId=${binding.id}`;
    let success_cnt = 0;
    const crawlTasks = [];
    for (let i = 0; i < toSubmit.length; ++i) {
        const problem = toSubmit[i];
        const pid = `${oj}-${problem}`;
        console.log(pid);
        if (i > 0) await sleep(syncDelay);
        try {
            const resp = await Fetch(`https://vjudge.net/problem/submit/${pid}`, { ...syncBody, body });
            const result = JSON.parse(resp.responseText);

            if (result?.runId) {
                log(`🎈 ${oj} ${problem} success`);
                success_cnt++;
            } else if (result.error?.i18nKey?.includes('not_found')) {
                log(`❗${oj} ${problem} 不存在, 已发起抓取任务...`);
                crawlTasks.push(startCrawlProblem(oj, problem, binding, log));
            }
            else if (result.error?.i18nKey?.includes('check_temporarily_failed')){
                log(`❗${oj} 检查远程账号出错,请检查账号绑定`);
            }
            else if(result.error?.i18nKey?.includes('no_recent_submissions_found')){
                log(`❗${oj} 无最新提交,可能已归档过但 VJudge 有延迟`);
            }
            else log(`❌${oj} ${problem} failed:\n ${result.error.i18nKey}`);
        } catch (err) {
            log(`❌${oj} ${problem} error: \n${err.message}`);
            console.log(err);
            continue;
        }
    }
    const crawlTasksCreated = (await Promise.all(crawlTasks)).filter(Boolean);
    pendingCrawlTasks.push(...crawlTasksCreated);
    log(`🎈 ${oj}: 归档完成，更新 ${success_cnt} 题`);
}

async function checkPendingCrawlProblems(log) {
    const tasks = pendingCrawlTasks;
    pendingCrawlTasks = [];
    if (tasks.length === 0) return;
    await sleep(5000);
    await checkCrawlProblems(tasks, log);
}

// --- 各个 OJ 获取数据逻辑 ---
async function fetchLuogu(user, log) {
    log('💡正在获取洛谷数据...');
    try {
        const pids = await OJApi.getLuoguAccepted(user);
        await submitVJ('洛谷', pids, log);
    } catch (err) { log('洛谷数据解析失败'); }
}

async function fetchCodeForces(user, log) {
    log('💡正在获取CodeForces数据...');
    try {
        const pids = await OJApi.getCodeForcesAccepted(user);
        await submitVJ('CodeForces', pids.CodeForces, log);
        await submitVJ('Gym', pids.Gym, log);
        await submitVJ('SGU', pids.SGU, log);
    } catch (err) { log('CF数据解析失败'); }
}

async function fetchAtCoder(user, log) {
    log('💡正在获取AtCoder数据...');
    try {
        const pids = await OJApi.getAtCoderAccepted(user);
        await submitVJ('AtCoder', pids, log);
    } catch (err) { log('ATC数据解析失败'); }
}

async function fetchQOJ(user, log) {
    log('💡正在获取QOJ数据...');
    try {
        const pids = await OJApi.getQOJAccepted(user);
        await submitVJ('QOJ', pids, log);
    } catch (err) { log('QOJ解析失败'); }
}

async function fetchUOJ(user, log) {
    log('💡正在获取UOJ数据...');
    try {
        const pids = await OJApi.getUOJAccepted(user);
        await submitVJ('UniversalOJ', pids, log);
    } catch (err) { log('UOJ解析失败'); }
}

async function fetchNowCoder(user, log) {
    log('💡正在获取牛客数据...');
    try {
        const pids = await OJApi.getNowCoderAccepted(user);
        await submitVJ('牛客', pids, log);
    } catch (err) { log('牛客获取数据失败'); }
}

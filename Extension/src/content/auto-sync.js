
//配置项
let vjArchived = {};
const DEFAULT_SYNC_DELAY = 8000;
const MIN_SYNC_DELAY = 5000;
const MAX_SYNC_DELAY = 20000;
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

/* ================= 跨域请求处理 ================= */
async function Fetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'FETCH', url, options }, (response) => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else if (response.error) reject(new Error(response.error));
            else resolve(response);
        });
    });
}

/* ================= 同步核心函数 ================= */

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
        log(`VJudge 已同步 ${total} 题`);
        return true;
    } catch (err) {
        log('获取 VJ 记录失败');
        return false;
    }
}

async function checkAccount(oj, log) {
    log(`💡正在检查${oj}账号信息...`);
    try {
        const verifyRes = await Fetch(`https://vjudge.net/user/remoteAccounts/list?oj=${oj}`);
        const verifyData = JSON.parse(verifyRes.responseText);
        if (Object.keys(verifyData.groups).length < 1) return null;
        const bid = verifyData.groups[oj]['defaultBinding'].id;
        if (verifyData.groups[oj]['defaultBinding'].runtimeStatus !== "READY"){
            log(`❌ ${oj} 账号状态异常, 请检查账号是否已绑定`);
            return null;
        }
        const check = await Fetch(`https://vjudge.net/user/remoteAccounts/check`, {
            method: 'POST', body: JSON.stringify({ bindingId: bid }),
            headers: { 'Content-Type': 'application/json' },
        });
        const checkData = JSON.parse(check.responseText);
        if (checkData.success) return verifyData.groups[oj]['defaultBinding']['accountId'];
        else {
            log(`❌ ${oj} 账号验证失败: ${checkData.error}`);
            return null;
        }
    } catch (err) {
        log(`❌ ${oj} 账号为空或cookie已失效`);
        return null;
    }
}

async function submitVJ(oj, pids, log) {
    const archivedSet = new Set(vjArchived[oj] || []);
    const toSubmit = pids.filter(pid => !archivedSet.has(pid));
    log(`${oj}:共AC ${pids.length} 题, 发现${toSubmit.length}未同步AC`);
    if (toSubmit.length === 0) {
        log(`🎈${oj}: 所有题目已同步`);
        return;
    }
    let success_cnt = 0;
    for (let i = 0; i < toSubmit.length; ++i) {
        const problem = toSubmit[i];
        const pid = `${oj}-${problem}`;

        if (i > 0) await new Promise(resolve => setTimeout(resolve, syncDelay));
        try {
            const resp = await Fetch(`https://vjudge.net/problem/submit/${pid}`, syncBody);
            const result = JSON.parse(resp.responseText);
            if (result?.runId) {
                log(`🎈 ${oj} ${problem} success`);
                success_cnt++;
            } else if (result.error?.i18nKey?.includes('not_found')) {
                log(`❗${oj} ${problem} 不存在, 尝试抓取并等待6秒重试...`);
                // 这里的 pid 是 VJudge 中 OJ-ProblemId 格式，例如 Luogu-P1001
                await Fetch(`https://vjudge.net/problem/data?length=1&OJId=${oj}&probNum=${problem}`);
                console.debug(oj+' '+problem)
                await new Promise(resolve => setTimeout(resolve, 6000));

                // 再次尝试提交
                const retryResp = await Fetch(`https://vjudge.net/problem/submit/${pid}`, syncBody);
                const retryResult = JSON.parse(retryResp.responseText);
                console.info(retryResult)
                if (retryResult?.runId) {
                    log(`🎈 ${oj} ${problem} success (retry)`);
                    success_cnt++;
                } else log(`❌${oj} ${problem} 重试失败: ${result.error.i18nKey}`);
            } else if (result.error?.i18nKey?.includes('own_account')){
                log(`❗${oj} 未在VJ绑定账号`);
            }
            else log(`❌${oj} ${problem} failed:\n ${result.error.i18nKey}`);
        } catch (err) {
            log(`❌${oj} ${problem} error: \n${err.message}`);
            console.error(err);
            return;
        }
    }
    log(`🎈 ${oj}: 同步完成，更新 ${success_cnt} 题`);
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
    log('💡正在获取CF数据...');
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
        log(`✅ 牛客获取成功，共 ${pids.length} 题`);
        await submitVJ('牛客', pids, log);
    } catch (err) { log('牛客获取数据失败'); }
}

//async function fetchNowCoder(user) {
    //     log('🔄正在同步牛客数据...');
    //     nc_id = user;
    //     try {
    //         const fst = await ncGet(`https://ac.nowcoder.com/acm/contest/profile/${user}/practice-coding?pageSize=1&statusTypeFilter=5&page=1`)
    //         const cnt = new DOMParser().parseFromString(fst.responseText, "text/html");
    //         const totalPage = Math.ceil(Number(cnt.querySelector(".my-state-item .state-num")?.innerText) / 200);
    //         let pids = [];
    //         for (let i = 1; i <= totalPage; i++) {
    //             try {
    //                 const data = await ncGet(`https://ac.nowcoder.com/acm/contest/profile/${user}/practice-coding?pageSize=200&statusTypeFilter=5&page=${i}`)
    //                 const problems = getNcDetail(data);
    //                 pids = pids.concat(problems);
    //             } catch (e) {
    //                 log(`牛客第 ${i} 页获取失败`);
    //             }
    //         }
    //         const preUniquePids = Array.from(new Map(pids.map(item => [item.problemId, item])).values());
    //         // 并发检查所有题目的权限
    //         const checkPromises = preUniquePids.map(async (item) => {
    //             try {
    //                 const res = await ncGet(`https://ac.nowcoder.com/acm/problem/${item.problemId}`);
    //                 const html = res.responseText || '';
    //                 if (html.includes('没有查看题目的权限哦')) {
    //                     return null;
    //                 }
    //                 return item;
    //             } catch (e) {
    //                 return item;
    //             }
    //         });
    //         const results = await Promise.all(checkPromises);
    //         const uniquePids = results.filter(item => item !== null);
    //         submitVJ('牛客', uniquePids);
    //     } catch (err) {
    //         log(err)
    //     }
    // }


// 牛客：同步（顺序）提交
        // if (oj === '牛客') {
        //     let submitCnt = 0;
        //     let successful = 0;
        //     const baseDelay = 60000; // 每次提交间隔60秒
        //
        //     for (let index = 0; index < toSubmit.length; index++) {
        //         const problem = toSubmit[index];
        //
        //         const delay = baseDelay + Math.random()*1000 + 10000;
        //         if (index > 0) {
        //             log(`等待 ${Math.round(delay/1000)} 秒后提交下一题...`);
        //             await new Promise(resolve => setTimeout(resolve, delay));
        //         }
        //
        //         const key = `${oj}-${problem.problemId}`;
        //         let submitted = false;
        //         try {
        //             const check = await ncGet(`https://vjudge.net/problem/data?length=1&OJId=牛客&probNum=${problem.problemId}`);
        //             const checkJson = JSON.parse(check.responseText);
        //             if (checkJson.data.length === 0) {
        //                 log(`${oj} ${problem.problemId} 不存在,等待6秒刷新`);
        //                 await new Promise(resolve => setTimeout(resolve, 6000));
        //                 const checkAgain = await ncGet(`https://vjudge.net/problem/data?length=1&OJId=牛客&probNum=${problem.problemId}`);
        //                 const checkAgainJson = JSON.parse(checkAgain.responseText);
        //                 if (checkAgainJson.data.length === 0) {
        //                     log(`${oj} ${problem.problemId} 不存在,等待6秒刷新失败`);
        //                     submitted = true; // 标记为已处理，跳过提交
        //                     continue;
        //                 }
        //             }
        //             const codeResp = await ncGet(`https://ac.nowcoder.com/acm/contest/view-submission?submissionId=${problem.submitId}&returnHomeType=1&uid=${nc_id}`);
        //             const code = getNcCode(codeResp.responseText || '');
        //             const rd = `\n//${Math.random()}`; // 确保不被判定重复提交
        //             const resp = await fetch(`https://vjudge.net/problem/submit/${key}`, {
        //                 method: 'POST',
        //                 headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        //                 body: `method=1&language=${encodeURIComponent(problem.language)}&open=1&source=${encodeURIComponent(code + rd)}`
        //             });
        //             const result = await resp.json();
        //
        //             if (result?.runId) {
        //                 successful++;
        //                 log(`✅${oj} ${problem.problemId} success`);
        //                 submitted = true;
        //             } else {
        //                 const isRateLimit = result?.error && result.error.includes('moment')
        //
        //                 if (isRateLimit){
        //                     log(`❌${oj} ${problem.problemId} 速率限制,提交暂停`);
        //                     return;
        //                 }
        //             }
        //         } catch (err) {
        //             log(`❌${oj} ${problem.problemId} error: \n${err.message}`);
        //         }
        //         submitCnt++;
        //         // 每三次提交额外等待20秒
        //         if (submitCnt % 3 === 0) {
        //             const restDelay = 20000;
        //             log(`牛客已提交 ${submitCnt} 次，额外等待 ${Math.round(restDelay/1000)} 秒...`);
        //             await new Promise(resolve => setTimeout(resolve, restDelay));
        //             log('等待完成，继续提交牛客题目');
        //         }
        //     }
        //     log(`🌟${oj}: 同步完成，更新 ${successful} 题`);
        //     return;
        // }

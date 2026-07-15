//第三方oj api
const OJApi = (() => {

    //洛谷
    async function getLuoguAccepted(user) {
        const res = await Fetch(
            `https://www.luogu.com.cn/user/${encodeURIComponent(user)}/practice`,
            { headers: { 'X-Lentille-Request': 'content-only' } }
        );
        const data = JSON.parse(res.responseText);
        return (data?.data?.passed || []).map(problem => problem.pid);
    }

    //cf+gym+sgu
    async function getCodeForcesAccepted(user) {
        const res = await Fetch(
            `https://codeforces.com/api/user.status?handle=${encodeURIComponent(user)}`
        );
        const submissions = JSON.parse(res.responseText).result || [];
        const accepted = {
            CodeForces: new Set(),
            Gym: new Set(),
            SGU: new Set()
        };

        submissions.filter(item => item.verdict === 'OK').forEach(({ problem }) => {
            if (!problem?.index) return;
            if (problem.problemsetName?.toLowerCase() === 'acmsguru') {
                accepted.SGU.add(problem.index);
            } else if (problem.contestId >= 100000) {
                accepted.Gym.add(`${problem.contestId}${problem.index}`);
            } else if (problem.contestId != null) {
                accepted.CodeForces.add(`${problem.contestId}${problem.index}`);
            }
        });

        return Object.fromEntries(
            Object.entries(accepted).map(([oj, pids]) => [oj, [...pids]])
        );
    }

    //atcoder
    async function getAtCoderAccepted(user) {
        const accepted = new Set();
        let fromSecond = 0;

        while (true) {
            const res = await Fetch(
                `https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=${encodeURIComponent(user)}&from_second=${fromSecond}`
            );
            const submissions = JSON.parse(res.responseText) || [];
            submissions
                .filter(item => item.result === 'AC')
                .forEach(item => accepted.add(item.problem_id));

            const lastEpoch = submissions[submissions.length - 1]?.epoch_second;
            if (submissions.length <= 10 || !lastEpoch || lastEpoch - 1 <= fromSecond) break;
            fromSecond = lastEpoch - 1;
        }

        return [...accepted];
    }

    //qoj
    async function getQOJAccepted(user) {
        const res = await Fetch(`https://qoj.ac/user/profile/${encodeURIComponent(user)}`);
        const doc = new DOMParser().parseFromString(res.responseText, 'text/html');
        const accepted = [];

        doc.querySelectorAll('h4.list-group-item-heading').forEach(heading => {
            if (!heading.textContent.includes('AC 过的题目')) return;
            const list = heading.nextElementSibling;
            if (!list?.classList.contains('list-group-item-text')) return;
            list.querySelectorAll('a').forEach(link => {
                const pid = link.textContent.trim();
                if (pid) accepted.push(pid);
            });
        });

        return accepted;
    }

    //uoj
    async function getUOJAccepted(user) {
        const res = await Fetch(`https://uoj.ac/user/profile/${encodeURIComponent(user)}`);
        const doc = new DOMParser().parseFromString(res.responseText, 'text/html');
        const accepted = [];

        doc.querySelectorAll('ul.uoj-ac-problems-list li a').forEach(link => {
            const match = link.getAttribute('href')?.match(/\/problem\/(\d+)/);
            if (match) accepted.push(match[1]);
        });

        return accepted;
    }

    //牛客
    async function getNowCoderAccepted() {
        const res = await Fetch(
            'https://ac.nowcoder.com/acm/problem/list/json?status=ac&page=1&pageSize=1'
        );
        const normalizedText = (res.responseText || '')
            .replace(/([{,]\s*)(\d+)(\s*:)/g, '$1"$2"$3');
        const data = JSON.parse(normalizedText);
        return Object.keys(data.data?.statusMap || {});
    }

    return Object.freeze({
        getLuoguAccepted,
        getCodeForcesAccepted,
        getAtCoderAccepted,
        getQOJAccepted,
        getUOJAccepted,
        getNowCoderAccepted
    });
})();

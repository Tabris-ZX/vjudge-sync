globalThis.CareerImage = (() => {
    function createElement(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    function normalizeRecords(records) {
        return Object.entries(records || {})
            .map(([oj, pids]) => {
                const problems = [...new Set(Array.isArray(pids) ? pids.map(String) : [])]
                    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                return { oj, count: problems.length, problems };
            })
            .filter(item => item.count > 0)
            .sort((a, b) => b.count - a.count || a.oj.localeCompare(b.oj));
    }

    function buildSummary(records) {
        const distribution = normalizeRecords(records);
        const total = distribution.reduce((sum, item) => sum + item.count, 0);
        return {
            total,
            ojCount: distribution.length,
            leadingOJ: distribution[0] || null,
            distribution
        };
    }

    function formatDate(date) {
        return new Intl.DateTimeFormat('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(date);
    }

    function createSectionHead(title, code) {
        const head = createElement('div', 'career-report__section-head');
        head.append(
            createElement('h2', 'career-report__section-title', title),
            createElement('span', 'career-report__section-code', code)
        );
        return head;
    }

    function createMetric(value, label, compact = false) {
        const metric = createElement('div', 'career-report__metric');
        metric.append(
            createElement(
                'div',
                `career-report__metric-value${compact ? ' career-report__metric-value--compact' : ''}`,
                String(value)
            ),
            createElement('div', 'career-report__metric-label', label)
        );
        return metric;
    }

    function createOJCard(item, index, total) {
        const share = item.count / total;
        const card = createElement('article', 'career-report__oj');
        const head = createElement('div', 'career-report__oj-head');
        head.append(
            createElement('span', 'career-report__rank', String(index + 1).padStart(2, '0')),
            createElement('h3', 'career-report__oj-name', item.oj),
            createElement('strong', 'career-report__oj-count', item.count)
        );

        const bar = createElement('div', 'career-report__bar');
        const fill = createElement('div', 'career-report__bar-fill');
        fill.style.width = `${Math.max(1.5, share * 100)}%`;
        bar.appendChild(fill);

        const meta = createElement('div', 'career-report__oj-meta');
        meta.append(
            createElement('span', '', 'accepted archive'),
            createElement('span', '', `${(share * 100).toFixed(1)}% share`)
        );

        const problems = createElement('div', 'career-report__problems');
        item.problems.slice(0, 8).forEach(pid => {
            problems.appendChild(createElement('span', 'career-report__problem', pid));
        });
        if (item.count > 8) {
            problems.appendChild(
                createElement('span', 'career-report__problem career-report__problem--more', `+${item.count - 8} MORE`)
            );
        }

        card.append(head, bar, meta, problems);
        return card;
    }

    function renderCareerReport(username, records, generatedAt = new Date()) {
        const summary = buildSummary(records);
        if (summary.total === 0) throw new Error('暂无可生成的 AC 记录');

        const report = createElement('main', 'career-report');
        const signal = createElement('div', 'career-report__signal');
        signal.append(createElement('span'), createElement('span'), createElement('span'));
        report.append(
            signal,
            createElement('div', 'career-report__eyebrow', 'VJudge Sync / Competitive Programming Archive')
        );

        const hero = createElement('header', 'career-report__hero');
        const heroCopy = createElement('div');
        const title = createElement('h1', 'career-report__title');
        title.append(
            document.createTextNode('Coding'),
            createElement('br'),
            createElement('span', 'career-report__title-accent', 'Career'),
            createElement('br'),
            document.createTextNode('Archive')
        );
        const identity = createElement('div', 'career-report__identity');
        identity.append(
            createElement('h2', 'career-report__user', username),
            createElement('div', 'career-report__muted', `算法竞赛生涯过题报告 / ${formatDate(generatedAt)}`)
        );
        heroCopy.append(title, identity);

        const totalPanel = createElement('div', 'career-report__total');
        totalPanel.append(
            createElement('div', 'career-report__mono', 'archive.total_accepted'),
            createElement('div', 'career-report__total-value', summary.total),
            createElement('div', 'career-report__mono', 'status: verified / source: vjudge')
        );
        hero.append(heroCopy, totalPanel);
        report.appendChild(hero);

        const overview = createElement('section', 'career-report__section');
        overview.appendChild(createSectionHead('Archive Overview', 'SUMMARY_01'));
        const metrics = createElement('div', 'career-report__metrics');
        metrics.append(
            createMetric(summary.total, 'Accepted Problems'),
            createMetric(summary.ojCount, 'Judge Sources'),
            createMetric(summary.leadingOJ.oj, 'Primary Judge', true),
            createMetric(`${Math.round(summary.leadingOJ.count / summary.total * 100)}%`, 'Primary Share')
        );
        overview.appendChild(metrics);
        report.appendChild(overview);

        const matrixSection = createElement('section', 'career-report__section');
        matrixSection.appendChild(createSectionHead('Judge Matrix', 'DISTRIBUTION_02'));
        const matrix = createElement('div', 'career-report__matrix');
        summary.distribution.forEach((item, index) => {
            matrix.appendChild(createOJCard(item, index, summary.total));
        });
        matrixSection.appendChild(matrix);
        report.appendChild(matrixSection);

        const footer = createElement('footer', 'career-report__footer');
        footer.append(
            createElement('span', '', `System report / ${formatDate(generatedAt)} / ${summary.ojCount} nodes`),
            createElement('span', '', 'Keep solving. Keep building.')
        );
        report.appendChild(footer);

        return { report, summary };
    }

    async function elementToBlob(element) {
        if (typeof html2canvas !== 'function') throw new Error('截图组件未加载');

        const host = document.createElement('div');
        host.style.position = 'fixed';
        host.style.left = '-10000px';
        host.style.top = '0';
        host.style.zIndex = '-1';
        host.appendChild(element);
        document.body.appendChild(host);

        try {
            if (document.fonts?.ready) await document.fonts.ready;
            const bounds = element.getBoundingClientRect();
            const width = Math.ceil(bounds.width);
            const height = Math.ceil(bounds.height);
            const canvas = await html2canvas(element, {
                backgroundColor: getComputedStyle(element).backgroundColor,
                scale: 1,
                width,
                height,
                windowWidth: width,
                windowHeight: height,
                scrollX: 0,
                scrollY: 0,
                logging: false,
                useCORS: false
            });
            return await new Promise((resolve, reject) => {
                canvas.toBlob(
                    blob => blob ? resolve(blob) : reject(new Error('图片编码失败')),
                    'image/png'
                );
            });
        } finally {
            host.remove();
        }
    }

    async function downloadCareerReport(username, records) {
        const { report, summary } = renderCareerReport(username, records);
        const blob = await elementToBlob(report);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const safeName = username.replace(/[^a-z0-9_-]+/gi, '_') || 'user';
        link.href = url;
        link.download = `${safeName}-career.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return summary;
    }

    return Object.freeze({
        buildSummary,
        renderCareerReport,
        elementToBlob,
        downloadCareerReport
    });
})();

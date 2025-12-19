(function() {
    'use strict';
    
    // CSS 由主脚本加载，这里只负责 UI 逻辑

    /* ================= 构建 UI DOM ================= */
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
            <label><input type="checkbox" id="vj-nc" /> 牛客(未完善)</label>
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

    /* ================= 交互逻辑 (拖拽、折叠、存储) ================= */
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
    let dragStart = {x: 0, y: 0};
    let panelStart = {x: 0, y: 0};

    header.addEventListener('mousedown', (e) => {
        if (e.target === toggleBtn) return;
        isDragging = true;
        dragStart = {x: e.clientX, y: e.clientY};
        const rect = panel.getBoundingClientRect();
        panelStart = {x: rect.left, y: rect.top};
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

    /* ================= 导出接口 ================= */
    window.VJPanel = {
        // 日志函数
        log: function(msg) {
            logBox.style.display = 'block';
            logBox.innerHTML += `<div>${msg}</div>`;
            logBox.scrollTop = logBox.scrollHeight;
        },
        
        // 初始化同步按钮
        initSyncButton: function(onSyncClick) {
            const btn = document.getElementById('vj-sync-btn');
            btn.onclick = async function () {
                const btn = this;
                btn.disabled = true;
                btn.textContent = '同步中...';
                logBox.innerHTML = '';

                try {
                    await onSyncClick({
                        needLg: document.getElementById('vj-lg').checked,
                        needCf: document.getElementById('vj-cf').checked,
                        needAtc: document.getElementById('vj-atc').checked,
                        needQoj: document.getElementById('vj-qoj').checked,
                        needNc: document.getElementById('vj-nc').checked,
                        needUoj: document.getElementById('vj-uoj').checked
                    });
                } finally {
                    btn.disabled = false;
                    btn.textContent = '一键同步';
                }
            };
        }
    };
})();


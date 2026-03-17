let batchCount = 0;
let allRawRecords = [];
let currentFilteredRecords = [];

window.onload = function() {
    addBatchInput("数据项 1");
};

function addBatchInput(defaultTitle = "") {
    batchCount++;
    const container = document.getElementById('batchesContainer');
    const div = document.createElement('div');
    div.className = 'batch-input-group';
    div.id = `batch-${batchCount}`;

    const title = defaultTitle || `数据项 ${batchCount}`;

    div.innerHTML = `
        <div class="batch-header">
            <input type="text" class="batch-title-input" value="${title}" placeholder="给这个数据项起个名字">
            <button class="btn-remove-batch" onclick="removeBatch('batch-${batchCount}')">删除此数据项</button>
        </div>
        <textarea placeholder='在此处粘贴 user_usage_group_by_sessions 数组数据...'></textarea>
    `;
    container.appendChild(div);
}

function removeBatch(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function clearAllBatches() {
    if(confirm("确定要清空所有输入框吗？")) {
        document.getElementById('batchesContainer').innerHTML = '';
        batchCount = 0;
        allRawRecords = [];
        currentFilteredRecords = [];
        addBatchInput("数据项 1");
        destroyModelChart();
        document.getElementById('resultSection').style.display = 'none';
    }
}

function formatTime(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
}

function formatDateOnly(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toISOString().split('T')[0];
}

function formatTokenNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(2) + 'M';
    } else {
        return num.toLocaleString();
    }
}

function processAllData() {
    const globalError = document.getElementById('globalErrorMsg');
    const resultSection = document.getElementById('resultSection');
    const batchStatsContainer = document.getElementById('batchStatsContainer');

    globalError.style.display = 'none';
    batchStatsContainer.innerHTML = '';
    resultSection.style.display = 'none';
    allRawRecords = [];

    const batches = document.querySelectorAll('.batch-input-group');
    let grandTotalCost = 0;
    let grandTotalInput = 0;
    let grandTotalOutput = 0;
    let grandTotalCache = 0;
    let hasError = false;

    if (batches.length === 0) {
        showError("请至少添加一个数据数据项。");
        return;
    }

    batches.forEach((batchEl, index) => {
        const titleInput = batchEl.querySelector('.batch-title-input');
        const textarea = batchEl.querySelector('textarea');
        const batchName = titleInput.value.trim() || `未命名数据项 ${index + 1}`;
        const jsonStr = textarea.value.trim();

        if (!jsonStr) return;

        let data;
        try {
            data = JSON.parse(jsonStr);
            if (!Array.isArray(data)) throw new Error("必须是 JSON 数组");
        } catch (e) {
            showError(`数据项 "${batchName}" 格式错误：${e.message}`);
            hasError = true;
            return;
        }

        let batchCost = 0;
        let batchInput = 0;
        let batchOutput = 0;
        let batchCache = 0;

        data.forEach(item => {
            item._batchName = batchName;

            const cost = item.dollar_float || 0;
            const extra = item.extra_info || {};

            batchCost += cost;
            batchInput += (extra.input_token || 0);
            batchOutput += (extra.output_token || 0);
            batchCache += (extra.cache_read_token || 0);

            allRawRecords.push(item);
        });

        grandTotalCost += batchCost;
        grandTotalInput += batchInput;
        grandTotalOutput += batchOutput;
        grandTotalCache += batchCache;

        const card = document.createElement('div');
        card.className = 'batch-stat-card';
        card.innerHTML = `
            <div class="batch-stat-title" title="${batchName}">${batchName}</div>
            <div class="batch-stat-row"><span>记录数:</span> <span class="batch-stat-val">${data.length}</span></div>
            <div class="batch-stat-row"><span>费用:</span> <span class="batch-stat-val" style="color:var(--success-color)">$${batchCost.toFixed(2)}</span></div>
            <div class="batch-stat-row"><span>输入 Token:</span> <span class="batch-stat-val">${formatTokenNumber(batchInput)}</span></div>
            <div class="batch-stat-row"><span>输出 Token:</span> <span class="batch-stat-val">${formatTokenNumber(batchOutput)}</span></div>
        `;
        batchStatsContainer.appendChild(card);
    });

    if (hasError) return;

    if (allRawRecords.length === 0) {
        showError("所有数据项均为空或无效，请输入数据。");
        return;
    }

    initDateFilters();
    applyDateFilter(false);

    document.getElementById('totalCost').textContent = '$' + grandTotalCost.toFixed(2);
    document.getElementById('totalToken').textContent = formatTokenNumber(grandTotalInput + grandTotalOutput);
    document.getElementById('totalCount').textContent = allRawRecords.length;

    initModelChart();
    updateModelChart(allRawRecords);

    setTimeout(() => {
        if (modelChartInstance) {
            modelChartInstance.resize();
        }
    }, 100);

    resultSection.style.display = 'block';
    resultSection.scrollIntoView({ behavior: 'smooth' });
}

function initDateFilters() {
    if (allRawRecords.length === 0) return;

    const times = allRawRecords.map(r => r.usage_time);
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    const startStr = formatDateOnly(minTime);
    const endStr = formatDateOnly(maxTime);

    const startInput = document.getElementById('startDate');
    const endInput = document.getElementById('endDate');

    startInput.value = startStr;
    startInput.min = startStr;
    startInput.max = endStr;

    endInput.value = endStr;
    endInput.min = startStr;
    endInput.max = endStr;
}

function applyDateFilter(showMessage = true) {
    const startVal = document.getElementById('startDate').value;
    const endVal = document.getElementById('endDate').value;
    const statusSpan = document.getElementById('filterStatus');
    const tableBody = document.getElementById('tableBody');

    if (!startVal || !endVal) {
        showError("请选择有效的开始和结束日期。");
        return;
    }

    const startDate = new Date(startVal);
    startDate.setHours(0, 0, 0, 0);
    const startTimestamp = Math.floor(startDate.getTime() / 1000);

    const endDate = new Date(endVal);
    endDate.setHours(23, 59, 59, 999);
    const endTimestamp = Math.floor(endDate.getTime() / 1000);

    currentFilteredRecords = allRawRecords.filter(item => {
        return item.usage_time >= startTimestamp && item.usage_time <= endTimestamp;
    });

    currentFilteredRecords.sort((a, b) => b.usage_time - a.usage_time);

    updateModelChart(currentFilteredRecords);

    if (showMessage) {
        let filteredCost = 0;
        let filteredInput = 0;
        let filteredOutput = 0;
        currentFilteredRecords.forEach(item => {
            filteredCost += item.dollar_float || 0;
            const extra = item.extra_info || {};
            filteredInput += extra.input_token || 0;
            filteredOutput += extra.output_token || 0;
        });
        const filteredToken = filteredInput + filteredOutput;
        statusSpan.innerHTML = `已筛选：${currentFilteredRecords.length} 条记录 (${startVal} 至 ${endVal}) | 累计 Token: ${formatTokenNumber(filteredToken)} | 费用: $${filteredCost.toFixed(2)}`;
        statusSpan.style.color = 'var(--primary-color)';
        setTimeout(() => { statusSpan.textContent = ''; }, 5000);
    }

    renderTable(currentFilteredRecords);
}

function resetDateFilter() {
    if (allRawRecords.length === 0) return;
    initDateFilters();
    applyDateFilter(false);
}

function renderTable(records) {
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = '';

    if (records.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-sub);">该时间段内无数据</td></tr>';
        return;
    }

    records.forEach(item => {
        const tr = document.createElement('tr');
        const extra = item.extra_info || {};
        const inputT = extra.input_token || 0;
        const outputT = extra.output_token || 0;
        const cacheRead = extra.cache_read_token || 0;
        const cacheWrite = extra.cache_write_token || 0;
        const costVal = (item.dollar_float || 0).toFixed(2);

        const tooltipId = `tooltip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const briefContent = `
            <div>输入：<strong>${formatTokenNumber(inputT)}</strong></div>
            <div>输出：<strong>${formatTokenNumber(outputT)}</strong></div>
        `;

        tr.innerHTML = `
            <td><span class="source-tag">${item._batchName}</span></td>
            <td>${formatTime(item.usage_time)}</td>
            <td><span class="model-tag">${item.model_name || 'Unknown'}</span></td>
            <td class="token-info">
                <div class="token-wrapper" data-tooltip-id="${tooltipId}">
                    ${briefContent}
                    <div class="token-tooltip" id="${tooltipId}">
                        <div class="tooltip-row"><span class="tooltip-label">输入:</span> <span class="tooltip-val">${formatTokenNumber(inputT)}</span></div>
                        <div class="tooltip-row"><span class="tooltip-label">输出:</span> <span class="tooltip-val">${formatTokenNumber(outputT)}</span></div>
                        <div style="border-top:1px solid var(--border-color); margin:6px 0;"></div>
                        <div class="tooltip-row"><span class="tooltip-label">Cache Read:</span> <span class="tooltip-val highlight">${formatTokenNumber(cacheRead)}</span></div>
                        <div class="tooltip-row"><span class="tooltip-label">Cache Write:</span> <span class="tooltip-val highlight">${formatTokenNumber(cacheWrite)}</span></div>
                    </div>
                </div>
            </td>
            <td>$${costVal}</td>
        `;
        tableBody.appendChild(tr);
    });

    document.querySelectorAll('.token-wrapper').forEach(wrapper => {
        const tooltip = wrapper.querySelector('.token-tooltip');

        wrapper.addEventListener('mouseenter', (e) => {
            const rect = wrapper.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();

            let top = rect.top - tooltipRect.height - 10;
            let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

            if (top < 10) {
                top = rect.bottom + 10;
            }

            if (left < 10) {
                left = 10;
            }
            if (left + tooltipRect.width > window.innerWidth - 10) {
                left = window.innerWidth - tooltipRect.width - 10;
            }

            tooltip.style.top = top + 'px';
            tooltip.style.left = left + 'px';
            wrapper.classList.add('active');
        });

        wrapper.addEventListener('mouseleave', () => {
            wrapper.classList.remove('active');
        });
    });
}

function showError(msg) {
    const el = document.getElementById('globalErrorMsg');
    el.textContent = msg;
    el.style.display = 'block';
    document.getElementById('resultSection').style.display = 'none';
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

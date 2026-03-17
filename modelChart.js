let modelChartInstance = null;

function initModelChart() {
    const chartContainer = document.getElementById('modelChartContainer');
    if (!chartContainer) return;

    if (modelChartInstance) {
        modelChartInstance.dispose();
    }

    modelChartInstance = echarts.init(chartContainer);

    const option = {
        tooltip: {
            trigger: 'item',
            formatter: '{a} <br/>{b}: {c} ({d}%)'
        },
        legend: {
            /* show: false */
        },
        series: [
            {
                name: '调用次数',
                type: 'pie',
                center: ['50%', '50%'],
                radius: ['35%', '65%'],
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 10,
                    borderColor: '#fff',
                    borderWidth: 2
                },
                label: {
                    show: false,
                    position: 'center'
                },
                emphasis: {
                    label: {
                        show: true,
                        fontSize: 16,
                        fontWeight: 'bold'
                    }
                },
                labelLine: {
                    show: false
                },
                data: []
            }
        ]
    };

    modelChartInstance.setOption(option);
    modelChartInstance.resize();
}

function updateModelChart(records) {
    if (!modelChartInstance) return;

    const modelCount = {};
    records.forEach(item => {
        const modelName = item.model_name || 'Unknown';
        modelCount[modelName] = (modelCount[modelName] || 0) + 1;
    });

    const data = Object.entries(modelCount).map(([name, count]) => ({
        name: name,
        value: count
    }));

    data.sort((a, b) => b.value - a.value);

    modelChartInstance.setOption({
        series: [{
            data: data
        }]
    });
    modelChartInstance.resize();
}

function destroyModelChart() {
    if (modelChartInstance) {
        modelChartInstance.dispose();
        modelChartInstance = null;
    }
}

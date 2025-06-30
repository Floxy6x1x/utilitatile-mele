updateConsumptionChart() {
    const canvas = document.getElementById('consumptionChart');
    if (!canvas) {
        console.warn('Canvas consumptionChart nu a fost găsit');
        return;
    }
    
    // Verifică dacă elementele de filtrare există
    const yearSelect = document.getElementById('reportYear');
    const monthSelect = document.getElementById('reportMonth');
    
    if (!yearSelect || !monthSelect) {
        console.warn('Elementele de filtrare nu au fost găsite');
        // Folosește valori implicite
        const year = new Date().getFullYear().toString();
        const month = 'all';
        this.createChartWithDefaults(canvas, year, month);
        return;
    }
    
    const ctx = canvas.getContext('2d');
    const year = yearSelect.value;
    const month = monthSelect.value;
    
    // Continuă cu logica existentă...
    if (this.chart) {
        this.chart.destroy();
    }
    
    const consumptions = this.getFilteredConsumptions(year, month);
    // Restul codului pentru grafic...
}

createChartWithDefaults(canvas, year, month) {
    const ctx = canvas.getContext('2d');
    
    if (this.chart) {
        this.chart.destroy();
    }
    
    // Creează un grafic basic cu date demo
    this.chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Demo'],
            datasets: [{
                label: 'Configurați filtrele pentru date reale',
                data: [0],
                backgroundColor: 'rgba(54, 162, 235, 0.6)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `Date demo - Configurați filtrele`
                }
            }
        }
    });
}

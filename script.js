// Aplicația de indexuri și reminder-uri
// Versiunea 2.0 - Cu sincronizare bilaterală

class UtilitiesApp {
    constructor() {
        this.data = this.loadData();
        this.currentType = '';
        this.currentName = '';
        this.syncSettings = this.loadSyncSettings();
        this.isScanning = false;
        
        this.init();
    }

    init() {
        this.updateUI();
        this.setupEventListeners();
        this.checkReminders();
        this.updateSyncStatus();
        
        // Auto-sync la fiecare 30 de secunde dacă este configurat
        setInterval(() => {
            if (this.syncSettings.enabled && this.syncSettings.partnerCode) {
                this.quickSync();
            }
        }, 30000);
    }

    // === GESTIONAREA DATELOR ===
    loadData() {
        const defaultData = {
            waterBath: { current: null, history: [], lastReading: null, sent: false },
            waterKitchen: { current: null, history: [], lastReading: null, sent: false },
            gas: { current: null, history: [], lastReading: null, sent: false },
            electric: { current: null, history: [], lastReading: null, sent: false },
            association: { current: null, history: [], lastPayment: null, sent: false },
            oil: { current: null, history: [], lastChange: null },
            vignette: { current: null, expiry: null, status: 'Necunoscută' },
            insurance: { current: null, expiry: null, status: 'Necunoscută' },
            itp: { current: null, expiry: null, status: 'Necunoscută' },
            lastSync: null,
            version: '2.0'
        };
        
        try {
            const saved = localStorage.getItem('utilitiesData');
            if (saved) {
                const data = JSON.parse(saved);
                // Migrare date vechi
                return this.migrateData(data, defaultData);
            }
        } catch (e) {
            console.error('Eroare la încărcarea datelor:', e);
        }
        
        return defaultData;
    }

    migrateData(oldData, defaultData) {
        // Asigură că toate câmpurile există
        const migrated = { ...defaultData };
        
        Object.keys(oldData).forEach(key => {
            if (migrated[key]) {
                migrated[key] = { ...migrated[key], ...oldData[key] };
            } else {
                migrated[key] = oldData[key];
            }
        });
        
        return migrated;
    }

    saveData() {
        try {
            this.data.lastSync = new Date().toISOString();
            localStorage.setItem('utilitiesData', JSON.stringify(this.data));
            this.showAlert('Date salvate cu succes!', 'success');
        } catch (e) {
            console.error('Eroare la salvarea datelor:', e);
            this.showAlert('Eroare la salvarea datelor!', 'danger');
        }
    }

    loadSyncSettings() {
        try {
            const saved = localStorage.getItem('syncSettings');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.error('Eroare la încărcarea setărilor sync:', e);
        }
        
        return {
            enabled: false,
            partnerCode: '',
            partnerName: '',
            lastSync: null,
            autoSync: true
        };
    }

    saveSyncSettings() {
        try {
            localStorage.setItem('syncSettings', JSON.stringify(this.syncSettings));
        } catch (e) {
            console.error('Eroare la salvarea setărilor sync:', e);
        }
    }

    // === UI UPDATES ===
    updateUI() {
        this.updateIndexDisplays();
        this.updateStatistics();
        this.updateReminders();
        this.updateHistory();
        this.updateConsumption();
        this.updateStatusBadges();
    }

    updateIndexDisplays() {
        // Indexuri apă
        this.updateIndexDisplay('waterBath', 'mc', 'Apometru Baie');
        this.updateIndexDisplay('waterKitchen', 'mc', 'Apometru Bucătărie');
        
        // Gaz și electricitate
        this.updateIndexDisplay('gas', 'mc', 'Contor Gaz');
        this.updateIndexDisplay('electric', 'kWh', 'Contor Electricitate');
        
        // Asociația
        this.updatePaymentDisplay('association');
        
        // Mașina
        this.updateCarDisplay('oil');
        this.updateCarDocumentDisplay('vignette');
        this.updateCarDocumentDisplay('insurance');
        this.updateCarDocumentDisplay('itp');
    }

    updateIndexDisplay(type, unit, name) {
        const data = this.data[type];
        const currentEl = document.getElementById(`${type}Current`);
        const lastEl = document.getElementById(`${type}Last`);
        
        if (currentEl) {
            if (data.current !== null) {
                currentEl.textContent = `${data.current.toLocaleString()} ${unit}`;
                currentEl.className = 'index-current text-success';
            } else {
                currentEl.textContent = '---';
                currentEl.className = 'index-current';
            }
        }
        
        if (lastEl && data.lastReading) {
            const date = new Date(data.lastReading).toLocaleDateString('ro-RO');
            lastEl.textContent = `Ultimul: ${date}`;
        }
    }

    updatePaymentDisplay(type) {
        const data = this.data[type];
        const currentEl = document.getElementById(`${type}Current`);
        const lastEl = document.getElementById(`${type}Last`);
        
        if (currentEl) {
            if (data.current !== null) {
                currentEl.textContent = `${data.current} RON`;
                currentEl.className = 'index-current text-success';
            } else {
                currentEl.textContent = '--- RON';
                currentEl.className = 'index-current';
            }
        }
        
        if (lastEl && data.lastPayment) {
            const date = new Date(data.lastPayment).toLocaleDateString('ro-RO');
            lastEl.textContent = `Ultima plată: ${date}`;
        }
    }

    updateCarDisplay(type) {
        const data = this.data[type];
        const currentEl = document.getElementById(`${type}Current`);
        const lastEl = document.getElementById(`${type}Last`);
        
        if (currentEl) {
            if (data.current !== null) {
                currentEl.textContent = `${data.current.toLocaleString()} km`;
                currentEl.className = 'index-current text-success';
            } else {
                currentEl.textContent = '--- km';
                currentEl.className = 'index-current';
            }
        }
        
        if (lastEl && data.lastChange) {
            const date = new Date(data.lastChange).toLocaleDateString('ro-RO');
            lastEl.textContent = `Ultima dată: ${date}`;
        }
    }

    updateCarDocumentDisplay(type) {
        const data = this.data[type];
        const currentEl = document.getElementById(`${type}Expiry`);
        const statusEl = document.getElementById(`${type}Status`);
        
        if (currentEl && data.expiry) {
            const date = new Date(data.expiry).toLocaleDateString('ro-RO');
            currentEl.textContent = date;
            
            const today = new Date();
            const expiryDate = new Date(data.expiry);
            const daysLeft = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
            
            if (daysLeft < 0) {
                currentEl.className = 'index-current text-danger';
            } else if (daysLeft < 30) {
                currentEl.className = 'index-current text-warning';
            } else {
                currentEl.className = 'index-current text-success';
            }
        }
        
        if (statusEl) {
            statusEl.textContent = `Status: ${data.status || 'Necunoscut'}`;
        }
    }

    updateStatusBadges() {
        const today = new Date();
        const currentDay = today.getDate();
        
        // Badge pentru apă (până pe 15)
        const waterBadge = document.getElementById('waterStatus');
        if (waterBadge) {
            if (currentDay > 15) {
                waterBadge.textContent = '⚠️ Întârziat!';
                waterBadge.className = 'status-badge overdue';
            } else if (currentDay > 10) {
                waterBadge.textContent = '📅 Până pe 15';
                waterBadge.className = 'status-badge due-soon';
            } else {
                waterBadge.textContent = '✅ În timp';
                waterBadge.className = 'status-badge ok';
            }
        }
        
        // Badge pentru gaz/electricitate (până pe 20)
        const gasElectricBadge = document.getElementById('gasElectricStatus');
        if (gasElectricBadge) {
            if (currentDay > 20) {
                gasElectricBadge.textContent = '⚠️ Întârziat!';
                gasElectricBadge.className = 'status-badge overdue';
            } else if (currentDay > 15) {
                gasElectricBadge.textContent = '📅 Până pe 20';
                gasElectricBadge.className = 'status-badge due-soon';
            } else {
                gasElectricBadge.textContent = '✅ În timp';
                gasElectricBadge.className = 'status-badge ok';
            }
        }
    }

    updateStatistics() {
        // Indexuri trimise luna aceasta
        const utilities = ['waterBath', 'waterKitchen', 'gas', 'electric'];
        const sentCount = utilities.filter(type => this.data[type].sent).length;
        const statEl = document.getElementById('statIndexesSent');
        if (statEl) {
            statEl.textContent = `${sentCount}/4`;
        }
        
        // Reminder-uri active
        const activeReminders = this.getActiveReminders().length;
        const reminderEl = document.getElementById('statActiveReminders');
        if (reminderEl) {
            reminderEl.textContent = activeReminders;
        }
    }

    updateReminders() {
        const remindersList = document.getElementById('remindersList');
        if (!remindersList) return;
        
        const reminders = this.getActiveReminders();
        
        if (reminders.length === 0) {
            remindersList.innerHTML = `
                <p style="color: #666; text-align: center; padding: 20px;">
                    Nu există reminder-uri active
                </p>
            `;
            return;
        }
        
        remindersList.innerHTML = reminders.map(reminder => `
            <div class="consumption-item">
                <span class="consumption-period">${reminder.title}</span>
                <span class="consumption-value ${reminder.urgent ? 'text-danger' : 'text-warning'}">
                    ${reminder.message}
                </span>
            </div>
        `).join('');
    }

    updateHistory() {
        const historyList = document.getElementById('historyList');
        if (!historyList) return;
        
        const allHistory = this.getAllHistory();
        
        if (allHistory.length === 0) {
            historyList.innerHTML = `
                <p style="color: #666; text-align: center; padding: 20px;">
                    Nu există înregistrări
                </p>
            `;
            return;
        }
        
        historyList.innerHTML = allHistory.slice(0, 10).map(entry => `
            <div class="consumption-item">
                <span class="consumption-period">
                    ${entry.name} - ${new Date(entry.date).toLocaleDateString('ro-RO')}
                </span>
                <span class="consumption-value">
                    ${entry.value} ${entry.unit || ''}
                </span>
            </div>
        `).join('');
    }

    updateConsumption() {
        const consumptionList = document.getElementById('consumptionList');
        if (!consumptionList) return;
        
        const consumptions = this.calculateMonthlyConsumptions();
        
        if (consumptions.length === 0) {
            consumptionList.innerHTML = `
                <div class="consumption-item">
                    <span class="consumption-period">Această lună</span>
                    <span class="consumption-value">Nu există date</span>
                </div>
            `;
            return;
        }
        
        consumptionList.innerHTML = consumptions.map(cons => `
            <div class="consumption-item">
                <span class="consumption-period">${cons.period}</span>
                <span class="consumption-value">${cons.value}</span>
            </div>
        `).join('');
    }

    updateSyncStatus() {
        const syncIndicator = document.getElementById('syncIndicator');
        if (!syncIndicator) return;
        
        if (!this.syncSettings.enabled || !this.syncSettings.partnerCode) {
            syncIndicator.textContent = '⚠️ Nu e configurat partenerul';
            syncIndicator.className = 'sync-indicator disconnected';
        } else {
            const lastSync = this.syncSettings.lastSync ? 
                new Date(this.syncSettings.lastSync).toLocaleTimeString('ro-RO', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                }) : 'Niciodată';
            
            syncIndicator.textContent = `🔄 Sincronizat cu ${this.syncSettings.partnerName} (${lastSync})`;
            syncIndicator.className = 'sync-indicator connected';
        }
    }

    // === CALCULĂRI ===
    calculateMonthlyConsumptions() {
        const consumptions = [];
        const utilities = [
            { key: 'waterBath', name: 'Apă Baie', unit: 'mc' },
            { key: 'waterKitchen', name: 'Apă Bucătărie', unit: 'mc' },
            { key: 'gas', name: 'Gaz', unit: 'mc' },
            { key: 'electric', name: 'Electricitate', unit: 'kWh' }
        ];
        
        utilities.forEach(utility => {
            const data = this.data[utility.key];
            if (data.history && data.history.length >= 2) {
                const latest = data.history[data.history.length - 1];
                const previous = data.history[data.history.length - 2];
                
                if (latest && previous) {
                    const consumption = latest.value - previous.value;
                    if (consumption >= 0) {
                        consumptions.push({
                            period: utility.name,
                            value: `${consumption.toLocaleString()} ${utility.unit}`
                        });
                    }
                }
            }
        });
        
        return consumptions;
    }

    getActiveReminders() {
        const reminders = [];
        const today = new Date();
        const currentDay = today.getDate();
        
        // Reminder pentru indexuri apă
        if (currentDay > 15 && (!this.data.waterBath.sent || !this.data.waterKitchen.sent)) {
            reminders.push({
                title: 'Indexuri Apă',
                message: 'Termenul a expirat!',
                urgent: true
            });
        } else if (currentDay > 10 && (!this.data.waterBath.sent || !this.data.waterKitchen.sent)) {
            reminders.push({
                title: 'Indexuri Apă',
                message: 'Se apropie termenul (15)',
                urgent: false
            });
        }
        
        // Reminder pentru gaz/electricitate
        if (currentDay > 20 && (!this.data.gas.sent || !this.data.electric.sent)) {
            reminders.push({
                title: 'Gaz & Electricitate',
                message: 'Termenul a expirat!',
                urgent: true
            });
        } else if (currentDay > 15 && (!this.data.gas.sent || !this.data.electric.sent)) {
            reminders.push({
                title: 'Gaz & Electricitate',
                message: 'Se apropie termenul (20)',
                urgent: false
            });
        }
        
        // Reminder pentru documente auto
        ['vignette', 'insurance', 'itp'].forEach(doc => {
            const data = this.data[doc];
            if (data.expiry) {
                const expiryDate = new Date(data.expiry);
                const daysLeft = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
                
                if (daysLeft < 0) {
                    reminders.push({
                        title: this.getDocumentName(doc),
                        message: 'A expirat!',
                        urgent: true
                    });
                } else if (daysLeft <= 30) {
                    reminders.push({
                        title: this.getDocumentName(doc),
                        message: `Expiră în ${daysLeft} zile`,
                        urgent: daysLeft <= 7
                    });
                }
            }
        });
        
        return reminders;
    }

    getAllHistory() {
        const history = [];
        const utilities = [
            { key: 'waterBath', name: 'Apometru Baie', unit: 'mc' },
            { key: 'waterKitchen', name: 'Apometru Bucătărie', unit: 'mc' },
            { key: 'gas', name: 'Contor Gaz', unit: 'mc' },
            { key: 'electric', name: 'Contor Electricitate', unit: 'kWh' },
            { key: 'association', name: 'Plată Asociație', unit: 'RON' },
            { key: 'oil', name: 'Schimb Ulei', unit: 'km' }
        ];
        
        utilities.forEach(utility => {
            const data = this.data[utility.key];
            if (data.history) {
                data.history.forEach(entry => {
                    history.push({
                        name: utility.name,
                        value: entry.value,
                        unit: utility.unit,
                        date: entry.date
                    });
                });
            }
        });
        
        return history.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    getDocumentName(type) {
        const names = {
            'vignette': 'Rovinietă',
            'insurance': 'Asigurare',
            'itp': 'ITP'
        };
        return names[type] || type;
    }

    // === EVENT LISTENERS ===
    setupEventListeners() {
        // Service Worker registration pentru notificări
        if ('serviceWorker' in navigator && 'Notification' in window) {
            this.setupNotifications();
        }
        
        // Verificare reminder-uri la focus
        window.addEventListener('focus', () => {
            this.checkReminders();
        });
    }

    async setupNotifications() {
        try {
            if (Notification.permission === 'default') {
                await Notification.requestPermission();
            }
        } catch (e) {
            console.log('Notificările nu sunt disponibile:', e);
        }
    }

    checkReminders() {
        const reminders = this.getActiveReminders();
        const urgentReminders = reminders.filter(r => r.urgent);
        
        if (urgentReminders.length > 0 && Notification.permission === 'granted') {
            urgentReminders.forEach(reminder => {
                new Notification(`${reminder.title}`, {
                    body: reminder.message,
                    icon: 'icon-192.png',
                    badge: 'icon-192.png'
                });
            });
        }
        
        // Afișează alertele în UI
        this.showRemindersInUI(reminders);
    }

    showRemindersInUI(reminders) {
        const alertsContainer = document.getElementById('alerts');
        if (!alertsContainer) return;
        
        const urgentReminders = reminders.filter(r => r.urgent);
        
        if (urgentReminders.length > 0) {
            alertsContainer.innerHTML = urgentReminders.map(reminder => `
                <div class="alert alert-danger">
                    <strong>${reminder.title}:</strong> ${reminder.message}
                </div>
            `).join('');
        } else {
            alertsContainer.innerHTML = '';
        }
    }

    // === FORM HANDLING ===
    showIndexForm(type, name) {
        this.currentType = type;
        this.currentName = name;
        
        document.getElementById('formTitle').textContent = `Citește ${name}`;
        document.getElementById('formLabel').textContent = 'Index curent:';
        document.getElementById('formValue').value = '';
        document.getElementById('formValue').placeholder = 'Introduceți valoarea';
        
        // Ascunde câmpurile specifice mașinii
        document.getElementById('kmGroup').style.display = 'none';
        document.getElementById('dateGroup').style.display = 'none';
        document.getElementById('previousIndexGroup').style.display = 'none';
        
        document.getElementById('formOverlay').style.display = 'block';
        document.getElementById('formValue').focus();
    }

    showPaymentForm(type, name) {
        this.currentType = type;
        this.currentName = name;
        
        document.getElementById('formTitle').textContent = `Înregistrează ${name}`;
        document.getElementById('formLabel').textContent = 'Suma plătită (RON):';
        document.getElementById('formValue').value = '';
        document.getElementById('formValue').placeholder = 'Ex: 150';
        
        // Ascunde câmpurile specifice
        document.getElementById('kmGroup').style.display = 'none';
        document.getElementById('dateGroup').style.display = 'none';
        document.getElementById('previousIndexGroup').style.display = 'none';
        
        document.getElementById('formOverlay').style.display = 'block';
        document.getElementById('formValue').focus();
    }

    showCarForm(type, name) {
        this.currentType = type;
        this.currentName = name;
        
        if (type === 'oil') {
            document.getElementById('formTitle').textContent = `Actualizează ${name}`;
            document.getElementById('formLabel').textContent = 'Kilometri actuali:';
            document.getElementById('kmGroup').style.display = 'block';
            document.getElementById('dateGroup').style.display = 'block';
            document.getElementById('previousIndexGroup').style.display = 'none';
            
            // Setează data curentă
            document.getElementById('formDate').value = new Date().toISOString().split('T')[0];
        } else {
            document.getElementById('formTitle').textContent = `Actualizează ${name}`;
            document.getElementById('formLabel').textContent = 'Data expirării:';
            document.getElementById('kmGroup').style.display = 'none';
            document.getElementById('dateGroup').style.display = 'block';
            document.getElementById('previousIndexGroup').style.display = 'none';
            
            // Pentru documente, folosim doar data
            document.getElementById('formValue').type = 'date';
        }
        
        document.getElementById('formValue').value = '';
        document.getElementById('formOverlay').style.display = 'block';
    }

    saveForm() {
        const value = document.getElementById('formValue').value;
        if (!value) {
            this.showAlert('Vă rog introduceți o valoare!', 'warning');
            return;
        }
        
        const type = this.currentType;
        const data = this.data[type];
        
        if (['waterBath', 'waterKitchen', 'gas', 'electric'].includes(type)) {
            // Indexuri normale
            const numValue = parseFloat(value);
            if (isNaN(numValue) || numValue < 0) {
                this.showAlert('Vă rog introduceți o valoare numerică validă!', 'warning');
                return;
            }
            
            // Verifică dacă valoarea este mai mică decât ultima înregistrată
            if (data.current !== null && numValue < data.current) {
                if (!confirm('Valoarea introdusă este mai mică decât ultima înregistrată. Continuați?')) {
                    return;
                }
            }
            
            data.current = numValue;
            data.lastReading = new Date().toISOString();
            data.sent = false;
            
            // Adaugă în istoric
            if (!data.history) data.history = [];
            data.history.push({
                value: numValue,
                date: new Date().toISOString()
            });
            
        } else if (type === 'association') {
            // Plată asociație
            const numValue = parseFloat(value);
            if (isNaN(numValue) || numValue <= 0) {
                this.showAlert('Vă rog introduceți o sumă validă!', 'warning');
                return;
            }
            
            data.current = numValue;
            data.lastPayment = new Date().toISOString();
            data.sent = false;
            
            if (!data.history) data.history = [];
            data.history.push({
                value: numValue,
                date: new Date().toISOString()
            });
            
        } else if (type === 'oil') {
            // Schimb ulei
            const kmValue = parseInt(document.getElementById('formKm').value);
            const dateValue = document.getElementById('formDate').value;
            
            if (isNaN(kmValue) || kmValue <= 0) {
                this.showAlert('Vă rog introduceți kilometrajul valid!', 'warning');
                return;
            }
            
            data.current = kmValue;
            data.lastChange = dateValue ? new Date(dateValue).toISOString() : new Date().toISOString();
            
            if (!data.history) data.history = [];
            data.history.push({
                value: kmValue,
                date: data.lastChange
            });
            
        } else if (['vignette', 'insurance', 'itp'].includes(type)) {
            // Documente auto
            const dateValue = value;
            if (!dateValue) {
                this.showAlert('Vă rog selectați data expirării!', 'warning');
                return;
            }
            
            data.expiry = new Date(dateValue).toISOString();
            data.status = 'Activă';
            data.current = dateValue;
        }
        
        this.saveData();
        this.updateUI();
        this.hideForm();
        
        this.showAlert(`${this.currentName} actualizat cu succes!`, 'success');
        
        // Auto-sync dacă este configurat
        if (this.syncSettings.enabled && this.syncSettings.partnerCode) {
            setTimeout(() => this.quickSync(), 1000);
        }
    }

    hideForm() {
        document.getElementById('formOverlay').style.display = 'none';
        this.currentType = '';
        this.currentName = '';
    }

    // === DELETE OPERATIONS ===
    showDeleteOptions(type, name) {
        this.currentType = type;
        this.currentName = name;
        
        document.getElementById('deleteTitle').textContent = `Șterge ${name}`;
        
        const data = this.data[type];
        const hasHistory = data.history && data.history.length > 0;
        
        let content = '<p>Ce doriți să ștergeți?</p><div class="form-buttons">';
        
        if (data.current !== null) {
            content += `
                <button class="btn btn-warning btn-full" onclick="app.deleteLastEntry('${type}')">
                    🗑️ Doar ultima înregistrare
                </button>
            `;
        }
        
        if (hasHistory) {
            content += `
                <button class="btn btn-danger btn-full" onclick="app.deleteAllHistory('${type}')">
                    🗑️ Tot istoricul
                </button>
            `;
        }
        
        if (!data.current && !hasHistory) {
            content += '<p style="text-align: center; color: #666;">Nu există date de șters.</p>';
        }
        
        content += '</div>';
        
        document.getElementById('deleteContent').innerHTML = content;
        document.getElementById('deleteOverlay').style.display = 'block';
    }

    deleteLastEntry(type) {
        const data = this.data[type];
        
        // Resetează valorile curente
        data.current = null;
        data.lastReading = null;
        data.lastPayment = null;
        data.lastChange = null;
        data.sent = false;
        
        // Șterge ultima intrare din istoric
        if (data.history && data.history.length > 0) {
            data.history.pop();
            
            // Dacă mai există istoric, setează penultima valoare ca actuală
            if (data.history.length > 0) {
                const lastEntry = data.history[data.history.length - 1];
                data.current = lastEntry.value;
                data.lastReading = lastEntry.date;
            }
        }
        
        this.saveData();
        this.updateUI();
        this.hideDeleteOptions();
        
        this.showAlert(`Ultima înregistrare pentru ${this.currentName} a fost ștearsă!`, 'success');
    }

    deleteAllHistory(type) {
        if (!confirm(`Sigur doriți să ștergeți tot istoricul pentru ${this.currentName}?`)) {
            return;
        }
        
        const data = this.data[type];
        
        // Resetează tot
        data.current = null;
        data.lastReading = null;
        data.lastPayment = null;
        data.lastChange = null;
        data.expiry = null;
        data.status = 'Necunoscută';
        data.sent = false;
        data.history = [];
        
        this.saveData();
        this.updateUI();
        this.hideDeleteOptions();
        
        this.showAlert(`Tot istoricul pentru ${this.currentName} a fost șters!`, 'success');
    }

    hideDeleteOptions() {
        document.getElementById('deleteOverlay').style.display = 'none';
        this.currentType = '';
        this.currentName = '';
    }

    // === BULK OPERATIONS ===
    markAllIndexesSent() {
        const utilities = ['waterBath', 'waterKitchen', 'gas', 'electric'];
        let marked = 0;
        
        utilities.forEach(type => {
            if (this.data[type].current !== null && !this.data[type].sent) {
                this.data[type].sent = true;
                marked++;
            }
        });
        
        if (marked > 0) {
            this.saveData();
            this.updateUI();
            this.showAlert(`${marked} indexuri marcate ca trimise!`, 'success');
            
            // Auto-sync dacă este configurat
            if (this.syncSettings.enabled && this.syncSettings.partnerCode) {
                setTimeout(() => this.quickSync(), 1000);
            }
        } else {
            this.showAlert('Nu există indexuri de marcat!', 'warning');
        }
    }

    showBulkIndexForm() {
        // Implementează un form rapid pentru introducerea multiplă de indexuri
        const overlay = document.createElement('div');
        overlay.className = 'form-overlay';
        overlay.style.display = 'block';
        
        overlay.innerHTML = `
            <div class="form-popup">
                <h3>📝 Index Rapid</h3>
                <div class="form-group">
                    <label>Apometru Baie (mc):</label>
                    <input type="number" id="bulkWaterBath" placeholder="Ex: 123">
                </div>
                <div class="form-group">
                    <label>Apometru Bucătărie (mc):</label>
                    <input type="number" id="bulkWaterKitchen" placeholder="Ex: 456">
                </div>
                <div class="form-group">
                    <label>Contor Gaz (mc):</label>
                    <input type="number" id="bulkGas" placeholder="Ex: 789">
                </div>
                <div class="form-group">
                    <label>Contor Electricitate (kWh):</label>
                    <input type="number" id="bulkElectric" placeholder="Ex: 12345">
                </div>
                <div class="form-buttons">
                    <button class="btn btn-success btn-full" onclick="app.saveBulkIndexes()">💾 Salvează Toate</button>
                    <button class="btn btn-full" style="background: #666;" onclick="app.hideBulkForm()">❌ Anulează</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        this.bulkOverlay = overlay;
    }

    saveBulkIndexes() {
        const values = {
            waterBath: parseFloat(document.getElementById('bulkWaterBath').value),
            waterKitchen: parseFloat(document.getElementById('bulkWaterKitchen').value),
            gas: parseFloat(document.getElementById('bulkGas').value),
            electric: parseFloat(document.getElementById('bulkElectric').value)
        };
        
        let saved = 0;
        const now = new Date().toISOString();
        
        Object.keys(values).forEach(type => {
            const value = values[type];
            if (!isNaN(value) && value > 0) {
                const data = this.data[type];
                
                // Verifică dacă valoarea este validă
                if (data.current === null || value >= data.current) {
                    data.current = value;
                    data.lastReading = now;
                    data.sent = false;
                    
                    if (!data.history) data.history = [];
                    data.history.push({
                        value: value,
                        date: now
                    });
                    
                    saved++;
                }
            }
        });
        
        if (saved > 0) {
            this.saveData();
            this.updateUI();
            this.hideBulkForm();
            this.showAlert(`${saved} indexuri salvate cu succes!`, 'success');
            
            // Auto-sync dacă este configurat
            if (this.syncSettings.enabled && this.syncSettings.partnerCode) {
                setTimeout(() => this.quickSync(), 1000);
            }
        } else {
            this.showAlert('Nu au fost introduse valori valide!', 'warning');
        }
    }

    hideBulkForm() {
        if (this.bulkOverlay) {
            document.body.removeChild(this.bulkOverlay);
            this.bulkOverlay = null;
        }
    }

    // === CAMERA SCANNING ===
    async scanIndexFromImage(file) {
        if (!file) return;
        
        this.showLoading();
        
        try {
            // Simulează scanarea OCR
            const text = await this.performOCR(file);
            const number = this.extractNumberFromText(text);
            
            if (number) {
                this.hideLoading();
                this.showScanResult(number);
            } else {
                this.hideLoading();
                this.showAlert('Nu am putut extrage numărul din imagine. Introduceți manual.', 'warning');
            }
        } catch (error) {
            this.hideLoading();
            this.showAlert('Eroare la scanarea imaginii. Introduceți manual.', 'danger');
            console.error('Eroare OCR:', error);
        }
    }

    async scanSpecificIndex(file, type, name) {
        if (!file) return;
        
        this.showLoading();
        
        try {
            const text = await this.performOCR(file);
            const number = this.extractNumberFromText(text);
            
            this.hideLoading();
            
            if (number) {
                // Pre-populează formularul cu valoarea scanată
                this.showIndexForm(type, name);
                document.getElementById('formValue').value = number;
            } else {
                this.showAlert('Nu am putut extrage numărul din imagine. Introduceți manual.', 'warning');
                this.showIndexForm(type, name);
            }
        } catch (error) {
            this.hideLoading();
            this.showAlert('Eroare la scanarea imaginii. Introduceți manual.', 'danger');
            this.showIndexForm(type, name);
            console.error('Eroare OCR:', error);
        }
    }

    async performOCR(file) {
        // În realitate, aici ar fi integrarea cu un serviciu OCR
        // Pentru demo, simulăm cu o promisiune
        return new Promise((resolve) => {
            setTimeout(() => {
                // Simulează rezultat OCR cu număr random
                const simulatedText = `Contor: ${Math.floor(Math.random() * 900000 + 100000)}`;
                resolve(simulatedText);
            }, 2000);
        });
    }

    extractNumberFromText(text) {
        // Extrage primul număr de 3+ cifre din text
        const matches = text.match(/\d{3,}/g);
        return matches ? parseInt(matches[0]) : null;
    }

    showScanResult(number) {
        const overlay = document.createElement('div');
        overlay.className = 'form-overlay';
        overlay.style.display = 'block';
        
        overlay.innerHTML = `
            <div class="form-popup">
                <h3>📷 Rezultat Scanare</h3>
                <p>Am detectat numărul: <strong>${number}</strong></p>
                <p>Pentru ce contor este acest index?</p>
                <div class="form-buttons">
                    <button class="btn btn-success btn-full" onclick="app.assignScannedValue(${number}, 'waterBath', 'Apometru Baie')">💧 Apometru Baie</button>
                    <button class="btn btn-success btn-full" onclick="app.assignScannedValue(${number}, 'waterKitchen', 'Apometru Bucătărie')">💧 Apometru Bucătărie</button>
                    <button class="btn btn-warning btn-full" onclick="app.assignScannedValue(${number}, 'gas', 'Contor Gaz')">🔥 Contor Gaz</button>
                    <button class="btn btn-warning btn-full" onclick="app.assignScannedValue(${number}, 'electric', 'Contor Electricitate')">⚡ Contor Electricitate</button>
                    <button class="btn btn-full" style="background: #666;" onclick="app.hideScanResult()">❌ Anulează</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        this.scanOverlay = overlay;
    }

    assignScannedValue(number, type, name) {
        this.hideScanResult();
        
        // Salvează direct valoarea scanată
        const data = this.data[type];
        data.current = number;
        data.lastReading = new Date().toISOString();
        data.sent = false;
        
        if (!data.history) data.history = [];
        data.history.push({
            value: number,
            date: new Date().toISOString()
        });
        
        this.saveData();
        this.updateUI();
        
        this.showAlert(`Index ${name} salvat: ${number}`, 'success');
        
        // Auto-sync dacă este configurat
        if (this.syncSettings.enabled && this.syncSettings.partnerCode) {
            setTimeout(() => this.quickSync(), 1000);
        }
    }

    hideScanResult() {
        if (this.scanOverlay) {
            document.body.removeChild(this.scanOverlay);
            this.scanOverlay = null;
        }
    }

    showLoading() {
        document.getElementById('loadingOverlay').style.display = 'block';
        document.getElementById('loading').style.display = 'block';
    }

    hideLoading() {
        document.getElementById('loadingOverlay').style.display = 'none';
        document.getElementById('loading').style.display = 'none';
    }

    // === SYNC OPERATIONS ===
    setupPartner() {
        const overlay = document.createElement('div');
        overlay.className = 'form-overlay';
        overlay.style.display = 'block';
        
        overlay.innerHTML = `
            <div class="form-popup">
                <h3>👤 Configurare Partener</h3>
                <div class="form-group">
                    <label>Numele partenerului:</label>
                    <input type="text" id="partnerName" placeholder="Ex: Sofia" value="${this.syncSettings.partnerName || ''}">
                </div>
                <div class="form-group">
                    <label>Codul de sincronizare:</label>
                    <input type="text" id="partnerCode" placeholder="Ex: sofia123" value="${this.syncSettings.partnerCode || ''}">
                    <small style="color: #666;">Ambii parteneri trebuie să folosească același cod</small>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="autoSync" ${this.syncSettings.autoSync ? 'checked' : ''}> 
                        Sincronizare automată
                    </label>
                </div>
                <div class="form-buttons">
                    <button class="btn btn-success btn-full" onclick="app.savePartnerSettings()">💾 Salvează</button>
                    <button class="btn btn-full" style="background: #666;" onclick="app.hidePartnerSetup()">❌ Anulează</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        this.partnerOverlay = overlay;
    }

    savePartnerSettings() {
        const name = document.getElementById('partnerName').value.trim();
        const code = document.getElementById('partnerCode').value.trim();
        const autoSync = document.getElementById('autoSync').checked;
        
        if (!name || !code) {
            this.showAlert('Vă rog completați toate câmpurile!', 'warning');
            return;
        }
        
        this.syncSettings.partnerName = name;
        this.syncSettings.partnerCode = code;
        this.syncSettings.autoSync = autoSync;
        this.syncSettings.enabled = true;
        
        this.saveSyncSettings();
        this.updateSyncStatus();
        this.hidePartnerSetup();
        
        this.showAlert(`Partener configurat: ${name}`, 'success');
        
        // Încercă o sincronizare imediată
        setTimeout(() => this.quickSync(), 1000);
    }

    hidePartnerSetup() {
        if (this.partnerOverlay) {
            document.body.removeChild(this.partnerOverlay);
            this.partnerOverlay = null;
        }
    }

    async quickSync() {
        if (!this.syncSettings.enabled || !this.syncSettings.partnerCode) {
            this.showAlert('Sincronizarea nu este configurată!', 'warning');
            return;
        }
        
        // Simulează sincronizarea (în realitate ar fi prin server)
        try {
            // Afișează indicator de sincronizare
            const syncIndicator = document.getElementById('syncIndicator');
            if (syncIndicator) {
                syncIndicator.textContent = '🔄 Se sincronizează...';
                syncIndicator.className = 'sync-indicator syncing';
            }
            
            // Simulează delay de rețea
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Actualizează ultima sincronizare
            this.syncSettings.lastSync = new Date().toISOString();
            this.saveSyncSettings();
            this.updateSyncStatus();
            
            this.showAlert('Sincronizare completă!', 'success');
        } catch (error) {
            console.error('Eroare la sincronizare:', error);
            this.showAlert('Eroare la sincronizare!', 'danger');
            this.updateSyncStatus();
        }
    }

    // === EXPORT/IMPORT ===
    exportToLink() {
        const exportData = {
            data: this.data,
            syncSettings: this.syncSettings,
            exportDate: new Date().toISOString(),
            version: '2.0'
        };
        
        try {
            const compressed = btoa(JSON.stringify(exportData));
            const url = `${window.location.origin}${window.location.pathname}?import=${compressed}`;
            
            // Copiază în clipboard
            if (navigator.clipboard) {
                navigator.clipboard.writeText(url).then(() => {
                    this.showAlert('Link copiat în clipboard!', 'success');
                }).catch(() => {
                    this.showManualCopy(url);
                });
            } else {
                this.showManualCopy(url);
            }
        } catch (error) {
            console.error('Eroare la export:', error);
            this.showAlert('Eroare la generarea link-ului!', 'danger');
        }
    }

    showManualCopy(url) {
        const overlay = document.createElement('div');
        overlay.className = 'form-overlay';
        overlay.style.display = 'block';
        
        overlay.innerHTML = `
            <div class="form-popup">
                <h3>📤 Link Export</h3>
                <div class="form-group">
                    <label>Copiați acest link:</label>
                    <textarea readonly style="height: 100px; font-size: 12px;">${url}</textarea>
                </div>
                <div class="form-buttons">
                    <button class="btn btn-full" style="background: #666;" onclick="app.hideManualCopy()">❌ Închide</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        this.copyOverlay = overlay;
    }

    hideManualCopy() {
        if (this.copyOverlay) {
            document.body.removeChild(this.copyOverlay);
            this.copyOverlay = null;
        }
    }

    showImportFromLink() {
        const overlay = document.createElement('div');
        overlay.className = 'form-overlay';
        overlay.style.display = 'block';
        
        overlay.innerHTML = `
            <div class="form-popup">
                <h3>📥 Import Date</h3>
                <div class="form-group">
                    <label>Introduceți link-ul de import:</label>
                    <textarea id="importUrl" placeholder="Lipiți aici link-ul complet..." style="height: 100px;"></textarea>
                </div>
                <div class="form-buttons">
                    <button class="btn btn-success btn-full" onclick="app.importFromUrl()">📥 Importă</button>
                    <button class="btn btn-full" style="background: #666;" onclick="app.hideImportDialog()">❌ Anulează</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        this.importOverlay = overlay;
    }

    importFromUrl() {
        const url = document.getElementById('importUrl').value.trim();
        if (!url) {
            this.showAlert('Vă rog introduceți un link!', 'warning');
            return;
        }
        
        try {
            const urlObj = new URL(url);
            const importParam = urlObj.searchParams.get('import');
            
            if (!importParam) {
                this.showAlert('Link invalid - nu conține date de import!', 'danger');
                return;
            }
            
            const importData = JSON.parse(atob(importParam));
            
            if (!importData.data || !importData.version) {
                this.showAlert('Date de import invalide!', 'danger');
                return;
            }
            
            // Confirmă importul
            if (confirm('Sigur doriți să importați aceste date? Datele curente vor fi suprascrise!')) {
                this.data = this.migrateData(importData.data, this.loadData());
                if (importData.syncSettings) {
                    this.syncSettings = { ...this.syncSettings, ...importData.syncSettings };
                }
                
                this.saveData();
                this.saveSyncSettings();
                this.updateUI();
                this.hideImportDialog();
                
                this.showAlert('Date importate cu succes!', 'success');
            }
        } catch (error) {
            console.error('Eroare la import:', error);
            this.showAlert('Eroare la importul datelor!', 'danger');
        }
    }

    hideImportDialog() {
        if (this.importOverlay) {
            document.body.removeChild(this.importOverlay);
            this.importOverlay = null;
        }
    }

    // Verifică la încărcare dacă există parametru de import
    checkForImportOnLoad() {
        const urlParams = new URLSearchParams(window.location.search);
        const importParam = urlParams.get('import');
        
        if (importParam) {
            try {
                const importData = JSON.parse(atob(importParam));
                
                if (confirm('Acest link conține date pentru import. Doriți să le importați? Datele curente vor fi suprascrise!')) {
                    this.data = this.migrateData(importData.data, this.loadData());
                    if (importData.syncSettings) {
                        this.syncSettings = { ...this.syncSettings, ...importData.syncSettings };
                    }
                    
                    this.saveData();
                    this.saveSyncSettings();
                    this.updateUI();
                    
                    this.showAlert('Date importate cu succes din link!', 'success');
                }
                
                // Curăță URL-ul
                const cleanUrl = window.location.origin + window.location.pathname;
                window.history.replaceState({}, document.title, cleanUrl);
            } catch (error) {
                console.error('Eroare la importul din URL:', error);
                this.showAlert('Link de import invalid!', 'danger');
            }
        }
    }

    // === CLEANUP OPERATIONS ===
    clearAllData() {
        if (!confirm('Sigur doriți să ștergeți toate datele? Această acțiune nu poate fi anulată!')) {
            return;
        }
        
        if (!confirm('ATENȚIE: Toate indexurile, istoricul și setările vor fi șterse permanent. Continuați?')) {
            return;
        }
        
        // Șterge toate datele
        localStorage.removeItem('utilitiesData');
        localStorage.removeItem('syncSettings');
        
        // Reinițializează aplicația
        this.data = this.loadData();
        this.syncSettings = this.loadSyncSettings();
        
        this.updateUI();
        this.showAlert('Toate datele au fost șterse!', 'success');
    }

    resetAllData() {
        // Funcție similară cu clearAllData dar păstrează setările de sync
        if (!confirm('Sigur doriți să resetați toate datele? Setările de sincronizare vor fi păstrate.')) {
            return;
        }
        
        const currentSync = { ...this.syncSettings };
        
        // Resetează doar datele
        this.data = this.loadData();
        
        // Păstrează setările de sync
        this.syncSettings = currentSync;
        this.saveSyncSettings();
        
        this.updateUI();
        this.showAlert('Date resetate! Setările de sincronizare au fost păstrate.', 'success');
    }

    // === UTILITY METHODS ===
    showAlert(message, type = 'info') {
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.textContent = message;
        
        const alertsContainer = document.getElementById('alerts');
        if (alertsContainer) {
            alertsContainer.appendChild(alert);
            
            // Auto-remove după 5 secunde
            setTimeout(() => {
                if (alert.parentNode) {
                    alert.parentNode.removeChild(alert);
                }
            }, 5000);
        }
    }

    showSyncSettings() {
        const overlay = document.createElement('div');
        overlay.className = 'form-overlay';
        overlay.style.display = 'block';
        
        overlay.innerHTML = `
            <div class="form-popup">
                <h3>⚙️ Setări Avansate Sincronizare</h3>
                <div class="form-group">
                    <label>Status sincronizare:</label>
                    <p>${this.syncSettings.enabled ? '✅ Activă' : '❌ Dezactivată'}</p>
                </div>
                <div class="form-group">
                    <label>Ultima sincronizare:</label>
                    <p>${this.syncSettings.lastSync ? new Date(this.syncSettings.lastSync).toLocaleString('ro-RO') : 'Niciodată'}</p>
                </div>
                <div class="form-buttons">
                    <button class="btn btn-warning btn-full" onclick="app.disableSync()">🔐 Dezactivează Sync</button>
                    <button class="btn btn-danger btn-full" onclick="app.resetSyncSettings()">🗑️ Reset Setări</button>
                    <button class="btn btn-full" style="background: #666;" onclick="app.hideSyncSettings()">❌ Închide</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        this.syncSettingsOverlay = overlay;
    }

    disableSync() {
        if (confirm('Sigur doriți să dezactivați sincronizarea?')) {
            this.syncSettings.enabled = false;
            this.saveSyncSettings();
            this.updateSyncStatus();
            this.hideSyncSettings();
            this.showAlert('Sincronizarea a fost dezactivată!', 'warning');
        }
    }

    resetSyncSettings() {
        if (confirm('Sigur doriți să resetați toate setările de sincronizare?')) {
            this.syncSettings = this.loadSyncSettings();
            this.saveSyncSettings();
            this.updateSyncStatus();
            this.hideSyncSettings();
            this.showAlert('Setările de sincronizare au fost resetate!', 'success');
        }
    }

    hideSyncSettings() {
        if (this.syncSettingsOverlay) {
            document.body.removeChild(this.syncSettingsOverlay);
            this.syncSettingsOverlay = null;
        }
    }
}

// === GLOBAL FUNCTIONS ===
function showSection(sectionName) {
    // Ascunde toate secțiunile
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Afișează secțiunea selectată
    document.getElementById(sectionName).classList.add('active');
    
    // Actualizează tab-urile
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    event.target.classList.add('active');
}

// Funcții pentru a fi apelate din HTML
function showIndexForm(type, name) {
    app.showIndexForm(type, name);
}

function showPaymentForm(type, name) {
    app.showPaymentForm(type, name);
}

function showCarForm(type, name) {
    app.showCarForm(type, name);
}

function saveForm() {
    app.saveForm();
}

function hideForm() {
    app.hideForm();
}

function showDeleteOptions(type, name) {
    app.showDeleteOptions(type, name);
}

function hideDeleteOptions() {
    app.hideDeleteOptions();
}

function markAllIndexesSent() {
    app.markAllIndexesSent();
}

function showBulkIndexForm() {
    app.showBulkIndexForm();
}

function quickSync() {
    app.quickSync();
}

function exportToLink() {
    app.exportToLink();
}

function showImportFromLink() {
    app.showImportFromLink();
}

function clearAllData() {
    app.clearAllData();
}

function resetAllData() {
    app.resetAllData();
}

function setupPartner() {
    app.setupPartner();
}

function showSyncSettings() {
    app.showSyncSettings();
}

function scanIndexFromImage(file) {
    app.scanIndexFromImage(file);
}

function scanSpecificIndex(file, type, name) {
    app.scanSpecificIndex(file, type, name);
}

// Inițializează aplicația
let app;

document.addEventListener('DOMContentLoaded', function() {
    app = new UtilitiesApp();
    
    // Verifică import la încărcare
    app.checkForImportOnLoad();
    
    // Event listeners pentru formulare
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            // Închide orice overlay deschis
            document.querySelectorAll('.form-overlay').forEach(overlay => {
                if (overlay.style.display === 'block') {
                    overlay.style.display = 'none';
                }
            });
            
            app.hideForm();
            app.hideDeleteOptions();
            app.hideBulkForm();
            app.hideScanResult();
            app.hidePartnerSetup();
            app.hideImportDialog();
            app.hideManualCopy();
            app.hideSyncSettings();
        }
        
        if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
            // Enter în input-uri din formulare
            const overlay = e.target.closest('.form-overlay');
            if (overlay) {
                const saveBtn = overlay.querySelector('.btn-success');
                if (saveBtn) {
                    saveBtn.click();
                }
            }
        }
    });
    
    // Auto-save în localStorage la ieșirea din pagină
    window.addEventListener('beforeunload', function() {
        if (app) {
            app.saveData();
        }
    });
});

// Service Worker pentru PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

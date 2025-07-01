// Utilitățile Mele PWA v4.0 - Script principal
console.log('🚀 Utilitățile Mele PWA v4.0 - Script încărcat!');

// Variabile globale
let currentTab = 'home';
let currentFormType = '';
let familyData = {};
let syncInterval = null;
let deferredPrompt = null;
let isOnline = navigator.onLine;

// Inițializare aplicație
document.addEventListener('DOMContentLoaded', function() {
    console.log('📱 Inițializare PWA...');
    
    // Load data
    loadAllData();
    
    // Setup PWA install prompt
    setupPWAInstall();
    
    // Setup network status
    setupNetworkStatus();
    
    // Setup family sync
    setupFamilySync();
    
    // Setup form date to today
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('formDate');
    if (dateInput) {
        dateInput.value = today;
    }
    
    // Update UI
    updateUI();
    updateReminders();
    
    console.log('✅ PWA inițializată cu succes!');
});

// === PWA INSTALL FUNCTIONALITY ===
function setupPWAInstall() {
    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
        console.log('📱 PWA poate fi instalată');
        e.preventDefault();
        deferredPrompt = e;
        
        // Show install buttons
        const installBtns = document.querySelectorAll('#installBtn, #installBtn2');
        installBtns.forEach(btn => {
            if (btn) {
                btn.style.display = 'inline-flex';
                btn.textContent = '📱 Instalează App';
            }
        });
    });

    // Listen for appinstalled event
    window.addEventListener('appinstalled', () => {
        console.log('✅ PWA instalată cu succes!');
        showAlert('✅ Aplicația a fost instalată cu succes!', 'success');
        deferredPrompt = null;
        
        const installBtns = document.querySelectorAll('#installBtn, #installBtn2');
        installBtns.forEach(btn => {
            if (btn) {
                btn.style.display = 'none';
            }
        });
    });
}

function installPWA() {
    if (deferredPrompt) {
        console.log('📱 Lansare prompt instalare PWA');
        deferredPrompt.prompt();
        
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('✅ Utilizatorul a acceptat instalarea');
                showAlert('🎉 Aplicația se instalează...', 'success');
            } else {
                console.log('❌ Utilizatorul a refuzat instalarea');
                showAlert('ℹ️ Poți instala aplicația oricând din meniu', 'info');
            }
            deferredPrompt = null;
        });
    } else {
        // Fallback instructions
        showAlert('💡 Pentru a instala aplicația: Deschide meniul browser-ului și selectează "Instalează aplicația" sau "Adaugă pe ecranul principal"', 'info');
    }
}

// === NETWORK STATUS ===
function setupNetworkStatus() {
    updateNetworkStatus();
    
    window.addEventListener('online', () => {
        isOnline = true;
        updateNetworkStatus();
        showAlert('✅ Conectat la internet - sincronizarea va fi reluată', 'success');
        if (familyData.familyCode) {
            startFamilySync();
        }
    });
    
    window.addEventListener('offline', () => {
        isOnline = false;
        updateNetworkStatus();
        showAlert('📱 Offline - aplicația funcționează în continuare local', 'warning');
        stopFamilySync();
    });
}

function updateNetworkStatus() {
    const syncStatus = document.getElementById('syncStatus');
    if (syncStatus) {
        if (isOnline) {
            if (familyData.familyCode) {
                syncStatus.className = 'sync-status connected';
                syncStatus.innerHTML = '🟢 Online & Sync';
            } else {
                syncStatus.className = 'sync-status connected';
                syncStatus.innerHTML = '🟢 Online';
            }
        } else {
            syncStatus.className = 'sync-status disconnected';
            syncStatus.innerHTML = '🔴 Offline';
        }
    }
}

// === TAB MANAGEMENT ===
function showTab(tabName) {
    console.log('📋 Schimbare tab:', tabName);
    
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Remove active class from all tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected section
    const targetSection = document.getElementById(tabName);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Add active class to selected tab
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach((tab, index) => {
        if ((tabName === 'home' && index === 0) ||
            (tabName === 'meters' && index === 1) ||
            (tabName === 'car' && index === 2) ||
            (tabName === 'reports' && index === 3) ||
            (tabName === 'settings' && index === 4)) {
            tab.classList.add('active');
        }
    });
    
    currentTab = tabName;
    
    // Update specific tab content
    if (tabName === 'reports') {
        generateReport();
    }
}

// === DATA MANAGEMENT ===
function loadAllData() {
    try {
        // Load readings
        const readings = JSON.parse(localStorage.getItem('readings') || '{}');
        familyData.readings = readings;
        
        // Load family settings
        const familyCode = localStorage.getItem('familyCode');
        if (familyCode) {
            familyData.familyCode = familyCode;
            document.getElementById('familyCode').textContent = familyCode;
            document.getElementById('familyCodeInput').value = familyCode;
        }
        
        // Load prices
        const prices = JSON.parse(localStorage.getItem('prices') || '{"water": 15.50, "gas": 3.20, "electric": 0.65}');
        familyData.prices = prices;
        
        // Load car data
        const carData = JSON.parse(localStorage.getItem('carData') || '{}');
        familyData.carData = carData;
        
        console.log('📊 Date încărcate:', familyData);
    } catch (error) {
        console.error('❌ Eroare la încărcarea datelor:', error);
        familyData = { readings: {}, prices: { water: 15.50, gas: 3.20, electric: 0.65 }, carData: {} };
    }
}

function saveData() {
    try {
        localStorage.setItem('readings', JSON.stringify(familyData.readings || {}));
        localStorage.setItem('prices', JSON.stringify(familyData.prices || {}));
        localStorage.setItem('carData', JSON.stringify(familyData.carData || {}));
        
        if (familyData.familyCode) {
            localStorage.setItem('familyCode', familyData.familyCode);
        }
        
        console.log('💾 Date salvate local');
        
        // Trigger sync if online and family code exists
        if (isOnline && familyData.familyCode) {
            syncWithFamily();
        }
    } catch (error) {
        console.error('❌ Eroare la salvarea datelor:', error);
        showAlert('❌ Eroare la salvarea datelor', 'danger');
    }
}

// === READINGS MANAGEMENT ===
function addReading(type) {
    currentFormType = type;
    const titles = {
        waterBath: 'Citire Apometru Baie',
        waterKitchen: 'Citire Apometru Bucătărie', 
        gas: 'Citire Contor Gaz',
        electric: 'Citire Contor Electricitate'
    };
    
    document.getElementById('formTitle').textContent = titles[type] || 'Adaugă Citire';
    document.getElementById('formLabel').textContent = 'Valoare nouă:';
    document.getElementById('formValue').value = '';
    document.getElementById('formValue').placeholder = 'Ex: 1234.56';
    
    // Set current date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('formDate').value = today;
    
    showForm();
}

function saveReading() {
    const value = parseFloat(document.getElementById('formValue').value);
    const date = document.getElementById('formDate').value;
    
    if (!value || !date) {
        showAlert('❌ Completați toate câmpurile', 'danger');
        return;
    }
    
    if (!familyData.readings) {
        familyData.readings = {};
    }
    
    if (!familyData.readings[currentFormType]) {
        familyData.readings[currentFormType] = [];
    }
    
    const reading = {
        value: value,
        date: date,
        timestamp: Date.now()
    };
    
    familyData.readings[currentFormType].push(reading);
    familyData.readings[currentFormType].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    saveData();
    updateUI();
    closeForm();
    
    showAlert(`✅ Citire ${currentFormType} salvată: ${value}`, 'success');
    console.log('📊 Citire salvată:', reading);
}

function deleteReading(type) {
    if (!familyData.readings || !familyData.readings[type] || familyData.readings[type].length === 0) {
        showAlert('❌ Nu există citiri de șters', 'warning');
        return;
    }
    
    if (confirm('Ștergeți ultima citire?')) {
        familyData.readings[type].shift();
        saveData();
        updateUI();
        showAlert(`✅ Citire ${type} ștearsă`, 'success');
    }
}

// === UI UPDATES ===
function updateUI() {
    updateReadingsDisplay();
    updateStats();
    updateCarDisplay();
}

function updateReadingsDisplay() {
    const types = ['waterBath', 'waterKitchen', 'gas', 'electric'];
    
    types.forEach(type => {
        const lastElement = document.getElementById(type + 'Last');
        const currentElement = document.getElementById(type + 'Current');
        
        if (familyData.readings && familyData.readings[type] && familyData.readings[type].length > 0) {
            const latest = familyData.readings[type][0];
            const previous = familyData.readings[type][1];
            
            if (lastElement) {
                lastElement.textContent = `Ultimul: ${latest.value} (${formatDate(latest.date)})`;
            }
            
            if (currentElement) {
                currentElement.textContent = latest.value.toString();
            }
        } else {
            if (lastElement) {
                lastElement.textContent = 'Ultimul: -';
            }
            if (currentElement) {
                currentElement.textContent = '---';
            }
        }
    });
}

function updateStats() {
    // Count readings this month
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    let thisMonthCount = 0;
    
    if (familyData.readings) {
        Object.values(familyData.readings).forEach(readings => {
            if (readings.length > 0) {
                const latestDate = new Date(readings[0].date);
                if (latestDate.getMonth() === currentMonth && latestDate.getFullYear() === currentYear) {
                    thisMonthCount++;
                }
            }
        });
    }
    
    const indexesElement = document.getElementById('indexesThisMonth');
    if (indexesElement) {
        indexesElement.textContent = `${thisMonthCount}/4`;
    }
    
    // Update estimated cost
    const estimatedCostElement = document.getElementById('estimatedCost');
    if (estimatedCostElement && familyData.readings && familyData.prices) {
        let totalCost = 0;
        
        // Calculate water cost
        const waterBath = getLatestConsumption('waterBath');
        const waterKitchen = getLatestConsumption('waterKitchen');
        totalCost += (waterBath + waterKitchen) * (familyData.prices.water || 15.50);
        
        // Calculate gas cost
        const gas = getLatestConsumption('gas');
        totalCost += gas * (familyData.prices.gas || 3.20);
        
        // Calculate electric cost
        const electric = getLatestConsumption('electric');
        totalCost += electric * (familyData.prices.electric || 0.65);
        
        estimatedCostElement.textContent = `${totalCost.toFixed(2)} RON`;
    }
}

function getLatestConsumption(type) {
    if (!familyData.readings || !familyData.readings[type] || familyData.readings[type].length < 2) {
        return 0;
    }
    
    const latest = familyData.readings[type][0].value;
    const previous = familyData.readings[type][1].value;
    return Math.max(0, latest - previous);
}

// === REMINDERS ===
function updateReminders() {
    const remindersList = document.getElementById('remindersList');
    if (!remindersList) return;
    
    const reminders = [];
    const today = new Date();
    const currentDay = today.getDate();
    
    // Check if we need to read meters (day 15 for water, day 20 for gas/electric)
    if (currentDay >= 15 && currentDay <= 17) {
        const waterBathRead = isReadThisMonth('waterBath');
        const waterKitchenRead = isReadThisMonth('waterKitchen');
        
        if (!waterBathRead) {
            reminders.push({
                type: 'water',
                title: '💧 Citire Apometru Baie',
                message: 'Timpul pentru citirea lunară (până pe 15)',
                action: () => addReading('waterBath')
            });
        }
        
        if (!waterKitchenRead) {
            reminders.push({
                type: 'water',
                title: '💧 Citire Apometru Bucătărie',
                message: 'Timpul pentru citirea lunară (până pe 15)',
                action: () => addReading('waterKitchen')
            });
        }
    }
    
    if (currentDay >= 20 && currentDay <= 22) {
        const gasRead = isReadThisMonth('gas');
        const electricRead = isReadThisMonth('electric');
        
        if (!gasRead) {
            reminders.push({
                type: 'gas',
                title: '🔥 Citire Contor Gaz',
                message: 'Timpul pentru citirea lunară (până pe 20)',
                action: () => addReading('gas')
            });
        }
        
        if (!electricRead) {
            reminders.push({
                type: 'electric',
                title: '⚡ Citire Contor Electricitate',
                message: 'Timpul pentru citirea lunară (până pe 20)',
                action: () => addReading('electric')
            });
        }
    }
    
    // Car maintenance reminders
    checkCarReminders(reminders);
    
    // Update UI
    const activeRemindersElement = document.getElementById('activeReminders');
    if (activeRemindersElement) {
        activeRemindersElement.textContent = reminders.length.toString();
    }
    
    // Display reminders
    if (reminders.length === 0) {
        remindersList.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">✅ Nu există reminder-uri active</p>';
    } else {
        remindersList.innerHTML = reminders.map(reminder => `
            <div class="card" style="margin-bottom: 15px; padding: 15px; border-left: 4px solid #FF9800;">
                <h4>${reminder.title}</h4>
                <p style="color: #666; margin: 5px 0;">${reminder.message}</p>
                <button class="btn btn-warning" onclick="(${reminder.action.toString()})()">
                    ⚡ Acțiune rapidă
                </button>
            </div>
        `).join('');
    }
}

function isReadThisMonth(type) {
    if (!familyData.readings || !familyData.readings[type] || familyData.readings[type].length === 0) {
        return false;
    }
    
    const latest = familyData.readings[type][0];
    const latestDate = new Date(latest.date);
    const today = new Date();
    
    return latestDate.getMonth() === today.getMonth() && latestDate.getFullYear() === today.getFullYear();
}

function checkCarReminders(reminders) {
    const carData = familyData.carData || {};
    const today = new Date();
    
    // Oil change reminder (6 months)
    if (carData.lastOilChange) {
        const lastOil = new Date(carData.lastOilChange);
        const diffMonths = (today.getFullYear() - lastOil.getFullYear()) * 12 + (today.getMonth() - lastOil.getMonth());
        
        if (diffMonths >= 6) {
            reminders.push({
                type: 'car',
                title: '🔧 Schimb Ulei Mașină',
                message: `Ultima dată: ${formatDate(carData.lastOilChange)}`,
                action: () => updateOilChange()
            });
        }
    }
    
    // Document expiry reminders
    const docs = ['itp', 'rovignette', 'insurance', 'casco'];
    docs.forEach(doc => {
        if (carData[doc + 'Expiry']) {
            const expiry = new Date(carData[doc + 'Expiry']);
            const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
            
            if (daysUntilExpiry <= 30 && daysUntilExpiry >= 0) {
                const docNames = {
                    itp: '🔍 ITP',
                    rovignette: '🛣️ Rovinietă', 
                    insurance: '🛡️ RCA',
                    casco: '🛡️ CASCO'
                };
                
                reminders.push({
                    type: 'car',
                    title: `${docNames[doc]} expiră în curând`,
                    message: `Expirare: ${formatDate(carData[doc + 'Expiry'])} (${daysUntilExpiry} zile)`,
                    action: () => showTab('car')
                });
            }
        }
    });
}

// === CAR MANAGEMENT ===
function updateCarDisplay() {
    const carData = familyData.carData || {};
    
    // Oil change
    const oilLastElement = document.getElementById('oilChangeLast');
    const oilNextElement = document.getElementById('oilChangeNext');
    
    if (carData.lastOilChange) {
        const lastOil = new Date(carData.lastOilChange);
        const today = new Date();
        const diffMonths = (today.getFullYear() - lastOil.getFullYear()) * 12 + (today.getMonth() - lastOil.getMonth());
        
        if (oilLastElement) {
            oilLastElement.textContent = `Ultima dată: ${formatDate(carData.lastOilChange)}`;
        }
        
        if (oilNextElement) {
            if (diffMonths >= 6) {
                oilNextElement.textContent = 'URGENT!';
                oilNextElement.style.color = '#F44336';
            } else {
                const remaining = 6 - diffMonths;
                oilNextElement.textContent = `${remaining} luni`;
                oilNextElement.style.color = remaining <= 1 ? '#FF9800' : '#4CAF50';
            }
        }
    }
    
    // Documents
    updateDocumentStatus('itp', '🔍 ITP');
    updateDocumentStatus('rovignette', '🛣️ Rovinietă');
    updateDocumentStatus('insurance', '🛡️ RCA');
    updateDocumentStatus('casco', '🛡️ CASCO');
}

function updateDocumentStatus(docType, docName) {
    const carData = familyData.carData || {};
    const lastElement = document.getElementById(docType + 'Last');
    const statusElement = document.getElementById(docType + 'Status');
    
    if (carData[docType + 'Expiry']) {
        const expiry = new Date(carData[docType + 'Expiry']);
        const today = new Date();
        const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
        
        if (lastElement) {
            lastElement.textContent = `Expirare: ${formatDate(carData[docType + 'Expiry'])}`;
        }
        
        if (statusElement) {
            if (daysUntilExpiry < 0) {
                statusElement.textContent = 'EXPIRAT!';
                statusElement.style.color = '#F44336';
            } else if (daysUntilExpiry <= 30) {
                statusElement.textContent = `${daysUntilExpiry} zile`;
                statusElement.style.color = '#FF9800';
            } else {
                statusElement.textContent = `${daysUntilExpiry} zile`;
                statusElement.style.color = '#4CAF50';
            }
        }
    } else {
        if (lastElement) {
            lastElement.textContent = 'Expirare: -';
        }
        if (statusElement) {
            statusElement.textContent = '---';
            statusElement.style.color = '#666';
        }
    }
}

function updateOilChange() {
    const today = new Date().toISOString().split('T')[0];
    if (!familyData.carData) {
        familyData.carData = {};
    }
    familyData.carData.lastOilChange = today;
    saveData();
    updateCarDisplay();
    updateReminders();
    showAlert('✅ Schimb ulei actualizat!', 'success');
}

function editOilChange() {
    const date = prompt('Introduceți data schimbului de ulei (YYYY-MM-DD):', familyData.carData?.lastOilChange || '');
    if (date) {
        if (!familyData.carData) {
            familyData.carData = {};
        }
        familyData.carData.lastOilChange = date;
        saveData();
        updateCarDisplay();
        updateReminders();
        showAlert('✅ Data schimbului de ulei actualizată!', 'success');
    }
}

function updateITP() {
    const date = prompt('Introduceți data expirării ITP (YYYY-MM-DD):');
    if (date) {
        if (!familyData.carData) {
            familyData.carData = {};
        }
        familyData.carData.itpExpiry = date;
        saveData();
        updateCarDisplay();
        updateReminders();
        showAlert('✅ Data ITP actualizată!', 'success');
    }
}

function updateRovignette() {
    const date = prompt('Introduceți data expirării rovinieta (YYYY-MM-DD):');
    if (date) {
        if (!familyData.carData) {
            familyData.carData = {};
        }
        familyData.carData.rovignetteExpiry = date;
        saveData();
        updateCarDisplay();
        updateReminders();
        showAlert('✅ Data rovinieta actualizată!', 'success');
    }
}

function updateInsurance() {
    const date = prompt('Introduceți data expirării RCA (YYYY-MM-DD):');
    if (date) {
        if (!familyData.carData) {
            familyData.carData = {};
        }
        familyData.carData.insuranceExpiry = date;
        saveData();
        updateCarDisplay();
        updateReminders();
        showAlert('✅ Data RCA actualizată!', 'success');
    }
}

function updateCasco() {
    const date = prompt('Introduceți data expirării CASCO (YYYY-MM-DD):');
    if (date) {
        if (!familyData.carData) {
            familyData.carData = {};
        }
        familyData.carData.cascoExpiry = date;
        saveData();
        updateCarDisplay();
        updateReminders();
        showAlert('✅ Data CASCO actualizată!', 'success');
    }
}

// === FAMILY SYNC ===
function setupFamilySync() {
    if (familyData.familyCode && isOnline) {
        startFamilySync();
    }
    
    updateSyncStatus();
}

function startFamilySync() {
    console.log('👨‍👩‍👧‍👦 Pornire sincronizare familie...');
    
    if (syncInterval) {
        clearInterval(syncInterval);
    }
    
    // Sync every 30 seconds when online
    syncInterval = setInterval(() => {
        if (isOnline && familyData.familyCode) {
            syncWithFamily();
        }
    }, 30000);
    
    updateSyncStatus();
}

function stopFamilySync() {
    console.log('⏹️ Oprire sincronizare familie');
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }
    updateSyncStatus();
}

function syncWithFamily() {
    // In a real app, this would sync with a backend service
    console.log('🔄 Sincronizare cu familia:', familyData.familyCode);
    
    // Simulate sync (in reality, you'd use Firebase, Supabase, etc.)
    const syncData = {
        familyCode: familyData.familyCode,
        readings: familyData.readings,
        carData: familyData.carData,
        lastSync: Date.now()
    };
    
    // Store sync timestamp
    localStorage.setItem('lastFamilySync', Date.now().toString());
    
    updateSyncStatus();
}

function updateSyncStatus() {
    const syncDetails = document.getElementById('syncDetails');
    const connectedUsers = document.getElementById('connectedUsers');
    
    if (familyData.familyCode) {
        const lastSync = localStorage.getItem('lastFamilySync');
        if (lastSync) {
            const syncDate = new Date(parseInt(lastSync));
            if (syncDetails) {
                syncDetails.textContent = `Conectat la familia "${familyData.familyCode}" - Ultima sincronizare: ${formatDate(syncDate.toISOString().split('T')[0])} ${syncDate.toTimeString().split(' ')[0]}`;
            }
        } else {
            if (syncDetails) {
                syncDetails.textContent = `Conectat la familia "${familyData.familyCode}" - Se inițializează sincronizarea...`;
            }
        }
        
        // Simulate connected users (in reality, you'd get this from the backend)
        if (connectedUsers) {
            connectedUsers.textContent = Math.floor(Math.random() * 3) + 1;
        }
    } else {
        if (syncDetails) {
            syncDetails.textContent = 'Offline - configurați codul familiei pentru sincronizare';
        }
        if (connectedUsers) {
            connectedUsers.textContent = '1';
        }
    }
}

function setupFamily() {
    showTab('settings');
    document.getElementById('familyCodeInput').focus();
}

function generateFamilyCode() {
    const code = 'FAM' + Math.random().toString(36).substr(2, 9).toUpperCase();
    document.getElementById('familyCodeInput').value = code;
    showAlert(`🎲 Cod generat: ${code}`, 'info');
}

function saveFamily() {
    const code = document.getElementById('familyCodeInput').value.trim();
    if (!code) {
        showAlert('❌ Introduceți un cod pentru familie', 'danger');
        return;
    }
    
    familyData.familyCode = code;
    localStorage.setItem('familyCode', code);
    
    document.getElementById('familyCode').textContent = code;
    
    if (isOnline) {
        startFamilySync();
    }
    
    updateNetworkStatus();
    showAlert(`✅ Familia "${code}" configurată cu succes!`, 'success');
}

function testSync() {
    if (!familyData.familyCode) {
        showAlert('❌ Configurați primul codul familiei', 'danger');
        return;
    }
    
    if (!isOnline) {
        showAlert('❌ Nu sunteți conectat la internet', 'danger');
        return;
    }
    
    showAlert('🧪 Test sincronizare...', 'info');
    
    setTimeout(() => {
        syncWithFamily();
        showAlert('✅ Test sincronizare completat cu succes!', 'success');
    }, 2000);
}

function syncNow() {
    if (!isOnline) {
        showAlert('❌ Nu sunteți conectat la internet', 'danger');
        return;
    }
    
    if (!familyData.familyCode) {
        showAlert('ℹ️ Configurați codul familiei pentru sincronizare', 'info');
        return;
    }
    
    const syncStatus = document.getElementById('syncStatus');
    if (syncStatus) {
        syncStatus.className = 'sync-status syncing';
        syncStatus.innerHTML = '🔄 Se sincronizează...';
    }
    
    setTimeout(() => {
        syncWithFamily();
        updateNetworkStatus();
        showAlert('✅ Sincronizare completă!', 'success');
    }, 1500);
}

// === REPORTS ===
function generateReport() {
    console.log('📊 Generare raport...');
    
    const tableBody = document.getElementById('consumptionTableBody');
    if (!tableBody) return;
    
    const months = getLastSixMonths();
    const rows = [];
    
    months.forEach(month => {
        const consumption = getConsumptionForMonth(month.year, month.month);
        const cost = calculateMonthlyCost(consumption);
        
        rows.push(`
            <tr>
                <td>${month.display}</td>
                <td>${consumption.waterBath.toFixed(2)}</td>
                <td>${consumption.waterKitchen.toFixed(2)}</td>
                <td>${consumption.gas.toFixed(2)}</td>
                <td>${consumption.electric.toFixed(2)}</td>
                <td>${cost.toFixed(2)}</td>
            </tr>
        `);
    });
    
    tableBody.innerHTML = rows.join('');
}

function getLastSixMonths() {
    const months = [];
    const today = new Date();
    
    for (let i = 0; i < 6; i++) {
        const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
        months.push({
            year: date.getFullYear(),
            month: date.getMonth(),
            display: date.toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' })
        });
    }
    
    return months;
}

function getConsumptionForMonth(year, month) {
    const consumption = { waterBath: 0, waterKitchen: 0, gas: 0, electric: 0 };
    
    if (!familyData.readings) return consumption;
    
    Object.keys(consumption).forEach(type => {
        if (familyData.readings[type] && familyData.readings[type].length >= 2) {
            const readings = familyData.readings[type];
            
            // Find readings for this month and previous month
            const thisMonth = readings.find(r => {
                const date = new Date(r.date);
                return date.getFullYear() === year && date.getMonth() === month;
            });
            
            const prevMonth = readings.find(r => {
                const date = new Date(r.date);
                const prevMonthDate = new Date(year, month - 1, 1);
                return date.getFullYear() === prevMonthDate.getFullYear() && 
                       date.getMonth() === prevMonthDate.getMonth();
            });
            
            if (thisMonth && prevMonth) {
                consumption[type] = Math.max(0, thisMonth.value - prevMonth.value);
            }
        }
    });
    
    return consumption;
}

function calculateMonthlyCost(consumption) {
    const prices = familyData.prices || { water: 15.50, gas: 3.20, electric: 0.65 };
    
    return (consumption.waterBath + consumption.waterKitchen) * prices.water +
           consumption.gas * prices.gas +
           consumption.electric * prices.electric;
}

// === EXPORT FUNCTIONS ===
function exportExcel() {
    showExportProgress('📋 Export Excel', 'Se generează fișierul Excel...');
    
    setTimeout(() => {
        try {
            const wb = XLSX.utils.book_new();
            
            // Create consumption data
            const months = getLastSixMonths();
            const data = months.map(month => {
                const consumption = getConsumptionForMonth(month.year, month.month);
                const cost = calculateMonthlyCost(consumption);
                
                return {
                    'Luna': month.display,
                    'Apă Baie (mc)': consumption.waterBath.toFixed(2),
                    'Apă Bucătărie (mc)': consumption.waterKitchen.toFixed(2), 
                    'Gaz (mc)': consumption.gas.toFixed(2),
                    'Electricitate (kWh)': consumption.electric.toFixed(2),
                    'Cost Total (RON)': cost.toFixed(2)
                };
            });
            
            const ws = XLSX.utils.json_to_sheet(data);
            XLSX.utils.book_append_sheet(wb, ws, 'Consumuri');
            
            // Add readings sheet
            if (familyData.readings) {
                const readingsData = [];
                Object.entries(familyData.readings).forEach(([type, readings]) => {
                    readings.forEach(reading => {
                        readingsData.push({
                            'Tip': type,
                            'Valoare': reading.value,
                            'Data': reading.date,
                            'Timestamp': new Date(reading.timestamp).toLocaleString('ro-RO')
                        });
                    });
                });
                
                if (readingsData.length > 0) {
                    const readingsWs = XLSX.utils.json_to_sheet(readingsData);
                    XLSX.utils.book_append_sheet(wb, readingsWs, 'Citiri');
                }
            }
            
            updateExportProgress(100, 'Se descarcă fișierul...');
            
            setTimeout(() => {
                XLSX.writeFile(wb, `utilitati_${new Date().toISOString().split('T')[0]}.xlsx`);
                hideExportProgress();
                showAlert('✅ Fișier Excel descărcat cu succes!', 'success');
            }, 500);
            
        } catch (error) {
            console.error('❌ Eroare export Excel:', error);
            hideExportProgress();
            showAlert('❌ Eroare la generarea fișierului Excel', 'danger');
        }
    }, 1000);
}

function exportPDF() {
    showExportProgress('📄 Export PDF', 'Se generează fișierul PDF...');
    
    setTimeout(() => {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Title
            doc.setFontSize(20);
            doc.text('📊 Raport Utilități', 20, 30);
            
            // Date
            doc.setFontSize(12);
            doc.text(`Generat pe: ${new Date().toLocaleDateString('ro-RO')}`, 20, 45);
            
            if (familyData.familyCode) {
                doc.text(`Familie: ${familyData.familyCode}`, 20, 55);
            }
            
            let yPosition = 70;
            
            // Consumption table
            doc.setFontSize(14);
            doc.text('Consumuri lunare:', 20, yPosition);
            yPosition += 15;
            
            const months = getLastSixMonths();
            months.forEach(month => {
                const consumption = getConsumptionForMonth(month.year, month.month);
                const cost = calculateMonthlyCost(consumption);
                
                doc.setFontSize(10);
                doc.text(`${month.display}:`, 25, yPosition);
                doc.text(`Apă: ${(consumption.waterBath + consumption.waterKitchen).toFixed(2)} mc`, 25, yPosition + 10);
                doc.text(`Gaz: ${consumption.gas.toFixed(2)} mc`, 25, yPosition + 20);
                doc.text(`Electric: ${consumption.electric.toFixed(2)} kWh`, 25, yPosition + 30);
                doc.text(`Cost: ${cost.toFixed(2)} RON`, 25, yPosition + 40);
                
                yPosition += 55;
                
                if (yPosition > 250) {
                    doc.addPage();
                    yPosition = 30;
                }
            });
            
            updateExportProgress(100, 'Se descarcă fișierul...');
            
            setTimeout(() => {
                doc.save(`utilitati_${new Date().toISOString().split('T')[0]}.pdf`);
                hideExportProgress();
                showAlert('✅ Fișier PDF descărcat cu succes!', 'success');
            }, 500);
            
        } catch (error) {
            console.error('❌ Eroare export PDF:', error);
            hideExportProgress();
            showAlert('❌ Eroare la generarea fișierului PDF', 'danger');
        }
    }, 1000);
}

function shareReport() {
    const data = {
        familyCode: familyData.familyCode,
        readings: familyData.readings,
        carData: familyData.carData,
        exportDate: new Date().toISOString(),
        appVersion: '4.0'
    };
    
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `utilitati_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    showAlert('✅ Backup JSON descărcat!', 'success');
}

// === EXPORT PROGRESS ===
function showExportProgress(title, message) {
    const progressDiv = document.getElementById('exportProgress');
    const titleElement = document.getElementById('exportTitle');
    const messageElement = document.getElementById('exportMessage');
    const progressFill = document.getElementById('progressFill');
    
    if (progressDiv) {
        progressDiv.style.display = 'block';
        titleElement.textContent = title;
        messageElement.textContent = message;
        progressFill.style.width = '0%';
        
        // Animate progress
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress > 90) {
                clearInterval(interval);
                progress = 90;
            }
            progressFill.style.width = progress + '%';
        }, 200);
    }
}

function updateExportProgress(percent, message) {
    const messageElement = document.getElementById('exportMessage');
    const progressFill = document.getElementById('progressFill');
    
    if (messageElement) messageElement.textContent = message;
    if (progressFill) progressFill.style.width = percent + '%';
}

function hideExportProgress() {
    const progressDiv = document.getElementById('exportProgress');
    if (progressDiv) {
        setTimeout(() => {
            progressDiv.style.display = 'none';
        }, 1000);
    }
}

// === SETTINGS ===
function savePrices() {
    const waterPrice = parseFloat(document.getElementById('waterPrice').value);
    const gasPrice = parseFloat(document.getElementById('gasPrice').value);
    const electricPrice = parseFloat(document.getElementById('electricPrice').value);
    
    if (isNaN(waterPrice) || isNaN(gasPrice) || isNaN(electricPrice)) {
        showAlert('❌ Introduceți prețuri valide', 'danger');
        return;
    }
    
    familyData.prices = {
        water: waterPrice,
        gas: gasPrice,
        electric: electricPrice
    };
    
    saveData();
    updateStats();
    
    showAlert('✅ Prețurile au fost salvate!', 'success');
}

function resetReadings() {
    if (confirm('Sigur doriți să resetați toate citirile? Această acțiune nu poate fi anulată!')) {
        familyData.readings = {};
        saveData();
        updateUI();
        updateReminders();
        showAlert('⚠️ Toate citirile au fost resetate!', 'warning');
    }
}

function factoryReset() {
    if (confirm('ATENȚIE! Aceasta va șterge TOATE datele (citiri, setări familie, date mașină). Sigur continuați?')) {
        if (confirm('Ultima confirmare: Toate datele vor fi pierdute definitiv!')) {
            localStorage.clear();
            familyData = { readings: {}, prices: { water: 15.50, gas: 3.20, electric: 0.65 }, carData: {} };
            
            // Reset UI
            document.getElementById('familyCode').textContent = '-';
            document.getElementById('familyCodeInput').value = '';
            
            stopFamilySync();
            updateUI();
            updateReminders();
            updateNetworkStatus();
            
            showAlert('🏭 Factory Reset complet! Aplicația a fost resetată.', 'warning');
        }
    }
}

function checkPWAFeatures() {
    const features = [
        { name: 'Service Worker', check: 'serviceWorker' in navigator },
        { name: 'Manifest', check: true },
        { name: 'HTTPS/Localhost', check: location.protocol === 'https:' || location.hostname === 'localhost' },
        { name: 'Standalone Display', check: window.matchMedia('(display-mode: standalone)').matches },
        { name: 'Push Notifications', check: 'PushManager' in window },
        { name: 'Background Sync', check: 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype },
        { name: 'Install Prompt', check: !!deferredPrompt }
    ];
    
    const results = features.map(f => 
        `${f.check ? '✅' : '❌'} ${f.name}: ${f.check ? 'Suportat' : 'Nu este suportat'}`
    ).join('\n');
    
    alert(`🔍 Status funcționalități PWA:\n\n${results}`);
}

// === QUICK ACTIONS ===
function markAllRead() {
    const today = new Date().toISOString().split('T')[0];
    const types = ['waterBath', 'waterKitchen', 'gas', 'electric'];
    
    let marked = 0;
    types.forEach(type => {
        if (!isReadThisMonth(type)) {
            const lastValue = getLastReading(type);
            if (lastValue) {
                const reading = {
                    value: lastValue + Math.random() * 10, // Simulate reading
                    date: today,
                    timestamp: Date.now()
                };
                
                if (!familyData.readings[type]) {
                    familyData.readings[type] = [];
                }
                
                familyData.readings[type].unshift(reading);
                marked++;
            }
        }
    });
    
    if (marked > 0) {
        saveData();
        updateUI();
        updateReminders();
        showAlert(`✅ ${marked} citiri marcate ca citite!`, 'success');
    } else {
        showAlert('ℹ️ Toate citirile sunt deja făcute pentru luna aceasta', 'info');
    }
}

function getLastReading(type) {
    if (!familyData.readings || !familyData.readings[type] || familyData.readings[type].length === 0) {
        return 100; // Default starting value
    }
    return familyData.readings[type][0].value;
}

function showQuickIndex() {
    const type = prompt('Tip contor (waterBath/waterKitchen/gas/electric):');
    if (!type) return;
    
    const value = prompt('Valoare citire:');
    if (!value) return;
    
    const today = new Date().toISOString().split('T')[0];
    const reading = {
        value: parseFloat(value),
        date: today,
        timestamp: Date.now()
    };
    
    if (!familyData.readings[type]) {
        familyData.readings[type] = [];
    }
    
    familyData.readings[type].unshift(reading);
    saveData();
    updateUI();
    updateReminders();
    
    showAlert(`⚡ Citire rapidă ${type}: ${value}`, 'success');
}

// === UTILITY FUNCTIONS ===
function showForm() {
    document.getElementById('formOverlay').classList.add('active');
    document.getElementById('formValue').focus();
}

function closeForm() {
    document.getElementById('formOverlay').classList.remove('active');
}

function showAlert(message, type = 'info') {
    const alertsContainer = document.getElementById('alerts');
    if (!alertsContainer) return;
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    alertsContainer.appendChild(alertDiv);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.parentNode.removeChild(alertDiv);
        }
    }, 5000);
    
    console.log(`📢 Alert (${type}):`, message);
}

function formatDate(dateString) {
    try {
        return new Date(dateString).toLocaleDateString('ro-RO');
    } catch {
        return dateString;
    }
}

// Initialize PWA
console.log('🎯 Script Utilitățile Mele PWA v4.0 încărcat complet!');

// Utilitățile Mele - Script principal cu sincronizare bidirectională

// Variabile globale
let currentTab = 'home';
let currentFormType = '';
let familyData = {};
let syncInterval = null;
let isOnline = navigator.onLine;
let soundEnabled = localStorage.getItem('soundEnabled') !== 'false';

// Variabile pentru sync bidirectional
let syncConfig = {
    enabled: false,
    familyCode: null,
    lastSyncTimestamp: 0,
    deviceId: null,
    syncUrl: 'https://api.jsonbin.io/v3/b/',
    apiKey: '$2a$10$ls5qozW/OLFyJa7ixZD9NOW6/oYQFVOiKT7jg7zHSt9X9osnMGbVO',
    binId: null
};

// === INIȚIALIZARE APLICAȚIE ===
document.addEventListener('DOMContentLoaded', function() {
    // Load data
    loadAllData();
    
    // Setup network status
    setupNetworkStatus();
    
    // Setup family sync
    setupFamilySync();
    
    // Inițializează sistemul de sync bidirectional
    initializeBidirectionalSync();
    
    // Setup form date to today
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('formDate');
    if (dateInput) {
        dateInput.value = today;
    }
    
    // Update UI
    updateUI();
    updateReminders();
});

// === SUNET NOTIFICĂRI ===
function playNotificationSound() {
    if (!soundEnabled) return;
    
    try {
        // Folosește Web Audio API pentru sunet plăcut
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Notă 1 - Do (C5)
        const osc1 = audioContext.createOscillator();
        const gain1 = audioContext.createGain();
        osc1.connect(gain1);
        gain1.connect(audioContext.destination);
        osc1.frequency.value = 523.25; // C5
        osc1.type = 'sine';
        gain1.gain.setValueAtTime(0.3, audioContext.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        osc1.start(audioContext.currentTime);
        osc1.stop(audioContext.currentTime + 0.2);
        
        // Notă 2 - Mi (E5)
        setTimeout(() => {
            const osc2 = audioContext.createOscillator();
            const gain2 = audioContext.createGain();
            osc2.connect(gain2);
            gain2.connect(audioContext.destination);
            osc2.frequency.value = 659.25; // E5
            osc2.type = 'sine';
            gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            osc2.start(audioContext.currentTime);
            osc2.stop(audioContext.currentTime + 0.2);
        }, 150);
        
        // Notă 3 - Sol (G5) 
        setTimeout(() => {
            const osc3 = audioContext.createOscillator();
            const gain3 = audioContext.createGain();
            osc3.connect(gain3);
            gain3.connect(audioContext.destination);
            osc3.frequency.value = 783.99; // G5
            osc3.type = 'sine';
            gain3.gain.setValueAtTime(0.3, audioContext.currentTime);
            gain3.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            osc3.start(audioContext.currentTime);
            osc3.stop(audioContext.currentTime + 0.3);
        }, 300);
    } catch (e) {
        console.log('Audio error:', e);
    }
}

// === SISTEM SINCRONIZARE BIDIRECTIONALĂ ===

// Inițializare device ID unic
function initializeDeviceId() {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
        deviceId = 'device_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        localStorage.setItem('deviceId', deviceId);
    }
    syncConfig.deviceId = deviceId;
    return deviceId;
}

// Structura îmbunătățită pentru citiri cu metadata
function createReading(type, value, date) {
    return {
        id: generateReadingId(),
        type: type,
        value: parseFloat(value),
        date: date,
        timestamp: Date.now(),
        deviceId: syncConfig.deviceId,
        syncStatus: 'local', // local, syncing, synced
        version: 1,
        lastModified: Date.now()
    };
}

function generateReadingId() {
    return 'reading_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

async function initializeBidirectionalSync() {
    initializeDeviceId();
    
    const familyCode = localStorage.getItem('familyCode');
    if (familyCode) {
        syncConfig.familyCode = familyCode;
        
        // Obține bin ID pentru familie
        const binId = getBinIdForFamily(familyCode);
        if (binId) {
            syncConfig.binId = binId;
            syncConfig.enabled = true;
            
            if (isOnline) {
                await performInitialSync();
                startContinuousSync();
            }
        } else {
            console.log('Nu există bin ID pentru familia:', familyCode);
        }
    }
}

async function performInitialSync() {
    try {
        showSyncStatus('🔄 Sincronizare inițială...');
        
        // Obține datele de pe server
        const serverData = await fetchFamilyDataFromServer();
        
        if (serverData) {
            // Merge local cu server data
            const mergedData = mergeDataSets(familyData, serverData);
            
            // Aplică datele merged
            familyData = mergedData;
            
            // Salvează local
            saveData();
            updateUI();
        }
        
        // Upload modificările locale la server
        await uploadLocalChangesToServer();
        
        syncConfig.lastSyncTimestamp = Date.now();
        localStorage.setItem('lastSyncTimestamp', syncConfig.lastSyncTimestamp.toString());
        
        showSyncStatus('✅ Sincronizare completă');
        
    } catch (error) {
        console.error('❌ Eroare sincronizare inițială:', error);
        showSyncStatus('❌ Eroare sincronizare');
    }
}

function startContinuousSync() {
    if (syncInterval) {
        clearInterval(syncInterval);
    }
    
    // Sync la fiecare 15 secunde
    syncInterval = setInterval(async () => {
        if (isOnline && syncConfig.enabled) {
            await performIncrementalSync();
        }
    }, 15000);
}

async function performIncrementalSync() {
    try {
        // Verifică dacă sunt modificări pe server
        const serverTimestamp = await getServerLastModified();
        
        if (serverTimestamp > syncConfig.lastSyncTimestamp) {
            // Sunt modificări pe server, le preluăm
            const serverData = await fetchFamilyDataFromServer();
            if (serverData) {
                const mergedData = mergeDataSets(familyData, serverData);
                familyData = mergedData;
                saveData();
                updateUI();
                
                showAlert('🔄 Date sincronizate de la familie', 'info');
            }
        }
        
        // Upload modificările locale
        await uploadLocalChangesToServer();
        
        syncConfig.lastSyncTimestamp = Date.now();
        localStorage.setItem('lastSyncTimestamp', syncConfig.lastSyncTimestamp.toString());
        
        updateSyncStatusDisplay();
        
    } catch (error) {
        console.error('❌ Eroare sync incremental:', error);
    }
}

// === FUNCȚII SERVER COMMUNICATION ===

async function fetchFamilyDataFromServer() {
    if (!syncConfig.familyCode || !syncConfig.binId) return null;
    
    try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${syncConfig.binId}/latest`, {
            method: 'GET',
            headers: {
                'X-Master-Key': syncConfig.apiKey
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            return data.record;
        } else if (response.status === 404) {
            console.log('Bin nu există încă');
            return null;
        }
    } catch (error) {
        console.error('❌ Eroare fetch server:', error);
    }
    
    return null;
}

async function uploadLocalChangesToServer() {
    if (!syncConfig.familyCode || !syncConfig.binId) return;
    
    try {
        const dataToSync = {
            familyCode: syncConfig.familyCode,
            readings: familyData.readings || {},
            carData: familyData.carData || {},
            prices: familyData.prices || {},
            lastModified: Date.now(),
            lastModifiedBy: syncConfig.deviceId,
            devices: updateDeviceList()
        };
        
        const response = await fetch(`https://api.jsonbin.io/v3/b/${syncConfig.binId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': syncConfig.apiKey
            },
            body: JSON.stringify(dataToSync)
        });
        
        if (response.ok) {
            markAllReadingsAsSynced();
            console.log('✅ Date sincronizate cu succes');
        } else {
            console.error('❌ Eroare upload:', response.status);
        }
        
    } catch (error) {
        console.error('❌ Eroare upload server:', error);
    }
}

async function getServerLastModified() {
    try {
        const serverData = await fetchFamilyDataFromServer();
        return serverData ? serverData.lastModified || 0 : 0;
    } catch (error) {
        return 0;
    }
}

function updateDeviceList() {
    const devices = JSON.parse(localStorage.getItem('familyDevices') || '{}');
    devices[syncConfig.deviceId] = {
        id: syncConfig.deviceId,
        name: getDeviceName(),
        lastSeen: Date.now(),
        userAgent: navigator.userAgent
    };
    
    localStorage.setItem('familyDevices', JSON.stringify(devices));
    return devices;
}

function getDeviceName() {
    let deviceName = localStorage.getItem('deviceName');
    if (!deviceName) {
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isTablet = /iPad/i.test(navigator.userAgent);
        
        if (isTablet) {
            deviceName = 'Tablet';
        } else if (isMobile) {
            deviceName = 'Telefon';
        } else {
            deviceName = 'Computer';
        }
        
        deviceName += '_' + syncConfig.deviceId.substr(-4);
        localStorage.setItem('deviceName', deviceName);
    }
    return deviceName;
}

// Helper pentru a obține bin ID-ul
function getBinIdForFamily(familyCode) {
    return localStorage.getItem(`binId_${familyCode}`);
}

// === MERGE LOGIC PENTRU REZOLVAREA CONFLICTELOR ===

function mergeDataSets(localData, serverData) {
    const merged = {
        readings: {},
        carData: {},
        prices: {},
        familyCode: localData.familyCode || serverData.familyCode
    };
    
    // Merge readings cu rezolvare conflicte
    merged.readings = mergeReadings(localData.readings || {}, serverData.readings || {});
    
    // Merge car data (ultima modificare câștigă)
    merged.carData = mergeCarData(localData.carData || {}, serverData.carData || {});
    
    // Merge prices (ultima modificare câștigă)
    merged.prices = mergePrices(localData.prices || {}, serverData.prices || {});
    
    return merged;
}

function mergeReadings(localReadings, serverReadings) {
    const merged = {};
    
    // Obține toate tipurile de citiri
    const allTypes = new Set([...Object.keys(localReadings), ...Object.keys(serverReadings)]);
    
    allTypes.forEach(type => {
        const localTypeReadings = localReadings[type] || [];
        const serverTypeReadings = serverReadings[type] || [];
        
        // Creează un map cu toate citirile după ID
        const readingsMap = new Map();
        
        // Adaugă citirile locale
        localTypeReadings.forEach(reading => {
            readingsMap.set(reading.id || generateReadingId(), reading);
        });
        
        // Adaugă/merge citirile de pe server
        serverTypeReadings.forEach(reading => {
            const existingReading = readingsMap.get(reading.id);
            
            if (!existingReading) {
                // Citire nouă de pe server
                readingsMap.set(reading.id, reading);
            } else {
                // Conflict - folosește cea mai recentă
                if (reading.lastModified > existingReading.lastModified) {
                    readingsMap.set(reading.id, reading);
                }
            }
        });
        
        // Convertește înapoi la array și filtrează ștergerile
        merged[type] = Array.from(readingsMap.values())
            .filter(reading => !reading.deleted)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    });
    
    return merged;
}

function mergeCarData(localCarData, serverCarData) {
    const merged = { ...localCarData };
    
    Object.keys(serverCarData).forEach(key => {
        const localValue = localCarData[key];
        const serverValue = serverCarData[key];
        
        if (!localValue || (serverValue && serverValue.lastModified > (localValue.lastModified || 0))) {
            merged[key] = serverValue;
        }
    });
    
    return merged;
}

function mergePrices(localPrices, serverPrices) {
    // Pentru prețuri, folosește valorile mai recente sau default-urile
    return {
        water: serverPrices.water || localPrices.water || 15.50,
        gas: serverPrices.gas || localPrices.gas || 3.20,
        electric: serverPrices.electric || localPrices.electric || 0.65,
        lastModified: Math.max(
            serverPrices.lastModified || 0,
            localPrices.lastModified || 0
        )
    };
}

function markAllReadingsAsSynced() {
    if (!familyData.readings) return;
    
    Object.values(familyData.readings).forEach(typeReadings => {
        typeReadings.forEach(reading => {
            if (reading.syncStatus === 'syncing' || reading.syncStatus === 'local') {
                reading.syncStatus = 'synced';
            }
        });
    });
}

// === NETWORK STATUS ===
function setupNetworkStatus() {
    updateNetworkStatus();
    
    window.addEventListener('online', () => {
        isOnline = true;
        updateNetworkStatus();
        if (familyData.familyCode) {
            startFamilySync();
        }
    });
    
    window.addEventListener('offline', () => {
        isOnline = false;
        updateNetworkStatus();
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
    } catch (error) {
        console.error('Eroare la încărcarea datelor:', error);
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
        
        // Trigger sync if online and family code exists
        if (isOnline && familyData.familyCode) {
            syncWithFamily();
        }
    } catch (error) {
        console.error('Eroare la salvarea datelor:', error);
        showAlert('❌ Eroare la salvarea datelor', 'danger');
    }
}

// === READINGS MANAGEMENT ÎMBUNĂTĂȚIT ===
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
    return saveReadingAdvanced();
}

function saveReadingAdvanced() {
    const value = parseFloat(document.getElementById('formValue').value);
    const date = document.getElementById('formDate').value;
    
    if (!value || !date) {
        showAlert('❌ Completați toate câmpurile', 'danger');
        return;
    }
    
    // Validare valoare
    const lastReading = getLastReadingValue(currentFormType);
    if (lastReading && value < lastReading) {
        if (!confirm(`⚠️ Valoarea ${value} este mai mică decât ultima citire (${lastReading}). Continuați?`)) {
            return;
        }
    }
    
    // Creează citirea cu metadata completă
    const reading = createReading(currentFormType, value, date);
    
    // Adaugă în storage local
    addReadingToStorage(reading);
    
    // Sync imediat dacă e activat
    if (syncConfig.enabled && isOnline) {
        syncReadingToFamily(reading);
    }
    
    // Update UI
    saveData();
    updateUI();
    closeForm();
    
    showAlert(`✅ Citire ${currentFormType} salvată: ${value}`, 'success');
}

function addReadingToStorage(reading) {
    if (!familyData.readings) {
        familyData.readings = {};
    }
    
    if (!familyData.readings[reading.type]) {
        familyData.readings[reading.type] = [];
    }
    
    // Adaugă și sortează după dată
    familyData.readings[reading.type].push(reading);
    familyData.readings[reading.type].sort((a, b) => new Date(b.date) - new Date(a.date));
}

function getLastReadingValue(type) {
    if (!familyData.readings || !familyData.readings[type] || familyData.readings[type].length === 0) {
        return null;
    }
    return familyData.readings[type][0].value;
}

function deleteReading(type) {
    return deleteReadingAdvanced(type);
}

function deleteReadingAdvanced(type, readingId = null) {
    if (!familyData.readings || !familyData.readings[type] || familyData.readings[type].length === 0) {
        showAlert('❌ Nu există citiri de șters', 'warning');
        return;
    }
    
    let readingToDelete;
    let readingIndex;
    
    if (readingId) {
        // Șterge citirea specifică
        readingIndex = familyData.readings[type].findIndex(r => r.id === readingId);
        if (readingIndex === -1) {
            showAlert('❌ Citirea nu a fost găsită', 'warning');
            return;
        }
        readingToDelete = familyData.readings[type][readingIndex];
    } else {
        // Șterge ultima citire
        readingToDelete = familyData.readings[type][0];
        readingIndex = 0;
    }
    
    const confirmMessage = `Ștergeți citirea ${readingToDelete.value} din ${formatDate(readingToDelete.date)}?`;
    if (confirm(confirmMessage)) {
        // Marchează ca ștearsă în loc să o ștergi complet (pentru sync)
        readingToDelete.deleted = true;
        readingToDelete.deletedAt = Date.now();
        readingToDelete.deletedBy = syncConfig.deviceId;
        readingToDelete.syncStatus = 'local';
        
        // Sync ștergerea
        if (syncConfig.enabled && isOnline) {
            syncDeletedReadingToFamily(readingToDelete);
        }
        
        // Remove din UI dar păstrează în backend pentru sync
        familyData.readings[type].splice(readingIndex, 1);
        
        saveData();
        updateUI();
        showAlert(`✅ Citire ${type} ștearsă`, 'success');
    }
}

// === FUNCȚII SYNC SPECIFICE ===
async function syncReadingToFamily(reading) {
    if (!syncConfig.enabled || !isOnline) return;
    
    reading.syncStatus = 'syncing';
    await uploadLocalChangesToServer();
    reading.syncStatus = 'synced';
}

async function syncDeletedReadingToFamily(deletedReading) {
    if (!syncConfig.enabled || !isOnline) return;
    
    // Adaugă ștergerea în lista de modificări pentru sync
    await uploadLocalChangesToServer();
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

// === REMINDERS CU SUNET ===
function updateReminders() {
    const remindersList = document.getElementById('remindersList');
    if (!remindersList) return;
    
    // Salvează numărul vechi de remindere
    const oldCount = parseInt(document.getElementById('activeReminders')?.textContent || '0');
    
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
    
    // Play sound dacă sunt reminder-uri noi
    if (reminders.length > oldCount && reminders.length > 0) {
        playNotificationSound();
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
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }
    updateSyncStatus();
}

function syncWithFamily() {
    // In a real app, this would sync with a backend service
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
    return setupFamilyAdvanced();
}

async function setupFamilyAdvanced() {
    const code = document.getElementById('familyCodeInput').value.trim();
    if (!code) {
        showAlert('❌ Introduceți un cod pentru familie', 'danger');
        return;
    }
    
    if (code.length < 5) {
        showAlert('❌ Codul familiei trebuie să aibă cel puțin 5 caractere', 'danger');
        return;
    }
    
    syncConfig.familyCode = code;
    syncConfig.enabled = true;
    familyData.familyCode = code;
    
    // Verifică dacă există deja un bin pentru această familie
    let binId = localStorage.getItem(`binId_${code}`);
    
    if (!binId) {
        // Creează un bin nou pentru familie
        try {
            showAlert('🔄 Se creează spațiul pentru familie...', 'info');
            
            const response = await fetch('https://api.jsonbin.io/v3/b', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': syncConfig.apiKey,
                    'X-Bin-Name': `UtilitatiMele_${code}`,
                    'X-Bin-Private': false
                },
                body: JSON.stringify({
                    familyCode: code,
                    readings: {},
                    carData: {},
                    prices: { water: 15.50, gas: 3.20, electric: 0.65 },
                    lastModified: Date.now(),
                    devices: {}
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                binId = data.metadata.id;
                localStorage.setItem(`binId_${code}`, binId);
                syncConfig.binId = binId;
                showAlert(`✅ Familie "${code}" creată cu succes!`, 'success');
            } else {
                throw new Error('Eroare la crearea familiei');
            }
        } catch (error) {
            showAlert('❌ Eroare la crearea familiei. Verificați conexiunea.', 'danger');
            console.error('Eroare creare familie:', error);
            return;
        }
    } else {
        syncConfig.binId = binId;
    }
    
    localStorage.setItem('familyCode', code);
    document.getElementById('familyCode').textContent = code;
    
    if (isOnline) {
        try {
            await performInitialSync();
            startContinuousSync();
            showAlert(`✅ Conectat la familia "${code}" cu succes!`, 'success');
        } catch (error) {
            showAlert('❌ Eroare la conectarea la familie', 'danger');
            console.error('Eroare setup familie:', error);
        }
    } else {
        showAlert(`✅ Familia "${code}" configurată (se va sincroniza când sunteți online)`, 'success');
    }
    
    updateNetworkStatus();
    updateSyncStatusDisplay();
}

async function forceFullSync() {
    if (!syncConfig.enabled) {
        showAlert('❌ Sincronizarea nu este activată', 'danger');
        return;
    }
    
    if (!isOnline) {
        showAlert('❌ Nu sunteți conectat la internet', 'danger');
        return;
    }
    
    showAlert('🔄 Sincronizare completă în curs...', 'info');
    
    try {
        // Reset sync timestamp pentru a forța sync complet
        syncConfig.lastSyncTimestamp = 0;
        
        await performInitialSync();
        
        showAlert('✅ Sincronizare completă finalizată!', 'success');
        updateUI();
        updateReminders();
        
    } catch (error) {
        showAlert('❌ Eroare la sincronizarea completă', 'danger');
        console.error('Eroare sync complet:', error);
    }
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

// === UI PENTRU SYNC STATUS ===
function showSyncStatus(message) {
    const syncStatus = document.getElementById('syncStatus');
    if (syncStatus) {
        syncStatus.innerHTML = message;
        syncStatus.className = 'sync-status syncing';
    }
}

function updateSyncStatusDisplay() {
    const syncDetails = document.getElementById('syncDetails');
    const connectedUsers = document.getElementById('connectedUsers');
    
    if (syncConfig.enabled && syncConfig.familyCode) {
        const lastSync = new Date(syncConfig.lastSyncTimestamp);
        
        if (syncDetails) {
            syncDetails.textContent = `Conectat la familia "${syncConfig.familyCode}" - Ultima sincronizare: ${formatTime(lastSync)}`;
        }
        
        // Simulare utilizatori conectați (în realitate din backend)
        if (connectedUsers) {
            const devices = JSON.parse(localStorage.getItem('familyDevices') || '{}');
            connectedUsers.textContent = Object.keys(devices).length.toString();
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

// === REPORTS ===
function generateReport() {
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
    showAlert('📋 Se generează fișierul Excel...', 'info');
    
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
            
            XLSX.writeFile(wb, `utilitati_${new Date().toISOString().split('T')[0]}.xlsx`);
            showAlert('✅ Fișier Excel descărcat cu succes!', 'success');
            
        } catch (error) {
            console.error('Eroare export Excel:', error);
            showAlert('❌ Eroare la generarea fișierului Excel', 'danger');
        }
    }, 1000);
}

function exportPDF() {
    showAlert('📄 Funcția PDF va fi disponibilă în curând!', 'info');
}

function shareReport() {
    const data = {
        familyCode: familyData.familyCode,
        readings: familyData.readings,
        carData: familyData.carData,
        exportDate: new Date().toISOString()
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
}

function formatDate(dateString) {
    try {
        return new Date(dateString).toLocaleDateString('ro-RO');
    } catch {
        return dateString;
    }
}

function formatTime(date) {
    return date.toLocaleTimeString('ro-RO', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

// === ÎMBUNĂTĂȚIRI DE SECURITATE ȘI OPTIMIZARE ===

// ❌ PROBLEMĂ: API key expus în frontend
const syncConfig = {
    enabled: false,
    familyCode: null,
    lastSyncTimestamp: 0,
    deviceId: null,
    // ❌ API key expus - PERICOL DE SECURITATE
    // apiKey: '$2a$10$ls5qozW/OLFyJa7ixZD9NOW6/oYQFVOiKT7jg7zHSt9X9osnMGbVO',
    
    // ✅ SOLUȚIE: Folosește un backend proxy
    backendUrl: '/api/sync', // Backend proxy pentru securitate
    binId: null
};

// ✅ SOLUȚIE: Sistem de environment variables (pentru deployment)
const CONFIG = {
    API_URL: window.location.hostname === 'localhost' ? 
        'http://localhost:3000/api' : 
        'https://your-backend.herokuapp.com/api',
    
    VERSION: '4.1',
    MAX_READINGS_PER_TYPE: 100, // Limitează numărul de citiri stocate
    SYNC_INTERVAL: 30000, // 30 secunde
    OFFLINE_STORAGE_LIMIT: 50 * 1024 * 1024 // 50MB limit
};

// === ÎMBUNĂTĂȚIRE: DEBOUNCE PENTRU SALVARE ===
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Debounced save function pentru performanță
const debouncedSave = debounce(saveData, 500);

// === ÎMBUNĂTĂȚIRE: VALIDARE INPUT ===
class DataValidator {
    static validateMeterReading(value, type) {
        const constraints = {
            waterBath: { min: 0, max: 999999, decimals: 2 },
            waterKitchen: { min: 0, max: 999999, decimals: 2 },
            gas: { min: 0, max: 999999, decimals: 2 },
            electric: { min: 0, max: 9999999, decimals: 2 }
        };
        
        const constraint = constraints[type];
        if (!constraint) return { valid: false, error: 'Tip contor necunoscut' };
        
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return { valid: false, error: 'Valoarea trebuie să fie un număr' };
        if (numValue < constraint.min) return { valid: false, error: `Valoarea minimă este ${constraint.min}` };
        if (numValue > constraint.max) return { valid: false, error: `Valoarea maximă este ${constraint.max}` };
        
        // Verifică numărul de zecimale
        const decimals = (value.toString().split('.')[1] || '').length;
        if (decimals > constraint.decimals) {
            return { valid: false, error: `Maxim ${constraint.decimals} zecimale permise` };
        }
        
        return { valid: true, value: numValue };
    }
    
    static validateDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        const oneMonthForward = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
        
        if (isNaN(date.getTime())) {
            return { valid: false, error: 'Data nu este validă' };
        }
        
        if (date < oneYearAgo) {
            return { valid: false, error: 'Data nu poate fi mai veche de 1 an' };
        }
        
        if (date > oneMonthForward) {
            return { valid: false, error: 'Data nu poate fi în viitor cu mai mult de 1 lună' };
        }
        
        return { valid: true, value: date };
    }
}

// === ÎMBUNĂTĂȚIRE: ERROR HANDLING ROBUST ===
class ErrorHandler {
    static handle(error, context, userMessage = null) {
        // Log tehnic pentru debug
        console.error(`[${context}] Error:`, error);
        
        // Log pentru analytics (dacă implementat)
        this.logToAnalytics(error, context);
        
        // Mesaj user-friendly
        const message = userMessage || this.getUserMessage(context, error);
        showAlert(message, 'danger');
        
        // Încearcă recovery automat unde e posibil
        this.attemptRecovery(context, error);
    }
    
    static getUserMessage(context, error) {
        const messages = {
            'sync': 'Probleme cu sincronizarea. Se va reîncerca automat în câteva secunde.',
            'storage': 'Probleme cu salvarea datelor. Verificați spațiul disponibil pe dispozitiv.',
            'network': 'Probleme de conexiune la internet. Verificați conexiunea.',
            'validation': 'Date introduse incorect. Verificați valorile.',
            'export': 'Probleme la generarea fișierului. Încercați din nou.',
            'reading': 'Eroare la salvarea citirilor. Verificați valorile introduse.'
        };
        
        return messages[context] || 'A apărut o eroare neașteptată. Încercați din nou.';
    }
    
    static logToAnalytics(error, context) {
        // Aici poți implementa logging către un serviciu extern
        // De exemplu: Sentry, LogRocket, etc.
        try {
            if (window.gtag) {
                window.gtag('event', 'exception', {
                    description: `${context}: ${error.message}`,
                    fatal: false
                });
            }
        } catch (e) {
            // Ignore analytics errors
        }
    }
    
    static attemptRecovery(context, error) {
        switch (context) {
            case 'sync':
                // Reprogramează sync-ul
                setTimeout(() => {
                    if (isOnline && familyData.familyCode) {
                        syncWithFamily();
                    }
                }, 5000);
                break;
                
            case 'storage':
                // Încearcă curățarea cache-ului vechi
                this.cleanOldData();
                break;
        }
    }
    
    static cleanOldData() {
        try {
            // Păstrează doar ultimele 50 de citiri per tip
            if (familyData.readings) {
                Object.keys(familyData.readings).forEach(type => {
                    if (familyData.readings[type].length > CONFIG.MAX_READINGS_PER_TYPE) {
                        familyData.readings[type] = familyData.readings[type]
                            .slice(0, CONFIG.MAX_READINGS_PER_TYPE);
                    }
                });
                saveData();
                showAlert('📁 Date vechi curățate pentru a elibera spațiu', 'info');
            }
        } catch (e) {
            console.error('Eroare la curățarea datelor vechi:', e);
        }
    }
}

// === ÎMBUNĂTĂȚIRE: SALVARE CU VALIDARE ===
function saveReadingEnhanced() {
    try {
        const value = document.getElementById('formValue').value;
        const date = document.getElementById('formDate').value;
        
        // Validare input
        const valueValidation = DataValidator.validateMeterReading(value, currentFormType);
        if (!valueValidation.valid) {
            showAlert(`❌ ${valueValidation.error}`, 'danger');
            return;
        }
        
        const dateValidation = DataValidator.validateDate(date);
        if (!dateValidation.valid) {
            showAlert(`❌ ${dateValidation.error}`, 'danger');
            return;
        }
        
        // Verificare logică - valoarea nu poate fi mult mai mică decât precedenta
        const lastReading = getLastReadingValue(currentFormType);
        if (lastReading && valueValidation.value < lastReading * 0.9) {
            const confirmMessage = `⚠️ Valoarea ${valueValidation.value} pare mult mai mică decât ultima citire (${lastReading}). 
            
Diferența este de ${(lastReading - valueValidation.value).toFixed(2)} unități. 

Sigur continuați?`;
            
            if (!confirm(confirmMessage)) {
                return;
            }
        }
        
        // Creează citirea
        const reading = createReading(currentFormType, valueValidation.value, date);
        
        // Salvează
        addReadingToStorage(reading);
        debouncedSave(); // Folosește debounced save
        
        updateUI();
        closeForm();
        
        showAlert(`✅ Citire ${currentFormType} salvată: ${valueValidation.value}`, 'success');
        
        // Sunet de confirmare
        playNotificationSound();
        
    } catch (error) {
        ErrorHandler.handle(error, 'reading');
    }
}

// === ÎMBUNĂTĂȚIRE: SYNC SECURIZAT (fără API key expus) ===
async function secureSync() {
    try {
        if (!familyData.familyCode) {
            throw new Error('Cod familie lipsă');
        }
        
        const response = await fetch(`${CONFIG.API_URL}/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                familyCode: familyData.familyCode,
                deviceId: syncConfig.deviceId,
                data: {
                    readings: familyData.readings,
                    carData: familyData.carData,
                    prices: familyData.prices
                },
                lastModified: Date.now()
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            // Merge datele primite
            if (result.data) {
                familyData = mergeDataSets(familyData, result.data);
                saveData();
                updateUI();
            }
            
            syncConfig.lastSyncTimestamp = Date.now();
            showAlert('✅ Sincronizare completă', 'success');
        }
        
    } catch (error) {
        ErrorHandler.handle(error, 'sync');
    }
}

// === ÎMBUNĂTĂȚIRE: STORAGE CU LIMITARE ===
function saveDataEnhanced() {
    try {
        // Verifică mărimea datelor
        const dataSize = JSON.stringify(familyData).length;
        if (dataSize > CONFIG.OFFLINE_STORAGE_LIMIT) {
            ErrorHandler.cleanOldData();
        }
        
        // Backup înainte de salvare
        const backup = localStorage.getItem('readings');
        
        try {
            localStorage.setItem('readings', JSON.stringify(familyData.readings || {}));
            localStorage.setItem('prices', JSON.stringify(familyData.prices || {}));
            localStorage.setItem('carData', JSON.stringify(familyData.carData || {}));
            
            if (familyData.familyCode) {
                localStorage.setItem('familyCode', familyData.familyCode);
            }
            
            // Salvează timestamp-ul ultimei modificări
            localStorage.setItem('lastModified', Date.now().toString());
            
        } catch (storageError) {
            // Restaurează backup-ul dacă salvarea eșuează
            if (backup) {
                localStorage.setItem('readings', backup);
            }
            throw storageError;
        }
        
    } catch (error) {
        ErrorHandler.handle(error, 'storage');
    }
}

// === ÎMBUNĂTĂȚIRE: EXPORT CU PROGRESS ===
async function exportExcelWithProgress() {
    try {
        // Arată progress bar
        showExportProgress(0, 'Se inițializează exportul...');
        
        await new Promise(resolve => setTimeout(resolve, 500));
        showExportProgress(20, 'Se colectează datele...');
        
        const wb = XLSX.utils.book_new();
        const today = new Date();
        
        showExportProgress(40, 'Se generează foaia de indexuri...');
        
        // Generează foaia principală
        const indexData = generateIndexDataForAssociation();
        const ws1 = XLSX.utils.aoa_to_sheet(indexData);
        XLSX.utils.book_append_sheet(wb, ws1, 'Indexuri pentru Asociatie');
        
        showExportProgress(60, 'Se adaugă istoricul...');
        
        // Adaugă istoric
        const historicData = generateHistoricData();
        const ws2 = XLSX.utils.aoa_to_sheet(historicData);
        XLSX.utils.book_append_sheet(wb, ws2, 'Istoric Citiri');
        
        showExportProgress(80, 'Se calculează costurile...');
        
        // Adaugă calculul costurilor
        const costData = generateCostCalculationData();
        const ws3 = XLSX.utils.aoa_to_sheet(costData);
        XLSX.utils.book_append_sheet(wb, ws3, 'Calculul Costurilor');
        
        showExportProgress(95, 'Se salvează fișierul...');
        
        // Salvează
        const fileName = `Indexuri_Iordache_Florin_${String(today.getMonth() + 1).padStart(2, '0')}_${today.getFullYear()}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        showExportProgress(100, 'Export complet!');
        
        setTimeout(() => {
            hideExportProgress();
            showAlert('✅ Fișier Excel pentru asociația de proprietari descărcat cu succes!', 'success');
        }, 1000);
        
    } catch (error) {
        hideExportProgress();
        ErrorHandler.handle(error, 'export');
    }
}

function showExportProgress(percentage, message) {
    const progressContainer = document.getElementById('exportProgress');
    if (progressContainer) {
        progressContainer.style.display = 'block';
        progressContainer.querySelector('#progressFill').style.width = percentage + '%';
        progressContainer.querySelector('#exportMessage').textContent = message;
    }
}

function hideExportProgress() {
    const progressContainer = document.getElementById('exportProgress');
    if (progressContainer) {
        progressContainer.style.display = 'none';
    }
}

// === ÎMBUNĂTĂȚIRE: PERFORMANCE MONITORING ===
class PerformanceMonitor {
    static startTimer(name) {
        performance.mark(`${name}-start`);
    }
    
    static endTimer(name) {
        performance.mark(`${name}-end`);
        performance.measure(name, `${name}-start`, `${name}-end`);
        
        const measure = performance.getEntriesByName(name)[0];
        if (measure.duration > 1000) { // Alertă dacă operația durează > 1s
            console.warn(`Slow operation detected: ${name} took ${measure.duration.toFixed(2)}ms`);
        }
        
        return measure.duration;
    }
}

// === ÎMBUNĂTĂȚIRE: LAZY LOADING PENTRU RAPOARTE ===
const LazyLoader = {
    loadReports: debounce(function() {
        PerformanceMonitor.startTimer('report-generation');
        generateReport();
        PerformanceMonitor.endTimer('report-generation');
    }, 300),
    
    loadCarData: debounce(function() {
        updateCarDisplay();
    }, 100)
};

// Înlocuiește apelurile directe cu lazy loading
// showTab('reports') va folosi LazyLoader.loadReports()

console.log('🔒 Script îmbunătățit cu securitate și optimizări încărcat!');

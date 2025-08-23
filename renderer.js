// --- DEKLARASI ELEMEN ---
const uploadBtn = document.getElementById('upload-btn');
const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');
const stopBtn = document.getElementById('stop-btn');
const statusElem = document.getElementById('status');
const tableHeader = document.getElementById('table-header');
const tableBody = document.getElementById('table-body');
const dropZone = document.getElementById('drop-zone');
const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');
const pageStatus = document.getElementById('page-status');
const paginationControls = document.getElementById('pagination-controls');
const toggleControlsBtn = document.getElementById('toggle-controls-btn');
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
const copyDropdown = document.getElementById('copy-dropdown');
const copyDropdownBtn = document.getElementById('copy-dropdown-btn');
const dropdownContent = document.querySelector('.dropdown-content');
const exportCsvBtn = document.getElementById('export-csv-btn');
const processListBtn = document.getElementById('process-list-btn');
const domainListTextarea = document.getElementById('domain-list-textarea');
const langBtnContainer = document.getElementById('lang-btn-container');
const addWaybackReportBtn = document.getElementById('add-wayback-report-btn');
const waybackReportModal = document.getElementById('wayback-report-modal');
const waybackModalCloseBtn = document.getElementById('wayback-modal-close-btn');
const waybackReportTextarea = document.getElementById('wayback-report-textarea');
const applyWaybackReportBtn = document.getElementById('apply-wayback-report-btn');
const clearWaybackReportBtn = document.getElementById('clear-wayback-report-btn');
const downloadWaybackFormatBtn = document.getElementById('download-wayback-format-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const settingsModalCloseBtn = document.getElementById('settings-modal-close-btn');
const credentialsForm = document.getElementById('credentials-form');
const ahrefsEmailInput = document.getElementById('ahrefs-email');
const ahrefsPasswordInput = document.getElementById('ahrefs-password');
const saveCredentialsBtn = document.getElementById('save-credentials-btn');

// View Containers
const initialView = document.getElementById('initial-view');
const processingView = document.getElementById('processing-view');
const controlPanel = document.getElementById('control-panel');
const analysisOptions = document.getElementById('analysis-options');

// File Info
const fileNameElem = document.getElementById('file-name');

// Progress Bar
const progressBarContainer = document.getElementById('progress-bar-container');
const progressBar = document.getElementById('progress-bar-fill');
const progressPercentage = document.getElementById('progress-percentage');

// Cards & Tabs
const outputCard = document.getElementById('output-card');
const logPanel = document.getElementById('log-panel');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Modal Elements
const modal = document.getElementById('details-modal');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalCloseBtn = document.getElementById('modal-close-btn');

// Checkboxes
const startTomorrowCheckbox = document.getElementById('start-tomorrow-checkbox');
const filterSeoCheckbox = document.getElementById('filter-seo-checkbox');
const checkIndexCheckbox = document.getElementById('check-index-checkbox');
const checkForbiddenCheckbox = document.getElementById('check-forbidden-checkbox');
const collectAhrefsCheckbox = document.getElementById('collect-ahrefs-checkbox');
const aiAnalysisCheckbox = document.getElementById('ai-analysis-checkbox');

// Stats Elements
const totalDomainsElem = document.getElementById('total-domains');
const highQualityElem = document.getElementById('high-quality');
const toxicDomainsElem = document.getElementById('toxic-domains');
const indexedDomainsElem = document.getElementById('indexed-domains');

// --- State & Data ---
let processedData = [], currentlyDisplayedDomains = [], isProcessing = false, currentPage = 1, isManualInput = false;
let currentTranslations = {};
const rowsPerPage = 30;
let spamKeywords = [];
let credentialsExist = false;

// --- Modal Controls ---
async function openSettingsModal() {
    const savedCreds = await window.electronAPI.getCredentials();
    if (savedCreds && savedCreds.email && savedCreds.password) {
        ahrefsEmailInput.value = savedCreds.email;
        ahrefsPasswordInput.value = savedCreds.password;
    } else {
        ahrefsEmailInput.value = '';
        ahrefsPasswordInput.value = '';
    }
    settingsModal.classList.add('active');
}

function closeSettingsModal() {
    settingsModal.classList.remove('active');
}

function updateUIBasedOnCredentials() {
    if (!startBtn.classList.contains('d-none')) {
        if (credentialsExist) {
            startBtn.disabled = false;
            startBtn.setAttribute('title', 'Ready to start analysis');
        } else {
            startBtn.disabled = true;
            startBtn.setAttribute('title', 'Please set Ahrefs credentials in Settings (gear icon) first.');
            if (processedData.length > 0) {
                 showFlashMessage('Ahrefs credentials required. Click the ⚙️ icon to set them up.', 'error', 8000);
            }
        }
    }
}

// --- Fungsi Bahasa & Terjemahan ---
async function setLanguage(lang) {
    if (!['id', 'en'].includes(lang)) lang = 'en';

    currentTranslations = await window.electronAPI.getTranslations(lang);
    if (!currentTranslations || Object.keys(currentTranslations).length === 0) {
        console.error(`Could not load translations for ${lang}`);
        return;
    }

    document.querySelectorAll('[data-lang-key]').forEach(el => {
        const key = el.dataset.langKey;
        if (currentTranslations[key]) {
            const svgIcon = el.querySelector('svg');
            const textContentSpan = el.querySelector('span');
            
            if (textContentSpan) {
                textContentSpan.textContent = currentTranslations[key];
            } else if (!svgIcon) {
                el.textContent = currentTranslations[key];
            } else {
                 const textNode = Array.from(el.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
                 if (textNode) textNode.textContent = ` ${currentTranslations[key]} `;
            }
        }
    });

    document.querySelectorAll('[data-lang-key-title]').forEach(el => {
        const key = el.dataset.langKeyTitle;
        if (currentTranslations[key]) {
            el.setAttribute('title', currentTranslations[key]);
        }
    });

    localStorage.setItem('userLanguage', lang);
    
    document.querySelectorAll('#lang-btn-container button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    pageStatus.textContent = (currentTranslations.pageStatus || 'Page {currentPage} of {totalPages}')
        .replace('{currentPage}', currentPage)
        .replace('{totalPages}', Math.ceil(currentlyDisplayedDomains.length / rowsPerPage) || 1);
    
    if (fileNameElem.classList.contains('d-none')) {
        fileNameElem.textContent = currentTranslations.fileSelect || 'No file selected';
    }
    
    if(currentlyDisplayedDomains.length > 0) {
        renderPage();
    }
}


// --- Fungsi Update UI ---
function updateProgress(percent, text) {
    statusElem.textContent = text;
    const p = Math.round(percent);
    progressBar.style.width = `${p}%`;
    progressPercentage.textContent = `${p}%`;
}

async function stopProcess(message) {
    await window.electronAPI.stopAhrefsCheck();

    updateProgress(100, message);
    addLog('success', message, new Date().toLocaleTimeString());
    updateStepIndicator(5);
    startBtn.disabled = currentlyDisplayedDomains.length === 0;
    resetBtn.disabled = false;
    stopBtn.classList.add('d-none');
    toggleControlsBtn.classList.remove('d-none');
    
    addWaybackReportBtn.disabled = false;
    
    analysisOptions.disabled = false;
    isProcessing = false;

    copyDropdownBtn.disabled = false;
    exportCsvBtn.disabled = false;
}

function addLog(level, message, timestamp, isHtml = false) {
    const logEntry = document.createElement('div');
    const messageSpan = document.createElement('span');
    messageSpan.className = `log-${level}`;
    
    if (isHtml) {
        messageSpan.innerHTML = message;
    } else {
        messageSpan.textContent = message;
    }
    
    logEntry.innerHTML = `<span class="log-time">[${timestamp}]</span> `;
    logEntry.appendChild(messageSpan);
    
    logPanel.appendChild(logEntry);
    
    setTimeout(() => {
        logPanel.scrollTop = logPanel.scrollHeight;
    }, 0);
}

function showFlashMessage(message, type = 'success', duration = 5000) {
    const container = document.getElementById('flash-message-container');
    const flashMessage = document.createElement('div');
    flashMessage.className = `flash-message flash-${type}`;
    flashMessage.innerHTML = message;

    container.appendChild(flashMessage);

    setTimeout(() => {
        flashMessage.style.animation = 'slideOut 0.5s forwards';
        flashMessage.addEventListener('animationend', () => {
            flashMessage.remove();
        });
    }, duration);
}

function updateStepIndicator(step) {
    document.querySelectorAll('.step').forEach(el => {
        el.classList.remove('active');
        if (parseInt(el.dataset.step) <= step) {
            el.classList.add('active');
        }
    });
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === tabId);
    });
}

function animateCount(element, target) {
    const start = parseInt(element.textContent, 10) || 0;
    if (start === target) return;

    const duration = 800;
    let startTime = null;

    function animationStep(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const currentValue = Math.floor(progress * (target - start) + start);
        element.textContent = currentValue;

        if (progress < 1) {
            requestAnimationFrame(animationStep);
        } else {
            element.textContent = target;
        }
    }

    requestAnimationFrame(animationStep);
}

function createStatIcon(type, pathData) {
    const iconSpan = document.createElement('span');
    iconSpan.className = `stat-icon ${type}`;
    iconSpan.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            ${pathData}
        </svg>
    `;
    return iconSpan;
}

function updateStatsCounters(data) {
    const icons = {
        total: createStatIcon('total', '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line>'),
        quality: createStatIcon('quality', '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path>'),
        toxic: createStatIcon('toxic', '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'),
        indexed: createStatIcon('indexed', '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"></path>')
    };

    const updateIcon = (cardElement, newIcon) => {
        const oldIcon = cardElement.querySelector('.stat-icon');
        if (oldIcon) {
            cardElement.replaceChild(newIcon, oldIcon);
        } else {
            cardElement.prepend(newIcon);
        }
    };
    
    updateIcon(totalDomainsElem.closest('.stat-card'), icons.total);
    animateCount(totalDomainsElem, data.length);

    updateIcon(highQualityElem.closest('.stat-card'), icons.quality);
    animateCount(highQualityElem, data.filter(d => d.aiResult?.keputusan === 'High Quality').length);

    const toxicCount = data.filter(d => 
        (d.ahrefsResult && (d.ahrefsResult.backlinkSpam !== 'Aman' || d.ahrefsResult.anchorSpam !== 'Aman')) ||
        (d.aiResult && (d.aiResult.keputusan === 'Low Quality' || d.aiResult.keputusan === 'Sangat Berisiko'))
    ).length;
    updateIcon(toxicDomainsElem.closest('.stat-card'), icons.toxic);
    animateCount(toxicDomainsElem, toxicCount);

    updateIcon(indexedDomainsElem.closest('.stat-card'), icons.indexed);
    animateCount(indexedDomainsElem, data.filter(d => d['G-INDEX']?.status === 'INDEX').length);
}

function parseWaybackReport(text) {
    const reports = {};
    const domainBlocks = text.split('------------------------------------------------').slice(1);

    for (const block of domainBlocks) {
        if (!block.trim()) continue;

        const domainMatch = block.match(/DOMAIN:\s*(.*)/i);
        if (!domainMatch) continue;

        const domainName = domainMatch[1].trim();
        const reportData = {};

        const lines = block.trim().split('\n');
        let currentKey = '';
        let currentValue = '';

        lines.forEach(line => {
            const match = line.trim().match(/^([^:]+):\s*(.*)/);
            if (match) {
                if (currentKey) {
                    reportData[currentKey.toUpperCase().trim()] = currentValue.trim();
                }
                currentKey = match[1].trim();
                currentValue = match[2].trim();
            } else if (currentKey) {
                currentValue += '\n' + line.trim();
            }
        });
        if (currentKey) {
            reportData[currentKey.toUpperCase().trim()] = currentValue.trim();
        }
        
        reports[domainName] = reportData;
    }
    return reports;
}


// --- Fungsi Utama Aplikasi ---
function resetApplicationState() {
    isProcessing = false;
    isManualInput = false;
    processedData = []; 
    currentlyDisplayedDomains = []; 
    currentPage = 1;
    tableHeader.innerHTML = ''; 
    tableBody.innerHTML = '';
    
    initialView.classList.remove('d-none');
    processingView.classList.add('d-none');
    controlPanel.classList.add('hidden');
    
    fileNameElem.textContent = currentTranslations.fileSelect || 'No file selected';
    fileNameElem.classList.add('d-none');
    
    startBtn.classList.add('d-none');
    toggleControlsBtn.classList.add('d-none');
    addWaybackReportBtn.classList.add('d-none');
    
    startBtn.disabled = false;
    resetBtn.disabled = false;
    stopBtn.classList.add('d-none');
    
    updateProgress(0, currentTranslations.statusInitial || 'Please select a file to start analysis.');
    
    analysisOptions.disabled = false;
    const dateFilterGroup = document.querySelector('[data-lang-key="step1Title"]').closest('.control-group');
    if (dateFilterGroup) {
        dateFilterGroup.style.opacity = '1';
        dateFilterGroup.querySelectorAll('input').forEach(el => el.disabled = false);
    }

    startTomorrowCheckbox.checked = false;
    document.querySelector('input[name="dateRange"][value="today"]').checked = true;
    filterSeoCheckbox.checked = true;
    checkIndexCheckbox.checked = true;
    checkForbiddenCheckbox.checked = true;
    collectAhrefsCheckbox.checked = true;
    aiAnalysisCheckbox.checked = true;
    
    logPanel.innerHTML = '';
    updateStepIndicator(0);
    updateStatsCounters([]);
}

async function handleFileProcessing(filePath) {
    try {
        isManualInput = false;
        const fileName = filePath.split(/[\\/]/).pop();
        
        initialView.classList.add('d-none');
        processingView.classList.remove('d-none');
        controlPanel.classList.remove('hidden');
        
        fileNameElem.textContent = fileName;
        fileNameElem.classList.remove('d-none');
        startBtn.classList.remove('d-none');
        toggleControlsBtn.classList.remove('d-none');
        addWaybackReportBtn.classList.remove('d-none');

        processedData = await window.electronAPI.parseFile(filePath);
        currentlyDisplayedDomains = [...processedData];

        if (processedData.length === 0) {
            startBtn.disabled = true;
            statusElem.textContent = `File loaded is empty. Add domains via Wayback Report to begin.`;
            addLog('info', `File loaded: ${fileName} (0 domains). Ready for manual input.`, new Date().toLocaleTimeString());
        } else {
            startBtn.disabled = false;
            statusElem.textContent = `File loaded! ${processedData.length} domains ready. Choose options and click Start.`;
            addLog('info', `File loaded: ${fileName} (${processedData.length} domains).`, new Date().toLocaleTimeString());
        }
        
        updateStatsCounters(processedData);
        updateUIBasedOnCredentials();
        renderPage();

    } catch (error) {
        statusElem.textContent = `Error: ${error.message}`;
        addLog('error', `Failed to load file: ${error.message}`, new Date().toLocaleTimeString());
    }
}

// --- Event Listeners ---
resetBtn.addEventListener('click', resetApplicationState);

stopBtn.addEventListener('click', async () => {
    isProcessing = false;
});

uploadBtn.addEventListener('click', async () => {
    try {
        const filePath = await window.electronAPI.openFile();
        if (filePath) handleFileProcessing(filePath);
    } catch (error) {
        statusElem.textContent = `Error: ${error.message}`;
        addLog('error', `File selection error: ${error.message}`, new Date().toLocaleTimeString());
    }
});

dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.name.endsWith('.csv')) {
            try {
                handleFileProcessing(file.path);
            } catch (error) {
                statusElem.textContent = `Error: ${error.message}`;
                addLog('error', `File drop error: ${error.message}`, new Date().toLocaleTimeString());
            }
        } else {
            statusElem.textContent = 'Error: File must be .csv format';
            addLog('error', 'Dropped file is not a CSV', new Date().toLocaleTimeString());
        }
    }
});

processListBtn.addEventListener('click', () => {
    const text = domainListTextarea.value;
    isManualInput = true;

    initialView.classList.add('d-none');
    processingView.classList.remove('d-none');
    controlPanel.classList.remove('hidden');

    fileNameElem.textContent = "Manual Domain List";
    fileNameElem.classList.remove('d-none');
    startBtn.classList.remove('d-none');
    toggleControlsBtn.classList.remove('d-none');
    addWaybackReportBtn.classList.remove('d-none');

    const dateFilterGroup = document.querySelector('[data-lang-key="step1Title"]').closest('.control-group');
    if (dateFilterGroup) {
        dateFilterGroup.style.opacity = '0.5';
        dateFilterGroup.querySelectorAll('input').forEach(el => el.disabled = true);
    }

    const domains = text.split('\n')
                        .map(domain => domain.trim())
                        .filter(domain => domain.length > 0);

    processedData = domains.map(domain => ({
        'Domain Name': domain, 'Domain Age': 'N/A',
        'Auction End Time': new Date().toISOString(),
        'Majestic TF': 'N/A', 'Majestic CF': 'N/A',
        'Backlinks': 'N/A', 'Referring Domains': 'N/A', 'Traffic': 'N/A'
    }));
    currentlyDisplayedDomains = [...processedData];

    if (domains.length === 0) {
        startBtn.disabled = true;
        statusElem.textContent = `List is empty. Paste domains or add a Wayback report to begin.`;
        addLog('info', `Processed an empty domain list. Ready for Wayback report.`, new Date().toLocaleTimeString());
    } else {
        startBtn.disabled = false;
        statusElem.textContent = `${processedData.length} domains loaded from list. Ready to start.`;
        addLog('info', `${processedData.length} domains loaded from text list.`, new Date().toLocaleTimeString());
    }
    
    updateStatsCounters(processedData);
    updateUIBasedOnCredentials();
    renderPage();
});


toggleControlsBtn.addEventListener('click', () => controlPanel.classList.toggle('hidden'));

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        switchTab(btn.dataset.tab);
    });
});

startBtn.addEventListener('click', async () => {
    if (currentlyDisplayedDomains.length === 0 || isProcessing) return;
    isProcessing = true;
    startBtn.disabled = true;
    resetBtn.disabled = true;
    stopBtn.classList.remove('d-none');
    toggleControlsBtn.classList.add('d-none');
    addWaybackReportBtn.disabled = true; 
    
    controlPanel.classList.add('hidden');
    analysisOptions.disabled = true;
    outputCard.classList.remove('d-none');
    progressBarContainer.classList.remove('d-none');
    
    switchTab('results-tab');
    
    logPanel.innerHTML = '';
    addLog('info', 'Process started...', new Date().toLocaleTimeString());

    copyDropdownBtn.disabled = true;
    exportCsvBtn.disabled = true;
    
    let domainsToProcess = [...currentlyDisplayedDomains];
    
    if (!isManualInput) {
        updateStepIndicator(1);
        updateProgress(5, 'STEP 1: Filtering domains...');
        const domainNameColumn = 'Domain Name', tfColumn = 'Majestic TF', cfColumn = 'Majestic CF', dateColumn = 'Auction End Time';
        domainsToProcess = currentlyDisplayedDomains.filter(domain => {
            const selectedRange = document.querySelector('input[name="dateRange"]:checked').value;
            const startDate = new Date();
            if (startTomorrowCheckbox.checked) startDate.setDate(startDate.getDate() + 1);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(startDate);
            if (selectedRange !== 'today') endDate.setDate(startDate.getDate() + parseInt(selectedRange.replace('days', '')) - 1);
            endDate.setHours(23, 59, 59, 999);
            const tf = parseInt(domain[tfColumn], 10) || 0;
            const cf = parseInt(domain[cfColumn], 10) || 0;
            return new Date(domain[dateColumn]) >= startDate && new Date(domain[dateColumn]) <= endDate && tf > 0 && cf > 0;
        });
        
        if (domainsToProcess.length === 0) {
            await stopProcess('No domains passed the initial filter.');
            return;
        }
        updateProgress(10, `STEP 1 Complete: ${domainsToProcess.length} domains passed.`);
    } else {
        updateProgress(10, `STEP 1 Bypassed: Manual input detected.`);
        addLog('info', 'STEP 1 (Date/TF Filter) was bypassed for manual list.', new Date().toLocaleTimeString());
    }

    currentlyDisplayedDomains = [...domainsToProcess];
    updateStatsCounters(currentlyDisplayedDomains);
    renderPage();
    
    if (isProcessing && filterSeoCheckbox.checked) {
        updateStepIndicator(2);
        window.electronAPI.onSpamScoreProgress(({ percentage, message }) => updateProgress(10 + (percentage * 0.1), `STEP 2: ${message}`));
        const domainNames = domainsToProcess.map(d => d['Domain Name']);
        const seoData = await window.electronAPI.checkSpamScore(domainNames);
        const safeDomains = [];
        domainsToProcess.forEach(domain => {
            const data = seoData[domain['Domain Name']];
            const spamScore = parseInt(String(data?.['Spam Score']).replace('%', '')) || 100;
            const da = parseInt(data?.['Domain Authority'], 10) || 0;
            const pa = parseInt(data?.['Page Authority'], 10) || 0;
            if (spamScore <= 1 && !(da === 0 && pa === 0)) {
                safeDomains.push({ ...domain, 'DA': da, 'PA': pa, 'Spam Score': `${spamScore}%` });
            }
        });
        domainsToProcess = safeDomains;
        if (domainsToProcess.length === 0) {
            await stopProcess(`STEP 2 Complete. No domains passed SS & DA/PA filter.`);
            return;
        }
        updateProgress(20, `STEP 2 Complete. ${domainsToProcess.length} safe domains remain.`);
        currentlyDisplayedDomains = [...domainsToProcess];
        updateStatsCounters(currentlyDisplayedDomains);
        renderPage();
    }

    if (isProcessing && checkIndexCheckbox.checked) {
        updateStepIndicator(2);
        window.electronAPI.onIndexCheckProgress(({ percentage, message }) => updateProgress(20 + (percentage * 0.05), `STEP 2.5: ${message}`));
        const domainNames = domainsToProcess.map(d => d['Domain Name']);
        const indexStatusData = await window.electronAPI.checkGoogleIndex(domainNames, false);
        domainsToProcess.forEach(d => d['G-INDEX'] = indexStatusData[d['Domain Name']]);
        const indexedDomains = domainsToProcess.filter(domain => domain['G-INDEX']?.status === 'INDEX');
        
        if (indexedDomains.length === 0) {
            await stopProcess(`STEP 2.5 Complete. No domains passed Google Index filter.`);
            return;
        }
        
        domainsToProcess = indexedDomains;
        updateProgress(25, `STEP 2.5 Complete. ${domainsToProcess.length} indexed domains remain.`);
        currentlyDisplayedDomains = [...domainsToProcess];
        updateStatsCounters(currentlyDisplayedDomains);
        renderPage();
    }
    if (isProcessing && checkForbiddenCheckbox.checked) {
        updateStepIndicator(2);
        window.electronAPI.onIndexCheckProgress(({ percentage, message }) => updateProgress(25 + (percentage * 0.05), `STEP 2.6: ${message}`));
        const domainNames = domainsToProcess.map(d => d['Domain Name']);
        const forbiddenStatusData = await window.electronAPI.checkGoogleIndex(domainNames, true);
        domainsToProcess.forEach(d => d['G-CONTENT'] = forbiddenStatusData[d['Domain Name']]);
        updateProgress(30, `STEP 2.6 Complete. Forbidden check finished.`);
        currentlyDisplayedDomains = [...domainsToProcess];
        renderPage();
    }
    
    if (isProcessing && (collectAhrefsCheckbox.checked || aiAnalysisCheckbox.checked)) {
        let count = 0;
        const total = domainsToProcess.length;
        for (const domain of domainsToProcess) {
            if (!isProcessing) break;
            count++;
            
            if (collectAhrefsCheckbox.checked) {
                updateStepIndicator(3);
                updateProgress(30 + (count / total) * 35, `STEP 3: Checking Ahrefs (${count}/${total})...`);
                const result = await window.electronAPI.ahrefsCheckDomain(domain['Domain Name']);
                if (!isProcessing) break;
                const domainIndex = currentlyDisplayedDomains.findIndex(d => d['Domain Name'] === domain['Domain Name']);
                if(domainIndex > -1) currentlyDisplayedDomains[domainIndex].ahrefsResult = result;
            }

            if (isProcessing && aiAnalysisCheckbox.checked) {
                updateStepIndicator(4);
                const baseProgress = 30 + (collectAhrefsCheckbox.checked ? 35 : 0);
                updateProgress(baseProgress + (count / total) * 35, `STEP 4: AI Analysis (${count}/${total})...`);
                const currentDomainData = currentlyDisplayedDomains.find(d => d['Domain Name'] === domain['Domain Name']);
                const aiDecision = await window.electronAPI.analyzeDomainWithAI(currentDomainData);
                if (!isProcessing) break;
                const domainIndex = currentlyDisplayedDomains.findIndex(d => d['Domain Name'] === domain['Domain Name']);
                if(domainIndex > -1) currentlyDisplayedDomains[domainIndex].aiResult = aiDecision;
            }
            updateStatsCounters(currentlyDisplayedDomains);
            renderPage();
        }
    }
    
    if (isProcessing && collectAhrefsCheckbox.checked) {
        const getFailedDomains = () => currentlyDisplayedDomains.filter(d => 
            d.ahrefsResult && d.ahrefsResult.topBacklinks?.length === 0 && !d.ahrefsResult.error
        );

        let failedDomains = getFailedDomains();
        let retryCount = 0;
        const maxRetries = 3;

        while (failedDomains.length > 0 && retryCount < maxRetries && isProcessing) {
            retryCount++;
            addLog('warning', `Found ${failedDomains.length} domain(s) with 'None' backlinks. Starting re-check attempt #${retryCount}...`, new Date().toLocaleTimeString());
            
            let recheckCount = 0;
            const totalToRecheck = failedDomains.length;

            for (const domain of failedDomains) {
                if (!isProcessing) break;
                recheckCount++;
                const domainName = domain['Domain Name'];
                
                updateProgress(99, `Re-checking ${domainName} (${recheckCount}/${totalToRecheck})`);
                addLog('info', `Re-checking Ahrefs for: ${domainName}`, new Date().toLocaleTimeString());

                const result = await window.electronAPI.ahrefsCheckDomain(domainName, true);
                
                if (!isProcessing) break;

                const domainIndex = currentlyDisplayedDomains.findIndex(d => d['Domain Name'] === domainName);
                if (domainIndex > -1) {
                    const existingAiResult = currentlyDisplayedDomains[domainIndex].aiResult;
                    currentlyDisplayedDomains[domainIndex].ahrefsResult = result;
                    if(existingAiResult) {
                         currentlyDisplayedDomains[domainIndex].aiResult = existingAiResult;
                    }
                }
                
                renderPage();
            }
            
            if (!isProcessing) break;
            failedDomains = getFailedDomains();
        }

        if (isProcessing && failedDomains.length > 0) {
            addLog('error', `${failedDomains.length} domain(s) still have 'None' backlinks after ${maxRetries} attempts.`, new Date().toLocaleTimeString());
        }
    }
    
    if (isProcessing) {
        await stopProcess(`All processes complete.`);
    } else {
        await stopProcess(`Process stopped by user.`);
    }
});

function renderPage() {
    paginationControls.classList.toggle('d-none', currentlyDisplayedDomains.length <= rowsPerPage);
    const totalPages = Math.ceil(currentlyDisplayedDomains.length / rowsPerPage) || 1;
    pageStatus.textContent = (currentTranslations.pageStatus || 'Page {currentPage} of {totalPages}')
        .replace('{currentPage}', currentPage)
        .replace('{totalPages}', totalPages);
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage >= totalPages;
    const paginatedItems = currentlyDisplayedDomains.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
    displayDomains(paginatedItems, 'Domain Name');
}

prevPageBtn.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderPage(); } });
nextPageBtn.addEventListener('click', () => {
    if (currentPage < Math.ceil(currentlyDisplayedDomains.length / rowsPerPage)) { currentPage++; renderPage(); }
});

function displayDomains(domains, domainNameColumn) {
    tableHeader.innerHTML = ''; 
    tableBody.innerHTML = '';
    
    const actionsContainer = document.querySelector('.results-table-header .actions');
    if (currentlyDisplayedDomains.length === 0) {
        actionsContainer.classList.add('d-none');
    } else {
        actionsContainer.classList.remove('d-none');
    }
    
    const baseHeaderKeys = ['colDomainName', 'colDomainAge', 'colAuctionEnd', 'colGIndex', 'colGContent'];
    const internalKeys = ['Domain Name', 'Domain Age', 'Auction End Time', 'G-INDEX', 'G-CONTENT'];
    
    let headerHtml = '';
    const headersInObject = Object.keys(currentlyDisplayedDomains[0] || {});

    internalKeys.forEach((key, index) => {
        if(headersInObject.includes(key) && currentTranslations[baseHeaderKeys[index]]) {
            headerHtml += `<th>${currentTranslations[baseHeaderKeys[index]]}</th>`;
        }
    });

    const dynamicHeaders = headersInObject.filter(h => 
        !internalKeys.includes(h) && 
        !['bids', 'price', 'estimated value', 'est. value', 'itemid', 'sale type', 'ahrefsresult', 'airesult', 'manualwaybackreport'].includes(h.toLowerCase().trim())
    );
    dynamicHeaders.forEach(h => headerHtml += `<th>${h}</th>`);

    if (collectAhrefsCheckbox.checked) headerHtml += `<th>${currentTranslations.colAhrefsToxic}</th><th>${currentTranslations.colTopBacklinks}</th>`;
    
    headerHtml += `<th>WAYBACK</th>`;

    if (aiAnalysisCheckbox.checked) headerHtml += `<th>${currentTranslations.colAiRec}</th><th>${currentTranslations.colCategory}</th>`;
    headerHtml += `<th>${currentTranslations.colActions}</th>`;
    tableHeader.innerHTML = headerHtml;

    const headersToDisplay = [...internalKeys.filter(key => headersInObject.includes(key)), ...dynamicHeaders];

    domains.forEach(domain => {
        const row = document.createElement('tr');
        row.dataset.domain = domain[domainNameColumn];
        const domainData = currentlyDisplayedDomains.find(d => d[domainNameColumn] === domain[domainNameColumn]);
        
        const decision = domainData?.aiResult?.keputusan;
        if (decision === 'Low Quality' || decision === 'Sangat Berisiko' || domainData?.['G-CONTENT']?.status === 'FORBIDDEN') {
            row.style.backgroundColor = 'var(--danger-light)';
        } else if (decision === 'Medium Quality' || domainData?.ahrefsResult?.backlinkSpam !== 'Aman' || domainData?.ahrefsResult?.anchorSpam !== 'Aman') {
            row.style.backgroundColor = 'var(--warning-light)';
        }
        
        let cellsHtml = '';
        headersToDisplay.forEach(header => {
            let cellContent = domain[header] || '-';
            if (header === 'G-INDEX' || header === 'G-CONTENT') {
                const statusObj = domain[header];
                const originalStatus = statusObj ? statusObj.status : '-';
                
                if (header === 'G-CONTENT' && originalStatus === 'FORBIDDEN' && statusObj.words && statusObj.words.length > 0) {
                    cellContent = `<button class="badge badge-danger view-details-btn" data-type="forbidden-words" data-domain="${domain[domainNameColumn]}" data-words="${statusObj.words.join(', ')}">${currentTranslations.notSafe || 'Not Safe'}</button>`;
                } else {
                    let displayText = originalStatus;
                    let badgeClass = 'badge-info';
                    if (originalStatus === 'CLEAN') { displayText = currentTranslations.safe || 'Safe'; badgeClass = 'badge-success'; } 
                    else if (originalStatus === 'FORBIDDEN') { displayText = currentTranslations.notSafe || 'Not Safe'; badgeClass = 'badge-danger'; } 
                    else if (originalStatus === 'INDEX') { badgeClass = 'badge-success'; } 
                    else if (originalStatus === 'NOINDEX' || originalStatus === 'Error') { badgeClass = 'badge-danger'; }
                    cellContent = `<span class="badge ${badgeClass}">${displayText}</span>`;
                }
            }
            cellsHtml += `<td>${cellContent}</td>`;
        });

        if (collectAhrefsCheckbox.checked) {
            let toxicCell = 'Queued', backlinksCell = 'Queued';
            if (domainData?.ahrefsResult) {
                const { error, backlinkSpam, anchorSpam, topBacklinks, backlinkWords, anchorWords } = domainData.ahrefsResult;
                if (error) { toxicCell = `<span class="badge badge-danger">Error</span>`; }
                else {
                    let backlinkBadge = `<span class="badge ${backlinkSpam === 'Aman' ? 'badge-success' : 'badge-danger'}">${backlinkSpam}</span>`;
                    if (backlinkSpam !== 'Aman' && backlinkWords?.length > 0) backlinkBadge = `<button class="badge badge-danger view-details-btn" data-type="toxic-words" data-domain="${domain[domainNameColumn]}" data-words="${backlinkWords.join(', ')}">${backlinkSpam}</button>`;
                    let anchorBadge = `<span class="badge ${anchorSpam === 'Aman' ? 'badge-success' : 'badge-danger'}">${anchorSpam}</span>`;
                    if (anchorSpam !== 'Aman' && anchorWords?.length > 0) anchorBadge = `<button class="badge badge-danger view-details-btn" data-type="toxic-words" data-domain="${domain[domainNameColumn]}" data-words="${anchorWords.join(', ')}">${anchorSpam}</button>`;
                    toxicCell = `${currentTranslations.backlink || 'Backlink'}: ${backlinkBadge}<br>${currentTranslations.anchor || 'Anchor'}: ${anchorBadge}`;
                }
                backlinksCell = (topBacklinks?.length > 0) ? `<button class="btn btn-outline btn-sm view-details-btn" data-type="backlinks" data-domain="${domain[domainNameColumn]}">${currentTranslations.view || 'View'} (${topBacklinks.length})</button>` : `<span class="text-muted">None</span>`;
            }
            cellsHtml += `<td>${toxicCell}</td><td>${backlinksCell}</td>`;
        }

        let waybackCell;
        if (domainData?.manualWaybackReport) {
            waybackCell = `<td><button class="badge badge-success view-details-btn" data-type="wayback-report" data-domain="${domain[domainNameColumn]}">DITEMUKAN</button></td>`;
        } else {
            waybackCell = `<td>Not Found</td>`;
        }
        cellsHtml += waybackCell;

        if (aiAnalysisCheckbox.checked) {
            let aiCell = 'Queued', categoryCell = 'Queued';
            if (domainData?.aiResult) {
                const { keputusan, alasan } = domainData.aiResult;
                let badgeClass = 'badge-info';
                if (keputusan === 'High Quality') badgeClass = 'badge-success';
                else if (keputusan === 'Low Quality' || keputusan === 'Sangat Berisiko' || keputusan === 'Error') badgeClass = 'badge-danger';
                else if (keputusan === 'Medium Quality') badgeClass = 'badge-warning';
                
                aiCell = (alasan?.length > 0) ? `<button class="badge ${badgeClass} view-details-btn" data-type="ai" data-domain="${domain[domainNameColumn]}">${keputusan}</button>` : `<span class="badge ${badgeClass}">${keputusan}</span>`;
                categoryCell = domainData.aiResult.kategori || 'N/A';
            }
            cellsHtml += `<td>${aiCell}</td><td>${categoryCell}</td>`;
        }
        
        cellsHtml += `<td><button class="copy-btn btn btn-secondary btn-sm">${currentTranslations.copy || 'Copy'}</button></td>`;
        row.innerHTML = cellsHtml;
        tableBody.appendChild(row);
    });
    
    tableBody.querySelectorAll('a').forEach(a => a.addEventListener('click', (e) => { e.preventDefault(); window.electronAPI.openExternalLink(a.href); }));
    tableBody.querySelectorAll('.copy-btn').forEach(btn => btn.addEventListener('click', (e) => {
        const domainToCopy = e.target.closest('tr').dataset.domain;
        navigator.clipboard.writeText(domainToCopy).then(() => {
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = currentTranslations.copy || 'Copy'; }, 1500);
        });
    }));
}

// --- Modal Logic ---
tableBody.addEventListener('click', (e) => {
    const button = e.target.closest('.view-details-btn');
    if (button) {
        const domainName = button.dataset.domain;
        const type = button.dataset.type;
        const domainData = currentlyDisplayedDomains.find(d => d['Domain Name'] === domainName);

        if (type === 'toxic-words' || type === 'forbidden-words') {
            const words = button.dataset.words.split(',');
            const title = type === 'toxic-words' ? `Detected Toxic Words for: ${domainName}` : `Detected Forbidden Words for: ${domainName}`;
            modalTitle.textContent = title;
            modalBody.innerHTML = (words.length === 0 || button.dataset.words === '') ? '<p>No specific keywords were found.</p>' : `<p>The following keywords were detected:</p><ul>${words.map(w => `<li>${w.trim()}</li>`).join('')}</ul>`;
            modal.classList.add('active');
            return;
        }
        
        if (!domainData) return;

        if (type === 'backlinks') {
            modalTitle.textContent = `Top Backlinks for: ${domainName}`;
            const backlinks = domainData.ahrefsResult?.topBacklinks || [];
            if (backlinks.length === 0) {
                 modalBody.innerHTML = '<p>No backlink data found.</p>';
            } else {
                modalBody.innerHTML = backlinks.map(bl => `
                    <div class="backlink-card">
                        <div class="backlink-header"><a href="${bl.referringPageUrl}" title="${bl.referringPageUrl}">${bl.referringPageTitle || 'No Title'}</a></div>
                        <div class="backlink-body">
                            <div class="backlink-grid">
                                <div><strong>DR:</strong> <span class="badge badge-danger">${bl.dr}</span></div>
                                <div><strong>UR:</strong> <span class="badge badge-info">${bl.ur}</span></div>
                                <div><strong>Domain Traffic:</strong> ${bl.domainTraffic}</div>
                                <div><strong>Page Traffic:</strong> ${bl.pageTraffic}</div>
                            </div>
                            <div class="backlink-full-col">
                                <strong>Anchor & Target:</strong>
                                <p>${bl.anchorAndTarget.replace(/\n/g, '<br>')}</p>
                            </div>
                        </div>
                    </div>`).join('');
            }
        } else if (type === 'ai') {
            modalTitle.textContent = `AI Analysis for: ${domainName}`;
            const { keputusan, alasan } = domainData.aiResult || {};
            const forbiddenStatus = domainData['G-CONTENT']?.status === 'FORBIDDEN' ? 'Not Safe' : 'Safe';
            const dofollowRD = domainData.ahrefsResult?.dofollowData?.referringDomains;
            const dofollowBL = domainData.ahrefsResult?.dofollowData?.backlinks;
            
            modalBody.innerHTML = `
                <div class="ai-summary-grid">
                    <div><strong>Age:</strong> ${domainData['Domain Age']} years</div>
                    <div><strong>G-INDEX:</strong> ${domainData['G-INDEX']?.status || 'N/A'}</div>
                    <div><strong>G-CONTENT:</strong> ${forbiddenStatus}</div>
                    <div><strong>TF/CF:</strong> ${domainData['Majestic TF']}/${domainData['Majestic CF']}</div>
                    <div><strong>DA/PA:</strong> ${domainData['DA'] || 'N/A'}/${domainData['PA'] || 'N/A'}</div>
                    <div><strong>Spam Score:</strong> ${domainData['Spam Score'] || 'N/A'}</div>
                    <div><strong>Dofollow RD:</strong> ${dofollowRD?.followed || 'N/A'}</div>
                    <div><strong>Dofollow BL:</strong> ${dofollowBL?.notFollowed || 'N/A'}</div>
                </div>
                <h4>Decision: ${keputusan || 'N/A'}</h4>
                <p>Reasons:</p>
                <ul>${(alasan || ['No reasons provided.']).map(r => `<li>${r}</li>`).join('')}</ul>`;
        } else if (type === 'wayback-report') {
            modalTitle.textContent = `Wayback Report for: ${domainName}`;
            const report = domainData.manualWaybackReport || {};
            
            const formatReportValue = (key, value) => {
                const upperValue = String(value).toUpperCase();
                if (upperValue === 'AMAN' || upperValue === 'SAFE') return `<span class="badge badge-success">${value}</span>`;
                if (upperValue === 'NO INDEX') return `<span class="badge badge-danger">${value}</span>`;
                if (upperValue.includes('BOLONG')) return `<span class="badge badge-warning">${value}</span>`;
                if (String(value).startsWith('http')) return `<a href="${value}" target="_blank">${value}</a>`;
                return String(value).replace(/\n/g, '<br>');
            };

            let reportHtml = '<div class="report-grid-container">';
            if (Object.keys(report).length > 0) {
                const fullWidthKeys = ['DOMAIN CONTENT', 'DOMAIN REDIRECT'];
                for (const [key, value] of Object.entries(report)) {
                    const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
                    const formattedValue = formatReportValue(key, value);
                    const itemClass = fullWidthKeys.includes(key) ? 'report-item full-width' : 'report-item';
                    
                    reportHtml += `
                        <div class="${itemClass}">
                            <div class="report-label">${formattedKey}</div>
                            <div class="report-value">${formattedValue}</div>
                        </div>
                    `;
                }
            } else {
                reportHtml += '<p>No report details found.</p>';
            }
            reportHtml += '</div>';
            modalBody.innerHTML = reportHtml;
        }

        modal.classList.add('active');
    }
});

modalCloseBtn.addEventListener('click', () => modal.classList.remove('active'));
modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });
modalBody.addEventListener('click', (e) => {
    if (e.target.tagName === 'A' && e.target.href) {
        e.preventDefault();
        window.electronAPI.openExternalLink(e.target.href);
    }
});

// --- Dark/Light Mode Logic ---
const sunIcon = `<path d="M12 1v2m0 18v2M4.2 4.2l1.4 1.4m12.8 12.8l1.4 1.4M1 12h2m18 0h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/><circle cx="12" cy="12" r="5"/>`;
const moonIcon = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`;

function applyTheme(theme) {
    document.documentElement.classList.toggle('dark-mode', theme === 'dark');
    themeIcon.innerHTML = theme === 'dark' ? sunIcon : moonIcon;
    localStorage.setItem('theme', theme);
}

themeToggle.addEventListener('click', () => {
    const newTheme = document.documentElement.classList.contains('dark-mode') ? 'light' : 'dark';
    applyTheme(newTheme);
});


// --- Inisialisasi Aplikasi ---
window.electronAPI.onLogMessage(({ level, message, timestamp }) => addLog(level, message, timestamp));

document.addEventListener('DOMContentLoaded', async () => {
    const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(savedTheme);
    
    const savedLang = localStorage.getItem('userLanguage') || 'en';
    await setLanguage(savedLang);

    spamKeywords = await window.electronAPI.getSpamKeywords();
    
    resetApplicationState();
    
    credentialsExist = await window.electronAPI.checkCredentials();
    updateUIBasedOnCredentials();

    settingsBtn.addEventListener('click', openSettingsModal);
    settingsModalCloseBtn.addEventListener('click', closeSettingsModal);
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            closeSettingsModal();
        }
    });

    credentialsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = ahrefsEmailInput.value;
        const password = ahrefsPasswordInput.value;

        if (!email || !password) {
            showFlashMessage('Email and password cannot be empty.', 'error');
            return;
        }

        saveCredentialsBtn.disabled = true;
        saveCredentialsBtn.textContent = 'Saving...';

        const result = await window.electronAPI.saveCredentials({ email, password });

        if (result.success) {
            credentialsExist = true;
            updateUIBasedOnCredentials();
            closeSettingsModal();
            showFlashMessage('Ahrefs credentials saved successfully!', 'success');
        } else {
            showFlashMessage(`Error: ${result.message}`, 'error');
        }

        saveCredentialsBtn.disabled = false;
        saveCredentialsBtn.textContent = 'Save Credentials';
    });

    const tableWrapper = document.getElementById('table-responsive-wrapper');
    const resultsTable = document.getElementById('results-table');
    
    if(tableWrapper && resultsTable) {
        tableWrapper.addEventListener('scroll', () => {
            resultsTable.classList.toggle('is-scrolling', tableWrapper.scrollLeft > 0);
        });
    }

    copyDropdownBtn.addEventListener('click', () => copyDropdown.classList.toggle('active'));
    window.addEventListener('click', (e) => { if (!copyDropdown.contains(e.target)) copyDropdown.classList.remove('active'); });

    dropdownContent.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' && e.target.dataset.copytype) {
            const copyType = e.target.dataset.copytype;
            let domainsToCopy = [];

            if (copyType === 'all') domainsToCopy = currentlyDisplayedDomains;
            else domainsToCopy = currentlyDisplayedDomains.filter(d => d.aiResult?.keputusan === copyType);

            if (domainsToCopy.length === 0) {
                copyDropdownBtn.querySelector('span').textContent = 'No Domains!';
                setTimeout(() => { copyDropdownBtn.querySelector('span').textContent = currentTranslations.copy || 'Copy'; }, 2000);
                return;
            }

            const domainListText = domainsToCopy.map(d => d['Domain Name']).join('\n');
            navigator.clipboard.writeText(domainListText).then(() => {
                copyDropdownBtn.querySelector('span').textContent = `Copied ${domainsToCopy.length}!`;
                setTimeout(() => { copyDropdownBtn.querySelector('span').textContent = currentTranslations.copy || 'Copy'; }, 2000);
            });
        }
    });
    
    exportCsvBtn.addEventListener('click', async () => {
        if (currentlyDisplayedDomains.length === 0) {
            addLog('error', 'No data to export.', new Date().toLocaleTimeString());
            return;
        }

        const cleanCell = (data) => {
            if (data === null || data === undefined) return '';
            const str = String(data);
            return (str.includes(',') || str.includes('"') || str.includes('\n')) ? `"${str.replace(/"/g, '""')}"` : str;
        };

        const headers = [ "DOMAIN NAME", "TRAFFIC", "DOMAIN AGE", "AUCTION END TIME", "MAJESTIC TF", "MAJESTIC CF", "BACKLINKS", "REFERRING DOMAINS", "DA", "PA", "SPAM SCORE", "G-INDEX", "G-CONTENT", "AHREFS TOXIC", "TOP BACKLINKS", "AI REC.", "CATEGORY" ];
        let csvContent = headers.join(',') + '\n';

        currentlyDisplayedDomains.forEach(domain => {
            const ahrefs = domain.ahrefsResult, ai = domain.aiResult, gContent = domain['G-CONTENT'];
            const rowData = [
                domain['Domain Name'], domain['Traffic'], domain['Domain Age'], domain['Auction End Time'],
                domain['Majestic TF'], domain['Majestic CF'], domain['Backlinks'], domain['Referring Domains'],
                domain['DA'], domain['PA'], domain['Spam Score'],
                domain['G-INDEX']?.status || '',
                (gContent?.status === 'FORBIDDEN') ? `Not Safe (${gContent.words.join(' ')})` : (gContent?.status || ''),
                (ahrefs) ? `Backlink: ${ahrefs.backlinkSpam} | Anchor: ${ahrefs.anchorSpam}` : '',
                (ahrefs?.topBacklinks) ? ahrefs.topBacklinks.map(bl => bl.referringPageUrl).join(' | ') : '',
                ai?.keputusan || '', ai?.kategori || ''
            ];
            csvContent += rowData.map(cleanCell).join(',') + '\n';
        });

        const result = await window.electronAPI.saveCsv(csvContent);
        if (result.success) {
            const message = `Data exported! <a href="#" data-path="${result.path}" class="open-folder-link">Open Folder</a>`;
            showFlashMessage(message, 'success');
        } else if (result.message !== 'Save cancelled') {
            showFlashMessage(`Export failed: ${result.message}`, 'error');
        }
    });

    document.body.addEventListener('click', (e) => {
        const link = e.target.closest('a.open-folder-link');
        if (link) {
            e.preventDefault();
            window.electronAPI.showItemInFolder(link.dataset.path);
        }
    });

    const inputTabs = document.querySelectorAll('.tab-btn-input');
    const inputContents = document.querySelectorAll('.tab-content-input');
    inputTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            inputTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            inputContents.forEach(content => content.style.display = content.id === tab.dataset.tabInput ? 'block' : 'none');
        });
    });

    langBtnContainer.addEventListener('click', (e) => {
        const targetButton = e.target.closest('button');
        if (targetButton && targetButton.dataset.lang) {
            setLanguage(targetButton.dataset.lang);
        }
    });
    
    addWaybackReportBtn.addEventListener('click', () => {
        waybackReportModal.classList.add('active');
    });

    waybackModalCloseBtn.addEventListener('click', () => {
        waybackReportModal.classList.remove('active');
    });

    applyWaybackReportBtn.addEventListener('click', () => {
        const reportText = waybackReportTextarea.value;
        if (!reportText.trim()) {
            addLog('warning', 'Wayback report textarea is empty.', new Date().toLocaleTimeString());
            return;
        }

        const parsedReports = parseWaybackReport(reportText);
        let appliedCount = 0;
        let removedForRedirect = 0;
        let removedForContent = 0;

        currentlyDisplayedDomains.forEach(domain => {
            const domainName = domain['Domain Name'];
            const report = parsedReports[domainName];

            if (report) {
                if (isManualInput) {
                    const summaryObject = {
                        'DOMAIN CATEGORY': report['DOMAIN CATEGORY'],
                        'DOMAIN REDIRECT': report['DOMAIN REDIRECT'],
                        'DOMAIN AGE': report['DOMAIN AGE'],
                        'TOPICAL CONSISTENCY': report['TOPICAL CONSISTENCY']
                    };
                    domain.manualWaybackReport = summaryObject;
                    domain['Domain Age'] = report['DOMAIN AGE'] || 'N/A';
                } else {
                    const summaryObject = {
                        'DOMAIN REDIRECT': report['DOMAIN REDIRECT'],
                        'TOPICAL CONSISTENCY': report['TOPICAL CONSISTENCY']
                    };
                    domain.manualWaybackReport = summaryObject;
                }
                appliedCount++;
            }
        });

        const domainsToKeep = currentlyDisplayedDomains.filter(domain => {
            if (!domain.manualWaybackReport) {
                return true;
            }
            const report = parsedReports[domain['Domain Name']];
            if (!report) return true;

            if (report['DOMAIN REDIRECT'] && /\b301\b|NOT SAFE|TIDAK AMAN/i.test(String(report['DOMAIN REDIRECT']))) {
                addLog('error', `Domain ${domain['Domain Name']} dihapus: Ditemukan Redirect tidak aman.`, new Date().toLocaleTimeString());
                removedForRedirect++;
                return false;
            }

            if (report['DOMAIN CONTENT'] && spamKeywords.length > 0) {
                const content = String(report['DOMAIN CONTENT']).toLowerCase();
                const foundKeyword = spamKeywords.find(keyword => content.includes(keyword.toLowerCase()));
                
                if (foundKeyword) {
                    addLog('error', `Domain ${domain['Domain Name']} dihapus: Konten mengandung kata terlarang "${foundKeyword}".`, new Date().toLocaleTimeString());
                    removedForContent++;
                    return false;
                }
            }
            return true;
        });

        currentlyDisplayedDomains = domainsToKeep;
        
        processedData = processedData.filter(pDomain => 
            currentlyDisplayedDomains.some(cDomain => cDomain['Domain Name'] === pDomain['Domain Name'])
        );

        addLog('success', `Laporan diterapkan pada ${appliedCount} domain.`, new Date().toLocaleTimeString());
        if(removedForRedirect > 0) addLog('warning', `${removedForRedirect} domain dihapus karena redirect.`, new Date().toLocaleTimeString());
        if(removedForContent > 0) addLog('warning', `${removedForContent} domain dihapus karena konten terlarang.`, new Date().toLocaleTimeString());
        
        waybackReportModal.classList.remove('active');
        
        if (currentlyDisplayedDomains.length > 0) {
            startBtn.disabled = false;
            statusElem.textContent = `${currentlyDisplayedDomains.length} domains ready for analysis.`;
        } else {
            startBtn.disabled = true;
            statusElem.textContent = `List is empty. Add a valid Wayback report to begin.`;
        }

        updateStatsCounters(currentlyDisplayedDomains);
        renderPage();
    });

    const waybackFormatSample = `------------------------------------------------
✅ FINAL REPORT WAYBACK CHECKER ✅
------------------------------------------------
DETAILS: 🔗 101Link | ⏰22-07-2025
------------------------------------------------
DOMAIN: example.com
LAST ONLINE: December 13, 2024
LAST FULL YEARS: 1 TAHUN BOLONG
DOMAIN CONTENT: JUDI
DOMAIN REDIRECT: AMAN
DOMAIN AGE: 6Y, 30D
DOMAIN CATEGORY: Example Category
TOPICAL CONSISTENCY: Tidak Konsisten ( Perubahan dari A ke B )
TEMPLATE CONSISTENCY: Konsisten
GOOGLE INDEX: NO INDEX
GOOGLE CONTENT: Safe
DA/PA/SS: 31 / 28 / 1%
DEMITOOLS: https://example.com/screenshot1  
SPAMHAUS: https://example.com/screenshot2
------------------------------------------------`;

    downloadWaybackFormatBtn.addEventListener('click', async () => {
        try {
            const result = await window.electronAPI.saveFile(waybackFormatSample, 'wayback-report-format.txt');
            if (result.success) {
                const message = `Sample format saved! <a href="#" data-path="${result.path}" class="open-folder-link">Open Folder</a>`;
                showFlashMessage(message, 'success');
            } else if (result.message !== 'Save cancelled') {
                showFlashMessage(`Failed to save sample: ${result.message}`, 'error');
            }
        } catch (error) {
            showFlashMessage(`Error saving sample format: ${error.message}`, 'error');
        }
    });

    clearWaybackReportBtn.addEventListener('click', () => {
        waybackReportTextarea.value = '';
        addLog('info', 'Wayback report textarea has been cleared.', new Date().toLocaleTimeString());
    });
});

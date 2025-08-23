// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Fungsi aplikasi utama
    openFile: () => ipcRenderer.invoke('dialog:openFile'),
    parseFile: (filePath) => ipcRenderer.invoke('csv:parseFile', filePath),
    getTranslations: (lang) => ipcRenderer.invoke('i18n:getTranslations', lang),
    checkSpamScore: (domains) => ipcRenderer.invoke('seo:checkSpamScore', domains),
    checkGoogleIndex: (domains, checkForForbidden) => ipcRenderer.invoke('hasdata:checkIndex', domains, checkForForbidden),
    ahrefsCheckDomain: (domainName, forceRecheck) => ipcRenderer.invoke('ahrefs:checkDomain', domainName, forceRecheck),
    stopAhrefsCheck: () => ipcRenderer.invoke('ahrefs:stopCheck'),
    analyzeDomainWithAI: (domainData) => ipcRenderer.invoke('ai:analyzeDomain', domainData),
    openExternalLink: (url) => ipcRenderer.send('open-external-link', url),
    saveCsv: (csvContent) => ipcRenderer.invoke('dialog:saveCsv', csvContent),
    saveFile: (content, defaultFileName) => ipcRenderer.invoke('dialog:saveFile', content, defaultFileName),
    showItemInFolder: (filePath) => ipcRenderer.send('shell:showItemInFolder', filePath),
    getSpamKeywords: () => ipcRenderer.invoke('app:getSpamKeywords'),

    // Fungsi untuk IP Whitelist & Setup
    getCurrentIp: () => ipcRenderer.invoke('app:getCurrentIp'),
    closeApp: () => ipcRenderer.send('app:close'),
    
    // Fungsi baru untuk kredensial
    checkCredentials: () => ipcRenderer.invoke('credentials:check'),
    saveCredentials: (credentials) => ipcRenderer.invoke('credentials:save', credentials),
    getCredentials: () => ipcRenderer.invoke('credentials:get'),

    // Event listeners dari Main ke Renderer
    onUpdateAvailable: (callback) => ipcRenderer.on('update_available', () => callback()),
    onLogMessage: (callback) => ipcRenderer.on('log-message', (event, ...args) => callback(...args)),
    onSpamScoreProgress: (callback) => ipcRenderer.on('spam-score-progress', (event, ...args) => callback(...args)),
    onIndexCheckProgress: (callback) => ipcRenderer.on('index-check-progress', (event, ...args) => callback(...args)),
});

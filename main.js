// main.js
const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const Papa = require('papaparse');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const { executablePath } = require('puppeteer');

puppeteer.use(StealthPlugin());

// --- KONFIGURASI PENTING ---
const CREDENTIALS_FILE_PATH = path.join(app.getPath('userData'), 'ahrefs-credentials.json');
const HASDATA_API_KEY = '2899d4e1-977a-4e3c-b7f8-7012ce25695c';
const SESSION_FILE_PATH = path.join(app.getPath('userData'), 'ahrefs-session.json');
const CACHE_DIR = path.join(app.getPath('userData'), '.cache');
const CACHE_FILE_PATH = path.join(CACHE_DIR, 'demicore_cache.json');

if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

const SPAM_KEYWORDS = [
    'bokep', 'cannabis', 'drugs', 'hentai', 'judi', 'porn', 'slot',
    'slot gacor', 'slot online', 'togel', 'togel online', 'toto',
    'toto macau', 'toto sgp',
];

let currentUserPublicIP = null;
let mainWindow;
let ahrefsCredentials = null;

// --- FUNGSI BANTU ---
function buildAhrefsFilter(keywords) {
    const rules = keywords.map(keyword => [["contains", "any"], keyword, "all"]);
    return encodeURIComponent(rules.map(r => JSON.stringify(r)).join('||'));
}
function readCache() {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const data = fs.readFileSync(CACHE_FILE_PATH, 'utf8');
      if (data) { return JSON.parse(data); }
    }
  } catch (error) { log.error('Error reading cache:', error); }
  return {};
}
function writeCache(cacheData) {
  try {
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cacheData, null, 2));
  } catch (error) { log.error('Error writing to cache:', error); }
}
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 30);
    });
  });
}

let browserInstance = null;
let pageInstance = null;
const randomDelay = (min = 1000, max = 2000) => new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));

// --- MANAJEMEN BROWSER PUPPETEER ---
async function getBrowserPage() {
    if (!ahrefsCredentials) {
        throw new Error("Ahrefs credentials are not loaded. Please set them in the settings.");
    }
    if (pageInstance && !pageInstance.isClosed()) return pageInstance;

    log.info('Membuka browser Puppeteer...');
    const userDataPath = path.join(app.getPath('userData'), 'puppeteer_user_data');
    log.info(`Puppeteer user data will be stored in: ${userDataPath}`);

    try {
        browserInstance = await puppeteer.launch({
            headless: false,
            userDataDir: userDataPath,
            executablePath: executablePath(),
            args: [
                '--disable-infobars',
                '--start-maximized'
            ]
        });
    } catch (error) {
        log.error('Failed to launch Puppeteer:', error);
        dialog.showErrorBox('Puppeteer Launch Error', `Could not launch the browser. Please ensure the application has the necessary permissions.\n\nError: ${error.message}`);
        app.quit();
        return;
    }

    pageInstance = await browserInstance.newPage();
    await pageInstance.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36');
    await pageInstance.setViewport({ width: 1366, height: 768 });

    try {
        await pageInstance.goto('https://app.ahrefs.com/dashboard', { waitUntil: 'networkidle2', timeout: 20000 });
        if (await pageInstance.$('input[placeholder="Domain or URL"]')) {
            log.info('Login berhasil menggunakan sesi tersimpan dari userDataDir!');
            return pageInstance;
        }
    } catch (e) {
        log.warn('Gagal memuat dashboard, mungkin perlu login ulang.');
    }
    
    log.info('Mencoba login baru ke Ahrefs...');
    await pageInstance.goto('https://app.ahrefs.com/user/login', { waitUntil: 'networkidle2' });
    await pageInstance.type('input[name="email"]', ahrefsCredentials.email, { delay: 150 });
    await pageInstance.type('input[name="password"]', ahrefsCredentials.password, { delay: 120 });
    await pageInstance.click('button[type="submit"]');
    await pageInstance.waitForSelector('input[placeholder="Domain or URL"]', { timeout: 60000 });
    log.info('Dashboard Ahrefs terdeteksi, login berhasil!');

    return pageInstance;
}


// --- PENGATURAN JENDELA APLIKASI ---
function createMainWindow() {
  mainWindow = new BrowserWindow({
    title: 'DEMICORE',
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      devTools: !app.isPackaged,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    }
  });

  if (app.isPackaged) {
    mainWindow.setMenu(null);
  }

  mainWindow.loadFile('index.html');
  mainWindow.on('closed', () => (mainWindow = null));
  mainWindow.once('ready-to-show', () => {
    if (app.isPackaged) {
      autoUpdater.checkForUpdates();
    }
  });
}

function createAccessDeniedWindow() {
    const accessDeniedWindow = new BrowserWindow({
        width: 500, height: 400, frame: false, resizable: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            devTools: !app.isPackaged,
            contextIsolation: true, nodeIntegration: false,
        }
    });
    accessDeniedWindow.loadFile(path.join(__dirname, 'access-denied.html'));
}

async function initializeApp() {
    log.info('App starting...');

    try {
        if (fs.existsSync(CREDENTIALS_FILE_PATH)) {
            const encryptedData = fs.readFileSync(CREDENTIALS_FILE_PATH);
            if (encryptedData.length > 0) {
                const decryptedData = safeStorage.decryptString(encryptedData);
                ahrefsCredentials = JSON.parse(decryptedData);
                log.info('Ahrefs credentials loaded and decrypted successfully.');
            }
        }
    } catch (error) {
        log.error('Failed to load/decrypt credentials.', error);
        dialog.showErrorBox(
            "Credential Error",
            `Failed to access secure credentials. You might need to re-enter them.\n\nError: ${error.message}`
        );
        ahrefsCredentials = null;
    }
    
    try {
        const { publicIpv4 } = await import('public-ip');
        
        try {
            currentUserPublicIP = await publicIpv4({ timeout: 3000 });
            log.info(`Current Public IP (via public-ip): ${currentUserPublicIP}`);
        } catch (error) {
            log.warn(`public-ip failed: ${error.message}. Trying fallback with axios...`);
            const response = await axios.get('https://api.ipify.org?format=json', { timeout: 3000 });
            currentUserPublicIP = response.data.ip;
            log.info(`Current Public IP (via axios fallback): ${currentUserPublicIP}`);
        }

        if (!currentUserPublicIP) {
            throw new Error("Failed to get Public IP from all sources.");
        }

        const whitelistResponse = await fetch('https://whitelistips.vercel.app/ips');
        const whitelistData = await whitelistResponse.json();
        const allowedIps = whitelistData.ips;

        if (allowedIps.includes(currentUserPublicIP)) {
            log.info('IP is in whitelist. Starting main application...');
            createMainWindow();
        } else {
            log.warn('IP NOT in whitelist. Showing access denied page.');
            createAccessDeniedWindow();
        }
    } catch (error) {
        log.error('Failed to verify IP address:', error);
        dialog.showErrorBox("Network Error", `Could not determine your Public IP address. Please check your internet connection and firewall settings, then restart the application.\n\nError: ${error.message}`);
        app.quit();
    }
}

app.whenReady().then(initializeApp);
app.on('window-all-closed', () => {
  if (browserInstance) browserInstance.close();
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        initializeApp();
    }
});

function sendLog(level, message) {
    if (mainWindow) {
        const timestamp = new Date().toLocaleTimeString();
        mainWindow.webContents.send('log-message', { level, message, timestamp });
    }
}

// --- AUTO-UPDATER LOGIC ---
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
autoUpdater.on('checking-for-update', () => log.info('Checking for update...'));
autoUpdater.on('update-available', (info) => {
  log.info('Update available.', info);
  if (mainWindow) {
    mainWindow.webContents.send('update_available');
  }
});
autoUpdater.on('update-not-available', (info) => log.info('Update not available.', info));
autoUpdater.on('error', (err) => log.error('Error in auto-updater. ' + err));
autoUpdater.on('download-progress', (progressObj) => {
  let log_message = `Downloaded ${progressObj.percent.toFixed(2)}% (${(progressObj.bytesPerSecond / 1000).toFixed(2)} KB/s)`;
  log.info(log_message);
});
autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded. Prompting user to restart.');
  const dialogOpts = {
    type: 'info',
    buttons: ['Restart and Update Now'],
    title: 'Application Update',
    message: `A new version (${info.version}) has been downloaded.`,
    detail: 'Restart the application to apply the updates.'
  };
  dialog.showMessageBox(dialogOpts).then((returnValue) => {
    if (returnValue.response === 0) autoUpdater.quitAndInstall();
  });
});

// --- IPC HANDLERS ---
ipcMain.handle('credentials:check', () => {
    return fs.existsSync(CREDENTIALS_FILE_PATH) && fs.readFileSync(CREDENTIALS_FILE_PATH).length > 0;
});

ipcMain.handle('credentials:save', async (event, credentials) => {
    log.info('Received credentials to save.');
    try {
        const encryptedCredentials = safeStorage.encryptString(JSON.stringify(credentials));
        fs.writeFileSync(CREDENTIALS_FILE_PATH, encryptedCredentials);
        
        ahrefsCredentials = credentials; 
        log.info('Credentials saved and loaded into current session.');
        
        return { success: true };
    } catch (error) {
        log.error('Failed to save credentials:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('credentials:get', () => {
    if (ahrefsCredentials) {
        return ahrefsCredentials;
    }
    return null;
});

ipcMain.handle('app:getCurrentIp', () => ({ currentIP: currentUserPublicIP }));
ipcMain.on('app:close', () => { app.quit(); });
ipcMain.handle('app:getSpamKeywords', () => { return SPAM_KEYWORDS; });
ipcMain.handle('dialog:openFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'CSV Files', extensions: ['csv'] }] });
    if (canceled) return;
    return filePaths[0];
});
ipcMain.on('shell:showItemInFolder', (event, filePath) => { if (filePath) { shell.showItemInFolder(filePath); } });
ipcMain.handle('dialog:saveCsv', async (event, csvContent) => {
    const { canceled, filePath } = await dialog.showSaveDialog({ title: 'Save Analysis Results', defaultPath: `demicore-results-${Date.now()}.csv`, filters: [{ name: 'CSV Files', extensions: ['csv'] }] });
    if (canceled || !filePath) { return { success: false, message: 'Save cancelled' }; }
    try {
        fs.writeFileSync(filePath, csvContent, 'utf-8');
        return { success: true, path: filePath };
    } catch (error) {
        log.error('Failed to save CSV:', error);
        return { success: false, message: error.message };
    }
});
ipcMain.handle('dialog:saveFile', async (event, content, defaultFileName) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Save Format File',
        defaultPath: defaultFileName,
        filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });
    if (canceled || !filePath) {
        return { success: false, message: 'Save cancelled' };
    }
    try {
        fs.writeFileSync(filePath, content, 'utf-8');
        return { success: true, path: filePath };
    } catch (error) {
        log.error('Failed to save file:', error);
        return { success: false, message: error.message };
    }
});
ipcMain.handle('csv:parseFile', (event, filePath) => {
  return new Promise((resolve, reject) => {
    try {
      const csvFile = fs.readFileSync(filePath, 'utf8');
      Papa.parse(csvFile, { header: true, skipEmptyLines: true, complete: (results) => resolve(results.data), error: (error) => reject(error) });
    } catch (error) { reject(error); }
  });
});
ipcMain.handle('i18n:getTranslations', async (event, lang) => {
    try {
        const isPackaged = app.isPackaged;
        const basePath = isPackaged ? process.resourcesPath : __dirname;
        const filePath = path.join(basePath, 'lang', `${lang}.json`);
        
        log.info(`Attempting to load translation from: ${filePath}`);

        const fileContent = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(fileContent);
    } catch (error) {
        log.error(`FATAL: Failed to load translation for language "${lang}":`, error);
        return {};
    }
});
ipcMain.handle('seo:checkSpamScore', async (event, domains) => {
    sendLog('info', `Memulai STEP 2: Cek Spam Score untuk ${domains.length} domain...`);
    const apiUrl = "https://demitoolsbackend.vercel.app/api/seo-checker";
    const batchSize = 50;
    let allSeoData = {};
    for (let i = 0; i < domains.length; i += batchSize) {
        const batch = domains.slice(i, i + batchSize);
        event.sender.send('spam-score-progress', { percentage: ((i + batch.length) / domains.length) * 100, message: `Mengecek batch ${Math.floor(i / batchSize) + 1}... (${i + batch.length}/${domains.length})` });
        try {
            const response = await axios.post(apiUrl, { domains: batch }, { headers: { 'Content-Type': 'application/json' }, timeout: 180000 });
            if (response.data && response.data.success) { allSeoData = { ...allSeoData, ...response.data.data }; }
        } catch (error) {
            log.error(`Error pada batch API Spam Score:`, error.message);
            batch.forEach(domain => { if (!allSeoData[domain]) allSeoData[domain] = { "Domain Authority": "Error", "Page Authority": "Error", "Spam Score": "Error" }; });
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    sendLog('success', `STEP 2 Selesai. Ditemukan ${Object.keys(allSeoData).length} data.`);
    return allSeoData;
});
ipcMain.handle('hasdata:checkIndex', async (event, domains, checkForForbidden = false) => {
    const type = checkForForbidden ? 'Forbidden Index' : 'Google Index';
    sendLog('info', `Memulai STEP 2.5/2.6: Cek ${type} untuk ${domains.length} domain...`);
    const results = {};
    const batchSize = 10;
    let processedCount = 0;
    const statusMessage = checkForForbidden ? 'Mengecek Forbidden Index' : 'Mengecek Google Index';
    for (let i = 0; i < domains.length; i += batchSize) {
        const batch = domains.slice(i, i + batchSize);
        const promises = batch.map(async (domain) => {
            let query = `site:${domain}`;
            if (checkForForbidden) {
                const combinedKeywords = SPAM_KEYWORDS.map(k => `"${k}"`).join(' OR ');
                query = `site:${domain} (${combinedKeywords})`;
            }
            const options = { method: 'GET', url: 'https://api.hasdata.com/scrape/google/serp', params: { q: query, location: 'Austin,Texas,United States', deviceType: 'desktop' }, headers: { 'x-api-key': HASDATA_API_KEY } };
            try {
                const response = await axios.request(options);
                const hasOrganicResults = response.data && response.data.organicResults && response.data.organicResults.length > 0;
                if (checkForForbidden) {
                    if (hasOrganicResults) {
                        const foundWords = new Set();
                        const resultsText = response.data.organicResults.map(r => `${r.title} ${r.snippet}`).join(' ').toLowerCase();
                        SPAM_KEYWORDS.forEach(keyword => { if (resultsText.includes(keyword)) { foundWords.add(keyword); } });
                        results[domain] = { status: 'FORBIDDEN', words: Array.from(foundWords) };
                    } else {
                        results[domain] = { status: 'CLEAN', words: [] };
                    }
                } else {
                    results[domain] = { status: hasOrganicResults ? 'INDEX' : 'NOINDEX' };
                }
            } catch (error) {
                log.error(`Error mengecek ${statusMessage} untuk ${domain}:`, error.message);
                results[domain] = { status: 'Error', words: [] };
            }
            processedCount++;
            event.sender.send('index-check-progress', { percentage: (processedCount / domains.length) * 100, message: `${statusMessage}... (${processedCount}/${domains.length})` });
        });
        await Promise.all(promises);
    }
    sendLog('success', `Pengecekan ${statusMessage} selesai.`);
    return results;
});
ipcMain.handle('ahrefs:checkDomain', async (event, domainName, forceRecheck = false) => {
    const cache = readCache();
    if (cache[domainName] && !forceRecheck) {
        sendLog('info', `[CACHE] Data ditemukan untuk ${domainName}. Menggunakan data cache.`);
        return cache[domainName];
    }
    if (forceRecheck) {
        sendLog('info', `[FORCE] Memulai pengecekan ulang (mengabaikan cache) untuk ${domainName}...`);
    } else {
        sendLog('info', `Memulai STEP 3: Analisis Ahrefs untuk domain: ${domainName}...`);
    }
    try {
        const page = await getBrowserPage();
        if (!page) { // Tambahan: Cek jika page gagal dibuat
            throw new Error("Puppeteer page instance could not be created.");
        }
        sendLog('info', `[Ahrefs] Membuka halaman Overview 2.0 untuk ${domainName}...`);
        await page.goto(`https://app.ahrefs.com/v2-site-explorer/overview?target=${domainName}`, { waitUntil: 'networkidle2', timeout: 90000 });
        let dofollowData = {};
        try {
            sendLog('info', `[Ahrefs] Menunggu elemen metrik untuk ${domainName}...`);
            await page.waitForSelector("h4.css-1uwmyp9-text", { timeout: 60000 });
            await randomDelay(3000, 4000);
            sendLog('info', `[Ahrefs] Mengambil data Dofollow/Nofollow...`);
            dofollowData = await page.evaluate(() => {
                const data = { referringDomains: { followed: 'N/A', notFollowed: 'N/A' }, backlinks: { followed: 'N/A', notFollowed: 'N/A' } };
                const findStats = (headerText) => {
                    const allH4 = Array.from(document.querySelectorAll('h4.css-1uwmyp9-text'));
                    const header = allH4.find(h4 => h4.textContent.trim() === headerText);
                    if (!header) return null;
                    const container = header.closest('.css-1rwqq8c.css-0.css-1dvc7bw-stack');
                    if (!container) return null;
                    const rows = container.querySelectorAll('.css-z8cz4v-progressRow');
                    const result = {};
                    const followedRow = Array.from(rows).find(row => row.innerText.includes('Followed'));
                    if (followedRow) {
                        const countEl = followedRow.querySelector('a .css-s2uf1z');
                        const percentEl = followedRow.querySelector('.css-d969c7');
                        result.followed = `${countEl ? countEl.textContent.trim() : 'N/A'} (${percentEl ? percentEl.textContent.trim() : 'N/A'})`;
                    }
                    const notFollowedRow = Array.from(rows).find(row => row.innerText.includes('Not followed'));
                    if (notFollowedRow) {
                        const valueElements = notFollowedRow.querySelectorAll('.css-s2uf1z');
                        if (valueElements.length >= 2) { result.notFollowed = `${valueElements[0].textContent.trim()} (${valueElements[1].textContent.trim()})`; }
                    }
                    return result;
                };
                const rdStats = findStats('Referring domains');
                if (rdStats) data.referringDomains = rdStats;
                const blStats = findStats('Backlinks');
                if (blStats) data.backlinks = blStats;
                return data;
            });
        } catch (metricError) {
            sendLog('error', `[Ahrefs] Gagal mengambil metrik Dofollow untuk ${domainName}: ${metricError.message}`);
            dofollowData = { referringDomains: { followed: 'Error', notFollowed: 'Error' }, backlinks: { followed: 'Error', notFollowed: 'Error' } };
        }

        const tableSelector = 'table.css-18gur7r-table';
        const tableRowSelector = `${tableSelector} tbody.css-1lkq3hk-tbody tr.css-1hdhldl-row`;

        async function waitForDataToLoad(timeout = 30000) {
            try {
                await page.waitForSelector(tableRowSelector, { timeout });
                await new Promise(resolve => setTimeout(resolve, 2500));
                return true;
            } catch (error) {
                if (await page.evaluate(() => document.body.innerText.includes("No results found") || document.body.innerText.includes("No backlinks found"))) {
                    sendLog('warning', `[Ahrefs] Halaman menampilkan 'No results found' untuk ${domainName}.`);
                    return false;
                }
                throw new Error('Gagal menunggu data tabel Ahrefs (timeout): ' + error.message);
            }
        }
        
        async function checkPageForSpam(url, keywords) {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
            const dataLoaded = await waitForDataToLoad();
            if (!dataLoaded) return { detected: false, words: [] };
            const detectedWords = await page.evaluate((selector, spamKeywords) => {
                const wordsFound = new Set();
                const tableText = document.querySelector(selector)?.innerText.toLowerCase() || '';
                for (const keyword of spamKeywords) {
                    const regex = new RegExp(`\\b${keyword.replace(/ /g, '\\s')}\\b`, 'g');
                    if (regex.test(tableText)) wordsFound.add(keyword);
                }
                return Array.from(wordsFound);
            }, tableSelector, keywords);
            return { detected: detectedWords.length > 0, words: detectedWords };
        }

        sendLog('info', `[Ahrefs] Mengecek toxic backlink untuk ${domainName}...`);
        const spamFilterRules = buildAhrefsFilter(SPAM_KEYWORDS);
        const backlinkResult = await checkPageForSpam(`https://app.ahrefs.com/v2-site-explorer/backlinks?target=${domainName}&refPageUrlMatch=%22any%22&refPageUrlRules=${spamFilterRules}`, SPAM_KEYWORDS);
        await randomDelay();
        sendLog('info', `[Ahrefs] Mengecek toxic anchor untuk ${domainName}...`);
        const anchorResult = await checkPageForSpam(`https://app.ahrefs.com/v2-site-explorer/anchors?target=${domainName}&anchorMatch=%22any%22&anchorRules=${spamFilterRules}`, SPAM_KEYWORDS);
        await randomDelay();

        async function scrapeTopBacklinks(domain) {
            sendLog('info', `[Ahrefs] Memulai scrape top backlinks untuk ${domain} (maksimal 2 halaman)...`);
            let allBacklinksData = [];
            const pagesToScrape = 2;
            const nextButtonSelector = 'button svg path[d^="M11.42 7L5.41"]';
            const initialUrl = `https://app.ahrefs.com/v2-site-explorer/backlinks?target=${domain}&sort=DomainTraffic&sortDirection=desc&limit=100&offset=0`;
            try {
                await page.goto(initialUrl, { waitUntil: 'networkidle2', timeout: 90000 });
                for (let pageNum = 1; pageNum <= pagesToScrape; pageNum++) {
                    sendLog('info', `[Ahrefs] Memproses halaman ${pageNum} untuk ${domain}...`);
                    try {
                        await page.waitForFunction(
                            `document.querySelector('${tableRowSelector}') || document.body.innerText.includes("No backlinks found")`, { timeout: 45000 }
                        );
                        const noBacklinksFound = await page.evaluate(() => document.body.innerText.includes("No backlinks found"));
                        if (noBacklinksFound) {
                            sendLog('warning', `[Ahrefs] Halaman menampilkan 'No backlinks found' untuk ${domain}. Menghentikan scrape.`);
                            break;
                        }
                        await randomDelay(1500, 2500);
                        sendLog('info', `[Ahrefs] Mensimulasikan scroll ke bawah di halaman ${pageNum}...`);
                        await autoScroll(page);
                        await randomDelay(1000, 1500);
                    } catch (waitError) {
                        sendLog('error', `[Ahrefs] Gagal menunggu data tabel di halaman ${pageNum} untuk ${domain} (timeout).`);
                        const screenshotPath = path.join(app.getPath('desktop'), `demicore_debug_${domain}_${Date.now()}.png`);
                        await page.screenshot({ path: screenshotPath, fullPage: true });
                        sendLog('error', `[Ahrefs] Screenshot disimpan di Desktop: ${screenshotPath}`);
                        break;
                    }
                    const backlinksData = await page.evaluate((rowSelector) => {
                        return Array.from(document.querySelectorAll(rowSelector)).map(row => {
                            const cells = row.querySelectorAll('td.css-gp1c5e-cell');
                            if (cells.length < 12) return null;
                            const referringPageLinkElement = cells[0]?.querySelector('a');
                            const dates = cells[10]?.querySelectorAll('div');
                            return { referringPageTitle: referringPageLinkElement?.innerText.trim() || 'N/A', referringPageUrl: referringPageLinkElement?.href || 'N/A', dr: cells[1]?.innerText.trim() || 'N/A', ur: cells[2]?.innerText.trim() || 'N/A', domainTraffic: cells[3]?.innerText.trim() || 'N/A', referringDomains: cells[4]?.innerText.trim() || 'N/A', linkedDomains: cells[5]?.innerText.trim() || 'N/A', ext: cells[6]?.innerText.trim() || 'N/A', pageTraffic: cells[7]?.innerText.trim() || 'N/A', kw: cells[8]?.innerText.trim() || 'N/A', anchorAndTarget: cells[9]?.innerText.trim() || 'N/A', firstSeen: dates?.[0]?.innerText.trim() || 'N/A', lastSeen: dates?.[1]?.innerText.trim() || 'N/A' };
                        }).filter(item => item !== null);
                    }, tableRowSelector);
                    if (backlinksData.length > 0) {
                        allBacklinksData = allBacklinksData.concat(backlinksData);
                        sendLog('info', `[Ahrefs] Berhasil mengambil ${backlinksData.length} backlink dari halaman ${pageNum}.`);
                    } else {
                        sendLog('warning', `[Ahrefs] Tidak ada data yang bisa di-scrape di halaman ${pageNum} meskipun tabel terdeteksi.`);
                    }
                    if (pageNum < pagesToScrape) {
                        sendLog('info', `[Ahrefs] Mengecek keberadaan halaman berikutnya...`);
                        const nextPageButton = await page.$(nextButtonSelector);
                        if (nextPageButton) {
                            sendLog('info', `[Ahrefs] Halaman berikutnya ditemukan. Menavigasi ke halaman ${pageNum + 1}...`);
                            await Promise.all([ page.waitForNavigation({ waitUntil: 'networkidle2' }), page.evaluate(el => el.closest('button').click(), nextPageButton) ]);
                            await randomDelay(1500, 3000);
                        } else {
                            sendLog('info', `[Ahrefs] Hanya ada satu halaman backlink. Menyelesaikan scrape untuk domain ini.`);
                            break;
                        }
                    }
                }
            } catch (navError) {
                sendLog('error', `[Ahrefs] Gagal navigasi ke halaman backlink untuk ${domain}: ${navError.message}`);
                const screenshotPath = path.join(app.getPath('desktop'), `demicore_debug_nav_error_${domain}_${Date.now()}.png`);
                await page.screenshot({ path: screenshotPath, fullPage: true });
                sendLog('error', `[Ahrefs] Screenshot disimpan di Desktop: ${screenshotPath}`);
            }
            return allBacklinksData;
        }

        const topBacklinksData = await scrapeTopBacklinks(domainName);
        const ahrefsResult = {
            dofollowData,
            backlinkSpam: backlinkResult.detected ? '⚠️ Terdeteksi' : 'Aman',
            backlinkWords: backlinkResult.words,
            anchorSpam: anchorResult.detected ? '⚠️ Terdeteksi' : 'Aman',
            anchorWords: anchorResult.words,
            topBacklinks: topBacklinksData
        };
        cache[domainName] = ahrefsResult;
        writeCache(cache);
        sendLog('success', `STEP 3 Selesai untuk ${domainName}. Data disimpan ke cache.`);
        return ahrefsResult;
    } catch (error) {
        sendLog('error', `Gagal di STEP 3 untuk ${domainName}: ${error.message}`);
        return { error: true, dofollowData: { referringDomains: { followed: 'Error', notFollowed: 'Error' }, backlinks: { followed: 'Error', notFollowed: 'Error' } }, backlinkSpam: 'Error', anchorSpam: 'Error', topBacklinks: [] };
    }
});
ipcMain.handle('ahrefs:stopCheck', async () => {
    if (browserInstance) {
        await browserInstance.close();
        browserInstance = null;
        pageInstance = null;
        log.info('Browser Puppeteer berhasil ditutup.');
    }
    return true;
});
ipcMain.on('open-external-link', (event, url) => {
    if (url && (url.startsWith('http:') || url.startsWith('https:'))) {
        shell.openExternal(url);
    }
});
ipcMain.handle('ai:analyzeDomain', async (event, domainData) => {
    sendLog('info', `Memulai STEP 4/5: Mengirim ${domainData['Domain Name']} ke AI...`);
    const apiKey = '!@?BERIKUT-KUNCI-SAYA-ARWANA!@?';
    const apiUrl = 'https://ihaveaiservice.vercel.app/neuroner';
    
    let manualReportSummary = "N/A";
    if (domainData.manualWaybackReport && Object.keys(domainData.manualWaybackReport).length > 0) {
        const report = domainData.manualWaybackReport;
        manualReportSummary = Object.entries(report)
            .map(([key, value]) => `- ${key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())}: ${value || 'N/A'}`)
            .join('\n');
    }

    const topBacklinksSummary = domainData.ahrefsResult?.topBacklinks?.slice(0, 20).map((bl, index) => {
        return `--- Backlink #${index + 1} ---
Judul Halaman: ${bl.referringPageTitle || 'N/A'}
DR: ${bl.dr || 'N/A'}
UR: ${bl.ur || 'N/A'}
Domain Traffic: ${bl.domainTraffic || 'N/A'}
Page Traffic: ${bl.pageTraffic || 'N/A'}
Anchor & Target:
${bl.anchorAndTarget || 'N/A'}`;
    }).join('\n\n') || "N/A";
    const forbiddenStatus = domainData['G-CONTENT']?.status === 'FORBIDDEN' ? 'NOT SAFE' : 'SAFE';
    const dofollowRD = domainData.ahrefsResult?.dofollowData?.referringDomains;
    const dofollowBL = domainData.ahrefsResult?.dofollowData?.backlinks;
    const prompt = `Anda adalah analis SEO Master **yang sangat teliti dan skeptis**. Tugas Anda adalah menganalisis data domain lelang berikut secara komprehensif untuk menentukan kelayakannya.
**Konteks: Domain ini adalah domain lelang yang akan dipertimbangkan untuk dibangun kembali sebagai PBN (Private Blog Network) atau Money Site. Prioritas utama adalah keamanan (bebas dari penalti masa lalu) dan kekuatan (otoritas yang bisa dimanfaatkan).**

**Data Metrik Utama Domain:**
- Nama: ${domainData['Domain Name']}
- Umur: ${domainData['Domain Age']} tahun
- Google Index: ${domainData['G-INDEX']?.status || 'N/A'}
- Forbidden Status: ${forbiddenStatus}
- Majestic TF/CF: ${domainData['Majestic TF']}/${domainData['Majestic CF']}
- DA/PA: ${domainData['DA'] || 'N/A'}/${domainData['PA'] || 'N/A'}
- Spam Score: ${domainData['Spam Score'] || 'N/A'}
- Dofollow RD: ${dofollowRD?.followed || 'N/A'}
- Nofollow RD: ${dofollowRD?.notFollowed || 'N/A'}
- Dofollow BL: ${dofollowBL?.followed || 'N/A'}
- Nofollow BL: ${dofollowBL?.notFollowed || 'N/A'}
- Status Toxic Ahrefs: Backlink (${domainData.ahrefsResult?.backlinkSpam}), Anchor (${domainData.ahrefsResult?.anchorSpam})

**Ringkasan Laporan Manual Tim Wayback:**
${manualReportSummary}

**Data Detail dari 20 Backlink Teratas (berdasarkan trafik domain):**
${topBacklinksSummary}

**Tugas Anda:**
1.  Beri peringkat kelayakan: **"High Quality", "Medium Quality", "Low Quality", atau "Sangat Berisiko"**.
2.  Sertakan **3-5 poin alasan** yang paling signifikan dalam format bullet points. **Setiap alasan HARUS merujuk pada data spesifik yang diberikan (baik dari metrik utama, laporan manual, maupun dari detail backlink) dan jelaskan dampaknya.**
    -   **Identifikasi Sinyal Positif (Kelebihan):** (Contoh: 'DA/PA tinggi (45/32) menunjukkan otoritas awal yang kuat', 'Profil backlink mayoritas berasal dari situs .edu dan .gov yang sangat terpercaya', 'Laporan manual menyatakan konten aman dan kategori jelas, ini nilai plus besar').
    -   **Identifikasi Sinyal Negatif (Kekurangan/Risiko):** (Contoh: 'Spam Score 15% adalah bendera merah besar', 'Meskipun DR tinggi, banyak backlink berasal dari situs judi seperti yang terlihat pada backlink #3 dan #8', 'Laporan manual menunjukkan adanya redirect mencurigakan ke situs lain').
3.  Tentukan satu niche kategori yang paling relevan dalam Bahasa Indonesia **berdasarkan analisis mayoritas Judul, Anchor, dan laporan manual yang ada.** Jika tidak jelas, sebutkan 'Niche Umum/Tidak Spesifik'.

Format output WAJIB dalam bentuk JSON seperti ini:
{"keputusan": "High Quality", "alasan": ["Alasan 1", "Alasan 2", "Alasan 3"], "kategori": "Kategori Niche"}`;
    try {
        const response = await axios.post(apiUrl, { prompt }, { headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey }, timeout: 120000 });
        sendLog('success', `STEP 4/5 Selesai: Jawaban AI diterima untuk ${domainData['Domain Name']}.`);
        try {
            return JSON.parse(response.data.answer);
        } catch (parseError) {
            sendLog('error', `Gagal parse jawaban AI untuk ${domainData['Domain Name']}: ${parseError.message}`);
            return { keputusan: 'Error', alasan: ['Jawaban AI tidak valid.'], kategori: 'N/A' };
        }
    } catch (error) {
        const errorMessage = `Gagal di STEP 4/5 untuk ${domainData['Domain Name']}: ${error.message}`;
        sendLog('error', errorMessage);
        log.error("==============================================");
        log.error(`DATA PENYEBAB ERROR AI UNTUK: ${domainData['Domain Name']}`);
        log.error(JSON.stringify(domainData, null, 2));
        log.error("==============================================");
        return { keputusan: 'Error', alasan: [`Gagal menghubungi server AI.`, `Status: ${error.response?.status || 'N/A'}`], kategori: 'N/A' };
    }
});

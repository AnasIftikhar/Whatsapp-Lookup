let excelData = [];
let results = [];
let isProcessing = false;
let currentIndex = 0;

const elements = {
    uploadSection: document.getElementById('uploadSection'),
    fileInput: document.getElementById('fileInput'),
    fileInfo: document.getElementById('fileInfo'),
    fileName: document.getElementById('fileName'),
    fileDetails: document.getElementById('fileDetails'),
    startBtn: document.getElementById('startBtn'),
    statusBox: document.getElementById('statusBox'),
    statusText: document.getElementById('statusText'),
    progressFill: document.getElementById('progressFill'),
    summary: document.getElementById('summary'),
    downloadBtn: document.getElementById('downloadBtn'),
    logContainer: document.getElementById('logContainer'),
    whatsappFrame: document.getElementById('whatsappFrame'),
    stopBtn: document.getElementById('stopBtn')
};

// Upload section interactions
elements.uploadSection.addEventListener('click', () => elements.fileInput.click());
elements.uploadSection.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.uploadSection.classList.add('active');
});
elements.uploadSection.addEventListener('dragleave', () => {
    elements.uploadSection.classList.remove('active');
});
elements.uploadSection.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.uploadSection.classList.remove('active');
    if (e.dataTransfer.files.length) {
        elements.fileInput.files = e.dataTransfer.files;
        handleFileUpload(e.dataTransfer.files[0]);
    }
});

elements.fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        handleFileUpload(e.target.files[0]);
    }
});

elements.startBtn.addEventListener('click', startVerification);
elements.stopBtn.addEventListener('click', stopVerification);
elements.downloadBtn.addEventListener('click', downloadResults);

function handleFileUpload(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            excelData = XLSX.utils.sheet_to_json(worksheet);

            if (excelData.length === 0) {
                throw new Error('Excel file is empty');
            }

            // Find phone column (case-insensitive)
            const columns = Object.keys(excelData[0]);
            const phoneColumn = columns.find(col => col.toLowerCase() === 'phone');

            if (!phoneColumn) {
                throw new Error('No "PHONE" column found in Excel file');
            }

            const phoneCount = excelData.filter(row => row[phoneColumn]).length;

            elements.fileName.textContent = `📄 ${file.name}`;
            elements.fileDetails.textContent = `${excelData.length} rows • ${phoneCount} phone numbers • Column: ${phoneColumn}`;
            elements.fileInfo.classList.add('active');
            elements.startBtn.disabled = false;

            addLog(`File loaded: ${file.name}`, 'success');
            addLog(`Found ${phoneCount} phone numbers`, 'info');
        } catch (error) {
            alert(`Error reading file: ${error.message}`);
            addLog(`Error: ${error.message}`, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

async function startVerification() {
    if (isProcessing) return;

    isProcessing = true;
    currentIndex = 0;
    results = JSON.parse(JSON.stringify(excelData));

    elements.startBtn.disabled = true;
    elements.startBtn.style.display = 'none';
    elements.stopBtn.style.display = 'block';
    elements.statusBox.classList.add('active');
    elements.logContainer.classList.add('active');
    elements.downloadBtn.style.display = 'none';

    const columns = Object.keys(excelData[0]);
    const phoneColumn = columns.find(col => col.toLowerCase() === 'phone');

    addLog('Starting verification process...', 'info');

    for (let i = 0; i < results.length; i++) {
        if (!isProcessing) {
            addLog('Verification stopped', 'warning');
            break;
        } currentIndex = i;
        const row = results[i];
        const phone = row[phoneColumn];

        updateProgress(i, results.length);

        if (!phone) {
            row.Status = 'Empty';
            addLog(`Row ${i + 1}: No phone number`, 'warning');
            continue;
        }

        const cleanPhone = String(phone).replace(/\D/g, '');
        if (!cleanPhone) {
            row.Status = 'Invalid';
            addLog(`Row ${i + 1}: Invalid format - ${phone}`, 'error');
            continue;
        }

        addLog(`Row ${i + 1}: Checking ${phone}...`, 'info');

        try {
            const status = await checkWhatsApp(cleanPhone);
            row.Status = status;
            addLog(`Row ${i + 1}: ${status}`, status === 'Exists' ? 'success' : 'error');
        } catch (error) {
            row.Status = 'Error';
            addLog(`Row ${i + 1}: Error - ${error.message}`, 'error');
        }

        updateSummary();
        await delay(3000); // Delay between checks
    }

    updateProgress(results.length, results.length);
    elements.statusText.textContent = 'Verification completed!';
    elements.downloadBtn.style.display = 'block';
    elements.stopBtn.style.display = 'none';
    elements.startBtn.style.display = 'block';
    elements.startBtn.disabled = false;
    isProcessing = false;
    addLog('Verification process completed!', 'success');
}

function stopVerification() {
    isProcessing = false;
    elements.statusText.textContent = 'Verification stopped by user';
    elements.stopBtn.style.display = 'none';
    elements.startBtn.style.display = 'block';
    elements.startBtn.disabled = false;
    elements.downloadBtn.style.display = 'block';
    addLog('Verification stopped by user', 'warning');
}

async function checkWhatsApp(phone) {
    return new Promise((resolve) => {
        const url = `https://web.whatsapp.com/send/?phone=${phone}&text&type=phone_number&app_absent=0`;

        chrome.tabs.create({ url: url, active: false }, (tab) => {
            const tabId = tab.id;
            let resolved = false;
            let checkInterval;

            const timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    clearInterval(checkInterval);
                    chrome.tabs.remove(tabId);
                    resolve('Unknown');
                }
            }, 30000); // 30 seconds timeout

            chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo) {
                if (updatedTabId === tabId && changeInfo.status === 'complete') {
                    // Start checking every 2 seconds after page loads
                    checkInterval = setInterval(() => {
                        chrome.tabs.sendMessage(tabId, { action: 'checkWhatsApp' }, (response) => {
                            if (response && response.status !== 'Loading' && !resolved) {
                                resolved = true;
                                clearTimeout(timeout);
                                clearInterval(checkInterval);
                                chrome.tabs.onUpdated.removeListener(listener);
                                chrome.tabs.remove(tabId);
                                resolve(response.status);
                            }
                        });
                    }, 2000); // Check every 2 seconds
                }
            });
        });
    });
}

function updateProgress(current, total) {
    const percentage = (current / total) * 100;
    elements.progressFill.style.width = `${percentage}%`;
    elements.statusText.textContent = `Processing: ${current} / ${total} (${Math.round(percentage)}%)`;
}

function updateSummary() {
    const summary = results.reduce((acc, row) => {
        const status = row.Status || 'Pending';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});

    elements.summary.innerHTML = Object.entries(summary)
        .map(([status, count]) => `
            <div class="summary-item">
                <div class="summary-value">${count}</div>
                <div class="summary-label">${status}</div>
            </div>
        `).join('');
}

function downloadResults() {
    const columns = Object.keys(excelData[0]);
    const phoneColumn = columns.find(col => col.toLowerCase() === 'phone');
    const phoneIndex = columns.indexOf(phoneColumn);

    // Create new column order: insert 'Whatsapp' after PHONE column
    const newColumns = [
        ...columns.slice(0, phoneIndex + 1),
        'Whatsapp',
        ...columns.slice(phoneIndex + 1).filter(col => col !== 'Status')
    ];

    // Remap data with new column order
    const outputData = results.map(row => {
        const newRow = {};
        newColumns.forEach(col => {
            if (col === 'Whatsapp') {
                newRow[col] = row.Status || 'Unknown';
            } else {
                newRow[col] = row[col];
            }
        });
        return newRow;
    });

    const worksheet = XLSX.utils.json_to_sheet(outputData, { header: newColumns });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Results');

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    XLSX.writeFile(workbook, `WhatsApp_Verified_${timestamp}.xlsx`);

    addLog('Results downloaded successfully', 'success');
}

function addLog(message, type = 'info') {
    const log = document.createElement('div');
    log.className = `log-entry log-${type}`;
    log.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    elements.logContainer.appendChild(log);
    elements.logContainer.scrollTop = elements.logContainer.scrollHeight;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
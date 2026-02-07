import { analyzePerformance } from './analyzer.js';

const runBtn = document.getElementById('run-btn');
const btnText = document.getElementById('btn-text');
const btnSpinner = document.getElementById('btn-spinner');
const resultsDiv = document.getElementById('results');

// HELPER: Ensures content script is injected before sending a message
async function ensureContentScript(tabId) {
    try {
        await chrome.tabs.sendMessage(tabId, { action: "PING" });
    } catch (e) {
        // If PING fails, inject the script manually
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js'] // Make sure this matches your filename
        });
    }
}

runBtn.addEventListener('click', async () => {
    resultsDiv.classList.add('hidden');
    btnText.classList.add('hidden');
    btnSpinner.classList.remove('hidden');
    runBtn.disabled = true;

    try {
        const tabId = chrome.devtools.inspectedWindow.tabId;

        // 1. Ensure the script exists before we even try to talk to it
        await ensureContentScript(tabId);

        // 2. Data Fetching
        const harLog = await new Promise(resolve => chrome.devtools.network.getHAR(resolve));
        
        const perfData = await new Promise(resolve => {
            chrome.devtools.inspectedWindow.eval(
                `window.performance && window.performance.getEntriesByType('navigation').length > 0 
                ? JSON.stringify(window.performance.getEntriesByType('navigation')[0]) : null`,
                (result) => resolve(result ? JSON.parse(result) : { loadEventEnd: 0 })
            );
        });

        // 3. Talk to Content Script safely
        const domData = await new Promise(resolve => {
            chrome.tabs.sendMessage(tabId, { action: "GET_PAGE_METRICS" }, (res) => {
                if (chrome.runtime.lastError) {
                    resolve({ longTasks: [], blockingTime: 0 }); 
                } else {
                    resolve(res || {});
                }
            });
        });

        // 4. Calculation
        let totalBytes = 0;
        const resources = harLog.entries.map(e => {
            const size = e.response._transferSize || e.response.content.size || 0;
            totalBytes += size;
            return { name: e.request.url, size: size };
        });

        const totalBlocking = domData.longTasks ? domData.longTasks.reduce((a, t) => a + t.duration, 0) : 0;
        const report = analyzePerformance(perfData, resources, domData);

        renderReport(report, perfData, totalBytes, totalBlocking);

    } catch (e) {
        console.error("Diagnosis Error:", e);
    } finally {
        btnText.classList.remove('hidden');
        btnSpinner.classList.add('hidden');
        runBtn.disabled = false;
    }
});

// ... Keep your renderReport, getGrade, and getGradeColor functions the same ...
function renderReport(report, perfData, totalBytes, totalBlocking) {
    const list = document.getElementById('issues-list');
    resultsDiv.classList.remove('hidden');
    
    document.getElementById('stat-load').textContent = (perfData.loadEventEnd / 1000).toFixed(2) + 's';
    document.getElementById('stat-weight').textContent = (totalBytes / (1024 * 1024)).toFixed(2) + ' MB';
    document.getElementById('stat-blocking').textContent = Math.round(totalBlocking) + 'ms';

    const gradeCircle = document.getElementById('grade-circle');
    gradeCircle.textContent = getGrade(report.score);
    gradeCircle.style.borderColor = getGradeColor(report.score);
    
    list.innerHTML = '';
    
    if (!report.issues || report.issues.length === 0) {
        list.innerHTML = `
            <div class="empty-state-container">
                <div class="success-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
                <h3>Clean Bill of Health!</h3>
                <p>No performance bottlenecks detected.</p>
                <button class="secondary-btn" id="reload-page-btn">Run Baseline Test Again</button>
            </div>`;
        return; 
    }
    
    report.issues.forEach(issue => {
        const div = document.createElement('div');
        div.className = `issue-card ${issue.impact}`;
        div.innerHTML = `
            <div class="issue-header"><span class="issue-title">${issue.title}</span></div>
            <p class="explanation">${issue.explanation}</p>
            <div class="fix-box"><strong>Rx:</strong> ${issue.fix}</div>`;
        list.appendChild(div);
    });
}

document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'reload-page-btn') {
        chrome.devtools.inspectedWindow.reload();
        setTimeout(() => runBtn.click(), 1500);
    }
});

function getGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 60) return 'C';
    return 'F';
}

function getGradeColor(score) {
    if (score >= 90) return 'var(--success)'; 
    if (score >= 60) return 'var(--warning)'; 
    return 'var(--danger)'; 
}
// Collect performance metrics from inside the page context
(() => {
    const data = {
        longTasks: [],
        clsScore: 0,
        frameworks: []
    };

    // 1. Observe Long Tasks (Main Thread Blocking)
    const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
            data.longTasks.push({
                duration: entry.duration,
                startTime: entry.startTime
            });
        }
    });
    observer.observe({ entryTypes: ["longtask"] });

    // 2. Listen for messages from DevTools Panel
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "GET_PAGE_METRICS") {
            
            // Detect Frameworks
            if (document.querySelector('[data-reactroot], [id="root"]')) data.frameworks.push('React');
            if (document.querySelector('app-root, [ng-version]')) data.frameworks.push('Angular');
            if (document.querySelector('[data-v-app]')) data.frameworks.push('Vue');

            // Send back snapshot
            sendResponse({
                longTasks: data.longTasks,
                frameworks: data.frameworks,
                domNodes: document.getElementsByTagName('*').length,
                title: document.title
            });
        }
    });
})();
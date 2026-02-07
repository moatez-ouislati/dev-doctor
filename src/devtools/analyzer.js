/**
 * THE HUMAN TRANSLATION ENGINE
 * Transforms raw metrics into prioritized, plain English advice.
 */

export const analyzePerformance = (navEntry, resources, domData) => {
  const issues = [];
  
  // --- 1. SLOW SERVER RESPONSE (TTFB) ---
  const ttfb = navEntry.responseStart - navEntry.requestStart;
  if (ttfb > 600) {
    issues.push({
      id: 'slow-ttfb',
      title: 'Server is struggling to reply',
      impact: 'HIGH',
      save: `~${(ttfb / 1000).toFixed(2)}s`,
      explanation: `Your server takes ${(ttfb / 1000).toFixed(2)} seconds just to think about the request before sending any data.`,
      fix: 'Check your database queries, server-side code efficiency, or upgrade your hosting plan.',
      technical: `TTFB: ${Math.round(ttfb)}ms`
    });
  }

  // --- 2. HEAVY JAVASCRIPT (Main Thread Blocking) ---
  // Using Long Tasks from Content Script
  const longTasks = domData.longTasks || [];
  const totalBlocking = longTasks.reduce((sum, t) => sum + t.duration, 0);
  
  if (totalBlocking > 500) {
    issues.push({
      id: 'heavy-js',
      title: 'JavaScript is locking up the browser',
      impact: 'HIGH',
      save: `~${(totalBlocking / 1000).toFixed(2)}s`,
      explanation: 'Scripts are working so hard that the user cannot scroll or click for significant periods.',
      fix: 'Break up long tasks, remove unused code, or defer non-essential third-party scripts.',
      technical: `Total Blocking Time: ${Math.round(totalBlocking)}ms across ${longTasks.length} tasks.`
    });
  }

  // --- 3. OVERSIZED IMAGES ---
  const largeImages = resources.filter(r => r.type === 'image' && r.size > 500 * 1024); // > 500KB
  largeImages.forEach(img => {
    issues.push({
      id: `img-${img.name}`,
      title: 'Massive Image Detected',
      impact: 'MEDIUM',
      save: 'Bandwidth & Load Time',
      explanation: `An image file is ${img.humanSize}. That's larger than the entire code of some websites.`,
      fix: 'Convert to WebP/AVIF, resize to actual display dimensions, and compress.',
      technical: `File: ...${img.name.slice(-20)}\nSize: ${img.humanSize}`
    });
  });

  // --- 4. RENDER BLOCKING RESOURCES ---
  // Heuristic: CSS/JS in head that isn't async/defer
  const blockingCss = resources.filter(r => r.type === 'stylesheet' && r.time > 100);
  if (blockingCss.length > 0) {
     issues.push({
      id: 'render-blocking-css',
      title: 'Styles are delaying the first paint',
      impact: 'HIGH',
      save: 'Visual Perception',
      explanation: `The browser pauses drawing the page until it finishes downloading these ${blockingCss.length} style files.`,
      fix: 'Inline critical CSS and defer the rest, or reduce CSS file size.',
      technical: `Blocking files: ${blockingCss.map(c => c.name.slice(-15)).join(', ')}`
    });
  }

  // --- SCORING ALGORITHM ---
  // Simple weighted score (0-100)
  let score = 100;
  if (ttfb > 600) score -= 15;
  if (totalBlocking > 300) score -= 20;
  if (navEntry.loadEventEnd > 3000) score -= 15; // >3s load
  score -= (issues.length * 5);
  
  return {
    score: Math.max(0, Math.round(score)),
    issues: issues.sort((a, b) => {
        const map = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
        return map[b.impact] - map[a.impact];
    })
  };
};
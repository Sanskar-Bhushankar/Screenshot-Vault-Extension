let isSelecting = false;
let startX, startY;
let overlay, selection;

function createSelectionTool() {
    // Remove existing elements if any
    removeSelectionTool();

    // Create overlay
    overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.3);
        cursor: crosshair;
        z-index: 2147483647;
    `;

    // Create selection box
    selection = document.createElement('div');
    selection.style.cssText = `
        position: fixed;
        border: 2px solid #4285f4;
        background: rgba(66, 133, 244, 0.2);
        z-index: 2147483647;
        display: none;
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(selection);

    // Add event listeners
    overlay.addEventListener('mousedown', startSelection);
    document.addEventListener('mousemove', updateSelection);
    document.addEventListener('mouseup', endSelection);
    document.addEventListener('keydown', handleKeyPress);
}

function startSelection(e) {
    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;
    selection.style.display = 'block';
    updateSelectionBox(e);
}

function updateSelection(e) {
    if (!isSelecting) return;
    updateSelectionBox(e);
}

function updateSelectionBox(e) {
    const currentX = e.clientX;
    const currentY = e.clientY;

    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    selection.style.left = left + 'px';
    selection.style.top = top + 'px';
    selection.style.width = width + 'px';
    selection.style.height = height + 'px';
}

function endSelection() {
    if (!isSelecting) return;
    isSelecting = false;

    const rect = selection.getBoundingClientRect();
    
    // Only capture if selection is large enough
    if (rect.width > 10 && rect.height > 10) {
        // Send coordinates to background script
        chrome.runtime.sendMessage({
            type: 'capture',
            bounds: {
                x: rect.left + window.scrollX,
                y: rect.top + window.scrollY,
                width: rect.width,
                height: rect.height,
                devicePixelRatio: window.devicePixelRatio
            }
        });
    }

    removeSelectionTool();
}

function handleKeyPress(e) {
    if (e.key === 'Escape') {
        cleanup();
    }
}

function cleanup() {
    if (overlay) {
        overlay.remove();
        overlay = null;
    }
    if (selection) {
        selection.remove();
        selection = null;
    }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'startSelection') {
        createSelectionTool();
    }
});

// When loading html2canvas
const script = document.createElement('script');
script.src = chrome.runtime.getURL('lib/html2canvas.min.js');
document.head.appendChild(script); 
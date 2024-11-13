function createSelector() {
    // Remove existing selector if any
    removeExistingSelector();

    // Create container for selection UI
    const container = document.createElement('div');
    container.id = 'screenshot-selector-container';
    container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 999999;
        cursor: crosshair;
        background: rgba(0,0,0,0.2);
    `;

    // Create selection box
    const selection = document.createElement('div');
    selection.id = 'screenshot-selector';
    selection.style.cssText = `
        position: absolute;
        border: 2px solid #0095ff;
        background: rgba(0, 149, 255, 0.1);
        display: none;
    `;

    container.appendChild(selection);
    document.body.appendChild(container);

    let isSelecting = false;
    let startX = 0;
    let startY = 0;

    container.addEventListener('mousedown', (e) => {
        isSelecting = true;
        startX = e.clientX;
        startY = e.clientY;
        selection.style.display = 'block';
        selection.style.left = startX + 'px';
        selection.style.top = startY + 'px';
    });

    container.addEventListener('mousemove', (e) => {
        if (!isSelecting) return;

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
    });

    container.addEventListener('mouseup', async (e) => {
        if (!isSelecting) return;
        isSelecting = false;

        // Get the final selection bounds
        const bounds = selection.getBoundingClientRect();
        
        // Calculate scroll offset
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;

        // Send message with adjusted coordinates
        chrome.runtime.sendMessage({
            type: 'captureArea',
            bounds: {
                x: bounds.x + scrollX,
                y: bounds.y + scrollY,
                width: bounds.width,
                height: bounds.height,
                devicePixelRatio: window.devicePixelRatio
            }
        });

        // Hide the selector UI
        removeExistingSelector();
    });

    // Allow canceling with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            removeExistingSelector();
        }
    });
}

function removeExistingSelector() {
    const existingContainer = document.getElementById('screenshot-selector-container');
    if (existingContainer) {
        existingContainer.remove();
    }
}

createSelector();
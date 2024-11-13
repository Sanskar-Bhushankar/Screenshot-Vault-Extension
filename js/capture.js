(() => {
    // Prevent multiple injections
    if (window.isCapturing) return;
    window.isCapturing = true;

    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.3);
        cursor: crosshair;
        z-index: 2147483647;
    `;

    const selection = document.createElement('div');
    selection.style.cssText = `
        position: fixed;
        border: 2px solid #0095ff;
        background: rgba(0, 149, 255, 0.1);
        z-index: 2147483647;
        display: none;
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(selection);

    let startX, startY;
    let isSelecting = false;

    overlay.addEventListener('mousedown', (e) => {
        isSelecting = true;
        startX = e.clientX;
        startY = e.clientY;
        selection.style.display = 'block';
        selection.style.left = startX + 'px';
        selection.style.top = startY + 'px';
        selection.style.width = '0';
        selection.style.height = '0';
    });

    overlay.addEventListener('mousemove', (e) => {
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

    overlay.addEventListener('mouseup', async () => {
        if (!isSelecting) return;
        isSelecting = false;

        const rect = selection.getBoundingClientRect();
        
        // Only capture if selection is large enough
        if (rect.width > 10 && rect.height > 10) {
            // Send message to capture the area
            chrome.runtime.sendMessage({
                type: 'captureArea',
                area: {
                    x: rect.left,
                    y: rect.top,
                    width: rect.width,
                    height: rect.height
                }
            });
        }

        // Cleanup
        cleanup();
    });

    function cleanup() {
        overlay.remove();
        selection.remove();
        window.isCapturing = false;
    }

    // Allow canceling with Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            cleanup();
        }
    });
})(); 
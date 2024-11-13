document.addEventListener('DOMContentLoaded', () => {
    loadScreenshots();
    
    document.getElementById('snipBtn').addEventListener('click', startSnipping);
    document.getElementById('fullSnipBtn').addEventListener('click', captureFullScreen);
    document.getElementById('clearBtn').addEventListener('click', clearScreenshots);
    document.getElementById('downloadAllBtn').addEventListener('click', downloadAllScreenshots);
    updateStorageInfo();
});

async function startSnipping() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // First capture the full screenshot
    const screenshot = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    
    // Store it in local storage
    await chrome.storage.local.set({ fullScreenshot: screenshot });
    
    // Inject the selection tool
    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: injectSelectionTool
    });
    
    window.close();
}

async function copyImageToClipboard(dataUrl, button) {
    try {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        
        const item = new ClipboardItem({
            'image/png': blob
        });
        
        await navigator.clipboard.write([item]);
        
        // Visual feedback
        button.textContent = 'Copied!';
        button.classList.add('copied');
        
        // Reset button after 2 seconds
        setTimeout(() => {
            button.textContent = 'Copy';
            button.classList.remove('copied');
        }, 2000);
        
    } catch (err) {
        console.error('Failed to copy to clipboard:', err);
        button.textContent = 'Failed';
        setTimeout(() => {
            button.textContent = 'Copy';
        }, 2000);
    }
}

function injectSelectionTool() {
    let isSelecting = false;
    let startX = 0;
    let startY = 0;
    
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.2);
        cursor: crosshair;
        z-index: 999999;
    `;
    
    const selection = document.createElement('div');
    selection.style.cssText = `
        position: fixed;
        border: 2px solid #0095ff;
        background: rgba(0,149,255,0.1);
        display: none;
        z-index: 999999;
    `;
    
    document.body.appendChild(overlay);
    document.body.appendChild(selection);

    function handleMouseDown(e) {
        isSelecting = true;
        startX = e.clientX;
        startY = e.clientY;
        selection.style.display = 'block';
        selection.style.left = startX + 'px';
        selection.style.top = startY + 'px';
        selection.style.width = '0';
        selection.style.height = '0';
    }

    function handleMouseMove(e) {
        if (!isSelecting) return;
        
        const width = Math.abs(e.clientX - startX);
        const height = Math.abs(e.clientY - startY);
        const left = Math.min(e.clientX, startX);
        const top = Math.min(e.clientY, startY);
        
        selection.style.width = width + 'px';
        selection.style.height = height + 'px';
        selection.style.left = left + 'px';
        selection.style.top = top + 'px';
    }

    async function handleMouseUp() {
        if (!isSelecting) return;
        isSelecting = false;

        const rect = selection.getBoundingClientRect();
        
        if (rect.width > 10 && rect.height > 10) {
            try {
                const result = await chrome.storage.local.get('fullScreenshot');
                const fullScreenshot = result.fullScreenshot;
                
                if (!fullScreenshot) {
                    console.error('No screenshot found');
                    return;
                }

                const img = new Image();
                
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Set canvas size to match selection
                    canvas.width = rect.width;
                    canvas.height = rect.height;
                    
                    // Calculate the ratio between full screenshot and visible area
                    // This accounts for the Chrome UI offset
                    const heightRatio = img.height / window.innerHeight;
                    const widthRatio = img.width / window.innerWidth;
                    
                    // Adjust coordinates based on the ratio
                    const adjustedX = rect.left * widthRatio;
                    const adjustedY = rect.top * heightRatio;
                    const adjustedWidth = rect.width * widthRatio;
                    const adjustedHeight = rect.height * heightRatio;
                    
                    // Draw the selected portion with adjusted coordinates
                    ctx.drawImage(
                        img,
                        adjustedX,
                        adjustedY,
                        adjustedWidth,
                        adjustedHeight,
                        0,
                        0,
                        rect.width,
                        rect.height
                    );
                    
                    const croppedImage = canvas.toDataURL('image/png');
                    
                    // Save to storage
                    chrome.storage.local.get(['screenshots'], (result) => {
                        const screenshots = result.screenshots || [];
                        screenshots.push(croppedImage);
                        chrome.storage.local.set({ screenshots }, () => {
                            // Copy to clipboard
                            copyImageToClipboard(croppedImage);
                        });
                    });
                };
                
                img.src = fullScreenshot;
                
            } catch (error) {
                console.error('Screenshot failed:', error);
            }
        }

        cleanup();
    }

    function handleKeyDown(e) {
        if (e.key === 'Escape') {
            cleanup();
        }
    }

    function cleanup() {
        isSelecting = false;
        overlay.removeEventListener('mousedown', handleMouseDown);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('keydown', handleKeyDown);
        overlay.remove();
        selection.remove();
    }

    overlay.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);
}

function addNewScreenshot(dataUrl) {
    chrome.storage.local.get(['screenshots'], (result) => {
        const screenshots = result.screenshots || [];
        screenshots.push(dataUrl);
        
        // Don't add any name by default, just save the screenshot
        chrome.storage.local.set({ screenshots }, () => {
            loadScreenshots();
        });
    });
}

function loadScreenshots() {
    chrome.storage.local.get(['screenshots', 'screenshotNames'], (result) => {
        const screenshots = result.screenshots || [];
        const container = document.getElementById('screenshotContainer');
        
        document.getElementById('screenshotCount').textContent = screenshots.length;
        
        if (screenshots.length === 0) {
            container.innerHTML = '<div class="no-screenshots">No screenshots yet</div>';
            return;
        }
        
        const reversedScreenshots = [...screenshots].reverse();
        
        container.innerHTML = reversedScreenshots.map((screenshot, index) => {
            const realIndex = screenshots.length - index;
            
            return `
                <div class="screenshot-item" draggable="true" data-index="${screenshots.length - 1 - index}">
                    <img src="${screenshot}" class="screenshot-img" alt="Screenshot ${realIndex}">
                    <div class="name-wrapper">
                        <span class="screenshot-name">${realIndex}</span>
                        <input type="text" class="name-input" value="${realIndex}">
                    </div>
                    <div class="screenshot-actions">
                        <button class="btn-copy">Copy</button>
                        <button class="btn-download">Download</button>
                        <button class="btn-delete">Delete</button>
                    </div>
                </div>
            `;
        }).join('');

        addScreenshotEventListeners();
    });
}

function setupDragAndDrop() {
    const items = document.querySelectorAll('.screenshot-item');
    
    items.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragenter', handleDragEnter);
        item.addEventListener('dragleave', handleDragLeave);
    });
}

function handleDragStart(e) {
    if (!e.target.classList.contains('screenshot-item')) return;
    e.target.classList.add('dragging');
    e.dataTransfer.setData('text/plain', e.target.dataset.index);
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.screenshot-item').forEach(item => {
        item.classList.remove('drag-over');
    });
}

function handleDragOver(e) {
    e.preventDefault();
}

function handleDragEnter(e) {
    e.preventDefault();
    const item = e.target.closest('.screenshot-item');
    if (item && !item.classList.contains('dragging')) {
        item.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    const item = e.target.closest('.screenshot-item');
    if (item) {
        item.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
    const toIndex = parseInt(this.dataset.index);
    
    if (fromIndex === toIndex) return;
    
    chrome.storage.local.get(['screenshots', 'screenshotNames'], (result) => {
        const screenshots = result.screenshots || [];
        const screenshotNames = result.screenshotNames || {};
        
        // Reorder screenshots
        const [movedScreenshot] = screenshots.splice(fromIndex, 1);
        screenshots.splice(toIndex, 0, movedScreenshot);
        
        // Reorder names if they exist
        const names = {};
        Object.keys(screenshotNames).forEach(key => {
            const keyNum = parseInt(key);
            if (keyNum === fromIndex) {
                names[toIndex] = screenshotNames[key];
            } else if (keyNum < fromIndex && keyNum >= toIndex) {
                names[keyNum + 1] = screenshotNames[key];
            } else if (keyNum > fromIndex && keyNum <= toIndex) {
                names[keyNum - 1] = screenshotNames[key];
            } else {
                names[keyNum] = screenshotNames[key];
            }
        });
        
        chrome.storage.local.set({ 
            screenshots, 
            screenshotNames: names 
        }, loadScreenshots);
    });
}

function addScreenshotEventListeners() {
    // Preview functionality
    document.querySelectorAll('.screenshot-img').forEach(img => {
        img.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const previewContainer = document.getElementById('previewContainer');
            const previewImage = document.getElementById('previewImage');
            previewImage.src = this.src;
            previewContainer.style.display = 'flex';
        });
    });

    // Close preview
    const closeBtn = document.querySelector('.close-preview');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            document.getElementById('previewContainer').style.display = 'none';
        });
    }

    // Close preview on outside click
    const previewContainer = document.getElementById('previewContainer');
    if (previewContainer) {
        previewContainer.addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
            }
        });
    }

    // Name editing
    document.querySelectorAll('.screenshot-name').forEach(span => {
        span.addEventListener('click', function() {
            const input = this.nextElementSibling;
            this.style.display = 'none';
            input.style.display = 'inline-block';
            input.focus();
            input.select();
        });
    });

    document.querySelectorAll('.name-input').forEach(input => {
        input.addEventListener('blur', function() {
            const nameSpan = this.previousElementSibling;
            const newName = this.value.trim();
            const index = this.closest('.screenshot-item').dataset.index;
            
            if (newName) {
                nameSpan.textContent = newName;
                chrome.storage.local.get(['screenshotNames'], (result) => {
                    const screenshotNames = result.screenshotNames || {};
                    screenshotNames[index] = newName;
                    chrome.storage.local.set({ screenshotNames }, () => {
                        console.log('Name saved:', newName);
                    });
                });
            } else {
                chrome.storage.local.get(['screenshots'], (result) => {
                    const screenshots = result.screenshots || [];
                    nameSpan.textContent = `${screenshots.length - index}`;
                });
            }
            
            input.style.display = 'none';
            nameSpan.style.display = 'inline';
        });

        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                this.blur();
            }
        });
    });

    // Button actions
    document.querySelectorAll('.screenshot-item').forEach(item => {
        const index = item.dataset.index;
        const screenshot = item.querySelector('.screenshot-img').src;

        // Copy button
        item.querySelector('.btn-copy').addEventListener('click', async () => {
            try {
                const response = await fetch(screenshot);
                const blob = await response.blob();
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);
                
                // Visual feedback
                const copyBtn = item.querySelector('.btn-copy');
                copyBtn.textContent = 'Copied!';
                setTimeout(() => {
                    copyBtn.textContent = 'Copy';
                }, 2000);
            } catch (err) {
                console.error('Copy failed:', err);
            }
        });

        // Download button
        item.querySelector('.btn-download').addEventListener('click', () => {
            chrome.storage.local.get(['screenshotNames'], (result) => {
                const screenshotNames = result.screenshotNames || {};
                const fileName = screenshotNames[index] || `screenshot_${parseInt(index) + 1}`;
                
                const link = document.createElement('a');
                link.href = screenshot;
                link.download = `${fileName}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
        });

        // Delete button
        item.querySelector('.btn-delete').addEventListener('click', () => {
            chrome.storage.local.get(['screenshots'], (result) => {
                const screenshots = result.screenshots || [];
                screenshots.splice(index, 1);
                chrome.storage.local.set({ screenshots }, () => {
                    loadScreenshots();
                });
            });
        });
    });

    // Setup drag and drop
    setupDragAndDrop();
}

function saveCustomName(index, name) {
    chrome.storage.local.get(['screenshotNames'], (result) => {
        const screenshotNames = result.screenshotNames || {};
        screenshotNames[index] = name;
        chrome.storage.local.set({ screenshotNames });
    });
}

function downloadScreenshot(dataUrl, index) {
    chrome.storage.local.get(['screenshotNames'], (result) => {
        const screenshotNames = result.screenshotNames || {};
        const name = screenshotNames[index] || `${index + 1}`;
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `${name}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}

function deleteScreenshot(index) {
    chrome.storage.local.get(['screenshots'], (result) => {
        const screenshots = result.screenshots || [];
        screenshots.splice(index, 1);
        chrome.storage.local.set({ screenshots }, () => {
            loadScreenshots();
        });
    });
}

function clearScreenshots() {
    if (confirm('Are you sure you want to clear all screenshots?')) {
        chrome.storage.local.set({ screenshots: [] }, () => {
            loadScreenshots();
        });
    }
}

async function captureFullScreen() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Capture the visible tab
        const screenshot = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
        
        // Save to storage
        chrome.storage.local.get(['screenshots'], (result) => {
            const screenshots = result.screenshots || [];
            screenshots.push(screenshot);
            chrome.storage.local.set({ screenshots }, () => {
                loadScreenshots(); // Reload the screenshots display
            });
        });
    } catch (error) {
        console.error('Failed to capture full screen:', error);
    }
}

async function downloadAllScreenshots() {
    const result = await chrome.storage.local.get(['screenshots']);
    const screenshots = result.screenshots || [];
    
    if (screenshots.length === 0) {
        alert('No screenshots to download');
        return;
    }

    // Create a zip file
    const zip = new JSZip();
    
    // Add each screenshot to the zip
    screenshots.forEach((screenshot, index) => {
        // Convert base64 to blob
        const imageData = screenshot.replace(/^data:image\/(png|jpg);base64,/, '');
        zip.file(`screenshot_${index + 1}.png`, imageData, {base64: true});
    });
    
    // Generate and download the zip
    zip.generateAsync({type: 'blob'}).then(content => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = 'screenshots.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    });
}

// Add this function to check and display storage usage
function updateStorageInfo() {
    chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
        const mbUsed = bytesInUse / (1024 * 1024);
        const storageText = document.getElementById('storageText');
        const storageBar = document.getElementById('storageBar');
        
        // Update storage text
        storageText.textContent = `${mbUsed.toFixed(1)}MB / 500MB`;
        
        // Update storage bar
        const percentUsed = (bytesInUse / (500 * 1024 * 1024)) * 100;
        storageBar.style.setProperty('--storage-used', `${percentUsed}%`);
        storageBar.style.cssText = `
            &::after {
                width: ${percentUsed}%;
                background: ${percentUsed > 90 ? '#ff4444' : '#9533e6'};
            }
        `;
    });
}

// Update storage info when screenshots change
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.screenshots) {
        updateStorageInfo();
    }
});

// Add these new functions for name editing
function enableNameEdit(index) {
    const nameContainer = document.querySelector(`.screenshot-item[data-index="${index}"] .screenshot-name`);
    const nameText = nameContainer.querySelector('.name-text');
    const nameInput = nameContainer.querySelector('.name-edit');
    
    nameText.style.display = 'none';
    nameInput.style.display = 'inline-block';
}

function saveScreenshotName(input) {
    const index = input.dataset.index;
    const newName = input.value.trim();
    const item = input.closest('.screenshot-item');
    const nameDisplay = item.querySelector('.name-display');
    
    chrome.storage.local.get(['screenshotNames'], (result) => {
        const screenshotNames = result.screenshotNames || {};
        screenshotNames[index] = newName;
        chrome.storage.local.set({ screenshotNames }, () => {
            nameDisplay.textContent = newName;
            input.style.display = 'none';
        });
    });
}

function showPreview(imageUrl) {
    const previewContainer = document.getElementById('previewContainer');
    const previewImage = document.getElementById('previewImage');
    previewImage.src = imageUrl;
    previewContainer.style.display = 'flex';
}

function hidePreview() {
    const previewContainer = document.getElementById('previewContainer');
    previewContainer.style.display = 'none';
}

// Add these functions to handle name editing
function enableEditing(element) {
    const parent = element.parentElement;
    const input = parent.querySelector('.name-input');
    const nameText = parent.querySelector('.name-text');
    
    nameText.style.display = 'none';
    input.style.display = 'inline-block';
    input.focus();
    input.select();
}

function saveNewName(input) {
    const parent = input.parentElement;
    const nameText = parent.querySelector('.name-text');
    const index = parent.dataset.index;
    const newName = input.value.trim() || `Screenshot ${parseInt(index) + 1}`;
    
    chrome.storage.local.get(['screenshotNames'], (result) => {
        const screenshotNames = result.screenshotNames || {};
        screenshotNames[index] = newName;
        chrome.storage.local.set({ screenshotNames }, () => {
            nameText.textContent = newName;
            input.style.display = 'none';
            nameText.style.display = 'inline-block';
        });
    });
}

function handleKeyPress(event, input) {
    if (event.key === 'Enter') {
        input.blur();
    }
}

function openInNewTab(imageUrl) {
    window.open(imageUrl, '_blank');
}

function startEditing(index) {
    const filenameSpan = document.querySelector(`.screenshot-item[data-index="${index}"] .filename`);
    const filenameInput = document.querySelector(`#filename-${index}`);
    
    filenameSpan.style.display = 'none';
    filenameInput.style.display = 'inline-block';
    filenameInput.focus();
    filenameInput.select();

    filenameInput.addEventListener('blur', () => saveFilename(index));
    filenameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') filenameInput.blur();
    });
}

function saveFilename(index) {
    const input = document.querySelector(`#filename-${index}`);
    const span = document.querySelector(`.screenshot-item[data-index="${index}"] .filename`);
    const newName = input.value.trim() || `Screenshot_${index + 1}`;

    chrome.storage.local.get(['screenshotNames'], (result) => {
        const screenshotNames = result.screenshotNames || {};
        screenshotNames[index] = newName;
        chrome.storage.local.set({ screenshotNames }, () => {
            span.textContent = newName;
            input.style.display = 'none';
            span.style.display = 'inline-block';
        });
    });
}

// Update delete handler to maintain names
function handleDelete(index) {
    chrome.storage.local.get(['screenshots', 'screenshotNames'], (result) => {
        const screenshots = result.screenshots || [];
        const screenshotNames = result.screenshotNames || {};
        
        // Remove screenshot
        screenshots.splice(index, 1);
        
        // Adjust names for remaining screenshots
        const newNames = {};
        Object.keys(screenshotNames).forEach(key => {
            const keyNum = parseInt(key);
            if (keyNum < index) {
                newNames[keyNum] = screenshotNames[keyNum];
            } else if (keyNum > index) {
                newNames[keyNum - 1] = screenshotNames[keyNum];
            }
        });
        
        chrome.storage.local.set({ 
            screenshots, 
            screenshotNames: newNames 
        }, () => {
            loadScreenshots();
        });
    });
}

// When loading jszip
const jszipScript = document.createElement('script');
jszipScript.src = chrome.runtime.getURL('lib/jszip.min.js');
document.head.appendChild(jszipScript);
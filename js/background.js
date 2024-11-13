chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'capture') {
        chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
            chrome.storage.local.get(['screenshots'], (result) => {
                const screenshots = result.screenshots || [];
                screenshots.push(dataUrl);
                chrome.storage.local.set({ screenshots }, () => {
                    sendResponse({ success: true });
                });
            });
        });
        return true;
    }
});

// Create context menu when extension is installed
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "saveToExtension",
        title: "Save to Screenshots",
        contexts: ["image"]
    });
});

// Handle context menu item click
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "saveToExtension") {
        // Fetch the image
        fetch(info.srcUrl)
            .then(response => response.blob())
            .then(blob => {
                // Convert blob to base64
                const reader = new FileReader();
                reader.onloadend = () => {
                    // Save to extension storage
                    chrome.storage.local.get(['screenshots'], (result) => {
                        const screenshots = result.screenshots || [];
                        screenshots.push(reader.result);
                        chrome.storage.local.set({ screenshots }, () => {
                            // Show notification (optional)
                            chrome.notifications.create({
                                type: 'basic',
                                iconUrl: 'icon48.png',
                                title: 'Screenshot Saved',
                                message: 'Image has been saved to your screenshots'
                            });
                        });
                    });
                };
                reader.readAsDataURL(blob);
            })
            .catch(error => console.error('Error saving image:', error));
    }
});

// Fix service worker error
chrome.action.onClicked.addListener(() => {
    // Only add this if you need to handle toolbar icon clicks
    // Otherwise, you can remove this listener
});

// Handle any chrome:// URL errors
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.url && tab.url.startsWith('chrome://')) {
        // Skip chrome:// URLs
        return;
    }
    // Rest of your code
}); 
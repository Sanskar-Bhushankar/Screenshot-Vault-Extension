// Handle displaying and managing scraped images
document.addEventListener('DOMContentLoaded', function() {
    loadScrapedImages();
    
    // Event listeners for bulk actions
    document.getElementById('downloadAllScraped').addEventListener('click', downloadAllScrapedImages);
    document.getElementById('clearScraped').addEventListener('click', clearAllScrapedImages);
});

function loadScrapedImages() {
    chrome.storage.local.get(['scrapedImages'], (result) => {
        const scrapedImages = result.scrapedImages || [];
        const container = document.getElementById('scrapedImagesContainer');
        
        if (scrapedImages.length === 0) {
            container.innerHTML = '<div class="no-images">No scraped images yet</div>';
            return;
        }
        
        container.innerHTML = scrapedImages.map((image, index) => `
            <div class="scraped-image-item">
                <img src="${image.url}" alt="Scraped image ${index + 1}">
                <div class="scraped-image-actions">
                    <button onclick="downloadImage('${image.url}', ${index})">Download</button>
                    <button onclick="deleteScrapedImage(${index})">Delete</button>
                </div>
            </div>
        `).join('');
    });
}

function downloadImage(url, index) {
    const a = document.createElement('a');
    a.href = url;
    a.download = `scraped-image-${index + 1}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function deleteScrapedImage(index) {
    chrome.storage.local.get(['scrapedImages'], (result) => {
        const scrapedImages = result.scrapedImages || [];
        scrapedImages.splice(index, 1);
        chrome.storage.local.set({ scrapedImages }, () => {
            loadScrapedImages();
        });
    });
}

function downloadAllScrapedImages() {
    chrome.storage.local.get(['scrapedImages'], (result) => {
        const scrapedImages = result.scrapedImages || [];
        scrapedImages.forEach((image, index) => {
            downloadImage(image.url, index);
        });
    });
}

function clearAllScrapedImages() {
    if (confirm('Are you sure you want to clear all scraped images?')) {
        chrome.storage.local.set({ scrapedImages: [] }, () => {
            loadScrapedImages();
        });
    }
} 
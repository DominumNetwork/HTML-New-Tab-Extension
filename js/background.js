// Background service worker for Custom New Tab extension

// Handle messages from content scripts and other parts of the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'openPopup') {
        // Try to open the extension popup
        chrome.action.openPopup()
            .then(() => {
                sendResponse({ success: true });
            })
            .catch((error) => {
                console.log('Failed to open popup:', error);
                // If popup opening fails, we can't do much more
                // The fallback in newtab.js will handle opening the options page
                sendResponse({ success: false, error: error.message });
            });
        
        // Return true to indicate we'll send a response asynchronously
        return true;
    }
});

// Handle extension installation or update
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('Custom New Tab extension installed');
    } else if (details.reason === 'update') {
        console.log('Custom New Tab extension updated');
    }
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
    console.log('Custom New Tab extension started');
});
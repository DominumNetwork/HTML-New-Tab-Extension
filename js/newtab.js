// Create animated particles
function createParticles() {
    const particlesContainer = document.querySelector('.particles');
    const particleCount = 50;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 6 + 's';
        particle.style.animationDuration = (Math.random() * 3 + 3) + 's';
        particlesContainer.appendChild(particle);
    }
}

// Update clock
function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    });
    document.getElementById('clock').textContent = timeString;
}

// Reconstruct content from chunks
function reconstructFromChunks(chunks) {
    return chunks.join('');
}

// Safely decode content from storage
function decodeFromStorage(content) {
    // Check if content is base64 encoded
    try {
        const decoded = decodeURIComponent(escape(atob(content)));
        return decoded;
    } catch (error) {
        // If decoding fails, assume it's raw content (backward compatibility)
        return content;
    }
}

// Safely set HTML content to prevent corruption
function setCustomContent(htmlContent) {
    const customContent = document.getElementById('custom-content');
    const defaultContent = document.getElementById('default-content');
    
    if (htmlContent && htmlContent.trim()) {
        // Create a new document fragment to safely parse HTML
        const parser = new DOMParser();
        try {
            // Parse the HTML content safely
            const doc = parser.parseFromString(htmlContent, 'text/html');
            
            // Clear and set the content properly
            customContent.innerHTML = '';
            
            // Copy all elements from the parsed document
            if (doc.head && doc.head.children.length > 0) {
                // Handle head elements (CSS, meta tags, etc.)
                Array.from(doc.head.children).forEach(element => {
                    if (element.tagName === 'STYLE' || element.tagName === 'LINK') {
                        document.head.appendChild(element.cloneNode(true));
                    }
                });
            }
            
            if (doc.body) {
                // Use the body content or the entire document if no body tag
                const contentToInsert = doc.body.innerHTML || htmlContent;
                customContent.innerHTML = contentToInsert;
            } else {
                // Fallback: insert content directly but safely
                customContent.textContent = '';
                customContent.insertAdjacentHTML('afterbegin', htmlContent);
            }
            
            customContent.style.display = 'block';
            defaultContent.style.display = 'none';
        } catch (error) {
            console.error('Error parsing HTML content:', error);
            // Fallback to safe text insertion
            customContent.textContent = htmlContent;
            customContent.style.display = 'block';
            defaultContent.style.display = 'none';
        }
    } else {
        customContent.style.display = 'none';
        defaultContent.style.display = 'block';
    }
}

// Load and display custom HTML content
function loadCustomContent() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.sync.get(null, function(result) {
            let htmlContent = '';
            
            // Check if we have chunked data
            if (result.customHtml_chunks) {
                const chunks = [];
                for (let i = 0; i < result.customHtml_chunks; i++) {
                    if (result[`customHtml_chunk_${i}`]) {
                        chunks.push(result[`customHtml_chunk_${i}`]);
                    }
                }
                const rawContent = reconstructFromChunks(chunks);
                // Try to decode if it was encoded
                htmlContent = result.customHtml_encoded ? decodeFromStorage(rawContent) : rawContent;
            } else if (result.customHtml) {
                // Legacy single storage - try to decode if marked as encoded
                htmlContent = result.customHtml_encoded ? decodeFromStorage(result.customHtml) : result.customHtml;
            }
            
            setCustomContent(htmlContent);
        });
    } else {
        // Fallback if chrome API not available
        console.log('Chrome storage API not available');
    }
}

async function openSettings() {
    if (typeof chrome !== 'undefined' && chrome.action) {
        try {
            // Try to open the extension popup (Manifest V3)
            await chrome.action.openPopup();
        } catch (error) {
            // If openPopup fails (which it often does), send a message to background script
            // to open the popup or fallback to options page
            try {
                chrome.runtime.sendMessage({action: 'openPopup'}, (response) => {
                    if (chrome.runtime.lastError || !response || !response.success) {
                        // Final fallback: open options page
                        chrome.runtime.openOptionsPage();
                    }
                });
            } catch (msgError) {
                // Last resort: open options page
                chrome.runtime.openOptionsPage();
            }
        }
    } else if (typeof chrome !== 'undefined' && chrome.runtime) {
        // Fallback for older manifest versions or limited context
        chrome.runtime.openOptionsPage();
    } else {
        // Fallback - try to open extension popup
        alert('Please click the extension icon in the toolbar to access settings.');
    }
}

// Open settings in tab mode (for file uploads)
function openSettingsInTab() {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.create({ 
            url: chrome.runtime.getURL('popup.html?popup=false')
        });
    } else {
        // Fallback
        chrome.runtime.openOptionsPage();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    createParticles();
    updateClock();
    setInterval(updateClock, 1000);
    loadCustomContent();
    
    // Add event listeners to buttons
    document.getElementById('customizeBtn').addEventListener('click', openSettings);
    document.getElementById('uploadBtn').addEventListener('click', openSettingsInTab);
});

// Listen for storage changes - listen to all storage changes
if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.onChanged.addListener(function(changes, namespace) {
        // Check if any custom HTML related keys changed
        if (changes.customHtml || changes.customHtml_chunks || 
            Object.keys(changes).some(key => key.startsWith('customHtml_chunk_'))) {
            loadCustomContent();
        }
    });
}
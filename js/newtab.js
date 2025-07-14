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

// Load and display custom HTML content
function loadCustomContent() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.sync.get(null, function(result) {
            const customContent = document.getElementById('custom-content');
            const defaultContent = document.getElementById('default-content');
            
            let htmlContent = '';
            
            // Check if we have chunked data
            if (result.customHtml_chunks) {
                const chunks = [];
                for (let i = 0; i < result.customHtml_chunks; i++) {
                    if (result[`customHtml_chunk_${i}`]) {
                        chunks.push(result[`customHtml_chunk_${i}`]);
                    }
                }
                htmlContent = reconstructFromChunks(chunks);
            } else if (result.customHtml) {
                // Legacy single storage
                htmlContent = result.customHtml;
            }
            
            if (htmlContent && htmlContent.trim()) {
                customContent.innerHTML = htmlContent;
                customContent.style.display = 'block';
                defaultContent.style.display = 'none';
            } else {
                customContent.style.display = 'none';
                defaultContent.style.display = 'block';
            }
        });
    } else {
        // Fallback if chrome API not available
        console.log('Chrome storage API not available');
    }
}

function openSettings() {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        // Try to open the popup
        chrome.runtime.openOptionsPage();
    } else {
        // Fallback - try to open extension popup
        alert('Please click the extension icon in the toolbar to access settings.');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    createParticles();
    updateClock();
    setInterval(updateClock, 1000);
    loadCustomContent();
    
    // Add event listener to customize button
    document.getElementById('customizeBtn').addEventListener('click', openSettings);
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
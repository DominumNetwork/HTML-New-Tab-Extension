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

// Safely set HTML content to prevent corruption and style bleeding
function setCustomContent(htmlContent) {
    const customContent = document.getElementById('custom-content');
    const defaultContent = document.getElementById('default-content');
    
    if (htmlContent && htmlContent.trim()) {
        try {
            // Create an isolated iframe for the custom content
            const iframe = document.createElement('iframe');
            iframe.style.cssText = `
                width: 100%;
                height: 100vh;
                border: none;
                margin: 0;
                padding: 0;
                overflow: hidden;
                position: absolute;
                top: 0;
                left: 0;
                z-index: 999999;
            `;
            
            // Clear the custom content container
            customContent.innerHTML = '';
            customContent.appendChild(iframe);
            
            // Write the custom HTML content to the iframe
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            iframeDoc.open();
            iframeDoc.write(htmlContent);
            iframeDoc.close();
            
            // Show custom content and hide default
            customContent.style.display = 'block';
            customContent.style.position = 'fixed';
            customContent.style.top = '0';
            customContent.style.left = '0';
            customContent.style.width = '100%';
            customContent.style.height = '100vh';
            customContent.style.zIndex = '999999';
            customContent.style.background = 'white';
            
            defaultContent.style.display = 'none';
            
            // Hide the body overflow to prevent scrollbars
            document.body.style.overflow = 'hidden';
            
        } catch (error) {
            console.error('Error setting custom content in iframe:', error);
            // Fallback: Use isolated div with CSS reset
            setCustomContentFallback(htmlContent, customContent, defaultContent);
        }
    } else {
        // Reset everything back to default
        customContent.style.display = 'none';
        customContent.style.position = 'static';
        customContent.style.zIndex = 'auto';
        defaultContent.style.display = 'block';
        document.body.style.overflow = 'auto';
    }
}

// Fallback method with CSS isolation
function setCustomContentFallback(htmlContent, customContent, defaultContent) {
    try {
        // Parse the HTML content safely
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        
        // Create an isolated container
        const isolatedContainer = document.createElement('div');
        isolatedContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100vh;
            z-index: 999999;
            background: white;
            overflow: auto;
            font-family: inherit;
            font-size: 16px;
            line-height: 1.4;
            color: #333;
        `;
        
        // Add CSS reset specifically for the isolated container
        const resetStyle = document.createElement('style');
        resetStyle.textContent = `
            .custom-html-container * {
                box-sizing: border-box;
            }
            .custom-html-container {
                all: initial;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100vh !important;
                z-index: 999999 !important;
                background: white !important;
                overflow: auto !important;
            }
        `;
        
        isolatedContainer.className = 'custom-html-container';
        
        // Process and insert head elements (CSS, meta tags)
        if (doc.head && doc.head.children.length > 0) {
            Array.from(doc.head.children).forEach(element => {
                if (element.tagName === 'STYLE') {
                    // Scope the CSS to the isolated container
                    const scopedStyle = document.createElement('style');
                    let css = element.textContent;
                    
                    // Add container scoping to CSS rules
                    css = css.replace(/([^{}]+)\{/g, '.custom-html-container $1{');
                    
                    // Fix body and html selectors
                    css = css.replace(/\.custom-html-container\s+body\s*\{/g, '.custom-html-container {');
                    css = css.replace(/\.custom-html-container\s+html\s*\{/g, '.custom-html-container {');
                    css = css.replace(/\.custom-html-container\s+\*\s*\{/g, '.custom-html-container * {');
                    
                    scopedStyle.textContent = css;
                    isolatedContainer.appendChild(scopedStyle);
                } else if (element.tagName === 'LINK' && element.rel === 'stylesheet') {
                    // Copy external stylesheets
                    isolatedContainer.appendChild(element.cloneNode(true));
                } else if (element.tagName === 'META') {
                    // Skip meta tags for the isolated container
                    return;
                }
            });
        }
        
        // Insert the reset style first
        isolatedContainer.appendChild(resetStyle);
        
        // Insert body content
        if (doc.body) {
            const bodyContent = document.createElement('div');
            bodyContent.innerHTML = doc.body.innerHTML;
            isolatedContainer.appendChild(bodyContent);
            
            // Copy body attributes to container
            if (doc.body.style.cssText) {
                const bodyStyles = doc.body.style.cssText;
                isolatedContainer.style.cssText += '; ' + bodyStyles;
            }
        } else {
            // If no body tag, insert all content
            const contentDiv = document.createElement('div');
            contentDiv.innerHTML = htmlContent;
            isolatedContainer.appendChild(contentDiv);
        }
        
        // Clear and set up the custom content
        customContent.innerHTML = '';
        customContent.appendChild(isolatedContainer);
        
        customContent.style.display = 'block';
        defaultContent.style.display = 'none';
        document.body.style.overflow = 'hidden';
        
        // Execute any scripts in the custom content
        const scripts = isolatedContainer.querySelectorAll('script');
        scripts.forEach(oldScript => {
            const newScript = document.createElement('script');
            Array.from(oldScript.attributes).forEach(attr => {
                newScript.setAttribute(attr.name, attr.value);
            });
            newScript.textContent = oldScript.textContent;
            oldScript.parentNode.replaceChild(newScript, oldScript);
        });
        
    } catch (error) {
        console.error('Error in fallback content setting:', error);
        // Last resort: simple text display
        customContent.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100vh; 
                        background: white; padding: 20px; overflow: auto; z-index: 999999;">
                <h2>Custom HTML Content</h2>
                <pre style="white-space: pre-wrap; font-family: monospace; font-size: 12px;">${htmlContent}</pre>
            </div>
        `;
        customContent.style.display = 'block';
        defaultContent.style.display = 'none';
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

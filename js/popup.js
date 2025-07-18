// Constants
const CHUNK_SIZE = 7000; // Leave some buffer for metadata
const MAX_CHUNKS = 50; // Reasonable limit to prevent excessive storage usage

// Check if running in popup or tab mode
function isInPopup() {
    return window.location.search.indexOf('popup=false') === -1 && 
           window.innerWidth < 500 && 
           window.innerHeight < 700;
}

// Open extension in tab mode
function openInTab() {
    const currentUrl = window.location.href;
    const tabUrl = currentUrl + (currentUrl.includes('?') ? '&' : '?') + 'popup=false';
    chrome.tabs.create({ url: tabUrl });
    if (isInPopup()) {
        window.close();
    }
}

// Update line numbers
function updateLineNumbers() {
    const editor = document.getElementById('htmlEditor');
    const lineNumbers = document.getElementById('lineNumbers');
    const lines = editor.value.split('\n').length;
    let lineNumbersText = '';
    
    for (let i = 1; i <= lines; i++) {
        lineNumbersText += i + '\n';
    }
    
    lineNumbers.textContent = lineNumbersText;
}

// File upload handling
function setupFileUpload() {
    const fileInput = document.getElementById('fileInput');
    const uploadContainer = document.getElementById('uploadContainer');
    const fileInfo = document.getElementById('fileInfo');

    // Click handler with popup detection
    uploadContainer.addEventListener('click', (e) => {
        if (isInPopup()) {
            // Show modal asking user if they want to open in tab
            showTabModeDialog();
        } else {
            fileInput.click();
        }
    });

    // Drag and drop handlers
    uploadContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadContainer.classList.add('dragover');
    });

    uploadContainer.addEventListener('dragleave', () => {
        uploadContainer.classList.remove('dragover');
    });

    uploadContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadContainer.classList.remove('dragover');
        
        if (isInPopup()) {
            // Show modal asking user if they want to open in tab
            showTabModeDialog();
            return;
        }
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    // File input change handler
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    function handleFile(file) {
        if (!file.name.match(/\.(html|htm)$/i)) {
            showStatus('Please select an HTML file (.html or .htm)', 'error');
            return;
        }

        if (file.size > 1024 * 1024) { // 1MB limit
            showStatus('File is too large. Please select a file smaller than 1MB.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            // Preserve exact content - don't modify or parse it
            document.getElementById('htmlEditor').value = content;
            updateLineNumbers();
            
            // Show file info
            fileInfo.textContent = `Loaded: ${file.name} (${formatFileSize(file.size)})`;
            fileInfo.classList.add('show');
            
            showStatus('File loaded successfully!', 'success');
        };
        
        reader.onerror = () => {
            showStatus('Error reading file', 'error');
        };
        
        // Read as text with UTF-8 encoding to preserve content exactly
        reader.readAsText(file, 'UTF-8');
    }
}

// Show dialog asking user to open in tab mode
function showTabModeDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'tab-mode-dialog';
    dialog.innerHTML = `
        <div class="dialog-overlay">
            <div class="dialog-content">
                <h3>Upload File</h3>
                <p>To upload files, the extension needs to open in a tab to prevent the popup from closing.</p>
                <div class="dialog-buttons">
                    <button id="openInTabBtn" class="btn-primary">Open in Tab</button>
                    <button id="cancelDialogBtn" class="btn-secondary">Cancel</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    document.getElementById('openInTabBtn').addEventListener('click', () => {
        openInTab();
    });
    
    document.getElementById('cancelDialogBtn').addEventListener('click', () => {
        document.body.removeChild(dialog);
    });
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Split content into chunks - preserve exact content
function splitIntoChunks(content) {
    const chunks = [];
    for (let i = 0; i < content.length; i += CHUNK_SIZE) {
        chunks.push(content.substring(i, i + CHUNK_SIZE));
    }
    return chunks;
}

// Reconstruct content from chunks - preserve exact content
function reconstructFromChunks(chunks) {
    return chunks.join('');
}

// Safely encode content to prevent corruption during storage
function encodeForStorage(content) {
    // Use base64 encoding to preserve exact content including special characters
    try {
        return btoa(unescape(encodeURIComponent(content)));
    } catch (error) {
        console.warn('Failed to encode content, using raw content:', error);
        return content;
    }
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

// Load saved HTML when popup opens
document.addEventListener('DOMContentLoaded', function() {
    const editor = document.getElementById('htmlEditor');
    
    // Add tab mode toggle if in popup
    if (isInPopup()) {
        addTabModeButton();
    } else {
        // Adjust styles for tab mode
        document.body.classList.add('tab-mode');
    }
    
    // Setup file upload
    setupFileUpload();
    
    // Load saved content
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.sync.get(null, function(result) {
            let content = '';
            
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
                content = result.customHtml_encoded ? decodeFromStorage(rawContent) : rawContent;
                
                // Show chunk info
                if (result.customHtml_chunks > 1) {
                    showStatus(`Loaded content from ${result.customHtml_chunks} chunks`, 'success');
                }
            } else if (result.customHtml) {
                // Legacy single storage - try to decode if marked as encoded
                content = result.customHtml_encoded ? decodeFromStorage(result.customHtml) : result.customHtml;
            }
            
            editor.value = content;
            updateLineNumbers();
        });
    }

    // Update line numbers on input
    editor.addEventListener('input', updateLineNumbers);
    editor.addEventListener('scroll', function() {
        document.getElementById('lineNumbers').scrollTop = editor.scrollTop;
    });

    // Initial line numbers
    updateLineNumbers();

    // Add event listeners
    document.getElementById('saveBtn').addEventListener('click', saveHTML);
    document.getElementById('resetBtn').addEventListener('click', resetHTML);
    document.getElementById('previewBtn').addEventListener('click', openNewTab);
    document.getElementById('exportBtn').addEventListener('click', exportHTML);
});

// Add button to open in tab mode
function addTabModeButton() {
    const header = document.querySelector('.header h1');
    const tabButton = document.createElement('button');
    tabButton.className = 'tab-mode-btn';
    tabButton.innerHTML = '📄';
    tabButton.title = 'Open in Tab';
    tabButton.addEventListener('click', openInTab);
    header.appendChild(tabButton);
}

function saveHTML() {
    const htmlContent = document.getElementById('htmlEditor').value;
    
    if (!htmlContent.trim()) {
        showStatus('Please enter some HTML content', 'warning');
        return;
    }
    
    if (typeof chrome !== 'undefined' && chrome.storage) {
        // Clear any existing chunks first
        chrome.storage.sync.get(null, function(result) {
            const keysToRemove = [];
            
            // Remove old chunks and metadata
            if (result.customHtml_chunks) {
                for (let i = 0; i < result.customHtml_chunks; i++) {
                    keysToRemove.push(`customHtml_chunk_${i}`);
                }
            }
            keysToRemove.push('customHtml_chunks', 'customHtml', 'customHtml_encoded');
            
            chrome.storage.sync.remove(keysToRemove, function() {
                // Encode content to prevent corruption
                const encodedContent = encodeForStorage(htmlContent);
                const useEncoding = encodedContent !== htmlContent;
                
                // Now save the new content
                if (encodedContent.length <= CHUNK_SIZE) {
                    // Small content, save directly
                    const dataToSave = {
                        customHtml: encodedContent
                    };
                    if (useEncoding) {
                        dataToSave.customHtml_encoded = true;
                    }
                    
                    chrome.storage.sync.set(dataToSave, function() {
                        if (chrome.runtime.lastError) {
                            showStatus('Error saving: ' + chrome.runtime.lastError.message, 'error');
                        } else {
                            showStatus('HTML saved successfully!', 'success');
                            reloadNewTabs();
                        }
                    });
                } else {
                    // Large content, split into chunks
                    const chunks = splitIntoChunks(encodedContent);
                    
                    if (chunks.length > MAX_CHUNKS) {
                        showStatus(`Content too large. Maximum ${MAX_CHUNKS} chunks allowed.`, 'error');
                        return;
                    }
                    
                    const dataToSave = {
                        customHtml_chunks: chunks.length
                    };
                    
                    if (useEncoding) {
                        dataToSave.customHtml_encoded = true;
                    }
                    
                    chunks.forEach((chunk, index) => {
                        dataToSave[`customHtml_chunk_${index}`] = chunk;
                    });
                    
                    chrome.storage.sync.set(dataToSave, function() {
                        if (chrome.runtime.lastError) {
                            showStatus('Error saving: ' + chrome.runtime.lastError.message, 'error');
                        } else {
                            showStatus(`HTML saved successfully in ${chunks.length} chunks!`, 'success');
                            reloadNewTabs();
                        }
                    });
                }
            });
        });
    } else {
        showStatus('Chrome storage not available', 'error');
    }
}

function resetHTML() {
    if (confirm('Are you sure you want to reset to default?')) {
        document.getElementById('htmlEditor').value = '';
        updateLineNumbers();
        
        // Hide file info
        document.getElementById('fileInfo').classList.remove('show');
        
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.sync.get(null, function(result) {
                const keysToRemove = ['customHtml', 'customHtml_encoded'];
                
                // Remove all chunks
                if (result.customHtml_chunks) {
                    for (let i = 0; i < result.customHtml_chunks; i++) {
                        keysToRemove.push(`customHtml_chunk_${i}`);
                    }
                    keysToRemove.push('customHtml_chunks');
                }
                
                chrome.storage.sync.remove(keysToRemove, function() {
                    if (chrome.runtime.lastError) {
                        showStatus('Error resetting: ' + chrome.runtime.lastError.message, 'error');
                    } else {
                        showStatus('Reset to default successfully!', 'success');
                        reloadNewTabs();
                    }
                });
            });
        } else {
            showStatus('Chrome storage not available', 'error');
        }
    }
}

function exportHTML() {
    const htmlContent = document.getElementById('htmlEditor').value;
    
    if (!htmlContent.trim()) {
        showStatus('No content to export', 'warning');
        return;
    }
    
    // Create blob with UTF-8 BOM to ensure proper encoding
    const blob = new Blob(['\ufeff' + htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'custom-newtab.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showStatus('HTML exported successfully!', 'success');
}

function openNewTab() {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.create({url: 'chrome://newtab/'});
    } else {
        // Fallback for testing
        window.open('chrome://newtab/', '_blank');
    }
}

function reloadNewTabs() {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.query({url: 'chrome://newtab/'}, function(tabs) {
            tabs.forEach(tab => {
                chrome.tabs.reload(tab.id);
            });
        });
    }
}

function showStatus(message, type) {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = `status ${type} show`;
    
    setTimeout(() => {
        statusDiv.classList.remove('show');
    }, 3000);
}

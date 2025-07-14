// Constants
const CHUNK_SIZE = 7000; // Leave some buffer for metadata
const MAX_CHUNKS = 50; // Reasonable limit to prevent excessive storage usage

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

    // Click handler
    uploadContainer.addEventListener('click', () => {
        fileInput.click();
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
        
        reader.readAsText(file);
    }
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Split content into chunks
function splitIntoChunks(content) {
    const chunks = [];
    for (let i = 0; i < content.length; i += CHUNK_SIZE) {
        chunks.push(content.substring(i, i + CHUNK_SIZE));
    }
    return chunks;
}

// Reconstruct content from chunks
function reconstructFromChunks(chunks) {
    return chunks.join('');
}

// Load saved HTML when popup opens
document.addEventListener('DOMContentLoaded', function() {
    const editor = document.getElementById('htmlEditor');
    
    // Setup file upload
    setupFileUpload();
    
    // Load saved content
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.sync.get(null, function(result) {
            // Check if we have chunked data
            if (result.customHtml_chunks) {
                const chunks = [];
                for (let i = 0; i < result.customHtml_chunks; i++) {
                    if (result[`customHtml_chunk_${i}`]) {
                        chunks.push(result[`customHtml_chunk_${i}`]);
                    }
                }
                const content = reconstructFromChunks(chunks);
                editor.value = content;
                updateLineNumbers();
                
                // Show chunk info
                if (result.customHtml_chunks > 1) {
                    showStatus(`Loaded content from ${result.customHtml_chunks} chunks`, 'success');
                }
            } else if (result.customHtml) {
                // Legacy single storage
                editor.value = result.customHtml;
                updateLineNumbers();
            }
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
            
            // Remove old chunks
            if (result.customHtml_chunks) {
                for (let i = 0; i < result.customHtml_chunks; i++) {
                    keysToRemove.push(`customHtml_chunk_${i}`);
                }
            }
            keysToRemove.push('customHtml_chunks', 'customHtml');
            
            chrome.storage.sync.remove(keysToRemove, function() {
                // Now save the new content
                if (htmlContent.length <= CHUNK_SIZE) {
                    // Small content, save directly
                    chrome.storage.sync.set({customHtml: htmlContent}, function() {
                        if (chrome.runtime.lastError) {
                            showStatus('Error saving: ' + chrome.runtime.lastError.message, 'error');
                        } else {
                            showStatus('HTML saved successfully!', 'success');
                            reloadNewTabs();
                        }
                    });
                } else {
                    // Large content, split into chunks
                    const chunks = splitIntoChunks(htmlContent);
                    
                    if (chunks.length > MAX_CHUNKS) {
                        showStatus(`Content too large. Maximum ${MAX_CHUNKS} chunks allowed.`, 'error');
                        return;
                    }
                    
                    const dataToSave = {
                        customHtml_chunks: chunks.length
                    };
                    
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
                const keysToRemove = ['customHtml'];
                
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
    
    const blob = new Blob([htmlContent], { type: 'text/html' });
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
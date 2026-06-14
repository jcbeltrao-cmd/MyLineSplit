document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const htmlElement = document.documentElement;
  const themeToggle = document.getElementById('theme-toggle');
  
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  
  const partsSlider = document.getElementById('parts-slider');
  const partsInput = document.getElementById('parts-input');
  const partsDisplay = document.getElementById('parts-display');
  const splitBtn = document.getElementById('split-btn');
  
  const errorBanner = document.getElementById('error-banner');
  const errorMessage = document.getElementById('error-message');
  
  const previewSection = document.getElementById('preview-section');
  const welcomePrompt = document.getElementById('welcome-prompt');
  const clearFileBtn = document.getElementById('clear-file');
  
  const metaName = document.getElementById('meta-name');
  const metaSize = document.getElementById('meta-size');
  const metaLines = document.getElementById('meta-lines');
  const previewBox = document.getElementById('preview-box');
  
  const resultsSection = document.getElementById('results-section');
  const cardsContainer = document.getElementById('cards-container');

  // --- App State ---
  let selectedFile = null;
  let linesArray = [];
  let activeUrls = [];

  // --- Theme Management ---
  // Initial Theme Setup
  const savedTheme = localStorage.getItem('theme') || 'dark';
  htmlElement.setAttribute('data-theme', savedTheme);

  // Toggle Theme
  themeToggle.addEventListener('click', () => {
    const currentTheme = htmlElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    htmlElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  });

  // --- Sync Slider and Number Input ---
  function updatePartsCount(value) {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 2) return;
    
    partsSlider.value = Math.min(num, 10); // Slider visually caps at 10 for layout spacing, but input can go higher
    partsInput.value = num;
    partsDisplay.textContent = `${num} partes`;
  }

  partsSlider.addEventListener('input', (e) => {
    updatePartsCount(e.target.value);
  });

  partsInput.addEventListener('change', (e) => {
    let value = parseInt(e.target.value, 10);
    if (isNaN(value) || value < 2) {
      value = 2;
    } else if (value > 100) {
      value = 100; // Cap at 100 for sanity and performance
    }
    updatePartsCount(value);
  });

  // --- File Drag & Drop Events ---
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  });

  // --- File Processing Logic ---
  function resetAppState() {
    selectedFile = null;
    linesArray = [];
    clearActiveUrls();
    
    // UI resets
    previewSection.classList.add('hidden');
    welcomePrompt.classList.remove('hidden');
    resultsSection.classList.add('hidden');
    errorBanner.classList.add('hidden');
    splitBtn.disabled = true;
    cardsContainer.innerHTML = '';
    
    fileInput.value = '';
    metaName.textContent = '-';
    metaSize.textContent = '-';
    metaLines.textContent = '-';
    previewBox.textContent = '';
  }

  clearFileBtn.addEventListener('click', resetAppState);

  function showError(title, message) {
    errorMessage.textContent = message;
    errorBanner.querySelector('.error-title').textContent = title;
    errorBanner.classList.remove('hidden');
    previewSection.classList.add('hidden');
    welcomePrompt.classList.remove('hidden');
    splitBtn.disabled = true;
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function checkIsBinary(file) {
    return new Promise((resolve) => {
      // Read first 8000 bytes to check for null bytes (\0)
      const reader = new FileReader();
      const blobSlice = file.slice(0, 8000);
      
      reader.onload = (e) => {
        const arrayBuffer = e.target.result;
        const uint8 = new Uint8Array(arrayBuffer);
        const len = uint8.length;
        
        for (let i = 0; i < len; i++) {
          if (uint8[i] === 0) {
            resolve(true); // Found null byte, definitely binary
            return;
          }
        }
        resolve(false); // Likely text
      };
      
      reader.onerror = () => {
        resolve(true); // Fail-safe binary on error
      };
      
      reader.readAsArrayBuffer(blobSlice);
    });
  }

  async function handleFileSelection(file) {
    resetAppState();
    selectedFile = file;

    // 1. Binary file detection
    const isBinary = await checkIsBinary(file);
    if (isBinary) {
      showError('Formato de Arquivo Inválido', `"${file.name}" parece ser um arquivo binário. A divisão por linhas suporta apenas arquivos de texto legíveis (como .txt, .srt, .vtt).`);
      return;
    }

    // 2. Read full file as text
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const textContent = e.target.result;
      
      // Preserve exact line endings using RegExp match.
      // Matches any non-newline block followed by newline(s), or trailing chars.
      linesArray = textContent.match(/[^\r\n]*\r?\n|[^\r\n]+/g) || [];
      
      if (linesArray.length === 0) {
        showError('Arquivo Vazio', `"${file.name}" não possui linhas ou conteúdo para dividir.`);
        return;
      }

      // Populate file details in UI
      metaName.textContent = file.name;
      metaName.title = file.name;
      metaSize.textContent = formatBytes(file.size);
      metaLines.textContent = linesArray.length.toLocaleString('pt-BR');

      // Show preview (first 20 lines)
      const previewLines = linesArray.slice(0, 20).join('');
      previewBox.textContent = previewLines;

      // Reveal preview area & enable splitting
      errorBanner.classList.add('hidden');
      welcomePrompt.classList.add('hidden');
      previewSection.classList.remove('hidden');
      splitBtn.disabled = false;
    };

    reader.onerror = () => {
      showError('Erro de Leitura', `Falha ao ler o conteúdo de "${file.name}".`);
    };

    reader.readAsText(file);
  }

  function clearActiveUrls() {
    activeUrls.forEach(url => URL.revokeObjectURL(url));
    activeUrls = [];
  }

  // --- Performing the Split ---
  splitBtn.addEventListener('click', () => {
    if (!selectedFile || linesArray.length === 0) return;

    // Reset previous results
    clearActiveUrls();
    cardsContainer.innerHTML = '';

    const totalLines = linesArray.length;
    const partsCount = parseInt(partsInput.value, 10);
    
    const baseLinesCount = Math.floor(totalLines / partsCount);
    const remainder = totalLines % partsCount;

    // Parse base name and extension
    const lastDotIndex = selectedFile.name.lastIndexOf('.');
    let baseName = selectedFile.name;
    let ext = '.txt'; // Sempre .txt por padrão
    
    if (lastDotIndex > 0) {
      baseName = selectedFile.name.substring(0, lastDotIndex);
      // Para manter a extensão original do arquivo selecionado, descomente a linha abaixo:
      // ext = selectedFile.name.substring(lastDotIndex);
    }

    let currentLineIndex = 0;

    for (let partIdx = 0; partIdx < partsCount; partIdx++) {
      // Distribute the remainder lines to the first few parts (one extra line each)
      const partLinesCount = baseLinesCount + (partIdx < remainder ? 1 : 0);
      
      // If we run out of lines (e.g. splitting 3 lines into 5 parts), skip empty parts
      if (partLinesCount === 0) continue;

      const partLines = linesArray.slice(currentLineIndex, currentLineIndex + partLinesCount);
      currentLineIndex += partLinesCount;

      // Create Blob from split text lines
      const blobText = partLines.join('');
      const blob = new Blob([blobText], { type: 'text/plain;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      activeUrls.push(blobUrl);

      const partNumber = partIdx + 1;
      const partFileName = `${baseName}_part${partNumber}${ext}`;

      // Create download card element
      const card = document.createElement('div');
      card.className = 'part-card';
      card.innerHTML = `
        <div class="part-card-header">
          <span class="part-badge">Parte ${partNumber}</span>
          <span class="part-card-title" title="${partFileName}">${partFileName}</span>
        </div>
        <div class="part-card-details">
          <div class="part-card-row">
            <span>Linhas:</span>
            <span>${partLinesCount.toLocaleString('pt-BR')}</span>
          </div>
          <div class="part-card-row">
            <span>Tamanho:</span>
            <span>${formatBytes(blob.size)}</span>
          </div>
        </div>
        <a href="${blobUrl}" download="${partFileName}" class="download-anchor">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Baixar
        </a>
      `;
      cardsContainer.appendChild(card);
    }

    // Reveal results block and scroll to it smoothly
    resultsSection.classList.remove('hidden');
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

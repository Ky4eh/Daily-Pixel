
// State
const state = {
    currentTab: 'painter',
    gridSize: 16,
    brushSize: 1,
    currentColor: '#000000',
    currentTool: 'pen', // 'pen', 'eraser', 'fill', 'eyedropper'
    isDrawing: false,
    history: [], // Stack of pixel data arrays
    historyStep: -1,
    pixels: [], // 2D array [y][x]

    // Calendar state
    currentDate: new Date(),

    // View state
    view: {
        scale: 1,
        panX: 0,
        panY: 0,
        isPanning: false,
        lastMouseX: 0,
        lastMouseY: 0
    },

    // Settings
    theme: 'dark', // 'dark' or 'light'
    directoryHandle: null, // For File System Access API
    exportSize: 'upscaled', // 'upscaled' or 'original'
    gallerySortOrder: 'newest', // 'newest' or 'oldest'

    // Data
    gallery: [], // Array of { id, dataUrl, date }
    calendar: {}, // Map "YYYY-MM-DD" -> galleryId
};

// Config
const MAX_HISTORY = 20;
const PALETTE_COLORS = [
    '#000000', // Black
    '#ffffff', // White
    '#ff0000', // Red
    '#00ff00', // Green
    '#0000ff', // Blue
    '#ffff00', // Yellow
    '#00ffff', // Cyan
    '#ff00ff', // Magenta
    '#808080', // Gray
    '#ff8000', // Orange
    '#800080', // Purple
    '#008080', // Teal
];

// DOM Elements
const elements = {
    tabs: document.querySelectorAll('.tab-btn'),
    views: document.querySelectorAll('.view'),
    canvas: document.getElementById('pixel-canvas'),
    canvasWrapper: document.querySelector('.canvas-wrapper'),
    gridSizeSelect: document.getElementById('grid-size'),
    brushSizeSelect: document.getElementById('brush-size'),
    colorPicker: document.getElementById('color-picker'),
    palette: document.getElementById('quick-palette'),
    undoBtn: document.getElementById('undo-btn'),
    clearBtn: document.getElementById('clear-btn'),
    saveBtn: document.getElementById('save-btn'),
    galleryGrid: document.getElementById('gallery-grid'),
    calendarGrid: document.getElementById('calendar-grid'),
    prevMonthBtn: document.getElementById('prev-month'),
    nextMonthBtn: document.getElementById('next-month'),
    currentMonthDisplay: document.getElementById('current-month-display'),
    modal: document.getElementById('selection-modal'),
    dateSelector: document.getElementById('date-selector'),
    confirmDateBtn: document.getElementById('confirm-date-btn'),
    dateSelector: document.getElementById('date-selector'),
    confirmDateBtn: document.getElementById('confirm-date-btn'),
    cancelModalBtn: document.getElementById('cancel-modal-btn'),
    // Title Screen
    titleScreen: document.getElementById('title-screen'),
    titleBtns: document.querySelectorAll('.title-btn'),
    appContainer: document.getElementById('app'),
    // Settings
    nightModeToggle: document.getElementById('night-mode-toggle'),
    setDirBtn: document.getElementById('set-dir-btn'),
    dirPathDisplay: document.getElementById('dir-path-display'),
    exportSizeRadios: document.getElementsByName('export-size'),
    // Tools
    toolPen: document.getElementById('tool-pen'),
    toolEraser: document.getElementById('tool-eraser'),
    toolFill: document.getElementById('tool-fill'),
    toolEyedropper: document.getElementById('tool-eyedropper'),
    // Gallery
    gallerySort: document.getElementById('gallery-sort'),
};

const ctx = elements.canvas.getContext('2d');
// Disable smoothing for pixel art export if needed, 
// but CSS image-rendering: pixelated usually handles the display.
ctx.imageSmoothingEnabled = false;

// Initialization
// Initialization
function init() {
    loadData();
    setupTabs();
    setupPainter();
    setupTools();
    setupGallery();
    setupGallerySort();
    setupCalendar();
    setupSettings();

    setupTitleScreen();

    // Initial Render
    applyTheme();
    resizeCanvas(state.gridSize);
    renderPalette();
}

function setupTitleScreen() {
    elements.titleBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Stop propagation to prevent double firing if nested (though buttons are top level in title)
            e.stopPropagation();
            const target = e.target.closest('.title-btn').dataset.target;
            startApp(target);
        });
    });
}

function startApp(initialTab = 'painter') {
    elements.titleScreen.classList.add('hidden');
    elements.appContainer.classList.remove('hidden');

    switchTab(initialTab);
}

function setupSettings() {
    // Set initial toggle state (Toggle is checked for Dark Mode)
    elements.nightModeToggle.checked = state.theme === 'dark';

    elements.nightModeToggle.addEventListener('change', (e) => {
        state.theme = e.target.checked ? 'dark' : 'light';
        applyTheme();
        saveData();
    });

    // Directory selection
    elements.setDirBtn.addEventListener('click', async () => {
        if ('showDirectoryPicker' in window) {
            try {
                const handle = await window.showDirectoryPicker({
                    mode: 'readwrite'
                });
                state.directoryHandle = handle;

                // Try to build a more descriptive path
                let pathDisplay = handle.name;

                // Store the folder name for display
                elements.dirPathDisplay.textContent = `📁 ${pathDisplay}`;
                elements.dirPathDisplay.title = `保存先フォルダ: ${pathDisplay}`;

                alert(`保存先を "${handle.name}" に設定しました。\n\n※ブラウザのセキュリティ制限により、フォルダ名のみ表示されます。`);
            } catch (err) {
                console.log('Cancelled');
            }
        } else {
            alert('お使いのブラウザはこの機能に対応していません。');
        }
    });

    // Reset display on load
    if (state.directoryHandle) {
        elements.dirPathDisplay.textContent = `📁 ${state.directoryHandle.name}`;
        elements.dirPathDisplay.title = `保存先フォルダ: ${state.directoryHandle.name}`;
    }

    // Export Size
    elements.exportSizeRadios.forEach(radio => {
        if (radio.value === state.exportSize) radio.checked = true;

        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                state.exportSize = e.target.value;
                saveData();
            }
        });
    });
}

function applyTheme() {
    if (state.theme === 'dark') {
        document.body.classList.remove('light-mode');
    } else {
        document.body.classList.add('light-mode');
    }
}

// --- Data Management ---
function loadData() {
    const galleryData = localStorage.getItem('dpa_gallery');
    if (galleryData) state.gallery = JSON.parse(galleryData);

    const calendarData = localStorage.getItem('dpa_calendar');
    if (calendarData) state.calendar = JSON.parse(calendarData);

    const themeData = localStorage.getItem('dpa_theme');
    if (themeData) state.theme = themeData;

    const exportSizeData = localStorage.getItem('dpa_export_size');
    if (exportSizeData) state.exportSize = exportSizeData;
}

function saveData() {
    localStorage.setItem('dpa_gallery', JSON.stringify(state.gallery));
    localStorage.setItem('dpa_calendar', JSON.stringify(state.calendar));
    localStorage.setItem('dpa_theme', state.theme);
    localStorage.setItem('dpa_export_size', state.exportSize);
}

// --- Navigation & Tabs ---
function switchTab(tabName) {
    state.currentTab = tabName;

    // Update UI
    elements.tabs.forEach(t => {
        if (t.dataset.tab === tabName) t.classList.add('active');
        else t.classList.remove('active');
    });

    elements.views.forEach(v => {
        if (v.id === tabName) v.classList.add('active');
        else v.classList.remove('active');
    });

    // Refresh views if needed
    if (tabName === 'gallery') renderGallery();
    if (tabName === 'calendar') renderCalendar();

    // Resize check for painter
    if (tabName === 'painter') {
        setTimeout(fitToScreen, 50);
    }
}

function setupTabs() {
    elements.tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
    });
}

// --- Painter ---
function setupPainter() {
    // Helper: Screen coords to Canvas pixel coords
    function getPixelCoords(e) {
        const rect = elements.canvasWrapper.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        // Transform logic: 
        // screenX = canvasX * scale + panX
        // canvasX = (screenX - panX) / scale

        const rawX = (mx - state.view.panX) / state.view.scale;
        const rawY = (my - state.view.panY) / state.view.scale;

        return {
            x: Math.floor(rawX),
            y: Math.floor(rawY)
        };
    }

    function paint(e) {
        const coords = getPixelCoords(e);
        const x = coords.x;
        const y = coords.y;

        // Eyedropper tool
        if (state.currentTool === 'eyedropper') {
            if (x >= 0 && x < state.gridSize && y >= 0 && y < state.gridSize) {
                const pickedColor = state.pixels[y][x];
                if (pickedColor) {
                    state.currentColor = pickedColor;
                    elements.colorPicker.value = pickedColor;
                }
            }
            return;
        }

        // Fill tool
        if (state.currentTool === 'fill') {
            if (x >= 0 && x < state.gridSize && y >= 0 && y < state.gridSize) {
                const targetColor = state.pixels[y][x];
                const fillColor = state.currentTool === 'eraser' ? null : state.currentColor;
                floodFill(x, y, targetColor, fillColor);
            }
            return;
        }

        // Pen and Eraser tools
        if (!state.isDrawing) return;
        const size = state.brushSize;
        const startOffset = Math.floor((size - 1) / 2);
        const drawColor = state.currentTool === 'eraser' ? null : state.currentColor;

        for (let dy = 0; dy < size; dy++) {
            for (let dx = 0; dx < size; dx++) {
                const tx = x - startOffset + dx;
                const ty = y - startOffset + dy;

                if (tx >= 0 && tx < state.gridSize && ty >= 0 && ty < state.gridSize) {
                    if (state.pixels[ty][tx] !== drawColor) {
                        state.pixels[ty][tx] = drawColor;
                        drawPixel(tx, ty, drawColor);
                    }
                }
            }
        }
    }

    // Zoom (Wheel)
    elements.canvasWrapper.addEventListener('wheel', (e) => {
        e.preventDefault();

        const zoomIntensity = 0.1;
        const direction = e.deltaY > 0 ? -1 : 1;
        const factor = 1 + (direction * zoomIntensity);

        // Current mouse position relative to wrapper
        const rect = elements.canvasWrapper.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        // Calculate new scale
        let newScale = state.view.scale * factor;
        newScale = Math.max(0.1, Math.min(newScale, 50)); // Limit zoom

        // Zoom towards mouse position:
        // (mx - panX) / scale = canvasX (constant)
        // panX_new = mx - canvasX * scale_new
        const canvasX = (mx - state.view.panX) / state.view.scale;
        const canvasY = (my - state.view.panY) / state.view.scale;

        state.view.panX = mx - canvasX * newScale;
        state.view.panY = my - canvasY * newScale;
        state.view.scale = newScale;

        updateTransform();
    });

    // Mouse Interaction
    elements.canvasWrapper.addEventListener('mousedown', (e) => {
        // Middle click or Space+Left -> Pan
        if (e.button === 1 || (e.button === 0 && e.getModifierState('Space'))) {
            state.view.isPanning = true;
            state.view.lastMouseX = e.clientX;
            state.view.lastMouseY = e.clientY;
            elements.canvasWrapper.classList.add('panning');
            e.preventDefault();
            return;
        }

        // Left click -> Draw/Tool
        if (e.button === 0) {
            // Fill and eyedropper are single-click tools
            if (state.currentTool === 'fill' || state.currentTool === 'eyedropper') {
                saveHistory();
                paint(e);
            } else {
                // Pen and eraser require dragging
                state.isDrawing = true;
                saveHistory();
                paint(e);
            }
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (state.view.isPanning) {
            const dx = e.clientX - state.view.lastMouseX;
            const dy = e.clientY - state.view.lastMouseY;

            state.view.panX += dx;
            state.view.panY += dy;
            state.view.lastMouseX = e.clientX;
            state.view.lastMouseY = e.clientY;

            updateTransform();
            return;
        }

        if (state.isDrawing) {
            paint(e);
        }
    });

    window.addEventListener('mouseup', () => {
        state.isDrawing = false;
        state.view.isPanning = false;
        elements.canvasWrapper.classList.remove('panning');
    });

    // Keyboard (Space for pan mode cursor)
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !state.view.isPanning) {
            elements.canvasWrapper.classList.add('panning');
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space' && !state.view.isPanning) {
            elements.canvasWrapper.classList.remove('panning');
        }
    });


    // Controls
    elements.gridSizeSelect.addEventListener('change', (e) => {
        if (confirm('サイズを変更すると現在の絵は消えます。よろしいですか？')) {
            resizeCanvas(parseInt(e.target.value));
        } else {
            e.target.value = state.gridSize; // revert
        }
    });

    elements.brushSizeSelect.addEventListener('change', (e) => {
        state.brushSize = parseInt(e.target.value);
    });

    elements.colorPicker.addEventListener('change', (e) => {
        state.currentColor = e.target.value;
    });

    elements.undoBtn.addEventListener('click', undo);
    elements.clearBtn.addEventListener('click', () => {
        if (confirm('本当に全消去しますか？')) {
            saveHistory();
            clearCanvas();
        }
    });

    elements.saveBtn.addEventListener('click', saveArtwork);
}

function resizeCanvas(size) {
    state.gridSize = size;
    elements.canvas.width = size;
    elements.canvas.height = size;

    // Important: Context settings are reset when resizing
    ctx.imageSmoothingEnabled = false;

    // Initialize pixels
    state.pixels = Array(size).fill(null).map(() => Array(size).fill(null)); // null means transparent/white
    state.history = [];
    state.historyStep = -1;

    drawGrid();
    fitToScreen();
}

function fitToScreen() {
    const rect = elements.canvasWrapper.getBoundingClientRect();
    const padding = 40;
    const availableW = rect.width - padding;
    const availableH = rect.height - padding;

    const scaleW = availableW / state.gridSize;
    const scaleH = availableH / state.gridSize;

    state.view.scale = Math.floor(Math.min(scaleW, scaleH));
    if (state.view.scale < 1) state.view.scale = 1;

    // Center logic
    const displayedW = state.gridSize * state.view.scale;
    const displayedH = state.gridSize * state.view.scale;

    state.view.panX = (rect.width - displayedW) / 2;
    state.view.panY = (rect.height - displayedH) / 2;

    updateTransform();
}

function updateTransform() {
    elements.canvas.style.transform = `translate(${state.view.panX}px, ${state.view.panY}px) scale(${state.view.scale})`;
}

function clearCanvas() {
    state.pixels = state.pixels.map(row => row.map(() => null));
    drawGrid();
}

function drawPixel(x, y, color) {
    ctx.fillStyle = color || '#FFFFFF'; // Default white? Or keep it transparent?
    // Let's assume white canvas for simplicity of saving as JPEG/PNG without transparency issues
    // But for pixel art, transparency is nice.
    // If color is null, clear rect
    if (color === null) {
        ctx.clearRect(x, y, 1, 1);
    } else {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
    }
}

function drawGrid() {
    ctx.clearRect(0, 0, state.gridSize, state.gridSize);
    // Fill white background for now, so saved images are not transparent
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, state.gridSize, state.gridSize);

    for (let y = 0; y < state.gridSize; y++) {
        for (let x = 0; x < state.gridSize; x++) {
            if (state.pixels[y][x]) {
                ctx.fillStyle = state.pixels[y][x];
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
}

function saveHistory() {
    // Clone pixels
    const currentSnapshot = JSON.parse(JSON.stringify(state.pixels));
    state.history = state.history.slice(0, state.historyStep + 1);
    state.history.push(currentSnapshot);
    if (state.history.length > MAX_HISTORY) state.history.shift();
    state.historyStep = state.history.length - 1;
}

function undo() {
    if (state.historyStep >= 0) {
        const prev = state.history[state.historyStep];
        state.pixels = JSON.parse(JSON.stringify(prev)); // Restore
        state.historyStep--;
        drawGrid();
    }
}

function renderPalette() {
    elements.palette.innerHTML = '';
    PALETTE_COLORS.forEach(color => {
        const div = document.createElement('div');
        div.className = 'palette-color';
        div.style.backgroundColor = color;
        div.addEventListener('click', () => {
            state.currentColor = color;
            elements.colorPicker.value = color;
        });
        elements.palette.appendChild(div);
    });
}

async function saveArtwork() {
    // 1. Convert canvas to Blob (better for file saving)
    const blob = await new Promise(resolve => elements.canvas.toBlob(resolve, 'image/png'));
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `pixel-art-${timestamp}.png`;

    // 2. Save to Gallery (Local Storage) - Keep this for in-app viewing
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = async () => {
        const dataUrl = reader.result;
        const id = Date.now().toString();

        const artwork = {
            id,
            dataUrl,
            createdAt: new Date().toISOString()
        };

        state.gallery.unshift(artwork);
        saveData();

        // Refresh Gallery UI if active
        if (state.currentTab === 'gallery') renderGallery();
    };

    alert('ギャラリーに保存しました！');
}

async function exportToFile(dataUrl) {
    let blob;

    if (state.exportSize === 'original') {
        // Use original size
        const res = await fetch(dataUrl);
        blob = await res.blob();
    } else {
        // Upscale Image (1024x1024)
        const upscaleSize = 1024;
        const img = new Image();
        img.src = dataUrl;
        await new Promise(resolve => img.onload = resolve);

        const offCanvas = document.createElement('canvas');
        offCanvas.width = upscaleSize;
        offCanvas.height = upscaleSize;
        const ctx = offCanvas.getContext('2d');

        // Important: Disable smoothing to keep it pixelated
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, upscaleSize, upscaleSize);

        blob = await new Promise(resolve => offCanvas.toBlob(resolve, 'image/png'));
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `pixel-art-${timestamp}.png`;

    // 2. Save to File System
    try {
        if ('showDirectoryPicker' in window) {
            // Use File System Access API
            if (!state.directoryHandle) {
                // If not set via settings, ask now
                if (confirm('保存先フォルダが設定されていません。\n今すぐ設定しますか？')) {
                    try {
                        state.directoryHandle = await window.showDirectoryPicker({
                            mode: 'readwrite',
                            startIn: 'documents'
                        });
                        // Update settings UI as well
                        if (elements.dirPathDisplay) elements.dirPathDisplay.textContent = `選択中: ${state.directoryHandle.name}`;
                    } catch (err) {
                        return; // Cancelled
                    }
                } else {
                    return; // Cancelled
                }
            }

            // Create file
            const fileHandle = await state.directoryHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();

            alert(`画像を保存しました: ${filename}`);

        } else {
            throw new Error('FS API not supported');
        }
    } catch (e) {
        // Fallback: Anchor tag download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert('画像をダウンロードしました！');
    }
}

// --- Gallery ---
function setupGallery() {
    // No specific setup needed now
}

let selectedArtId = null;

function renderGallery() {
    elements.galleryGrid.innerHTML = '';

    if (state.gallery.length === 0) {
        elements.galleryGrid.innerHTML = '<div class="empty-state">まだ絵がありません。「絵描き」タブで描いてみましょう！</div>';
        return;
    }

    // Sort gallery
    let sortedGallery = [...state.gallery];
    if (state.gallerySortOrder === 'oldest') {
        sortedGallery.reverse();
    }

    sortedGallery.forEach(art => {
        const item = document.createElement('div');
        item.className = 'gallery-item';

        const img = document.createElement('img');
        img.src = art.dataUrl;

        item.appendChild(img);

        // Check if this artwork is set for today
        const today = new Date().toISOString().split('T')[0];
        const isSetForToday = state.calendar[today] === art.id;

        // Calendar button (star)
        const calendarBtn = document.createElement('button');
        calendarBtn.className = 'calendar-btn gallery-action-btn' + (isSetForToday ? ' active' : '');
        calendarBtn.textContent = isSetForToday ? '★' : '☆';
        calendarBtn.title = isSetForToday ? '本日のカレンダーから解除' : '本日のカレンダーに設定';
        calendarBtn.addEventListener('click', (e) => {
            e.stopPropagation();

            if (isSetForToday) {
                // Unset from calendar
                if (confirm('本日のカレンダーから解除しますか？')) {
                    delete state.calendar[today];
                    saveData();
                    alert('カレンダーから解除しました。');
                    if (state.currentTab === 'calendar') renderCalendar();
                    renderGallery(); // Re-render to update star states
                }
            } else {
                // Set to calendar
                if (confirm('この作品を本日の絵として飾りますか？')) {
                    state.calendar[today] = art.id;
                    saveData();
                    alert('本日のカレンダーに設定しました！');
                    if (state.currentTab === 'calendar') renderCalendar();
                    renderGallery(); // Re-render to update star states
                }
            }
        });

        // Export button
        const exportBtn = document.createElement('button');
        exportBtn.className = 'export-btn gallery-action-btn';
        exportBtn.textContent = '💾';
        exportBtn.title = 'Imageフォルダに保存';
        exportBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            exportToFile(art.dataUrl);
        });

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn gallery-action-btn';
        deleteBtn.textContent = '🗑️';
        deleteBtn.title = '削除';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('この作品を削除しますか？')) {
                state.gallery = state.gallery.filter(a => a.id !== art.id);
                saveData();
                renderGallery();
            }
        });

        item.appendChild(calendarBtn);
        item.appendChild(exportBtn);
        item.appendChild(deleteBtn);

        elements.galleryGrid.appendChild(item);
    });
}

// --- Calendar ---
function setupCalendar() {
    elements.prevMonthBtn.addEventListener('click', () => changeMonth(-1));
    elements.nextMonthBtn.addEventListener('click', () => changeMonth(1));
}

function changeMonth(delta) {
    state.currentDate.setMonth(state.currentDate.getMonth() + delta);
    renderCalendar();
}

function renderCalendar() {
    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();

    elements.currentMonthDisplay.textContent = `${year}年 ${month + 1}月`;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0 = Sun

    elements.calendarGrid.innerHTML = '';

    // Padding days
    for (let i = 0; i < startDayOfWeek; i++) {
        const div = document.createElement('div');
        div.className = 'day-cell other-month';
        elements.calendarGrid.appendChild(div);
    }

    // Days
    const todayStr = new Date().toISOString().split('T')[0];

    for (let d = 1; d <= daysInMonth; d++) {
        const div = document.createElement('div');
        div.className = 'day-cell';

        // Date string YYYY-MM-DD
        // Ensure zero padding
        const mStr = (month + 1).toString().padStart(2, '0');
        const dStr = d.toString().padStart(2, '0');
        const dateKey = `${year}-${mStr}-${dStr}`;

        if (dateKey === todayStr) {
            div.classList.add('today');
        }

        const numSpan = document.createElement('span');
        numSpan.className = 'day-number';
        numSpan.textContent = d;
        div.appendChild(numSpan);

        // Check if art exists for this day
        if (state.calendar[dateKey]) {
            const artId = state.calendar[dateKey];
            const art = state.gallery.find(a => a.id === artId);
            if (art) {
                const bg = document.createElement('div');
                bg.className = 'day-bg-image';
                bg.style.backgroundImage = `url(${art.dataUrl})`;
                div.appendChild(bg);
            }
        }

        // Click to set art if wanted from calendar too?
        div.addEventListener('click', () => {
            // Optional: allow setting art from calendar view
            // Maybe open gallery selector?
            // For now, let's keep the flow: Gallery -> Modal -> Calendar
        });

        elements.calendarGrid.appendChild(div);
    }
}

// --- New Features ---

// Tool selection
function setupTools() {
    const toolButtons = [elements.toolPen, elements.toolEraser, elements.toolFill, elements.toolEyedropper];

    toolButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all
            toolButtons.forEach(b => b.classList.remove('active'));
            // Add active to clicked
            btn.classList.add('active');

            // Set current tool
            if (btn === elements.toolPen) state.currentTool = 'pen';
            else if (btn === elements.toolEraser) state.currentTool = 'eraser';
            else if (btn === elements.toolFill) state.currentTool = 'fill';
            else if (btn === elements.toolEyedropper) state.currentTool = 'eyedropper';
        });
    });
}

// Fill tool (bucket fill)
function floodFill(startX, startY, targetColor, fillColor) {
    if (startX < 0 || startX >= state.gridSize || startY < 0 || startY >= state.gridSize) return;
    if (targetColor === fillColor) return;

    const stack = [[startX, startY]];
    const visited = new Set();

    while (stack.length > 0) {
        const [x, y] = stack.pop();
        const key = `${x},${y}`;

        if (visited.has(key)) continue;
        if (x < 0 || x >= state.gridSize || y < 0 || y >= state.gridSize) continue;
        if (state.pixels[y][x] !== targetColor) continue;

        visited.add(key);
        state.pixels[y][x] = fillColor;
        drawPixel(x, y, fillColor);

        // Add neighbors
        stack.push([x + 1, y]);
        stack.push([x - 1, y]);
        stack.push([x, y + 1]);
        stack.push([x, y - 1]);
    }
}

// Gallery sort
function setupGallerySort() {
    elements.gallerySort.addEventListener('change', (e) => {
        state.gallerySortOrder = e.target.value;
        renderGallery();
    });
}

// Start
init();

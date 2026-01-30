const { app, BrowserWindow, screen } = require('electron');
const path = require('path');

// FORCE DISCRETE GPU USAGE
app.commandLine.appendSwitch('force_high_performance_gpu');
app.commandLine.appendSwitch('ignore-gpu-blacklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('disable-frame-rate-limit');

let mainWindow;

function createWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    mainWindow = new BrowserWindow({
        width,
        height,
        frame: true, // User requested "Desktop App", standard frame is safer for dragging unless custom UI
        backgroundColor: '#000000',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // Per user request for "No browser sandbox limitations" / direct access
            backgroundThrottling: false, // Important for physics loop
            webSecurity: false // Allow loading local resources easily
        }
    });

    // Load the local URL for development or the local file for production by default.
    // In this dev environment, we assume accessing the Vite server.
    // Load content
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
    } else {
        // In production, load the built index.html
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Open the DevTools by default for diagnostics
    // mainWindow.webContents.openDevTools();

    // Log GPU info to console for verification
    app.getGPUInfo('complete').then(info => {
        console.log('GPU Info:', info);
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  net,
  protocol,
} from 'electron';

import { createStreamService } from './StreamService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '../..');
const isMac = process.platform === 'darwin';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'node-modules',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true
    }
  }
]);

let streamService;
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

function createMenu() {
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Settings...',
          accelerator: 'Cmd+,',
          click: () => mainWindow?.webContents.send('open-settings')
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        ...(isMac ? [] : [
          {
            label: 'Settings',
            accelerator: 'Ctrl+,',
            click: () => mainWindow?.webContents.send('open-settings')
          },
          { type: 'separator' }
        ]),
        {
          label: 'Import Configuration...',
          click: () => mainWindow?.webContents.send('import-configuration')
        },
        {
          label: 'Export Configuration...',
          click: () => mainWindow?.webContents.send('export-configuration')
        },
        { type: 'separator' },
        { role: isMac ? 'close' : 'quit' }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function handleExportConfiguration() {
  const dateSuffix = new Date().toISOString().split('T')[0];
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `streams-${dateSuffix}.json`,
    filters: [{ extensions: ['json'] }]
  });

  if (canceled || !filePath) return { success: false };

  try {
    const config = streamService.getConfiguration();
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleImportConfiguration() {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    filters: [{ extensions: ['json'] }],
    properties: ['openFile']
  });

  if (canceled || !filePaths[0]) return { success: false };

  try {
    const config = JSON.parse(fs.readFileSync(filePaths[0], 'utf-8'));

    if (!Array.isArray(config.streams)) {
      return { success: false, error: 'Invalid configuration format' };
    }

    return { success: true, config };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function registerIpcHandlers() {
  ipcMain.handle('configuration:get', () => streamService.getConfiguration());
  ipcMain.handle('configuration:export', handleExportConfiguration);
  ipcMain.handle('configuration:import', handleImportConfiguration);

  ipcMain.handle('stream:add', (event, name, url) => streamService.addStream(name, url));
  ipcMain.handle('stream:remove', (event, index) => streamService.removeStream(index));
  ipcMain.handle('streams:save', (event, streams) => streamService.updateStreams(streams));

  ipcMain.handle('server:get-port', async () => {
    await streamService.waitUntilReady();
    return streamService.getServerPort();
  });

  ipcMain.handle('discovery:start', async () => {
    try {
      const streams = await streamService.discoverStreams();
      return { success: true, streams };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

function handleNodeModulesProtocol(request) {
  const filePath = path.join(projectRoot, 'node_modules', request.url.slice('node-modules://'.length));
  return net.fetch(pathToFileURL(filePath).toString());
}

app.whenReady().then(() => {
  protocol.handle('node-modules', handleNodeModulesProtocol);
  streamService = createStreamService();
  registerIpcHandlers();
  createMenu();
  createWindow();
});

app.on('window-all-closed', () => {
  if (!isMac) app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

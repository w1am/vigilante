const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ipc', {
  /**
   * Retrieves all stream configurations from the configuration repository.
   */
  getConfiguration: () => ipcRenderer.invoke('configuration:get'),

  /**
   * Gets the dynamically assigned port number of the relay server.
   */
  getServerPort: () => ipcRenderer.invoke('server:get-port'),

  /**
   * Adds a new RTSP stream to the configuration.
   * @param {string} name - Display name for the stream
   * @param {string} url - RTSP URL of the stream
   */
  addStream: (name, url) => ipcRenderer.invoke('stream:add', name, url),

  /**
   * Removes a stream from the configuration by its index.
   * @param {number} index - Zero-based index of the stream to remove
   */
  removeStream: (index) => ipcRenderer.invoke('stream:remove', index),

  /**
   * Saves all stream configurations in bulk, replacing existing configuration.
   * @param {Array<{name: string, url: string}>} streams - Array of stream configuration objects
   */
  saveAllStreams: (streams) => ipcRenderer.invoke('streams:save', streams),

  /**
   * Exports the current stream configuration to a user-selected file.
   */
  exportConfiguration: () => ipcRenderer.invoke('configuration:export'),

  /**
   * Imports stream configuration from a user-selected file.
   */
  importConfiguration: () => ipcRenderer.invoke('configuration:import'),

  /**
   * Registers a callback to be invoked when the settings dialog should be opened.
   * @param {Function} callback - Function to call when settings should open
   */
  onOpenSettings: (callback) => ipcRenderer.on('open-settings', callback),

  /**
   * Registers a callback to be invoked when configuration export is triggered.
   * @param {Function} callback - Function to call when export is triggered
   */
  onExportConfiguration: (callback) => ipcRenderer.on('export-configuration', callback),

  /**
   * Registers a callback to be invoked when configuration import is triggered.
   * @param {Function} callback - Function to call when import is triggered
   */
  onImportConfiguration: (callback) => ipcRenderer.on('import-configuration', callback),

  /**
   * Gets the current platform identifier.
   * @returns {string} Platform name
   */
  getPlatform: () => process.platform,

  /**
   * Starts network discovery to find Hikvision cameras/NVRs.
   * @returns {Promise<{success: boolean, streams?: Array, error?: string}>}
   */
  discoverStreams: () => ipcRenderer.invoke('discovery:start')
});

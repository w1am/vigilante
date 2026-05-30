const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

window.api = {
  getConfiguration: () => invoke('get_configuration'),
  getServerPort: () => invoke('get_server_port'),
  addStream: (name, url) => invoke('add_stream', { name, url }),
  removeStream: (index) => invoke('remove_stream', { index }),
  saveAllStreams: (streams) => invoke('save_all_streams', { streams }),
  exportConfiguration: () => invoke('export_configuration'),
  importConfiguration: () => invoke('import_configuration'),
  discoverStreams: () => invoke('discover_streams'),

  onAddCamera: (callback) => listen('add-camera', () => callback()),
  onFindCameras: (callback) => listen('find-cameras', () => callback()),
  onOpenSettings: (callback) => listen('open-settings', () => callback()),
  onExportConfiguration: (callback) => listen('export-configuration', () => callback()),
  onImportConfiguration: (callback) => listen('import-configuration', () => callback())
};

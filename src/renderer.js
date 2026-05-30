const BRAND_CONFIG = {
  hikvision: { hasChannels: true, path: (ch) => `/Streaming/Channels/${ch}02` },
  dahua: { hasChannels: true, path: (ch) => `/cam/realmonitor?channel=${ch}&subtype=1` },
  reolink: { hasChannels: false, path: () => `/h264Preview_01_sub` },
  axis: { hasChannels: false, path: () => `/axis-media/media.amp` },
  amcrest: { hasChannels: false, path: () => `/cam/realmonitor?channel=1&subtype=1` },
  generic: { hasChannels: false, path: () => `/stream1` }
};

let relayServerPort = null;
let appConfiguration = { streams: [] };
let discoveredDevices = [];
const streamPlayers = new Map();
const streamStatus = new Map();

const $ = (id) => document.getElementById(id);
const escapeHtml = (text) => Object.assign(document.createElement('div'), { textContent: text }).innerHTML;

function calculateLayout(count) {
  if (count <= 1) return { cols: 1, rows: 1 };
  const cols = Math.ceil(Math.sqrt(count));
  return { cols, rows: Math.ceil(count / cols) };
}

function toggleModal(id, active) {
  $(id).classList.toggle('active', active);
}

function setTileStatus(index, state, text = '', sub = '') {
  const overlay = document.querySelector(`.tile-status[data-index="${index}"]`);
  if (!overlay) return;

  overlay.classList.toggle('hidden', state === 'live');
  overlay.classList.toggle('offline', state === 'offline');

  const spinner = overlay.querySelector('.tile-status-spinner');
  if (spinner) spinner.style.display = state === 'connecting' ? '' : 'none';

  overlay.querySelector('.tile-status-text').textContent = text;
  overlay.querySelector('.tile-status-sub').textContent = sub;
}

function disposePlayer(index) {
  const player = streamPlayers.get(index);
  if (player) {
    try { player.destroy(); } catch (e) { console.warn(`Failed to dispose player ${index}:`, e); }
    streamPlayers.delete(index);
  }
  streamStatus.delete(index);
}

function initializePlayer(index) {
  const canvas = document.querySelectorAll('.video-canvas')[index];
  if (!canvas) return;

  disposePlayer(index);

  const stream = appConfiguration.streams[index];
  if (!stream?.url) {
    setTileStatus(index, 'offline', 'No camera set', 'Open Settings to add a link');
    return;
  }

  setTileStatus(index, 'connecting', 'Connecting…');
  streamStatus.set(index, { start: Date.now(), lastFrame: 0, frameSeen: false });

  const url = `ws://localhost:${relayServerPort}/api/stream/${index}`;
  streamPlayers.set(index, new JSMpeg.Player(url, {
    canvas,
    onVideoDecode: () => {
      const status = streamStatus.get(index);
      if (status) {
        status.frameSeen = true;
        status.lastFrame = Date.now();
      }
      setTileStatus(index, 'live');
    }
  }));
}

function startStatusWatchdog() {
  setInterval(() => {
    const now = Date.now();
    streamStatus.forEach((status, index) => {
      if (!streamPlayers.has(index)) return;

      if (status.frameSeen) {
        if (now - status.lastFrame > 6000) {
          setTileStatus(index, 'connecting', 'Reconnecting…');
        }
      } else if (now - status.start > 9000) {
        setTileStatus(index, 'offline', 'Cannot connect', 'Check the camera, password, or link');
      }
    });
  }, 1000);
}

function rebuildGrid() {
  streamPlayers.forEach((_, i) => disposePlayer(i));
  renderGrid();
  appConfiguration.streams.forEach((_, i) => initializePlayer(i));
}

function renderGrid() {
  const grid = $('grid');
  const { streams } = appConfiguration;

  if (streams.length === 0) {
    grid.classList.add('grid-empty');
    grid.style.gridTemplateColumns = '';
    grid.style.gridTemplateRows = '';
    grid.innerHTML = `
      <div class="empty-state">
        <x-icon class="empty-state-icon" href="vendor/xel/icons/material.svg#videocam_off"></x-icon>
        <div class="empty-state-content">
          <h2 class="empty-state-title">No Cameras Yet</h2>
          <p class="empty-state-description">Add a camera to start watching your live feeds. Type one in yourself, or scan your network to find them automatically.</p>
        </div>
        <div class="empty-state-actions">
          <x-button id="empty-add-btn" size="large" skin="accent">
            <x-icon href="vendor/xel/icons/material.svg#add"></x-icon>
            <x-label>Add a Camera</x-label>
          </x-button>
          <x-button id="empty-discover-btn" size="large">
            <x-icon href="vendor/xel/icons/material.svg#search"></x-icon>
            <x-label>Find Cameras</x-label>
          </x-button>
          <x-button id="empty-import-btn" size="large">
            <x-icon href="vendor/xel/icons/material.svg#upload"></x-icon>
            <x-label>Import Setup</x-label>
          </x-button>
        </div>
      </div>`;

    $('empty-add-btn').onclick = openAddCamera;
    $('empty-discover-btn').onclick = openDiscovery;
    $('empty-import-btn').onclick = () => handleImport(true);
    return;
  }

  grid.classList.remove('grid-empty');
  const { cols, rows } = calculateLayout(streams.length);
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

  grid.innerHTML = streams.map((stream, i) => `
    <div class="video-canvas-wrapper" data-index="${i}">
      <span class="stream-label">${escapeHtml(stream.name) || `Camera ${i + 1}`}</span>
      <div class="tile-status" data-index="${i}">
        <x-throbber class="tile-status-spinner"></x-throbber>
        <span class="tile-status-text">Connecting…</span>
        <span class="tile-status-sub"></span>
      </div>
      <canvas class="video-canvas"></canvas>
    </div>
  `).join('');
}

function openAddCamera() {
  $('ac-name').value = '';
  $('ac-brand').value = 'hikvision';
  $('ac-ip').value = '';
  $('ac-channel').value = '1';
  $('ac-port').value = '554';
  $('ac-username').value = 'admin';
  $('ac-password').value = '';
  $('ac-url').value = '';
  updateAddCameraForm();
  toggleModal('add-camera-modal', true);
  $('ac-name').focus();
}

function closeAddCamera() {
  toggleModal('add-camera-modal', false);
}

function updateAddCameraForm() {
  const brand = $('ac-brand').value || 'hikvision';
  const isManual = brand === 'manual';

  $('ac-guided').style.display = isManual ? 'none' : 'block';
  $('ac-manual-group').style.display = isManual ? 'block' : 'none';

  if (!isManual) {
    const config = BRAND_CONFIG[brand] || BRAND_CONFIG.generic;
    $('ac-channel-group').style.display = config.hasChannels ? '' : 'none';
  }

  $('ac-preview-url').textContent = buildCameraUrl() || '—';
}

function buildCameraUrl() {
  const brand = $('ac-brand').value || 'hikvision';
  if (brand === 'manual') return $('ac-url').value.trim();

  const ip = $('ac-ip').value.trim();
  if (!ip) return '';

  const config = BRAND_CONFIG[brand] || BRAND_CONFIG.generic;
  const username = $('ac-username').value.trim();
  const password = $('ac-password').value;
  const port = parseInt($('ac-port').value) || 554;
  const channel = parseInt($('ac-channel').value) || 1;

  let auth = '';
  if (username) {
    auth = encodeURIComponent(username);
    if (password) auth += `:${encodeURIComponent(password)}`;
    auth += '@';
  }

  const path = config.hasChannels ? config.path(channel) : config.path();
  return `rtsp://${auth}${ip}:${port}${path}`;
}

async function addCameraFromForm() {
  const url = buildCameraUrl();
  if (!url) {
    alert('Please enter the camera IP address, or choose "I already have a link" and paste it.');
    return;
  }

  const name = $('ac-name').value.trim() || `Camera ${appConfiguration.streams.length + 1}`;
  const streams = [...appConfiguration.streams, { name, url }];

  const confirmBtn = $('add-camera-confirm');
  confirmBtn.disabled = true;
  const success = await window.api.saveAllStreams(streams).catch(() => false);
  confirmBtn.disabled = false;

  if (success) {
    appConfiguration.streams = streams;
    rebuildGrid();
    closeAddCamera();
  } else {
    alert('Could not save the camera. Please try again.');
  }
}

function openSettings() {
  renderStreamConfigs();
  toggleModal('modal', true);
}

function closeSettings() {
  toggleModal('modal', false);
}

function renderStreamConfigs() {
  const container = $('configs');
  const streams = appConfiguration.streams;

  if (streams.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = streams.map((stream, i) => `
    <div class="stream-config collapsed" data-index="${i}">
      <div class="stream-config-header">
        <div class="stream-config-header-left">
          <x-icon class="stream-config-chevron" href="vendor/xel/icons/material.svg#expand_more"></x-icon>
          <span class="stream-config-title">Camera ${i + 1}</span>
          <span class="stream-config-subtitle">${escapeHtml(stream.name || stream.url || 'Not configured')}</span>
        </div>
        <x-button class="remove-stream-button" data-index="${i}" size="small" skin="textured">
          <x-icon href="vendor/xel/icons/material.svg#delete"></x-icon>
          <x-label>Remove</x-label>
        </x-button>
      </div>
      <div class="stream-config-body">
        <div class="stream-config-body-inner">
          <div class="form-group">
            <x-label>Camera Name</x-label>
            <x-input class="stream-name" value="${escapeHtml(stream.name || '')}"></x-input>
          </div>
          <div class="form-group">
            <x-label>Camera Link</x-label>
            <x-input class="stream-url" value="${escapeHtml(stream.url || '')}" placeholder="rtsp://user:pass@192.168.1.100:554/stream"></x-input>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

function removeStream(index) {
  const config = document.querySelector(`.stream-config[data-index="${index}"]`);
  const name = config.querySelector('.stream-name').value.trim();
  const url = config.querySelector('.stream-url').value.trim();

  if ((name || url) && !confirm(`Remove Camera ${index + 1}?`)) return;

  appConfiguration.streams.splice(index, 1);
  renderStreamConfigs();
}

function getFormStreams() {
  return [...document.querySelectorAll('.stream-config')].map(el => ({
    name: el.querySelector('.stream-name').value.trim(),
    url: el.querySelector('.stream-url').value.trim()
  }));
}

async function saveStreams() {
  const saveBtn = $('save-button');
  saveBtn.disabled = true;

  const streams = getFormStreams();
  const success = await window.api.saveAllStreams(streams).catch(() => false);

  if (success) {
    appConfiguration.streams = streams;
    rebuildGrid();
    closeSettings();
  }

  saveBtn.disabled = false;
}

async function handleExport() {
  const result = await window.api.exportConfiguration();
  if (result.error) alert(`Export failed: ${result.error}`);
}

async function handleImport(applyImmediately = false) {
  const result = await window.api.importConfiguration();

  if (result.success && result.config) {
    appConfiguration.streams = result.config.streams;
    if (applyImmediately) {
      rebuildGrid();
    } else {
      renderStreamConfigs();
    }
  } else if (result.error) {
    alert(`Import failed: ${result.error}`);
  }
}

function openDiscovery() {
  discoveredDevices = [];
  setDiscoveryState('progress');
  toggleModal('discovery-modal', true);
  startDiscovery();
}

function closeDiscovery() {
  toggleModal('discovery-modal', false);
}

function setDiscoveryState(state) {
  $('discovery-progress').style.display = state === 'progress' ? 'flex' : 'none';
  $('discovery-results').style.display = state === 'results' ? 'block' : 'none';
  $('discovery-empty').style.display = state === 'empty' ? 'block' : 'none';
  $('discovery-add-button').disabled = state !== 'results';
}

async function startDiscovery() {
  const result = await window.api.discoverStreams();

  if (result.success && result.streams.length > 0) {
    discoveredDevices = result.streams;
    renderDiscoveryResults();
    updateChannelsVisibility();
    setDiscoveryState('results');
  } else {
    setDiscoveryState('empty');
  }
}

function renderDiscoveryResults() {
  $('discovery-list').innerHTML = discoveredDevices.map((device, i) => `
    <x-checkbox class="discovery-item" data-index="${i}" toggled>
      <x-label>
        <span class="discovery-item-name">${escapeHtml(device.ip)}</span>
        <span class="discovery-item-info">Camera found</span>
      </x-label>
    </x-checkbox>
  `).join('');
}

function updateChannelsVisibility() {
  const brand = $('discovery-brand').value || 'hikvision';
  const config = BRAND_CONFIG[brand] || BRAND_CONFIG.generic;
  $('discovery-channels-group').style.display = config.hasChannels ? '' : 'none';
}

async function addDiscoveredStreams() {
  const username = $('discovery-username').value.trim() || 'admin';
  const password = $('discovery-password').value;
  const brand = $('discovery-brand').value || 'hikvision';
  const channelCount = parseInt($('discovery-channels').value) || 4;
  const port = parseInt($('discovery-port').value) || 554;

  const config = BRAND_CONFIG[brand] || BRAND_CONFIG.generic;

  let auth = '';
  if (username) {
    auth = encodeURIComponent(username);
    if (password) auth += `:${encodeURIComponent(password)}`;
    auth += '@';
  }

  const selected = Array.from(document.querySelectorAll('.discovery-item[toggled]'))
    .map(el => discoveredDevices[parseInt(el.dataset.index)]);

  const additions = [];
  for (const device of selected) {
    if (config.hasChannels) {
      for (let ch = 1; ch <= channelCount; ch++) {
        additions.push({
          name: `Camera ${ch}`,
          url: `rtsp://${auth}${device.ip}:${port}${config.path(ch)}`
        });
      }
    } else {
      additions.push({
        name: device.ip,
        url: `rtsp://${auth}${device.ip}:${port}${config.path()}`
      });
    }
  }

  const streams = [...appConfiguration.streams, ...additions];
  const success = await window.api.saveAllStreams(streams).catch(() => false);

  if (success) {
    appConfiguration.streams = streams;
    rebuildGrid();
  }

  closeDiscovery();
}

function setupEventListeners() {
  window.api.onAddCamera(openAddCamera);
  window.api.onFindCameras(openDiscovery);
  window.api.onOpenSettings(openSettings);
  window.api.onExportConfiguration(handleExport);
  window.api.onImportConfiguration(() => handleImport(true));

  $('add-camera-close').onclick = closeAddCamera;
  $('add-camera-cancel').onclick = closeAddCamera;
  $('add-camera-confirm').onclick = addCameraFromForm;
  $('ac-brand').addEventListener('change', updateAddCameraForm);
  ['ac-ip', 'ac-username', 'ac-password', 'ac-port', 'ac-channel', 'ac-url'].forEach(
    id => $(id).addEventListener('input', updateAddCameraForm)
  );

  $('close-button').onclick = closeSettings;
  $('save-button').onclick = saveStreams;

  $('configs').onclick = (e) => {
    const removeBtn = e.target.closest('.remove-stream-button');
    if (removeBtn) return removeStream(parseInt(removeBtn.dataset.index));

    const header = e.target.closest('.stream-config-header');
    if (header && !e.target.closest('x-button')) {
      header.closest('.stream-config').classList.toggle('collapsed');
    }
  };

  $('configs').oninput = (e) => {
    const config = e.target.closest('.stream-config');
    if (!config) return;

    const name = config.querySelector('.stream-name').value.trim();
    const url = config.querySelector('.stream-url').value.trim();
    config.querySelector('.stream-config-subtitle').textContent = name || url || 'Not configured';
  };

  const menuButton = $('menu-button');
  const actionsMenu = $('actions-menu');

  menuButton.onclick = (e) => {
    e.stopPropagation();
    actionsMenu.opened ? actionsMenu.close() : actionsMenu.openNextToElement(menuButton, 'vertical');
  };

  document.addEventListener('click', (e) => {
    if (actionsMenu.opened && !actionsMenu.contains(e.target) && !menuButton.contains(e.target)) {
      actionsMenu.close();
    }
  });

  const menuActions = {
    'menu-add-stream': () => { closeSettings(); openAddCamera(); },
    'menu-export': handleExport,
    'menu-import': () => handleImport(false),
    'menu-discover': openDiscovery,
    'menu-delete-all': () => {
      if (appConfiguration.streams.length > 0 && confirm(`Remove all ${appConfiguration.streams.length} camera(s)?`)) {
        appConfiguration.streams = [];
        renderStreamConfigs();
      }
    }
  };

  for (const [id, action] of Object.entries(menuActions)) {
    $(id).onclick = () => { actionsMenu.close(); action(); };
  }

  $('discovery-close-button').onclick = closeDiscovery;
  $('discovery-add-button').onclick = addDiscoveredStreams;
  $('discovery-brand').addEventListener('change', updateChannelsVisibility);

  $('discovery-list').onclick = () => {
    setTimeout(() => {
      const hasSelected = document.querySelector('.discovery-item[toggled]') !== null;
      $('discovery-add-button').disabled = !hasSelected;
    }, 0);
  };

  document.onkeydown = (e) => {
    if (e.key === 'Escape') {
      closeSettings();
      closeAddCamera();
      closeDiscovery();
    }
  };
}

document.addEventListener('DOMContentLoaded', async () => {
  appConfiguration = await window.api.getConfiguration();
  appConfiguration.streams ??= [];
  relayServerPort = await window.api.getServerPort();

  renderGrid();
  appConfiguration.streams.forEach((_, i) => initializePlayer(i));
  setupEventListeners();
  startStatusWatchdog();
});

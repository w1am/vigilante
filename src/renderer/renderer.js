// ============================================================================
// CONFIGURATION
// ============================================================================

const BRAND_CONFIG = {
  hikvision: { hasChannels: true, path: (ch) => `/Streaming/Channels/${ch}02` },
  dahua: { hasChannels: true, path: (ch) => `/cam/realmonitor?channel=${ch}&subtype=1` },
  reolink: { hasChannels: false, path: () => `/h264Preview_01_sub` },
  axis: { hasChannels: false, path: () => `/axis-media/media.amp` },
  amcrest: { hasChannels: false, path: () => `/cam/realmonitor?channel=1&subtype=1` },
  generic: { hasChannels: false, path: () => `/stream1` }
};

// ============================================================================
// STATE
// ============================================================================

let relayServerPort = null;
let appConfiguration = { streams: [] };
let discoveredDevices = [];
const streamPlayers = new Map();

// ============================================================================
// UTILITIES
// ============================================================================

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

// ============================================================================
// STREAM PLAYERS
// ============================================================================

function disposePlayer(index) {
  const player = streamPlayers.get(index);
  if (player) {
    try { player.destroy(); } catch (e) { console.warn(`Failed to dispose player ${index}:`, e); }
    streamPlayers.delete(index);
  }
}

function initializePlayer(index) {
  const canvas = document.querySelectorAll('.video-canvas')[index];
  if (!canvas) return;

  disposePlayer(index);

  const stream = appConfiguration.streams[index];
  if (stream?.url) {
    const url = `ws://localhost:${relayServerPort}/api/stream/${index}`;
    streamPlayers.set(index, new JSMpeg.Player(url, { canvas }));
  }
}

function rebuildGrid() {
  streamPlayers.forEach((_, i) => disposePlayer(i));
  renderGrid();
  appConfiguration.streams.forEach((_, i) => initializePlayer(i));
}

// ============================================================================
// GRID RENDERING
// ============================================================================

function renderGrid() {
  const grid = $('grid');
  const { streams } = appConfiguration;

  if (streams.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <x-icon class="empty-state-icon" href="node-modules://xel/icons/material.svg#videocam_off"></x-icon>
        <div class="empty-state-content">
          <h2 class="empty-state-title">No Streams Configured</h2>
          <p class="empty-state-description">Get started by adding RTSP camera streams to monitor your feeds in a dynamic grid layout.</p>
        </div>
        <div class="empty-state-actions">
          <x-button id="empty-add-btn" skin="accent">
            <x-icon href="node-modules://xel/icons/material.svg#add"></x-icon>
            <x-label>Add Stream</x-label>
          </x-button>
          <x-button id="empty-discover-btn">
            <x-icon href="node-modules://xel/icons/material.svg#search"></x-icon>
            <x-label>Discover Streams</x-label>
          </x-button>
          <x-button id="empty-import-btn">
            <x-icon href="node-modules://xel/icons/material.svg#upload"></x-icon>
            <x-label>Import Configuration</x-label>
          </x-button>
        </div>
      </div>`;

    $('empty-add-btn').onclick = () => { openSettings(); addStream(); };
    $('empty-discover-btn').onclick = openDiscovery;
    $('empty-import-btn').onclick = () => handleImport(true);
    return;
  }

  const { cols, rows } = calculateLayout(streams.length);
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

  grid.innerHTML = streams.map((stream, i) => `
    <div class="video-canvas-wrapper" data-index="${i}">
      <span class="stream-label" style="display: ${stream.url ? 'block' : 'none'}">${escapeHtml(stream.name) || `Stream ${i + 1}`}</span>
      <div class="no-stream" style="display: ${stream.url ? 'none' : 'block'}">No stream configured</div>
      <canvas class="video-canvas"></canvas>
    </div>
  `).join('');
}

// ============================================================================
// SETTINGS MODAL
// ============================================================================

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
          <x-icon class="stream-config-chevron" href="node-modules://xel/icons/material.svg#expand_more"></x-icon>
          <span class="stream-config-title">Stream ${i + 1}</span>
          <span class="stream-config-subtitle">${escapeHtml(stream.name || stream.url || 'Not configured')}</span>
        </div>
        <x-button class="remove-stream-button" data-index="${i}" size="small" skin="textured">
          <x-icon href="node-modules://xel/icons/material.svg#delete"></x-icon>
        </x-button>
      </div>
      <div class="stream-config-body">
        <div class="stream-config-body-inner">
          <div class="form-group">
            <x-label>Name</x-label>
            <x-input class="stream-name" value="${escapeHtml(stream.name || '')}"></x-input>
          </div>
          <div class="form-group">
            <x-label>RTSP URL</x-label>
            <x-input class="stream-url" value="${escapeHtml(stream.url || '')}" placeholder="rtsp://user:pass@192.168.1.100:554/stream"></x-input>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

function addStream() {
  appConfiguration.streams.push({ name: '', url: '' });
  renderStreamConfigs();

  const config = document.querySelector(`.stream-config[data-index="${appConfiguration.streams.length - 1}"]`);
  if (config) {
    config.classList.remove('collapsed');
    config.scrollIntoView({ behavior: 'smooth' });
    config.querySelector('.stream-name').focus();
  }
}

function removeStream(index) {
  const config = document.querySelector(`.stream-config[data-index="${index}"]`);
  const name = config.querySelector('.stream-name').value.trim();
  const url = config.querySelector('.stream-url').value.trim();

  if ((name || url) && !confirm(`Remove Stream ${index + 1}?`)) return;

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
  const success = await window.ipc.saveAllStreams(streams).catch(() => false);

  if (success) {
    appConfiguration.streams = streams;
    rebuildGrid();
  }

  saveBtn.disabled = false;
}

// ============================================================================
// IMPORT/EXPORT
// ============================================================================

async function handleExport() {
  const result = await window.ipc.exportConfiguration();
  if (result.error) alert(`Export failed: ${result.error}`);
}

async function handleImport(applyImmediately = false) {
  const result = await window.ipc.importConfiguration();

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

// ============================================================================
// DISCOVERY MODAL
// ============================================================================

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
  const result = await window.ipc.discoverStreams();

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
        <span class="discovery-item-info">RTSP device</span>
      </x-label>
    </x-checkbox>
  `).join('');
}

function updateChannelsVisibility() {
  const brand = $('discovery-brand').value || 'hikvision';
  const config = BRAND_CONFIG[brand] || BRAND_CONFIG.generic;
  $('discovery-channels-group').style.display = config.hasChannels ? '' : 'none';
}

function addDiscoveredStreams() {
  const username = $('discovery-username').value.trim() || 'admin';
  const password = $('discovery-password').value.trim();
  const brand = $('discovery-brand').value || 'hikvision';
  const channelCount = parseInt($('discovery-channels').value) || 4;
  const port = parseInt($('discovery-port').value) || 554;

  const config = BRAND_CONFIG[brand] || BRAND_CONFIG.generic;
  const auth = password ? `${username}:${password}@` : (username ? `${username}@` : '');

  const selected = Array.from(document.querySelectorAll('.discovery-item[toggled]'))
    .map(el => discoveredDevices[parseInt(el.dataset.index)]);

  for (const device of selected) {
    if (config.hasChannels) {
      for (let ch = 1; ch <= channelCount; ch++) {
        appConfiguration.streams.push({
          name: `Camera ${ch}`,
          url: `rtsp://${auth}${device.ip}:${port}${config.path(ch)}`
        });
      }
    } else {
      appConfiguration.streams.push({
        name: device.ip,
        url: `rtsp://${auth}${device.ip}:${port}${config.path()}`
      });
    }
  }

  closeDiscovery();
  openSettings();
}

// ============================================================================
// EVENT SETUP
// ============================================================================

function setupEventListeners() {
  // IPC events
  window.ipc.onOpenSettings(openSettings);
  window.ipc.onExportConfiguration(handleExport);
  window.ipc.onImportConfiguration(() => handleImport(true));

  // Settings modal
  $('close-button').onclick = closeSettings;
  $('save-button').onclick = saveStreams;

  // Stream configs panel
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

  // Actions menu
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
    'menu-add-stream': () => { openSettings(); addStream(); },
    'menu-export': handleExport,
    'menu-import': () => handleImport(false),
    'menu-discover': openDiscovery,
    'menu-delete-all': () => {
      if (appConfiguration.streams.length > 0 && confirm(`Delete all ${appConfiguration.streams.length} stream(s)?`)) {
        appConfiguration.streams = [];
        renderStreamConfigs();
      }
    }
  };

  for (const [id, action] of Object.entries(menuActions)) {
    $(id).onclick = () => { actionsMenu.close(); action(); };
  }

  // Discovery modal
  $('discovery-close-button').onclick = closeDiscovery;
  $('discovery-add-button').onclick = addDiscoveredStreams;
  $('discovery-brand').addEventListener('change', updateChannelsVisibility);

  $('discovery-list').onclick = () => {
    setTimeout(() => {
      const hasSelected = document.querySelector('.discovery-item[toggled]') !== null;
      $('discovery-add-button').disabled = !hasSelected;
    }, 0);
  };

  // Keyboard shortcuts
  document.onkeydown = (e) => {
    if (e.key === 'Escape') closeSettings();
  };
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  appConfiguration = await window.ipc.getConfiguration();
  appConfiguration.streams ??= [];
  relayServerPort = await window.ipc.getServerPort();

  renderGrid();
  appConfiguration.streams.forEach((_, i) => initializePlayer(i));
  setupEventListeners();
});

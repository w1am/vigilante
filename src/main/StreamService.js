import path from 'path';
import { app } from 'electron';

import { createStream } from './domain/StreamConfiguration.js';
import ConfigurationRepository from './infrastructure/ConfigurationRepository.js';
import StreamRelayServer from './infrastructure/StreamRelayServer.js';
import DiscoveryService from './infrastructure/DiscoveryService.js';

/**
 * Orchestrates stream configuration management and relay server operations.
 */
class StreamService {
  #configRepository;
  #relayServer;
  #discoveryService;
  #configuration;

  constructor(configRepository, relayServer, discoveryService) {
    this.#configRepository = configRepository;
    this.#relayServer = relayServer;
    this.#discoveryService = discoveryService;
    this.#configuration = this.#configRepository.load();
  }

  getConfiguration() {
    return { streams: [...this.#configuration.streams] };
  }

  synchronizeStreamsWithRelay() {
    this.#relayServer.registerAllStreams(this.#configuration.streams);
  }

  addStream(name = '', url = '') {
    const streamIndex = this.#configuration.streams.length;
    const newStreamConfig = createStream({ name, url });

    this.#configuration.streams.push(newStreamConfig);
    this.#configRepository.save(this.#configuration.streams);

    if (url) {
      this.#relayServer.registerStream(streamIndex, newStreamConfig);
    }

    return streamIndex;
  }

  removeStream(streamIndex) {
    if (streamIndex < 0 || streamIndex >= this.#configuration.streams.length) {
      return false;
    }

    this.#configuration.streams.splice(streamIndex, 1);
    this.#configRepository.save(this.#configuration.streams);
    this.synchronizeStreamsWithRelay();

    return true;
  }

  updateStreams(streams) {
    this.#configuration.streams = streams.map(entry => createStream(entry));
    this.#configRepository.save(this.#configuration.streams);
    this.synchronizeStreamsWithRelay();

    return true;
  }

  getServerPort() {
    return this.#relayServer.getPort();
  }

  async waitUntilReady() {
    return this.#relayServer.waitUntilReady();
  }

  async discoverStreams(options = {}) {
    return this.#discoveryService.discover(options);
  }
}

/**
 * Creates and initializes a StreamService instance.
 * Must be called after app is ready since it uses app.getPath().
 */
export function createStreamService() {
  const configurationFilePath = path.join(app.getPath('userData'), 'streams.json');
  const configRepository = new ConfigurationRepository(configurationFilePath);
  const relayServer = new StreamRelayServer();
  const discoveryService = new DiscoveryService();

  const streamService = new StreamService(configRepository, relayServer, discoveryService);
  streamService.synchronizeStreamsWithRelay();

  return streamService;
}

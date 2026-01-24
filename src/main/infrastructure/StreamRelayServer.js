import express from 'express';
import rtspRelay from 'rtsp-relay';

/**
 * Handles HTTP/WebSocket server and RTSP-to-WebSocket proxying.
 */
class StreamRelayServer {
  #expressApp;
  #httpServer;
  #serverPort;
  #serverReadyPromise;
  #rtspRelayProxy;
  #streamRegistry;

  constructor() {
    this.#streamRegistry = new Map();
    this.#expressApp = express();
    this.#serverPort = null;
    this.#httpServer = null;

    const { proxy } = rtspRelay(this.#expressApp);
    this.#rtspRelayProxy = proxy;

    this.#expressApp.ws('/api/stream/:index', (websocket, request) => {
      const streamIndex = parseInt(request.params.index, 10);
      const streamConfig = this.#streamRegistry.get(streamIndex);

      if (!streamConfig || !streamConfig.url) {
        console.error(`No stream configured for index ${streamIndex}`);
        websocket.close();
        return;
      }

      console.log(`Client connected to stream ${streamIndex}: ${streamConfig.url}`);

      this.#rtspRelayProxy({
        url: streamConfig.url,
        transport: 'tcp',
        verbose: false
      })(websocket);
    });

    this.#serverReadyPromise = new Promise((resolve) => {
      this.#httpServer = this.#expressApp.listen(0, () => {
        this.#serverPort = this.#httpServer.address().port;
        console.log(`Stream relay server listening on port ${this.#serverPort}`);
        resolve(this.#serverPort);
      });
    });
  }

  registerStream(streamIndex, streamConfiguration) {
    if (streamConfiguration && streamConfiguration.url) {
      this.#streamRegistry.set(streamIndex, {
        url: streamConfiguration.url,
        name: streamConfiguration.name || `Stream ${streamIndex + 1}`
      });
    }
  }

  unregisterStream(streamIndex) {
    this.#streamRegistry.delete(streamIndex);
  }

  registerAllStreams(streamConfigurations) {
    this.#streamRegistry.clear();
    streamConfigurations.forEach((streamConfig, index) => {
      this.registerStream(index, streamConfig);
    });
  }

  getPort() {
    return this.#serverPort;
  }

  async waitUntilReady() {
    return this.#serverReadyPromise;
  }
}

export default StreamRelayServer;

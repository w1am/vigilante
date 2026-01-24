import net from 'net';
import os from 'os';

/**
 * RTSP device discovery service
 */
class DiscoveryService {
  #checkPort(ip, port, timeout = 300) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(timeout);

      const cleanup = (result) => {
        socket.destroy();
        resolve(result ? { ip, port } : null);
      };

      socket.on('connect', () => cleanup(true));
      socket.on('timeout', () => cleanup(false));
      socket.on('error', () => cleanup(false));

      socket.connect(port, ip);
    });
  }

  #getLocalSubnet() {
    const interfaces = os.networkInterfaces();

    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address.split('.').slice(0, 3).join('.');
        }
      }
    }

    return null;
  }

  /**
   * Scan for RTSP devices on the local network.
   * @returns {Promise<Array<{ip: string}>>} Array of discovered devices
   */
  async discover() {
    const subnet = this.#getLocalSubnet();
    if (!subnet) return [];

    // Scan all 254 IPs in parallel with short timeout
    const promises = [];
    for (let i = 1; i <= 254; i++) {
      promises.push(this.#checkPort(`${subnet}.${i}`, 554, 300));
    }

    const results = await Promise.all(promises);
    return results.filter(Boolean).map(r => ({ ip: r.ip }));
  }
}

export default DiscoveryService;

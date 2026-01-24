/**
 * Utility functions for stream configuration.
 */

export function createStream({ name = '', url = '' } = {}) {
  return {
    name: String(name).trim(),
    url: String(url).trim()
  };
}

export function isValidStream(stream) {
  return stream && typeof stream.name === 'string' && typeof stream.url === 'string';
}

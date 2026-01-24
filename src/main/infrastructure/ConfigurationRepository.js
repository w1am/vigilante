import fs from 'fs';
import path from 'path';
import { createStream } from '../domain/StreamConfiguration.js';

/**
 * Handles persistence of stream configurations to the filesystem.
 */
class ConfigurationRepository {
  #configurationFilePath;

  constructor(configurationFilePath) {
    if (!configurationFilePath || typeof configurationFilePath !== 'string') {
      throw new Error('Configuration file path is required');
    }
    this.#configurationFilePath = configurationFilePath;
  }

  load() {
    try {
      if (fs.existsSync(this.#configurationFilePath)) {
        const data = fs.readFileSync(this.#configurationFilePath, 'utf8');
        const parsedData = JSON.parse(data);

        if (Array.isArray(parsedData.streams)) {
          return {
            streams: parsedData.streams.map(entry => createStream(entry))
          };
        }
      }
    } catch (error) {
      console.error('Error loading configuration:', error);
    }

    return { streams: [] };
  }

  save(streamConfigurations) {
    try {
      const directoryPath = path.dirname(this.#configurationFilePath);
      if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
      }

      const dataToSave = { streams: streamConfigurations };

      fs.writeFileSync(
        this.#configurationFilePath,
        JSON.stringify(dataToSave, null, 2),
        'utf8'
      );

      return true;
    } catch (error) {
      console.error('Error saving configuration:', error);
      return false;
    }
  }
}

export default ConfigurationRepository;

const Stream = require('node-rtsp-stream');
const fs = require('fs');
const yaml = require('js-yaml');

const path = './config.yml';
const config = yaml.load(fs.readFileSync(path, 'utf8'));

config.streams.forEach((streamInfo, index) => {
  new Stream({
    name: streamInfo.name,
    streamUrl: streamInfo.url,
    wsPort: 9990 + index,
  });
});

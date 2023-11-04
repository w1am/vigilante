const Stream = require('node-rtsp-stream');
const streams = [
  {
    name: '',
    url: '',
  },
];

streams.forEach((streamInfo, index) => {
  new Stream({
    name: streamInfo.name,
    streamUrl: streamInfo.url,
    wsPort: 9990 + index,
  });
});

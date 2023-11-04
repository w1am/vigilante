document.addEventListener('DOMContentLoaded', () => {
  const canvasElements = document.querySelectorAll('.video-canvas');

  const streamPorts = [9990, 9991, 9992, 9993];

  canvasElements.forEach((canvas, index) => {
    const url = `ws://localhost:${streamPorts[index]}`;
    new JSMpeg.Player(url, { canvas: canvas });
  });
});

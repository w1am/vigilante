# Vigilante

Vigilante is an Electron-based application designed to provide a user-friendly interface for viewing live streams from CCTV cameras.

## Requirements

Before running Vigilante, ensure that the following prerequisites are installed:

- [Node.js](https://nodejs.org/en/)
- [Yarn](https://yarnpkg.com/en/)
- [FFmpeg](https://www.ffmpeg.org/)

## Configuration

A configuration file named `config.yml` must be created at the root. This file, in YAML format, contains the following properties:

```yaml
streams:
  - name: yard
    url: rtsp://username:password@your-ip-address:554/Streaming/Channels/102
  - name: buzzer
    url: rtsp://username:password@your-ip-address:554/Streaming/Channels/202
  - name: garage
    url: rtsp://username:password@your-ip-address:554/Streaming/Channels/302
  - name: driveway
    url: rtsp://username:password@your-ip-address:554/Streaming/Channels/402
```

The `config.yml` file allows you to define different camera streams with their respective names and URLs. Ensure that the required authentication details and correct RTSP URLs are provided.

## Build
Once the configuration file has been updated, you can build the application by running the following command:

```bash
yarn build
```

View the [Electron Builder](https://www.electron.build/) documentation for more information on how to build the application for different platforms.  

If you wish to see the application in action without building it, you can run the following command:

```bash
yarn start
```
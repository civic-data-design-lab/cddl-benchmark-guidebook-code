import os
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DEFAULT_OUTPUT_DIR = '/home/lcau/Desktop/PLSK/cddl-benchmark-guidebook-code/control_app/code/gopro/view_check'
LATEST_FRAME_NAME = '.stream_latest.jpg'
DEFAULT_PORT = 8089
DEFAULT_FPS = 5
BOUNDARY = 'frame'


def resolve_output_dir():
    output_directory = os.getenv('CAPTURE_OUTPUT_DIR', DEFAULT_OUTPUT_DIR)
    output_directory = os.path.abspath(output_directory)
    return output_directory


def resolve_port():
    try:
        port = int(os.getenv('PREVIEW_STREAM_PORT', DEFAULT_PORT))
    except ValueError:
        port = DEFAULT_PORT
    return max(1024, min(port, 65535))


def resolve_fps():
    try:
        fps = float(os.getenv('STREAM_TAP_FPS', os.getenv('PREVIEW_STREAM_FPS', DEFAULT_FPS)))
    except ValueError:
        fps = DEFAULT_FPS
    return max(1.0, min(fps, 15.0))


def read_latest_jpeg(latest_path):
    if not os.path.isfile(latest_path):
        return None
    try:
        with open(latest_path, 'rb') as file_handle:
            return file_handle.read()
    except OSError:
        return None


class MjpegStreamHandler(BaseHTTPRequestHandler):
    latest_path = ''
    frame_interval = 0.2

    def do_GET(self):
        if self.path not in ('/stream', '/'):
            self.send_error(404)
            return

        self.send_response(200)
        self.send_header('Age', '0')
        self.send_header('Cache-Control', 'no-cache, private')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Connection', 'close')
        self.send_header('Content-Type', f'multipart/x-mixed-replace; boundary={BOUNDARY}')
        self.end_headers()

        try:
            while True:
                frame = read_latest_jpeg(self.latest_path)
                if frame:
                    self.wfile.write(f'--{BOUNDARY}\r\n'.encode('ascii'))
                    self.wfile.write(b'Content-Type: image/jpeg\r\n')
                    self.wfile.write(f'Content-Length: {len(frame)}\r\n\r\n'.encode('ascii'))
                    self.wfile.write(frame)
                    self.wfile.write(b'\r\n')
                    self.wfile.flush()
                time.sleep(self.frame_interval)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            return

    def log_message(self, format, *args):
        return


def main():
    output_directory = resolve_output_dir()
    latest_path = os.path.join(output_directory, LATEST_FRAME_NAME)
    port = resolve_port()
    fps = resolve_fps()
    frame_interval = 1.0 / fps

    MjpegStreamHandler.latest_path = latest_path
    MjpegStreamHandler.frame_interval = frame_interval

    server = ThreadingHTTPServer(('0.0.0.0', port), MjpegStreamHandler)
    print(f'MJPEG_READY:http://0.0.0.0:{port}/stream', flush=True)
    print(f'MJPEG_SOURCE:{latest_path}', flush=True)
    print(f'MJPEG_FPS:{fps}', flush=True)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()

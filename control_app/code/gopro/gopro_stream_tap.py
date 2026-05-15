import os
import sys
import time

import cv2

DEFAULT_OUTPUT_DIR = '/home/lcau/Desktop/PLSK/cddl-benchmark-guidebook-code/control_app/code/gopro/view_check'
LATEST_FRAME_NAME = '.stream_latest.jpg'
DEFAULT_TAP_FPS = 5
DEFAULT_JPEG_QUALITY = 55


def resolve_output_dir():
    output_directory = os.getenv('CAPTURE_OUTPUT_DIR', DEFAULT_OUTPUT_DIR)
    output_directory = os.path.abspath(output_directory)
    os.makedirs(output_directory, exist_ok=True)
    return output_directory


def resolve_tap_fps():
    try:
        fps = float(os.getenv('STREAM_TAP_FPS', DEFAULT_TAP_FPS))
    except ValueError:
        fps = DEFAULT_TAP_FPS
    return max(1.0, min(fps, 15.0))


def resolve_jpeg_quality():
    try:
        quality = int(os.getenv('PREVIEW_JPEG_QUALITY', DEFAULT_JPEG_QUALITY))
    except ValueError:
        quality = DEFAULT_JPEG_QUALITY
    return max(40, min(quality, 90))


def write_latest_frame(frame, latest_path, jpeg_quality):
    temp_path = f'{latest_path}.tmp'
    if not cv2.imwrite(temp_path, frame, [int(cv2.IMWRITE_JPEG_QUALITY), jpeg_quality]):
        return False
    os.replace(temp_path, latest_path)
    os.chmod(latest_path, 0o644)
    return True


def main():
    stream_url = os.getenv('STREAM_URL', 'udp://@0.0.0.0:8554')
    output_directory = resolve_output_dir()
    latest_path = os.path.join(output_directory, LATEST_FRAME_NAME)
    tap_fps = resolve_tap_fps()
    update_interval = 1.0 / tap_fps
    jpeg_quality = resolve_jpeg_quality()

    cap = cv2.VideoCapture(stream_url)
    if not cap.isOpened():
        print('TAP_ERROR:Failed to open the video stream.', flush=True)
        sys.exit(1)

    print(f'TAP_READY:{latest_path}', flush=True)
    print(f'TAP_FPS:{tap_fps}', flush=True)

    while True:
        ret, frame = cap.read()
        if ret and frame is not None and frame.size > 0:
            write_latest_frame(frame, latest_path, jpeg_quality)
        time.sleep(update_interval)


if __name__ == '__main__':
    main()

import os
import sys
import time

import cv2

DEFAULT_OUTPUT_DIR = '/home/lcau/Desktop/PLSK/cddl-benchmark-guidebook-code/control_app/code/gopro/view_check'
LATEST_FRAME_NAME = '.stream_latest.jpg'
UPDATE_INTERVAL_SECONDS = 0.2


def resolve_output_dir():
    output_directory = os.getenv('CAPTURE_OUTPUT_DIR', DEFAULT_OUTPUT_DIR)
    output_directory = os.path.abspath(output_directory)
    os.makedirs(output_directory, exist_ok=True)
    return output_directory


def write_latest_frame(frame, latest_path):
    temp_path = f'{latest_path}.tmp'
    if not cv2.imwrite(temp_path, frame):
        return False
    os.replace(temp_path, latest_path)
    os.chmod(latest_path, 0o644)
    return True


def main():
    stream_url = os.getenv('STREAM_URL', 'udp://@0.0.0.0:8554')
    output_directory = resolve_output_dir()
    latest_path = os.path.join(output_directory, LATEST_FRAME_NAME)

    cap = cv2.VideoCapture(stream_url)
    if not cap.isOpened():
        print('TAP_ERROR:Failed to open the video stream.', flush=True)
        sys.exit(1)

    print(f'TAP_READY:{latest_path}', flush=True)

    while True:
        ret, frame = cap.read()
        if ret and frame is not None and frame.size > 0:
            write_latest_frame(frame, latest_path)
        time.sleep(UPDATE_INTERVAL_SECONDS)


if __name__ == '__main__':
    main()

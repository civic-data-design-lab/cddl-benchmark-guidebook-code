import os
import time

import cv2

LATEST_FRAME_NAME = '.stream_latest.jpg'
DEFAULT_MAX_AGE_SECONDS = 8


def resolve_output_dir(output_directory):
    output_directory = os.getenv('CAPTURE_OUTPUT_DIR', output_directory)
    return os.path.abspath(output_directory)


def latest_frame_path(output_directory):
    return os.path.join(resolve_output_dir(output_directory), LATEST_FRAME_NAME)


def read_latest_shared_frame(output_directory, max_age_seconds=DEFAULT_MAX_AGE_SECONDS):
    path = latest_frame_path(output_directory)
    if not os.path.isfile(path):
        return None

    age_seconds = time.time() - os.path.getmtime(path)
    if age_seconds > max_age_seconds:
        return None

    frame = cv2.imread(path)
    if frame is None or frame.size == 0:
        return None
    return frame


def read_frame_from_udp(stream_url, max_attempts=90):
    cap = cv2.VideoCapture(stream_url)
    if not cap.isOpened():
        return None

    frame = None
    for _ in range(max_attempts):
        ret, candidate = cap.read()
        if ret and candidate is not None and candidate.size > 0:
            frame = candidate
            break

    cap.release()
    return frame


def acquire_stream_frame(stream_url, output_directory, prefer_shared=False, max_age_seconds=DEFAULT_MAX_AGE_SECONDS):
    if prefer_shared:
        shared_frame = read_latest_shared_frame(output_directory, max_age_seconds)
        if shared_frame is not None:
            return shared_frame, 'shared'

    udp_frame = read_frame_from_udp(stream_url)
    if udp_frame is not None:
        return udp_frame, 'udp'

    shared_frame = read_latest_shared_frame(output_directory, max_age_seconds)
    if shared_frame is not None:
        return shared_frame, 'shared'

    return None, None

import os
import sys
import time
from datetime import datetime

import cv2
from rich.console import Console

from gopro_stream_frame import acquire_stream_frame, resolve_output_dir

console = Console()

def get_bbox_from_env():
    # Expects CROP_BBOX as "x1,y1,x2,y2"
    bbox_str = os.getenv("CROP_BBOX", "0, 0, 1920, 1080")  #for 12 : 700, 280, 1500, 1080   # for 7 : 440,80,1080,720
    coords = tuple(map(int, bbox_str.split(',')))
    if len(coords) != 4:
        raise ValueError("CROP_BBOX must have 4 comma-separated values: x1,y1,x2,y2")
    return coords

def capture_frame_after_delay(
    stream_url,
    delay=1,
    output_directory='/home/lcau/Desktop/PLSK/cddl-benchmark-guidebook-code/control_app/code/gopro/view_check',
    bbox=None,
):
    """
    Captures a single frame after a delay, overlays a timestamp, and draws a detection region.
    bbox: (x1, y1, x2, y2) or None to use env variable.
    """
    output_directory = resolve_output_dir(output_directory)
    os.makedirs(output_directory, exist_ok=True)

    prefer_shared = os.getenv('PREFER_SHARED_FRAME', '').lower() in {'1', 'true', 'yes'}
    frame, source = acquire_stream_frame(stream_url, output_directory, prefer_shared=prefer_shared)
    if frame is None:
        print(
            'CAPTURE_ERROR:Could not read a frame. Start the GoPro stream and stream tap '
            '(gopro_stream_tap.py), or stop Live Preview and try again.',
            flush=True,
        )
        sys.exit(1)

    if source == 'shared':
        time.sleep(max(delay, 0))

    current_time = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    output_file = os.path.join(output_directory, f"img_{current_time}.jpg")
    if bbox is None:
        bbox = get_bbox_from_env()
    x1, y1, x2, y2 = bbox

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 1
    color = (255, 255, 255)
    thickness = 2
    tx, ty = 10, 30
    (text_width, text_height), _ = cv2.getTextSize(timestamp, font, font_scale, thickness)
    cv2.rectangle(frame, (tx - 5, ty - text_height - 5), (tx + text_width + 5, ty + 5), (0, 0, 0), -1)
    cv2.putText(frame, timestamp, (tx, ty), font, font_scale, color, thickness, cv2.LINE_AA)

    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 2)

    label = "detection region"
    font_scale = 0.8
    color = (0, 0, 255)
    thickness = 2
    (label_width, label_height), _ = cv2.getTextSize(label, font, font_scale, thickness)
    cv2.rectangle(frame, (x1, y1 - label_height - 10), (x1 + label_width, y1), (0, 0, 0), -1)
    cv2.putText(frame, label, (x1, y1 - 5), font, font_scale, color, thickness, cv2.LINE_AA)

    coord_font_scale = 0.6
    coord_color = (0, 0, 255)
    coord_thickness = 2
    cv2.putText(frame, f"({x1},{y1})", (x1 + 5, y1 + 20), font, coord_font_scale, coord_color, coord_thickness, cv2.LINE_AA)
    cv2.putText(frame, f"({x2},{y2})", (x2 - 120, y2 - 20), font, coord_font_scale, coord_color, coord_thickness, cv2.LINE_AA)

    cv2.imwrite(output_file, frame)
    os.chmod(output_file, 0o644)
    print(f"CAPTURE_PATH:{output_file}", flush=True)

def main():
    stream_url = os.getenv("STREAM_URL", "udp://@0.0.0.0:8554")

    # Option 1: Use environment variable (default)
    capture_frame_after_delay(stream_url)

    # Option 2: Use direct coordinates (uncomment to use)
    # bbox = (420, 200, 1500, 880)
    # capture_frame_after_delay(stream_url, bbox=bbox)

if __name__ == "__main__":
    main()

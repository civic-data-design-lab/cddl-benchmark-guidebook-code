import cv2
from rich.console import Console
import time
from datetime import datetime
from dotenv import load_dotenv
import os

console = Console()
load_dotenv()

def get_bbox_from_env():
    # Expects CROP_BBOX as "x1,y1,x2,y2"
    bbox_str = os.getenv("CROP_BBOX", "0, 0, 1920, 1080")  #for 12 : 700, 280, 1500, 1080   # for 7 : 440,80,1080,720
    coords = tuple(map(int, bbox_str.split(',')))
    if len(coords) != 4:
        raise ValueError("CROP_BBOX must have 4 comma-separated values: x1,y1,x2,y2")
    return coords

def capture_frame_after_delay(stream_url, delay=1, output_directory='/home/lcau/benchmark-aus-2/code/gopro/view_check/', bbox=None):
    """
    Captures a single frame after a delay, overlays a timestamp, and draws a detection region.
    bbox: (x1, y1, x2, y2) or None to use env variable.
    """
    current_time = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    output_file = f"{output_directory}img_{current_time}.jpg"
    cap = cv2.VideoCapture(stream_url)

    if not cap.isOpened():
        console.print("Failed to open the video stream.")
        return

    start_time = time.time()
    if bbox is None:
        bbox = get_bbox_from_env()
    x1, y1, x2, y2 = bbox

    invalid_count = 0
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret or frame is None or frame.shape[0] == 0 or frame.shape[1] == 0:
            invalid_count += 1
            if invalid_count == 1:
                console.print("Waiting for a valid frame from the stream...")
            continue
        # Got a valid frame, reset counter
        invalid_count = 0

        # Display the frame for visual confirmation (optional)
        # cv2.imshow('GoPro Stream', frame)

        # Capture the frame after the delay
        if time.time() - start_time > delay:
            # Overlay timestamp
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 1
            color = (255, 255, 255)  # White text
            thickness = 2
            tx, ty = 10, 30  # Top-left corner for timestamp
            (text_width, text_height), _ = cv2.getTextSize(timestamp, font, font_scale, thickness)
            cv2.rectangle(frame, (tx-5, ty-text_height-5), (tx+text_width+5, ty+5), (0,0,0), -1)
            cv2.putText(frame, timestamp, (tx, ty), font, font_scale, color, thickness, cv2.LINE_AA)

            # Draw detection region rectangle
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 2)  # Red rectangle

            # Put label above the rectangle
            label = "detection region"
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.8
            color = (0, 0, 255)  # Red text
            thickness = 2
            (label_width, label_height), _ = cv2.getTextSize(label, font, font_scale, thickness)
            # Black background for text
            cv2.rectangle(frame, (x1, y1 - label_height - 10), (x1 + label_width, y1), (0, 0, 0), -1)
            cv2.putText(frame, label, (x1, y1 - 5), font, font_scale, color, thickness, cv2.LINE_AA)

            # Add bbox corner coordinates as text
            coord_font_scale = 0.6
            coord_color = (0, 0, 255)  # Green text
            coord_thickness = 2
            cv2.putText(frame, f"({x1},{y1})", (x1 + 5, y1 + 20), font, coord_font_scale, coord_color, coord_thickness, cv2.LINE_AA)
            cv2.putText(frame, f"({x2},{y2})", (x2 - 120, y2 - 20), font, coord_font_scale, coord_color, coord_thickness, cv2.LINE_AA)

            cv2.imwrite(output_file, frame)
            console.print(f"Frame captured and saved as {output_file}")
            break

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

def main():
    stream_url = "udp://@0.0.0.0:8554"  # Your stream URL
    # stream_url = "udp://127.0.0.1:8556"  # Your stream URL

    # Option 1: Use environment variable (default)
    capture_frame_after_delay(stream_url)

    # Option 2: Use direct coordinates (uncomment to use)
    # bbox = (420, 200, 1500, 880)
    # capture_frame_after_delay(stream_url, bbox=bbox)

if __name__ == "__main__":
    main()

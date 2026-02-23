
import cv2
import time
from rich.console import Console
from ultralytics import YOLO

console = Console()

def load_yolo():
    model = YOLO("yolov8n.pt")  # Load YOLOv8n model from Ultralytics
    return model

def play_stream(stream_url):
    model = load_yolo()

    cap = cv2.VideoCapture(stream_url)

    if not cap.isOpened():
        console.print("[bold red]Failed to open the video stream.[/bold red]")
        return

    detection_interval = 1  # seconds
    last_detection_time = 0
    annotated_frame = None

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            console.print("[bold red]Failed to grab frame.[/bold red]")
            break

        current_time = time.time()
        if current_time - last_detection_time >= detection_interval:
            # Perform object detection
            results = model.track(frame)

            # Render the results on the frame
            if results:
                annotated_frame = results[0].plot()
            else:
                annotated_frame = frame

            last_detection_time = current_time

        # Display the resulting frame (annotated or original)
        if annotated_frame is not None:
            cv2.imshow('GoPro Stream', annotated_frame)
        else:
            cv2.imshow('GoPro Stream', frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

def main():
    stream_url = "udp://@0.0.0.0:8554"  # Your stream URL
    play_stream(stream_url)

if __name__ == "__main__":
    main()
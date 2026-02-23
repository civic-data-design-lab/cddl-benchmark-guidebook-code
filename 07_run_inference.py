
import cv2
import logging
import torch
import json
import asyncio
import os
import time
import numpy as np
from ultralytics import YOLO
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
import geopandas as gpd
from shapely.geometry import Point

# Set up logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

class GeoJSONSaver:
    def __init__(self, geojson_dir, save_interval=10, grid_path=None):
        self.geojson_dir = geojson_dir
        self.save_interval = save_interval
        self.last_save_time = time.time()
        self.grid_gdf = gpd.read_file(grid_path).to_crs("EPSG:4326") if grid_path else None
        self.geojson_features = []
        self.current_date = datetime.now().strftime("%Y%m%d")
        self.create_directory()
        logging.info(f"GeoJSONSaver initialized with directory: {self.geojson_dir}")

    def create_directory(self):
        os.makedirs(self.geojson_dir, exist_ok=True)
        logging.info(f"Directory created: {self.geojson_dir}")

    def get_current_geojson_path(self):
        return os.path.join(self.geojson_dir, f"features_{self.current_date}.geojson")

    def load_existing_features(self):
        geojson_path = self.get_current_geojson_path()
        if os.path.exists(geojson_path):
            with open(geojson_path, 'r') as f:
                existing_data = json.load(f)
                return existing_data.get("features", [])
        return []

    def add_feature(self, x, y, category, confidence, timestamp, object_id, keypoints=None):
        point_geom = Point(x, y)
        grid_id = self.get_grid_id(point_geom) if self.grid_gdf is not None else None

        feature = {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [x, y]},
            "properties": {
                "category": category,
                "confidence": confidence,
                "timestamp": timestamp,
                "objectID": object_id,
                "gridId": grid_id,
                "keypoints": keypoints
            }
        }
        self.geojson_features.append(feature)
        logging.debug(f"Feature added: {feature}")

    def get_grid_id(self, point_geom):
        for grid in self.grid_gdf.itertuples():
            grid_geom = grid.geometry
            if grid_geom.contains(point_geom):
                return grid.grid_id
        return None

    def save(self):
        current_time = time.time()
        current_date = datetime.now().strftime("%Y%m%d")
        if current_date != self.current_date:
            self.current_date = current_date
            self.geojson_features = self.load_existing_features()

        if current_time - self.last_save_time >= self.save_interval:
            geojson_data = {
                "type": "FeatureCollection",
                "features": self.geojson_features
            }
            geojson_path = self.get_current_geojson_path()
            with open(geojson_path, 'w') as f:
                json.dump(geojson_data, f, indent=4)
            logging.info(f"GeoJSON data saved to {geojson_path}")
            self.last_save_time = current_time

class BenchDetection:
    def __init__(self, model_path, geojson_dir, grid_path=None):
        self.model = YOLO(model_path).to('cuda')
        self.geojson_saver = GeoJSONSaver(geojson_dir, grid_path=grid_path)

    async def process_frame(self, frame):
        results = self.model.track(frame, conf=0.2, save=False, persist=True)
        annotated_frame = frame.copy()

        for result in results:
            boxes = result.boxes
            if boxes is not None:
                for detection in boxes:
                    if detection.id is None:
                        continue  # Skip detections without IDs

                    x1, y1, x2, y2 = map(int, detection.xyxy[0][:4])
                    confidence = detection.conf[0]
                    object_id = f'bench_{int(detection.id.item())}'
                    category = self.model.names[int(detection.cls)]
                    timestamp = datetime.now().isoformat()

                    color = (255, 255, 255)
                    cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 2)
                    label = f'{category} {confidence:.2f} ID: {object_id}'
                    cv2.putText(annotated_frame, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

                    center_x = (x1 + x2) // 2
                    center_y = y1 + 2 * (y2 - y1) // 3

                    cv2.circle(annotated_frame, (center_x, center_y), 5, color, -1)

                    coordinates_text = f'({center_x}, {center_y})'
                    cv2.putText(annotated_frame, coordinates_text, (center_x, center_y + 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

                    self.geojson_saver.add_feature(center_x, center_y, category, confidence.item(), timestamp, object_id)

        return annotated_frame

class PedDetection:
    def __init__(self, model_path, geojson_dir, grid_path=None):
        self.model = YOLO(model_path).to('cuda')
        self.geojson_saver = GeoJSONSaver(geojson_dir, grid_path=grid_path)
        self.keypoint_pairs = {
            'head': [(0, 1), (0, 2), (1, 3), (2, 4)],
            'body': [(5, 6), (6, 12), (5, 11), (12, 11)],
            'arms': [(6, 8), (8, 10), (5, 7), (7, 9)],
            'legs': [(12, 14), (14, 16), (11, 13), (13, 15)]
        }
        self.colors = {
            'head': (255, 0, 255),
            'body': (0, 0, 255),
            'arms': (0, 0, 255),
            'legs': (255, 255, 0)
        }

    async def process_frame(self, frame):
        results = self.model.track(frame, conf=0.2, save=False, persist=True)
        annotated_frame = frame.copy()

        for result in results:
            boxes = result.boxes
            keypoints = result.keypoints
            if boxes is not None and keypoints is not None and isinstance(keypoints.data, torch.Tensor):
                keypoints_data = keypoints.data.cpu().numpy().tolist()  # Move tensor to CPU before converting to numpy

                for detection, person_keypoints in zip(boxes, keypoints_data):
                    if len(person_keypoints) < 17:
                        continue

                    x1, y1, x2, y2 = map(int, detection.xyxy[0][:4])
                    confidence = detection.conf[0]
                    object_id = f'ped_{int(detection.id.item()) if detection.id is not None else -1}'  # Extract numerical ID
                    category = self.model.names[int(detection.cls)]
                    timestamp = datetime.now().isoformat()

                    cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                    label = f'ID: {object_id} {confidence:.2f}'
                    cv2.putText(annotated_frame, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

                    for part, pairs in self.keypoint_pairs.items():
                        line_color = self.colors[part]
                        for start_idx, end_idx in pairs:
                            if start_idx < len(person_keypoints) and end_idx < len(person_keypoints):
                                if person_keypoints[start_idx][2] > 0.5 and person_keypoints[end_idx][2] > 0.5:
                                    start_point = (int(person_keypoints[start_idx][0]), int(person_keypoints[start_idx][1]))
                                    end_point = (int(person_keypoints[end_idx][0]), int(person_keypoints[end_idx][1]))
                                    cv2.line(annotated_frame, start_point, end_point, line_color, 3)

                    bottom_keypoints = sorted([kp for kp in person_keypoints if kp[2] > 0.5], key=lambda k: k[1], reverse=True)[:2]
                    if len(bottom_keypoints) == 2:
                        mid_y = int((bottom_keypoints[0][1] + bottom_keypoints[1][1]) / 2)
                        valid_keypoints = [kp for kp in person_keypoints if kp[2] > 0.5]
                        left_keypoint = min(valid_keypoints, key=lambda k: k[0], default=None)
                        right_keypoint = max(valid_keypoints, key=lambda k: k[0], default=None)
                        if left_keypoint is not None and right_keypoint is not None:
                            mid_x = int((left_keypoint[0] + right_keypoint[0]) / 2)
                            cv2.circle(annotated_frame, (mid_x, mid_y), 3, (255, 255, 255), -1)
                            cv2.putText(annotated_frame, f'({mid_x}, {mid_y})', (mid_x, mid_y + 20), cv2.FONT_HERSHEY_SIMPLEX, 0.3, (0, 255, 0), 1)

                            self.geojson_saver.add_feature(mid_x, mid_y, category, confidence.item(), timestamp, object_id, person_keypoints)

        return annotated_frame

class SittingDetection:
    def __init__(self, model_path_pose, model_path_sitting, geojson_dir, grid_path=None):
        self.model_pose = YOLO(model_path_pose).to('cuda')
        self.model_sitting = YOLO(model_path_sitting).to('cuda')
        self.geojson_saver = GeoJSONSaver(geojson_dir, grid_path=grid_path)
        self.keypoint_pairs = {
            'head': [(0, 1), (0, 2), (1, 3), (2, 4)],
            'body': [(5, 6), (6, 12), (5, 11), (12, 11)],
            'arms': [(6, 8), (8, 10), (5, 7), (7, 9)],
            'legs': [(12, 14), (14, 16), (11, 13), (13, 15)]
        }
        self.colors = {
            'head': (255, 0, 255),
            'body': (0, 0, 255),
            'arms': (0, 0, 255),
            'legs': (255, 255, 0)
        }

    async def process_frame(self, frame):
        pose_results = self.model_pose.track(frame, conf=0.2, save=False, persist=True)
        midpoints = []
        keypoints_list = []
        annotated_frame = frame.copy()

        for pose_result in pose_results:
            keypoints = pose_result.keypoints
            if keypoints is not None and isinstance(keypoints.data, torch.Tensor):
                keypoints_data = keypoints.data.cpu().numpy().tolist()  # Move tensor to CPU before converting to numpy
                for person_keypoints in keypoints_data:
                    keypoints_list.append(person_keypoints)
                    if len(person_keypoints) < 17:
                        continue
                    for part, pairs in self.keypoint_pairs.items():
                        line_color = self.colors[part]
                        for start_idx, end_idx in pairs:
                            if start_idx < len(person_keypoints) and end_idx < len(person_keypoints):
                                if person_keypoints[start_idx][2] > 0.5 and person_keypoints[end_idx][2] > 0.5:
                                    start_point = (int(person_keypoints[start_idx][0]), int(person_keypoints[start_idx][1]))
                                    end_point = (int(person_keypoints[end_idx][0]), int(person_keypoints[end_idx][1]))
                                    cv2.line(annotated_frame, start_point, end_point, line_color, 3)
                    bottom_keypoints = sorted([kp for kp in person_keypoints if kp[2] > 0.6], key=lambda k: k[1], reverse=True)[:2]
                    if len(bottom_keypoints) == 2:
                        mid_y = int((bottom_keypoints[0][1] + bottom_keypoints[1][1]) / 2)
                        valid_keypoints = [kp for kp in person_keypoints if kp[2] > 0.6]
                        left_keypoint = min(valid_keypoints, key=lambda k: k[0], default=None)
                        right_keypoint = max(valid_keypoints, key=lambda k: k[0], default=None)
                        if left_keypoint is not None and right_keypoint is not None:
                            mid_x = int((left_keypoint[0] + right_keypoint[0]) / 2)
                            midpoints.append((mid_x, mid_y))

        sitting_results = self.model_sitting.track(annotated_frame, conf=0.2, save=False, persist=True)
        for result in sitting_results:
            boxes = result.boxes
            if boxes is not None:
                for detection in boxes:
                    x1, y1, x2, y2 = map(int, detection.xyxy[0][:4])
                    confidence = detection.conf[0]
                    if detection.id is None:
                        continue  # Skip detections without IDs
                    object_id = int(detection.id.item()) if hasattr(detection, 'id') else -1
                    category = self.model_sitting.names[int(detection.cls)]
                    timestamp = datetime.now().isoformat()

                    color = (0, 255, 0) if category == 'sitting' else (255, 0, 0)

                    cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 2)
                    label = f'{category} ID: {object_id} {confidence:.2f}'
                    cv2.putText(annotated_frame, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.3, color, 1)

                    closest_midpoint = self.find_closest_midpoint(midpoints, (x1 + x2) // 2, (y1 + y2) // 2)
                    if closest_midpoint is not None:
                        mid_x, mid_y = closest_midpoint
                        cv2.circle(annotated_frame, (mid_x, mid_y), 3, color, -1)
                        self.geojson_saver.add_feature(mid_x, mid_y, category, confidence.item(), timestamp, object_id, keypoints_list)
                        coordinates_text = f'({mid_x}, {mid_y})'
                        cv2.putText(annotated_frame, coordinates_text, (mid_x, mid_y + 40), cv2.FONT_HERSHEY_SIMPLEX, 0.3, (0, 255, 0), 1)

        return annotated_frame

    def find_closest_midpoint(self, midpoints, x, y):
        min_distance = float('inf')
        closest_midpoint = None
        for (mx, my) in midpoints:
            distance = np.sqrt((mx - x) ** 2 + (my - y) ** 2)
            if distance < min_distance:
                min_distance = distance
                closest_midpoint = (mx, my)
        return closest_midpoint

async def run_detection(detection_class, frame):
    return await detection_class.process_frame(frame)

async def frame_producer(queue, cap, max_retries, crop_coords):
    retry_count = 0
    x_start, y_start, width, height = crop_coords
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            retry_count += 1
            logging.error(f"Failed to grab frame. Attempt {retry_count} of {max_retries}.")
            if retry_count >= max_retries:
                logging.error("Max retries reached. Exiting.")
                break
            await asyncio.sleep(1)  # Wait a bit before retrying
            continue

        retry_count = 0  # Reset retry count after a successful frame grab
        cropped_frame = frame[y_start:y_start+height, x_start:x_start+width]

        if queue.qsize() < 1:  # Limit queue size to 1 to ensure frame skipping
            await queue.put(cropped_frame)
        await asyncio.sleep(0)  # Yield control to allow other coroutines to run

    await queue.put(None)  # Signal the consumer to stop

async def frame_consumer(queue, bench_detector, ped_detector, sitting_detector, image_output_dir):
    while True:
        frame = await queue.get()
        if frame is None:
            break

        start_time = time.time()

        tasks = [
            run_detection(bench_detector, frame),
            run_detection(ped_detector, frame),
            run_detection(sitting_detector, frame)
        ]
        results = await asyncio.gather(*tasks)

        # Calculate duration of detection tasks
        duration = time.time() - start_time

        # Process results
        bench_frame, ped_frame, sitting_frame = results
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        bench_image_path = os.path.join(image_output_dir, "bench", f"frame_{timestamp}.jpg")
        ped_image_path = os.path.join(image_output_dir, "ped", f"frame_{timestamp}.jpg")
        sitting_image_path = os.path.join(image_output_dir, "sitting", f"frame_{timestamp}.jpg")

        # Save GeoJSON data
        bench_detector.geojson_saver.save()
        ped_detector.geojson_saver.save()
        sitting_detector.geojson_saver.save()

        logging.info(f"Detection and processing took {duration:.2f} seconds.")

        # Add a 1-second interval before processing the next frame
        await asyncio.sleep(3)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cv2.destroyAllWindows()

async def process_stream(bench_detector, ped_detector, sitting_detector, stream_url, image_output_dir):
    cap = cv2.VideoCapture(f"{stream_url}?fifo_size=100000000&overrun_nonfatal=1")
    if not cap.isOpened():
        logging.error("Error opening video stream")
        return

    queue = asyncio.Queue(maxsize=1)
    max_retries = 5
    crop_coords = (420, 200, 1920-420, 1080-200)  # Crop coordinates (x_start, y_start, width, height)

    producer_task = asyncio.create_task(frame_producer(queue, cap, max_retries, crop_coords))
    consumer_task = asyncio.create_task(frame_consumer(queue, bench_detector, ped_detector, sitting_detector, image_output_dir))

    await asyncio.gather(producer_task, consumer_task)

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    bench_detector = BenchDetection('modelpath', 'resultpath', grid_path='gridpath')
    ped_detector = PedDetection('modelpath', 'resultpath', grid_path='gridpath')
    sitting_detector = SittingDetection('modelpath', 'modelpath2', 'resultpath', grid_path='gridpath')
    stream_url = "udp://@0.0.0.0:8554"
    image_output_dir = 'image-output-dir'
    asyncio.run(process_stream(bench_detector, ped_detector, sitting_detector, stream_url, image_output_dir))
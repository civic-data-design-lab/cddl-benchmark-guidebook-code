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
import csv
from collections import defaultdict
import sys
import pytz

# Set up logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

DETECTION_FRAME_SAVE_INTERVAL = 600  # 10 minutes in seconds
DETECTION_IMAGE_SAVE_INTERVAL = 600  # 10 minutes in seconds
FPS_LOG_INTERVAL = 60  # seconds

SYDNEY_TZ = pytz.timezone('Australia/Sydney')
STATUS_CSV_PATH = os.getenv("STATUS_LOG_PATH", "/home/lcau/Desktop/PLSK/cddl-benchmark-guidebook-code/control_app/code/logs/stream_status.csv")
DETECTION_FRAME_PATH = os.getenv("DETECTION_FRAME_PATH", "/home/lcau/Desktop/PLSK/cddl-benchmark-guidebook-code/control_app/code/detection/detection_frame.png")

def env_bool(name, default=False):
    raw = os.getenv(name)
    if raw is None:
        return default
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}

class GeoJSONSaver:
    def __init__(self, geojson_dir, save_interval=60, grid_path=None):
        self.geojson_dir = geojson_dir
        self.save_interval = save_interval
        self.last_save_time = time.time()
        # self.grid_gdf = gpd.read_file(grid_path).to_crs("EPSG:4326") if grid_path else None
        self.grid_gdf = None
        self.geojson_features = []
        self.current_date = datetime.now(SYDNEY_TZ).strftime("%Y%m%d")
        self.current_datehour = datetime.now(SYDNEY_TZ).strftime("%Y%m%d_%H")
        self.create_directory()
        logging.info(f"GeoJSONSaver initialized with directory: {self.geojson_dir}")

    def create_directory(self):
        os.makedirs(self.geojson_dir, exist_ok=True)
        logging.info(f"Directory created: {self.geojson_dir}")

    def get_current_geojson_path(self):
        return os.path.join(self.geojson_dir, f"features_{self.current_datehour}.geojson")

    def load_existing_features(self):
        geojson_path = self.get_current_geojson_path()
        if os.path.exists(geojson_path):
            with open(geojson_path, 'r') as f:
                existing_data = json.load(f)
                return existing_data.get("features", [])
        return []

    def add_feature(self, x, y, category, confidence, timestamp, object_id, keypoints=None, bbox=None, baseline_id=None):
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
                "keypoints": keypoints,
                "bbox": bbox,
                "baseline_id": baseline_id
            }
        }
        self.geojson_features.append(feature)
        logging.debug(f"Feature added: {feature}")

    def get_grid_id(self, point_geom):
        # for grid in self.grid_gdf.itertuples():
        #     grid_geom = grid.geometry
        #     if grid_geom.contains(point_geom):
        #         return grid.grid_id
        return None

    def save(self):
        current_time = time.time()
        current_date = datetime.now(SYDNEY_TZ).strftime("%Y%m%d")
        current_datehour = datetime.now(SYDNEY_TZ).strftime("%Y%m%d_%H")

        if current_datehour != self.current_datehour:
            self.current_datehour = current_datehour
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
        self.last_detection_time = 0
        self.detection_interval = 5.0  # 5 seconds

    async def process_frame(self, frame):
        current_time = time.time()
        
        # Only run detection every 5 seconds
        if current_time - self.last_detection_time < self.detection_interval:
            return frame  # Return original frame without processing
        
        self.last_detection_time = current_time
        
        now = datetime.now(SYDNEY_TZ)  # Set once, right after frame is captured
        now_ts = now.timestamp()
        datefor_id = now.strftime("%m%d")
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
                    object_id = f'bench_{datefor_id}_{int(detection.id.item())}'
                    category = self.model.names[int(detection.cls)]

                    timestamp = now.isoformat()

                    color = (255, 255, 255)
                    cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 2)
                    label = f'{category} {confidence:.2f} ID: {object_id}'
                    cv2.putText(annotated_frame, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

                    center_x = (x1 + x2) // 2
                    center_y = y1 + 2 * (y2 - y1) // 3

                    cv2.circle(annotated_frame, (center_x, center_y), 5, color, -1)

                    coordinates_text = f'({center_x}, {center_y})'
                    cv2.putText(annotated_frame, coordinates_text, (center_x, center_y + 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

                    self.geojson_saver.add_feature(center_x, center_y, category, confidence.item(), timestamp, object_id)

        return annotated_frame

class PoseAndSittingDetection:
    def __init__(self, model_path_pose, model_path_sitting, geojson_dir_ped, geojson_dir_sitting, grid_path=None):
        self.model_pose = YOLO(model_path_pose).to('cuda')
        self.model_sitting = YOLO(model_path_sitting).to('cuda') if model_path_sitting else None
        self.geojson_saver_ped = GeoJSONSaver(geojson_dir_ped, grid_path=grid_path)
        self.geojson_saver_sitting = GeoJSONSaver(geojson_dir_sitting, grid_path=grid_path) if geojson_dir_sitting else None
        self.keypoint_pairs = {
            'head': [(0, 1), (0, 2), (1, 3), (2, 4)],
            'body': [(5, 6), (6, 12), (5, 11), (12, 11)],
            'arms': [(6, 8), (8, 10), (5, 7), (7, 9)],
            'legs': [(12, 14), (14, 16), (11, 13), (13, 15)]
        }
        self.colors = {
            'head': (255, 0, 255),
            'body': (0, 0, 255),
            'arms': (0, 255, 0),
            'legs': (255, 255, 0)
        }
        self.last_annotated_save_time_ped = None
        self.last_annotated_save_time_sitting = None
        self.annotated_save_interval = DETECTION_IMAGE_SAVE_INTERVAL
        self.annotated_save_dir_ped = os.path.join(os.path.dirname(__file__), 'ped_detection_images')
        self.annotated_save_dir_sitting = os.path.join(os.path.dirname(__file__), 'sitting_detection_images')
        self.non_annotated_save_dir = os.path.join(os.path.dirname(__file__), 'sample_images')
        os.makedirs(self.annotated_save_dir_ped, exist_ok=True)
        os.makedirs(self.annotated_save_dir_sitting, exist_ok=True)
        os.makedirs(self.non_annotated_save_dir, exist_ok=True)

    async def process_frame(self, frame):
        now = datetime.now(SYDNEY_TZ)
        now_ts = now.timestamp()
        datefor_id = now.strftime("%m%d")
        pose_results = self.model_pose.track(frame, conf=0.2, save=False, persist=True)
        annotated_frame_ped = frame.copy()
        annotated_frame_sitting = frame.copy()
        non_annotated_frame = frame.copy()
        keypoints_list = []
        midpoints = []
        num_ped_detections = 0
        baseline_image_saved = False
        all_pose_detections = []
        baseline_bbox_keypoint_pairs = []
        # Pedestrian detection and skeleton drawing
        
        for pose_result in pose_results:
            boxes = pose_result.boxes
            keypoints = pose_result.keypoints
            if boxes is not None and keypoints is not None and isinstance(keypoints.data, torch.Tensor):
                keypoints_data = keypoints.data.cpu().numpy().tolist()
                for detection, person_keypoints in zip(boxes, keypoints_data):
                    if len(person_keypoints) < 17:
                        continue
                    num_ped_detections += 1
                    # Pedestrian ID
                    rounded_seconds = now.second - (now.second % 5)
                    timestamp_for_id = now.replace(second=rounded_seconds, microsecond=0).strftime("%H%M%S")
                    x1, y1, x2, y2 = map(int, detection.xyxy[0][:4])
                    bbox = [x1, y1, x2, y2]
                    confidence = detection.conf[0]
                    det_id = int(detection.id.item()) if detection.id is not None else -1
                    if det_id == -1:
                        object_id = f'ped_{datefor_id}_{timestamp_for_id}_{det_id}'
                    else:
                        object_id = f'ped_{datefor_id}_{det_id}'
                    category = self.model_pose.names[int(detection.cls)]
                    timestamp = now.isoformat()

                    for part, pairs in self.keypoint_pairs.items():
                        line_color = self.colors[part]
                        for start_idx, end_idx in pairs:
                            if start_idx < len(person_keypoints) and end_idx < len(person_keypoints):
                                if person_keypoints[start_idx][2] > 0.6 and person_keypoints[end_idx][2] > 0.6:
                                    start_point = (int(person_keypoints[start_idx][0]), int(person_keypoints[start_idx][1]))
                                    end_point = (int(person_keypoints[end_idx][0]), int(person_keypoints[end_idx][1]))
                                    cv2.line(annotated_frame_ped, start_point, end_point, line_color, 3)

                    annotated_frame_sitting = annotated_frame_ped.copy()

                    # Midpoint for geojson
                    bottom_keypoints = sorted([kp for kp in person_keypoints if kp[2] > 0.6], key=lambda k: k[1], reverse=True)[:2]
                    if len(bottom_keypoints) == 2:
                        mid_y = int((bottom_keypoints[0][1] + bottom_keypoints[1][1]) / 2)
                        valid_keypoints = [kp for kp in person_keypoints if kp[2] > 0.6]
                        left_keypoint = min(valid_keypoints, key=lambda k: k[0], default=None)
                        right_keypoint = max(valid_keypoints, key=lambda k: k[0], default=None)
                        if left_keypoint is not None and right_keypoint is not None:
                            mid_x = int((left_keypoint[0] + right_keypoint[0]) / 2)
                            cv2.circle(annotated_frame_ped, (mid_x, mid_y), 3, (255, 255, 255), -1)
                            cv2.putText(annotated_frame_ped, f'({mid_x}, {mid_y})', (mid_x, mid_y + 20), cv2.FONT_HERSHEY_SIMPLEX, 0.3, (0, 255, 0), 1)

                            self.geojson_saver_ped.add_feature(mid_x, mid_y, category, confidence.item(), timestamp, object_id, person_keypoints, bbox)
                            # For sitting detection
                            keypoints_list.append(person_keypoints)

                            midpoints.append((mid_x, mid_y))
                            
                            baseline_bbox_keypoint_pairs.append({
                                "baseline_id": object_id,
                                "bbox": bbox,
                                "keypoints": person_keypoints,
                            })
                            
                            all_pose_detections.append({
                                'bbox': (x1, y1, x2, y2),
                                'category': category,
                                'confidence': confidence
                            })

        if num_ped_detections > 1 and (self.last_annotated_save_time_ped is None or (now_ts - self.last_annotated_save_time_ped) >= self.annotated_save_interval):

            save_name = now.strftime("sample_images_%Y%m%d_%H%M%S.jpg")
            save_path = os.path.join(self.non_annotated_save_dir, save_name)
            cv2.imwrite(save_path, non_annotated_frame)
            self.last_annotated_save_time_ped = now_ts

            # save_name = now.strftime("baseline_model_%Y%m%d_%H%M%S.jpg")
            # save_path = os.path.join(self.annotated_save_dir_ped, save_name)
            # timestamp_str = save_name
            # font = cv2.FONT_HERSHEY_SIMPLEX
            # font_scale = 0.7
            # color = (255, 255, 255)
            # thickness = 2
            # margin = 10
            # text_size, baseline = cv2.getTextSize(timestamp_str, font, font_scale, thickness)
            # text_width, text_height = text_size
            # image_height, image_width = annotated_frame_ped.shape[:2]
            # text_x = (image_width - text_width) // 2
            # text_y = image_height - margin
            # for detection in all_pose_detections:
            #     x1, y1, x2, y2 = detection['bbox']
            #     category = detection['category']
            #     confidence = detection['confidence']
            #     cv2.rectangle(annotated_frame_ped, (x1, y1), (x2, y2), (0, 255, 0), 2)
            #     label = f'{category} {confidence:.2f}'
            #     cv2.putText(annotated_frame_ped, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
            # cv2.rectangle(annotated_frame_ped, (text_x - 10, text_y - text_height - 10), (text_x + text_width + 10, text_y + baseline + 10), (0, 0, 0), thickness=-1)
            # cv2.putText(annotated_frame_ped, timestamp_str, (text_x, text_y), font, font_scale, color, thickness, cv2.LINE_AA)
            # cv2.imwrite(save_path, annotated_frame_ped)
            # baseline_image_saved = True
            # self.last_annotated_save_time_ped = now_ts

        if self.model_sitting is not None and self.geojson_saver_sitting is not None:
            sitting_results = self.model_sitting.track(annotated_frame_sitting, conf=0.2, save=False, persist=True)
            num_sitting_detections = 0
            category_counts = defaultdict(int)
            for result in sitting_results:
                boxes = result.boxes
                if boxes is not None:
                    for detection in boxes:
                        x1, y1, x2, y2 = map(int, detection.xyxy[0][:4])
                        bbox_pose_enhanced = [x1, y1, x2, y2]
                        confidence = detection.conf[0]
                        if detection.id is None:
                            continue
                        object_id = f'{datefor_id}_{int(detection.id.item())}'
                        category = self.model_sitting.names[int(detection.cls)]
                        timestamp = now.isoformat()
                        color = (0, 255, 0) if category == 'sitting' else (255, 0, 0)
                        cv2.rectangle(annotated_frame_sitting, (x1, y1), (x2, y2), color, 2)
                        label = f'{category} ID: {object_id} {confidence:.2f}'
                        cv2.putText(annotated_frame_sitting, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.3, color, 1)
                        closest_midpoint = self.find_closest_midpoint(midpoints, (x1 + x2) // 2, (y1 + y2) // 2)
                        if closest_midpoint is not None:
                            mid_x, mid_y = closest_midpoint
                            cv2.circle(annotated_frame_sitting, (mid_x, mid_y), 3, color, -1)
                            best_iou = 0
                            best_keypoints = None
                            best_id = None
                            for pair in baseline_bbox_keypoint_pairs:
                                iou = bbox_iou(bbox_pose_enhanced, pair["bbox"])
                                if iou > best_iou:
                                    best_iou = iou
                                    best_keypoints = pair["keypoints"]
                                    best_id = pair["baseline_id"]
                            if best_iou > 0.7 and best_keypoints is not None:
                                selected_keypoints = best_keypoints
                            else:
                                selected_keypoints = None
                            self.geojson_saver_sitting.add_feature(
                                mid_x, mid_y, category, confidence.item(), timestamp, object_id, selected_keypoints, bbox_pose_enhanced, best_id
                            )
                            coordinates_text = f'({mid_x}, {mid_y})'
                            cv2.putText(annotated_frame_sitting, coordinates_text, (mid_x, mid_y + 40), cv2.FONT_HERSHEY_SIMPLEX, 0.3, (0, 255, 0), 1)
                        num_sitting_detections += 1
                        category_counts[category] += 1

        # if baseline_image_saved:
        #     save_name = now.strftime("pose_enhanced_model_%Y%m%d_%H%M%S.jpg")
        #     save_path = os.path.join(self.annotated_save_dir_sitting, save_name)
        #     timestamp_str = save_name
        #     font = cv2.FONT_HERSHEY_SIMPLEX
        #     font_scale = 0.7
        #     color = (255, 255, 255)
        #     thickness = 2
        #     margin = 10
        #     text_size, baseline = cv2.getTextSize(timestamp_str, font, font_scale, thickness)
        #     text_width, text_height = text_size
        #     image_height, image_width = annotated_frame_sitting.shape[:2]
        #     text_x = (image_width - text_width) // 2
        #     text_y = image_height - margin
        #     cv2.rectangle(annotated_frame_sitting, (text_x - 10, text_y - text_height - 10), (text_x + text_width + 10, text_y + baseline + 10), (0, 0, 0), thickness=-1)
        #     cv2.putText(annotated_frame_sitting, timestamp_str, (text_x, text_y), font, font_scale, color, thickness, cv2.LINE_AA)

        #     # Compose the result text by category
        #     if category_counts:
        #         result_text = " | ".join([f"{cat}: {count}" for cat, count in category_counts.items()])
        #     else:
        #         result_text = "No sitting detected"

        #     # Choose position for the text (top-left corner, for example)
        #     result_font = cv2.FONT_HERSHEY_SIMPLEX
        #     result_font_scale = 0.8
        #     result_color = (0, 255, 255)  # Yellow
        #     result_thickness = 2
        #     result_margin = 20

        #     cv2.putText(
        #         annotated_frame_sitting,
        #         result_text,
        #         (result_margin, result_margin + 30),  # (x, y)
        #         result_font,
        #         result_font_scale,
        #         result_color,
        #         result_thickness,
        #         cv2.LINE_AA
        #     )

        #     cv2.imwrite(save_path, annotated_frame_sitting)
        #     self.last_annotated_save_time_sitting = now_ts
        #     baseline_image_saved = False

        return annotated_frame_ped, annotated_frame_sitting

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

fps_state = {"producer_fps": None, "consumer_fps": None, "log_time": None}

async def frame_producer(queue, cap, max_retries, crop_coords):
    status_csv_path = STATUS_CSV_PATH
    # Ensure CSV header exists
    if not os.path.exists(status_csv_path):
        with open(status_csv_path, 'w', newline='') as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow(['timestamp', 'producer_fps', 'consumer_fps'])
    count_frame_added = 0
    last_fps_log_time = time.time()
    last_frame_save_time = None
    retry_count = 0
    x1, y1, x2, y2 = crop_coords  # Now using bbox format
    while cap.isOpened():
        ret, frame = cap.read()
        
        if not ret:
            retry_count += 1
            logging.error(f"Failed to grab frame. Attempt {retry_count} of {max_retries}.")
            # status_csv_path is already defined at the top
            if retry_count >= max_retries:
                logging.error("Max retries reached. Waiting 5 minutes before restarting the script.")
                # Log the restart event to stream_status.csv
                # status_csv_path is already defined at the top
                log_time = datetime.now(SYDNEY_TZ).isoformat()
                with open(status_csv_path, 'a', newline='') as csvfile:
                    writer = csv.writer(csvfile)
                    #### 0 for "restart wait 5 min"
                    writer.writerow([log_time, 0, 0])
                time.sleep(300)  # Wait for 5 minutes (blocking, but safe here since we're about to restart)
                os.execv(sys.executable, [sys.executable] + sys.argv)

            await asyncio.sleep(1)  # Wait a bit before retrying
            continue

        retry_count = 0  # Reset retry count after a successful frame grab
        cropped_frame = frame[y1:y2, x1:x2]

        if queue.qsize() < 1:
            await queue.put(cropped_frame)
            
            count_frame_added += 1

            current_time = time.time()
            if current_time - last_fps_log_time >= FPS_LOG_INTERVAL:
                fps = count_frame_added / (current_time - last_fps_log_time)
                last_fps_log_time = current_time
                log_time = datetime.now(SYDNEY_TZ).isoformat()
                fps_state["producer_fps"] = fps
                fps_state["log_time"] = log_time
                if fps_state["consumer_fps"] is not None:
                    update_fps_log(status_csv_path, fps_state["log_time"], fps_state["producer_fps"], fps_state["consumer_fps"])
                    fps_state["producer_fps"] = None
                    fps_state["consumer_fps"] = None
                count_frame_added = 0

            if last_frame_save_time is None:
                detection_frame_path = DETECTION_FRAME_PATH
                timestamp_str = time.strftime('%Y%m%d_%H%M%S')
                label = f'background taken: {timestamp_str}'
                frame_to_save = cropped_frame.copy()
                
                # Add timestamp overlay
                font = cv2.FONT_HERSHEY_SIMPLEX
                font_scale = 1.0
                color = (255, 255, 255)
                thickness = 4
                margin = 10
                
                text_size, baseline = cv2.getTextSize(label, font, font_scale, thickness)
                text_width, text_height = text_size
                image_height, image_width = frame_to_save.shape[:2]
                text_x = (image_width - text_width) // 2
                text_y = image_height - margin
                
                cv2.rectangle(frame_to_save, 
                            (text_x - 10, text_y - text_height - 10),
                            (text_x + text_width + 10, text_y + baseline + 10),
                            (0, 0, 0), thickness=-1)
                cv2.putText(frame_to_save, label, (text_x, text_y), font, font_scale, color, thickness, cv2.LINE_AA)
                
                cv2.imwrite(detection_frame_path, frame_to_save)
                last_frame_save_time = current_time

            elif (current_time - last_frame_save_time) >= DETECTION_FRAME_SAVE_INTERVAL:
                detection_frame_path = DETECTION_FRAME_PATH
                timestamp_str = time.strftime('%Y%m%d_%H%M%S')
                label = f'detection frame taken: {timestamp_str}'
                frame_to_save = cropped_frame.copy()
                
                # Add timestamp overlay
                font = cv2.FONT_HERSHEY_SIMPLEX
                font_scale = 1.0
                color = (255, 255, 255)
                thickness = 4
                margin = 10
                
                text_size, baseline = cv2.getTextSize(label, font, font_scale, thickness)
                text_width, text_height = text_size
                image_height, image_width = frame_to_save.shape[:2]
                text_x = (image_width - text_width) // 2
                text_y = image_height - margin
                
                cv2.rectangle(frame_to_save, 
                            (text_x - 10, text_y - text_height - 10),
                            (text_x + text_width + 10, text_y + baseline + 10),
                            (0, 0, 0), thickness=-1)
                cv2.putText(frame_to_save, label, (text_x, text_y), font, font_scale, color, thickness, cv2.LINE_AA)
                
                cv2.imwrite(detection_frame_path, frame_to_save)
                logging.info(f"[Periodic] Updated detection frame at {detection_frame_path} with timestamp {timestamp_str}")
                last_frame_save_time = current_time
            
        await asyncio.sleep(0)  # Yield control to allow other coroutines to run

    await queue.put(None)  # Signal the consumer to stop

async def frame_consumer(queue, bench_detection, ped_and_sitting_detection, image_output_dir):
    count_frame_consumed = 0
    last_fps_log_time = time.time()
    status_csv_path = STATUS_CSV_PATH
    # Ensure CSV header exists
    if not os.path.exists(status_csv_path):
        with open(status_csv_path, 'w', newline='') as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow(['timestamp', 'producer_fps', 'consumer_fps'])

    while True:
        frame = await queue.get()
        if frame is None:
            break

        count_frame_consumed += 1

        start_time = time.time()

        tasks = []
        if bench_detection is not None:
            tasks.append(run_detection(bench_detection, frame))
        if ped_and_sitting_detection is not None:
            tasks.append(run_detection(ped_and_sitting_detection, frame))
        if not tasks:
            await asyncio.sleep(0.1)
            continue
        results = await asyncio.gather(*tasks)

        # Calculate duration of detection tasks
        duration = time.time() - start_time

        # Save GeoJSON data
        if bench_detection is not None:
            bench_detection.geojson_saver.save()
        if ped_and_sitting_detection is not None:
            ped_and_sitting_detection.geojson_saver_ped.save()
            if ped_and_sitting_detection.geojson_saver_sitting is not None:
                ped_and_sitting_detection.geojson_saver_sitting.save()

        logging.info(f"Detection and processing took {duration:.2f} seconds.")

        # Add a 0.25-second interval before processing the next frames 
        await asyncio.sleep(0.05)

        # Log FPS every 10 seconds
        current_time = time.time()
        if current_time - last_fps_log_time >= FPS_LOG_INTERVAL:
            fps = count_frame_consumed / (current_time - last_fps_log_time)
            log_time = datetime.now(SYDNEY_TZ).isoformat()
            fps_state["consumer_fps"] = fps
            fps_state["log_time"] = log_time
            if fps_state["producer_fps"] is not None:
                update_fps_log(status_csv_path, fps_state["log_time"], fps_state["producer_fps"], fps_state["consumer_fps"])
                fps_state["producer_fps"] = None
                fps_state["consumer_fps"] = None
            count_frame_consumed = 0
            last_fps_log_time = current_time

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cv2.destroyAllWindows() 

async def process_stream(bench_detection, ped_and_sitting_detection, stream_url, image_output_dir):
    cap = cv2.VideoCapture(f"{stream_url}?fifo_size=100000000&overrun_nonfatal=1")
    if not cap.isOpened():
        logging.error("Error opening video stream")
        return

    queue = asyncio.Queue(maxsize=1)
    max_retries = 5
    crop_coords = (0, 0, 1920, 1080)  # Crop coordinates (x_start, y_start, width, height)

    #for 12 : 700, 280, 1500, 1080   # for 7 : 440,80,1080,720

    producer_task = asyncio.create_task(frame_producer(queue, cap, max_retries, crop_coords))
    consumer_task = asyncio.create_task(frame_consumer(queue, bench_detection, ped_and_sitting_detection, image_output_dir))

    await asyncio.gather(producer_task, consumer_task)

    cap.release()
    cv2.destroyAllWindows()

def update_fps_log(status_csv_path, log_time, producer_fps, consumer_fps):
    with open(status_csv_path, 'a', newline='') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow([log_time, f"{producer_fps:.2f}", f"{consumer_fps:.2f}"])

def bbox_iou(boxA, boxB):
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])
    interArea = max(0, xB - xA) * max(0, yB - yA)
    boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
    boxBArea = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])
    iou = interArea / float(boxAArea + boxBArea - interArea + 1e-6)
    return iou

if __name__ == "__main__":
    stream_url = os.getenv("STREAM_URL", "udp://@0.0.0.0:8554")
    image_output_dir = os.getenv("OUTPUT_BASE_DIR", '/home/lcau/Desktop/PLSK/cddl-benchmark-guidebook-code/control_app/code/data')
    pose_model_path = os.getenv("MODEL_POSE_PATH", '/home/lcau/Desktop/PLSK/cddl-benchmark-guidebook-code/control_app/code/model/yolov8l-pose.pt')
    bench_model_path = os.getenv("MODEL_BENCH_PATH", '/home/lcau/Desktop/PLSK/cddl-benchmark-guidebook-code/control_app/code/model/bench_version2025/bench_10x/weights/best.pt')
    sitting_model_path = os.getenv("MODEL_SITTING_PATH", '/home/lcau/Desktop/PLSK/cddl-benchmark-guidebook-code/control_app/code/model/sitting_version2025/sitting_3x/weights/best.pt')
    enable_bench_model = env_bool("ENABLE_BENCH_MODEL", False)
    enable_sitting_model = env_bool("ENABLE_SITTING_MODEL", True)

    bench_detection = None
    if enable_bench_model:
        bench_detection = BenchDetection(
            bench_model_path,
            os.path.join(image_output_dir, 'bench'),
            grid_path=None,
        )

    pose_and_sitting_detection = PoseAndSittingDetection(
        pose_model_path,
        sitting_model_path if enable_sitting_model else None,
        os.path.join(image_output_dir, 'ped'),
        os.path.join(image_output_dir, 'sitting') if enable_sitting_model else None,
        grid_path=None,
    )

    asyncio.run(process_stream(bench_detection, pose_and_sitting_detection, stream_url, image_output_dir))

# tmux new -s gcp_data_uploader
# python gcp_data_uploader.py
# ctrl+b, d
# tmux ls
# tmux a -t gcp_data_uploader
# ps aux | grep python
# tmux kill-session -t gcp_data_uploader

# export GOOGLE_APPLICATION_CREDENTIALS="/home/lcau/benchmark-aus-2/code/keys/benchmark-beta-test-ef408c2fc7e0.json"


import os
import time
from google.cloud import storage
from datetime import datetime, timedelta
from dotenv import load_dotenv
import pytz

load_dotenv()

SYDNEY_TZ = pytz.timezone("Australia/Sydney")

def upload_to_gcs(local_path, bucket_name, blob_name, make_public=False):
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_name)
    blob.upload_from_filename(local_path)
    if make_public:
        blob.make_public()
        print(f"Made gs://{bucket_name}/{blob_name} public at {blob.public_url}")
    print(f"Uploaded {local_path} to gs://{bucket_name}/{blob_name}")

if __name__ == "__main__":

    bucket_name = "benchmark-aus-v2"
    image_path = "/home/lcau/benchmark-aus-2/code/detection/latest_detection_skeleton_combined.jpg"
    image_blob_name_2 = f"snapshots/latest_detection_skeleton.jpg"
    image_path_2 = "/home/lcau/benchmark-aus-2/code/detection/latest_detection_skeleton_trained.jpg"
    image_blob_name_3 = f"snapshots/latest_detection_skeleton_trained.jpg"
    detection_frame_path = f"/home/lcau/benchmark-aus-2/code/detection/detection_frame.png"
    detection_frame_blob_name = f"snapshots/latest_detection_frame.png"
    stream_status_path = f"/home/lcau/benchmark-aus-2/code/logs/stream_status.csv"
    stream_status_blob_name = f"logs/stream_status.csv"

    bench_summary_path = f"/home/lcau/benchmark-aus-2/data/summary/bench_hourly_summary.csv"
    bench_summary_blob_name = f"summary/bench_hourly_summary.csv"
    ped_summary_path = f"/home/lcau/benchmark-aus-2/data/summary/ped_hourly_summary.csv"
    ped_summary_blob_name = f"summary/ped_hourly_summary.csv"
    sitting_summary_path = f"/home/lcau/benchmark-aus-2/data/summary/sitting_hourly_summary.csv"
    sitting_summary_blob_name = f"summary/sitting_hourly_summary.csv"

    while True:
        YYYYMMDD = datetime.now(SYDNEY_TZ).strftime("%Y%m%d")
        YYYYMMDD_1DAYAGO = (datetime.now(SYDNEY_TZ) - timedelta(days=1)).strftime("%Y%m%d")
        YYYYMMDDHH_1HOURAGO = (datetime.now(SYDNEY_TZ) - timedelta(hours=1)).strftime("%Y%m%d_%H")
        YYYYMMDDHH = (datetime.now(SYDNEY_TZ)).strftime("%Y%m%d_%H")

        ped_path = f"/home/lcau/benchmark-aus-2/data/ped/features_{YYYYMMDDHH}.geojson"
        ped_path_1HOURAGO = f"/home/lcau/benchmark-aus-2/data/ped/features_{YYYYMMDDHH_1HOURAGO}.geojson"
        sitting_path = f"/home/lcau/benchmark-aus-2/data/sitting/features_{YYYYMMDDHH}.geojson"
        sitting_path_1HOURAGO = f"/home/lcau/benchmark-aus-2/data/sitting/features_{YYYYMMDDHH_1HOURAGO}.geojson"

        ped_blob_name = f"data/baseline/ped_{YYYYMMDDHH}.geojson"
        ped_blob_name_1HOURAGO = f"data/baseline/ped_{YYYYMMDDHH_1HOURAGO}.geojson"
        sitting_blob_name = f"data/pose_enhanced/sitting_{YYYYMMDDHH}.geojson"
        sitting_blob_name_1HOURAGO = f"data/pose_enhanced/sitting_{YYYYMMDDHH_1HOURAGO}.geojson"

        image_blob_name = f"snapshots/trajectory/latest_detection_skeleton_combined_{YYYYMMDDHH}.jpg"

        # daily_bench_path = f"/home/lcau/benchmark-aus-2/data/daily/bench_{YYYYMMDD}.geojson"
        daily_ped_path = f"/home/lcau/benchmark-aus-2/data/daily/ped_{YYYYMMDD}.geojson"
        daily_sitting_path = f"/home/lcau/benchmark-aus-2/data/daily/sitting_{YYYYMMDD}.geojson"

        # daily_bench_path_1DAYAGO = f"/home/lcau/benchmark-aus-2/data/daily/bench_{YYYYMMDD_1DAYAGO}.geojson"
        daily_ped_path_1DAYAGO = f"/home/lcau/benchmark-aus-2/data/daily/ped_{YYYYMMDD_1DAYAGO}.geojson"
        daily_sitting_path_1DAYAGO = f"/home/lcau/benchmark-aus-2/data/daily/sitting_{YYYYMMDD_1DAYAGO}.geojson"

        # daily_bench_blob_name = f"data/daily_bench/bench_{YYYYMMDD}.geojson"
        daily_ped_blob_name = f"data/daily_ped/ped_{YYYYMMDD}.geojson"
        daily_sitting_blob_name = f"data/daily_sitting/sitting_{YYYYMMDD}.geojson"
        # daily_bench_blob_name_1DAYAGO = f"data/daily_bench/bench_{YYYYMMDD_1DAYAGO}.geojson"
        # daily_ped_blob_name_1DAYAGO = f"data/daily_ped/ped_{YYYYMMDD_1DAYAGO}.geojson"
        # daily_sitting_blob_name_1DAYAGO = f"data/daily_sitting/sitting_{YYYYMMDD_1DAYAGO}.geojson"

        print("Starting upload cycle...")
        for local_path, blob_name in [
            (ped_path, ped_blob_name),
            (ped_path_1HOURAGO, ped_blob_name_1HOURAGO),
            (sitting_path, sitting_blob_name),
            (sitting_path_1HOURAGO, sitting_blob_name_1HOURAGO),
            (stream_status_path, stream_status_blob_name),
            (bench_summary_path, bench_summary_blob_name),
            (ped_summary_path, ped_summary_blob_name),
            (sitting_summary_path, sitting_summary_blob_name),

            # (daily_bench_path, daily_bench_blob_name),
            (daily_ped_path, daily_ped_blob_name),
            (daily_sitting_path, daily_sitting_blob_name),
            # (daily_bench_path_1DAYAGO, daily_bench_blob_name_1DAYAGO),
            # (daily_ped_path_1DAYAGO, daily_ped_blob_name_1DAYAGO),
            # (daily_sitting_path_1DAYAGO, daily_sitting_blob_name_1DAYAGO),
        ]:
            if not os.path.exists(local_path):
                print(f"File not found, skipping: {local_path}")
            else:
                upload_to_gcs(local_path, bucket_name, blob_name)

        for local_path, blob_name, make_public in [
            (detection_frame_path, detection_frame_blob_name, True),
            (image_path, image_blob_name, True),
            (image_path, image_blob_name_2, True),
            (image_path_2, image_blob_name_3, True),
        ]:
            if not os.path.exists(local_path):
                print(f"File not found, skipping: {local_path}")
            else:
                upload_to_gcs(local_path, bucket_name, blob_name, make_public=make_public)
        print("Upload cycle complete. Sleeping for 10 minutes.")
        sleep_seconds = 1800

        for remaining in range(sleep_seconds, 0, -1):
            mins, secs = divmod(remaining, 60)
            print(f"\rNext upload in {mins:02d}:{secs:02d}", end="", flush=True)
            time.sleep(1)
        print()  # Move to next line after countdown

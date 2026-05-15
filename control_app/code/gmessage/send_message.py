# tmux new -s send_message
# python send_message.py
# ctrl+b, d
# tmux ls
# tmux a -t send_message
# ps aux | grep python
# tmux kill-session -t send_message
# pkill -f send_message.py

import os
import pandas as pd
from datetime import datetime, timedelta, timezone
from google.cloud import storage
import requests
import pytz
import time

GOOGLE_CHAT_WEBHOOK_URL = 'https://chat.googleapis.com/v1/spaces/AAQAe8BtL7A/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=mWQKl73P2kW32-T0h7oHmZd0ilaUkKvYKwyanhfHp-8'
TIMEZONE = timezone.utc  # or your local timezone
local_csv = '/home/lcau/benchmark-aus-2/code/logs/stream_status.csv'

# BOSTON_TZ = pytz.timezone('America/New_York')
SYDNEY_TZ = pytz.timezone('Australia/Sydney')

IMAGE_URL = "https://storage.googleapis.com/benchmark-aus-v2/snapshots/latest_detection_frame.png"
IMAGE_URL_2 = "https://storage.googleapis.com/benchmark-aus-v2/snapshots/latest_detection_skeleton_trained.jpg"

def send_google_chat_message(text, image_url=None):
    if image_url:
        cache_buster = int(time.time())
        image_url_with_cb = f"{image_url}?cb={cache_buster}"
        payload = {
            "text": text,
            "cards": [
                {
                    "sections": [
                        {
                            "widgets": [
                                {"image": {"imageUrl": image_url_with_cb}}
                            ]
                        }
                    ]
                }
            ]
        }
    else:
        payload = {'text': text}
    response = requests.post(GOOGLE_CHAT_WEBHOOK_URL, json=payload)
    if response.status_code != 200:
        print(f"Failed to send message: {response.text}")

def main():
    df = pd.read_csv(local_csv)
    if df.empty:
        send_google_chat_message('No data in CSV!')
        return

    last_row = df.iloc[-1]
    last_time = pd.to_datetime(last_row['timestamp'])
    if last_time.tzinfo is None:
        # Localize to Sydney time
        last_time = SYDNEY_TZ.localize(last_time)
    now = datetime.now(SYDNEY_TZ)

    if (now - last_time).total_seconds() > 30 * 60:
        send_google_chat_message('No new FPS record for the last 30 minutes. FPS is 0.')
        return

    try:
        fps = float(last_row['producer_fps'])
        if fps < 1:
            send_google_chat_message('FPS is lower than 1')
        else:
            send_google_chat_message(f'All good. Current FPS: {fps:.2f}')
            send_google_chat_message("Detection Frame", IMAGE_URL)
            send_google_chat_message("Detection result from last 2 hours", IMAGE_URL_2)
    except Exception as e:
        send_google_chat_message(f'Error parsing FPS: {e}')

if __name__ == '__main__':
    while True:
        main()
        sleep_seconds = 3600
        print(f"Sleeping for {sleep_seconds // 60} minutes...")
        for remaining in range(sleep_seconds, 0, -1):
            mins, secs = divmod(remaining, 60)
            print(f"\rNext check in {mins:02d}:{secs:02d}", end="", flush=True)
            time.sleep(1)
        print()  # Move to next line after countdown
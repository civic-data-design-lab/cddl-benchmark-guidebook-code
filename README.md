# Benchmark: Public Life Sensor Kit

This repository contains the codebase for setting up, training, and running object detection and pose estimation models across video streams connected from a GoPro camera. It utilizes Ultralytics YOLOv8 for running initial baseline models, as well as a pipeline to curate images and create your own custom model.

## Project Structure

The project code is divided systematically across multiple processing steps:

- **`00_gopro_start_stream.py`**: A utility script to initialize and establish a GoPro live stream over Wi-Fi/Bluetooth using the Open GoPro library. It logs connected status and streams media via UDP (Port 8554).
- **`01_test_baseline_model_inference.py`**: Runs a simple detection script applying a pre-trained YOLOv8 baseline model to annotate bounding boxes on the initialized GoPro UDP stream.
- **`02_collect_training_data.py`**: A collection script capturing the active video stream for specified duration windows via FFmpeg. Great for saving slices of live footage to create custom datasets.
- **`03_custom_model_training.ipynb`**: A Jupyter Notebook demonstrating the steps involved in fine-tuning YOLOv8 on your newly collected and labeled dataset.
- **`04_test_custom_model_inference.py`**: Similar to the baseline test script, but configured to load and evaluate the custom model weights generated in the training notebook.
- **`05_coordinates_transformer.py`** & **`06_test_coordinates_transformer.py`**: Logic implementation for translating frame pixel coordinates into localized geographic coordinates for spatial analysis tools.
- **`07_run_inference.py`**: The comprehensive main inference script. This file asynchronously runs three YOLO trackers (for benches, pedestrians, and sitting individuals). Features include evaluating bounding boxes, human keypoints tracking/midpoint associations, mapping to an external coordinate grid (GeoPandas), and persistently saving detections into segmented `GeoJSON` logging structures under corresponding identifiers.

## Getting Started

1. **Environment Setup:** A Conda environment file (`environment.yml`) is included for easy dependency management. Create and activate the environment using:
   ```bash
   conda env create -f environment.yml
   conda activate benchmark
   ```
2. **Connect the Camera:** Ensure your GoPro camera is powered on with its wireless connection modes enabled. Run `00_gopro_start_stream.py` to establish the connection and discover the stream address (e.g., `udp://@0.0.0.0:8554`).
3. **Setup Dependencies:** If not using Conda, review the code imports and ensure you have core ML/Vision libraries installed, particularly `ultralytics`, `opencv-python` (`cv2`), `geopandas`, and `shapely`.
4. **Data Collection (Optional):** Record stream segments with `02_collect_training_data.py` if you wish to build onto the baseline models.
5. **Primary Inference:** Edit your `grid_path` and `modelpath` pointers within `07_run_inference.py` based on your specific layout parameters, then execute the script to start recording structured GeoJSON output arrays on detecting specific interactions over time.

## Data Output

If executing the `07_run_inference.py` pipeline, localized detections map directly to the defined directory structured per-class (e.g., `./bench/`, `./ped/`, `./sitting/`) alongside their corresponding coordinate features serialized directly to GeoJSON files for downstream geospatial analysis or database storage.

import json
import numpy as np

# Load the JSON data
origin_grid = 'origin_grids.json'
target_grid = 'target_grids.geojson'

# Load the geojson files
with open(origin_grid, 'r') as file:
    origin_grid_data = json.load(file)

with open(target_grid, 'r') as file:
    target_grid_data = json.load(file)

# Function to extract grid coordinates by grid_id
def get_grid_coordinates_from_json(data, grid_id):
    for grid in data:
        if grid['grid_id'] == grid_id:
            return grid['corners']
    return None

# Function to extract grid coordinates by grid_id from geojson
def get_grid_coordinates_from_geojson(geojson, grid_id):
    for feature in geojson['features']:
        if feature['properties']['grid_id'] == grid_id:
            return feature['geometry']['coordinates'][0]
    return None

def compute_perspective_transform(src, dst):
    assert src.shape == (4, 2)
    assert dst.shape == (4, 2)

    A = []
    B = []

    for i in range(4):
        x, y = src[i][0], src[i][1]
        u, v = dst[i][0], dst[i][1]
        A.append([x, y, 1, 0, 0, 0, -u*x, -u*y])
        A.append([0, 0, 0, x, y, 1, -v*x, -v*y])
        B.append(u)
        B.append(v)

    A = np.array(A, dtype=np.float64)
    B = np.array(B, dtype=np.float64)

    H = np.linalg.solve(A, B)
    H = np.append(H, 1).reshape((3, 3))
    return H

# Dictionary to store transformation matrices and transformed polygons
transformation_matrices = {}
transformed_polygons = []

# Iterate through each grid feature in plan_grid_data
for grid in origin_grid_data:
    grid_id = grid['grid_id']
    origin_grid_coords = get_grid_coordinates_from_json(origin_grid_data, grid_id)
    target_grid_coords = get_grid_coordinates_from_geojson(target_grid_data, grid_id)

    if grid_coords is None or target_grid_coords is None:
        print(f"Skipping {grid_id} due to missing coordinates.")
        continue

    # Convert to numpy arrays with high precision
    src_pts = np.array(origin_grid_coords, dtype=np.float64)
    dst_pts = np.array(target_grid_coords[:-1], dtype=np.float64)

    # Compute the perspective transformation matrix
    M = compute_perspective_transform(src_pts, dst_pts)

    # Store the matrix in the dictionary
    transformation_matrices[grid_id] = M.tolist()  # Convert to list for JSON serialization

    # Apply the transformation to the source points to verify
    src_pts_homogeneous = np.hstack([src_pts, np.ones((4, 1), dtype=np.float64)])
    transformed_src_pts_homogeneous = src_pts_homogeneous @ M.T
    transformed_src_pts = (transformed_src_pts_homogeneous[:, :2].T / transformed_src_pts_homogeneous[:, 2]).T

    # Print debug information
    print(f"Grid ID: {grid_id}")
    print("Source Points (plan_grid_corners.json):")
    print(src_pts)
    print("Destination Points (map_grid.geojson):")
    print(dst_pts)
    print("Transformation Matrix:")
    print(M)
    print("Transformed Source Points:")
    print(transformed_src_pts)
    print("Difference (Transformed - Destination):")
    print(transformed_src_pts - dst_pts)
    print()

    # Create a new polygon feature with the transformed source points
    transformed_polygon = {
        "type": "Feature",
        "properties": {
            "grid_id": grid_id
        },
        "geometry": {
            "type": "Polygon",
            "coordinates": [transformed_src_pts.tolist() + [transformed_src_pts.tolist()[0]]]  # Close the polygon by repeating the first point
        }
    }
    transformed_polygons.append(transformed_polygon)

# Create a new GeoJSON feature collection for the transformed polygons
transformed_geojson = {
    "type": "FeatureCollection",
    "features": transformed_polygons
}

# Save the transformation matrices and transformed polygons to JSON files
with open('transformation_matrices.json', 'w') as outfile:
    json.dump(transformation_matrices, outfile, indent=4)


print("Transformation matrices saved to transformation_matrices.json")
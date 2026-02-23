import json
import numpy as np

# Load the transformation matrices
transformation_matrices = 'transformation_matrices.json'
with open(transformation_matrices, 'r') as file:
    transformation_matrices = json.load(file)

# Load the GeoJSON points file
points_geojson = 'detection_point_data.geojson'
with open(points_geojson, 'r') as file:
    points_geojson = json.load(file)

# Function to apply transformation matrix to a point
def apply_transformation(matrix, point):
    point_homogeneous = np.array([point[0], point[1], 1], dtype=np.float64)
    transformed_point_homogeneous = point_homogeneous @ matrix.T
    transformed_point = (transformed_point_homogeneous[:2] / transformed_point_homogeneous[2]).tolist()
    return transformed_point

# Iterate through each point feature in the GeoJSON file and apply the transformation
transformed_features = []
for feature in points_geojson['features']:
    grid_id = feature['properties'].get('gridId')
    if grid_id and grid_id in transformation_matrices:
        matrix = np.array(transformation_matrices[grid_id], dtype=np.float64)
        original_point = feature['geometry']['coordinates']
        transformed_point = apply_transformation(matrix, original_point)

        # Create a new feature with the transformed point
        transformed_feature = {
            "type": "Feature",
            "properties": feature['properties'],
            "geometry": {
                "type": "Point",
                "coordinates": transformed_point
            }
        }
        transformed_features.append(transformed_feature)

# Create a new GeoJSON feature collection for the transformed points
transformed_points_geojson = {
    "type": "FeatureCollection",
    "features": transformed_features
}

# Save the transformed points to a new GeoJSON file
transformed_points_geojson = 'lat_lon_data.geojson'
with open(transformed_points_geojson, 'w') as outfile:
    json.dump(transformed_points_geojson, outfile, indent=4)

print(f"Transformed points saved to {transformed_points_geojson}")
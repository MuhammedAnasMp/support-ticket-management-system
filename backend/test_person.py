from huggingface_hub import hf_hub_download
from ultralytics import YOLO
from PIL import Image

# Face detection model
model_path = hf_hub_download(
    repo_id="arnabdhar/YOLOv8-Face-Detection",
    filename="model.pt"
)

model = YOLO(model_path)


def validate_human_photo(image_path):

    image = Image.open(image_path).convert("RGB")
    width, height = image.size

    results = model(
        image,
        conf=0.35,
        imgsz=1280,
        verbose=False
    )

    if not results:
        return False, "No face detected"

    boxes = results[0].boxes

    if boxes is None or len(boxes) == 0:
        return False, "No face detected"

    # Must have exactly ONE clear face
    if len(boxes) != 1:
        return False, f"Multiple faces detected: {len(boxes)}"

    box = boxes[0]

    x1, y1, x2, y2 = box.xyxy[0].tolist()

    face_width = x2 - x1
    face_height = y2 - y1

    # -----------------------------------------
    # Face size relative to image
    # -----------------------------------------

    face_height_ratio = face_height / height
    face_width_ratio = face_width / width

    # Too small = probably a scene/photo containing
    # a person rather than a human portrait
    if face_height_ratio < 0.20:
        return False, "Face is too small"

    # Extremely close-up
    if face_height_ratio > 0.75:
        return False, "Face is too large"

    # -----------------------------------------
    # Face position
    # -----------------------------------------

    face_center_x = (x1 + x2) / 2
    face_center_y = (y1 + y2) / 2

    center_x_ratio = face_center_x / width
    center_y_ratio = face_center_y / height

    # Person should generally be in the middle area
    if center_x_ratio < 0.20 or center_x_ratio > 0.80:
        return False, "Face is too far left/right"

    if center_y_ratio < 0.10 or center_y_ratio > 0.75:
        return False, "Face is too far top/bottom"

    # -----------------------------------------
    # Face confidence
    # -----------------------------------------

    confidence = float(box.conf[0])

    if confidence < 0.35:
        return False, "Face confidence too low"

    return True, "Valid human portrait"


# Test
if __name__ == "__main__":
    valid, reason = validate_human_photo("1.png")
    print("VALID:", valid)
    print("REASON:", reason)

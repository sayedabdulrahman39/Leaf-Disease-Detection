from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import numpy as np
import tensorflow as tf
import json, io, os

app = Flask(__name__)
CORS(app)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "leaf_model.h5")
LABELS_PATH = os.path.join(os.path.dirname(__file__), "class_names.json")

model = tf.keras.models.load_model(MODEL_PATH)

with open(LABELS_PATH, "r") as f:
    CLASS_NAMES = json.load(f)

print("Model & Class Names Loaded ✔")

# REAL FIX — SAME PREPROCESSING
preprocess = tf.keras.applications.mobilenet_v2.preprocess_input


@app.route('/predict', methods=['POST'])
def predict():
    if 'image' not in request.files:
        return jsonify({'error': 'No image found'}), 400

    file = request.files['image']

    img = Image.open(io.BytesIO(file.read())).convert("RGB")
    img = img.resize((224, 224))

    img_array = np.array(img)
    img_array = preprocess(img_array)     
    img_array = np.expand_dims(img_array, axis=0)

    preds = model.predict(img_array)
    index = int(np.argmax(preds))
    confidence = float(np.max(preds))
    result = CLASS_NAMES[index]

    return jsonify({
        'class': result,
        'confidence': round(confidence, 4)
    })


@app.route('/')
def home():
    return "Tomato Disease API Running"
    

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)

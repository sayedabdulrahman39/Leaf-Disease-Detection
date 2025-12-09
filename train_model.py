import tensorflow as tf
from tensorflow.keras.preprocessing import image_dataset_from_directory
from tensorflow.keras import layers, models
import os, json

# Paths
ROOT = os.path.dirname(__file__)
DATA_DIR = os.path.normpath(os.path.join(ROOT, "../data/Tomato"))
MODEL_PATH = os.path.join(ROOT, "leaf_model.h5")
LABELS_PATH = os.path.join(ROOT, "class_names.json")

IMG_SIZE = (224, 224)
BATCH_SIZE = 16
EPOCHS = 5

print("\n========================================")
print("📂 Dataset:", DATA_DIR)
print("========================================\n")

train_ds = image_dataset_from_directory(
    DATA_DIR,
    validation_split=0.2,
    subset="training",
    seed=123,
    image_size=IMG_SIZE,
    batch_size=BATCH_SIZE
)
val_ds = image_dataset_from_directory(
    DATA_DIR,
    validation_split=0.2,
    subset="validation",
    seed=123,
    image_size=IMG_SIZE,
    batch_size=BATCH_SIZE
)

class_names = train_ds.class_names
print("Detected Classes:", class_names)

# ⚠️ THE REAL FIX — SAME PREPROCESSING AS MobileNetV2
preprocess = tf.keras.applications.mobilenet_v2.preprocess_input

AUTOTUNE = tf.data.AUTOTUNE
train_ds = train_ds.map(lambda x, y: (preprocess(x), y)).cache().shuffle(1000).prefetch(AUTOTUNE)
val_ds = val_ds.map(lambda x, y: (preprocess(x), y)).cache().prefetch(AUTOTUNE)

# Build model
base_model = tf.keras.applications.MobileNetV2(
    input_shape=IMG_SIZE + (3,),
    include_top=False,
    weights='imagenet'
)
base_model.trainable = False

model = models.Sequential([
    base_model,
    layers.GlobalAveragePooling2D(),
    layers.Dropout(0.2),
    layers.Dense(128, activation='relu'),
    layers.Dense(len(class_names), activation='softmax')
])

model.compile(
    optimizer='adam',
    loss='sparse_categorical_crossentropy',
    metrics=['accuracy']
)

print("\n🚀 Training Started...\n")
model.fit(train_ds, validation_data=val_ds, epochs=EPOCHS)

# Save
model.save(MODEL_PATH)
with open(LABELS_PATH, "w") as f:
    json.dump(class_names, f)

print("\n=================================================")
print("Model saved:", MODEL_PATH)
print("Labels saved:", LABELS_PATH)
print("=================================================\n")

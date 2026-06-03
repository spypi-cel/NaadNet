import tensorflow as tf

from tensorflow.keras import layers

def transformer_model():

    inputs = layers.Input(
        shape=(100,1)
    )

    x = layers.MultiHeadAttention(
        num_heads=4,
        key_dim=64
    )(inputs,inputs)

    x = layers.GlobalAveragePooling1D()(x)

    outputs = layers.Dense(1)(x)

    model = tf.keras.Model(
        inputs,
        outputs
    )

    return model

model = transformer_model()

model.compile(
    optimizer="adam",
    loss="mse"
)

model.save(
    "../models/transformer_prediction.h5"
)
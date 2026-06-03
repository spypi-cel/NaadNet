import numpy as np

from tensorflow.keras.models import load_model

model = load_model(
    "../models/lstm_prediction.h5"
)

def forecast(values):

    data = np.array(values)

    data = data.reshape(
        1,
        len(values),
        1
    )

    prediction = model.predict(data)

    return float(prediction[0][0])
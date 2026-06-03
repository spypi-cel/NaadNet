import numpy as np
import pandas as pd

from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM
from tensorflow.keras.layers import Dense

data = pd.read_csv(
    "noise_history.csv"
)

values = data["noise"].values

X = []
y = []

window = 10

for i in range(
    len(values)-window
):

    X.append(
        values[i:i+window]
    )

    y.append(
        values[i+window]
    )

X = np.array(X)

y = np.array(y)

X = X.reshape(
    X.shape[0],
    X.shape[1],
    1
)

model = Sequential()

model.add(
    LSTM(
        64,
        input_shape=(window,1)
    )
)

model.add(Dense(1))

model.compile(
    optimizer="adam",
    loss="mse"
)

model.fit(
    X,
    y,
    epochs=20
)

model.save(
    "../models/lstm_prediction.h5"
)
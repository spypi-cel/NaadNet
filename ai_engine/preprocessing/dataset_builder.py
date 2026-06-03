import os
import pandas as pd

def build_dataset(path):

    data = []

    for root, dirs, files in os.walk(path):

        for file in files:

            if file.endswith(".wav"):

                data.append(
                    {
                        "file":
                        os.path.join(root,file)
                    }
                )

    return pd.DataFrame(data)
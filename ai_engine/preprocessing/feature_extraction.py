import librosa
import numpy as np

def extract_features(audio_file):

    signal, sr = librosa.load(
        audio_file,
        sr=22050
    )

    mfcc = librosa.feature.mfcc(
        y=signal,
        sr=sr,
        n_mfcc=40
    )

    feature = np.mean(
        mfcc.T,
        axis=0
    )

    return feature
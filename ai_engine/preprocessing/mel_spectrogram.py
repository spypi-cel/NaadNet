import librosa
import librosa.display
import matplotlib.pyplot as plt

def create_mel_spectrogram(audio_file):

    y, sr = librosa.load(audio_file)

    mel = librosa.feature.melspectrogram(
        y=y,
        sr=sr
    )

    db = librosa.power_to_db(
        mel,
        ref=np.max
    )

    plt.figure(figsize=(10,4))

    librosa.display.specshow(
        db,
        sr=sr,
        x_axis='time',
        y_axis='mel'
    )

    plt.colorbar()

    plt.show()
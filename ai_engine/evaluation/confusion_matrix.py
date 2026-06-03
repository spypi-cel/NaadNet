from sklearn.metrics import confusion_matrix
import seaborn as sns
import matplotlib.pyplot as plt

def plot_cm(y_true,y_pred):

    cm = confusion_matrix(
        y_true,
        y_pred
    )

    sns.heatmap(
        cm,
        annot=True,
        fmt="d"
    )

    plt.show()
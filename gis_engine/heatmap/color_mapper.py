class ColorMapper:

    @staticmethod
    def get_color(noise):

        if noise < 30:
            return "#0000FF"

        elif noise < 50:
            return "#00FF00"

        elif noise < 70:
            return "#FFFF00"

        elif noise < 85:
            return "#FFA500"

        return "#FF0000"
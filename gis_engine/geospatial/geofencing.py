from shapely.geometry import Point
from shapely.geometry import Polygon

class GeoFence:

    @staticmethod
    def inside(point, polygon_points):

        polygon = Polygon(
            polygon_points
        )

        p = Point(
            point["lng"],
            point["lat"]
        )

        return polygon.contains(p)
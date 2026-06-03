def detect_hotspots(nodes):

    hotspots = []

    for node in nodes:

        if node["noise"] > 80:

            hotspots.append(node)

    return hotspots
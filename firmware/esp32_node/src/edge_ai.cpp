#include "edge_ai.h"
#include <math.h>

EdgeAI::EdgeAI() {
    _centroids[NOISE_TRAFFIC][0] = 0.25f; _centroids[NOISE_TRAFFIC][1] = 0.45f;
    _centroids[NOISE_TRAFFIC][2] = 0.20f; _centroids[NOISE_TRAFFIC][3] = 0.10f;

    _centroids[NOISE_CONSTRUCTION][0] = 0.40f; _centroids[NOISE_CONSTRUCTION][1] = 0.35f;
    _centroids[NOISE_CONSTRUCTION][2] = 0.15f; _centroids[NOISE_CONSTRUCTION][3] = 0.10f;

    _centroids[NOISE_INDUSTRIAL][0] = 0.50f; _centroids[NOISE_INDUSTRIAL][1] = 0.25f;
    _centroids[NOISE_INDUSTRIAL][2] = 0.15f; _centroids[NOISE_INDUSTRIAL][3] = 0.10f;

    _centroids[NOISE_PEOPLE][0] = 0.05f; _centroids[NOISE_PEOPLE][1] = 0.20f;
    _centroids[NOISE_PEOPLE][2] = 0.50f; _centroids[NOISE_PEOPLE][3] = 0.25f;

    _centroids[NOISE_NATURE][0] = 0.10f; _centroids[NOISE_NATURE][1] = 0.15f;
    _centroids[NOISE_NATURE][2] = 0.30f; _centroids[NOISE_NATURE][3] = 0.45f;
}

float EdgeAI::computeDistance(const float *features, NoiseSource source) {
    float dist = 0;
    for (int i = 0; i < NUM_BANDS; i++) {
        float diff = features[i] - _centroids[source][i];
        dist += diff * diff;
    }
    return sqrt(dist);
}

ClassificationResult EdgeAI::classify(const SpectralBands &bands, float totalDb) {
    ClassificationResult result;
    result.source = NOISE_UNKNOWN;
    result.label = "Unknown";
    result.confidence = 0;

    float features[NUM_BANDS] = {bands.low, bands.mid_low, bands.mid_high, bands.high};

    float bestDist = 999.0f;
    float totalInvDist = 0;
    float invDists[NUM_NOISE_CLASSES - 1];

    for (int i = 0; i < NUM_NOISE_CLASSES - 1; i++) {
        float dist = computeDistance(features, (NoiseSource)i);
        float invDist = 1.0f / (dist + 0.001f);
        invDists[i] = invDist;
        totalInvDist += invDist;

        if (dist < bestDist) {
            bestDist = dist;
            result.source = (NoiseSource)i;
        }
    }

    if (totalDb < 40.0f) {
        result.source = NOISE_NATURE;
        result.label = "Quiet / Nature";
        result.confidence = 0.8f;
        return result;
    }

    result.label = sourceLabel(result.source);
    result.confidence = totalInvDist > 0 ? invDists[result.source] / totalInvDist : 0;

    if (result.confidence < 0.3f) {
        result.source = NOISE_UNKNOWN;
        result.label = "Mixed";
        result.confidence = 1.0f - result.confidence;
    }

    return result;
}

const char* EdgeAI::sourceLabel(NoiseSource source) {
    switch (source) {
        case NOISE_TRAFFIC:     return "Traffic";
        case NOISE_CONSTRUCTION: return "Construction";
        case NOISE_INDUSTRIAL:  return "Industrial";
        case NOISE_PEOPLE:      return "People / Crowd";
        case NOISE_NATURE:      return "Nature / Wind";
        default:                return "Unknown";
    }
}

float EdgeAI::getSourceConfidence(NoiseSource source) {
    (void)source;
    return 0;
}

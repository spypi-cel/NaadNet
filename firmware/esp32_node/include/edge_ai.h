#ifndef EDGE_AI_H
#define EDGE_AI_H

#include <Arduino.h>
#include "fft_processor.h"

#define NUM_NOISE_CLASSES 6

enum NoiseSource {
    NOISE_TRAFFIC = 0,
    NOISE_CONSTRUCTION,
    NOISE_INDUSTRIAL,
    NOISE_PEOPLE,
    NOISE_NATURE,
    NOISE_UNKNOWN
};

struct ClassificationResult {
    NoiseSource source;
    const char* label;
    float confidence;
};

class EdgeAI {
public:
    EdgeAI();
    ClassificationResult classify(const SpectralBands &bands, float totalDb);
    const char* sourceLabel(NoiseSource source);
    float getSourceConfidence(NoiseSource source);

private:
    float _centroids[NUM_NOISE_CLASSES - 1][NUM_BANDS];
    float computeDistance(const float *features, NoiseSource source);
};

#endif

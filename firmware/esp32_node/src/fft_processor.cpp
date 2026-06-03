#include "fft_processor.h"
#include "config.h"
#include <math.h>

FFTProcessor::FFTProcessor() : _fft(), _initialized(false) {
    memset(_real, 0, sizeof(_real));
    memset(_imag, 0, sizeof(_imag));
    memset(_magnitudes, 0, sizeof(_magnitudes));
}

void FFTProcessor::begin() {
    _initialized = true;
}

void FFTProcessor::sampleAudio(uint16_t *rawSamples, size_t count) {
    size_t n = min(count, (size_t)FFT_SAMPLES);
    for (size_t i = 0; i < n; i++) {
        _real[i] = (double)((int)rawSamples[i] - 2048);
        _imag[i] = 0.0;
    }
    for (size_t i = n; i < FFT_SAMPLES; i++) {
        _real[i] = 0.0;
        _imag[i] = 0.0;
    }
}

SpectralBands FFTProcessor::computeBands(uint16_t *rawSamples, size_t count) {
    SpectralBands bands = {0, 0, 0, 0};

    sampleAudio(rawSamples, count);

    _fft.windowing(_real, FFT_SAMPLES, FFT_WIN_TYP_HAMMING, FFT_FORWARD);
    _fft.compute(_real, _imag, FFT_SAMPLES, FFT_FORWARD);
    _fft.complexToMagnitude(_real, _imag, FFT_SAMPLES);

    size_t half = FFT_SAMPLES / 2;
    float binWidth = (float)FFT_SAMPLING_FREQ / FFT_SAMPLES;

    for (size_t i = 1; i < half; i++) {
        float freq = i * binWidth;
        float mag = (float)_real[i];
        _magnitudes[i] = mag;

        if (freq < 250.0f) {
            bands.low += mag;
        } else if (freq < 1000.0f) {
            bands.mid_low += mag;
        } else if (freq < 4000.0f) {
            bands.mid_high += mag;
        } else {
            bands.high += mag;
        }
    }
    _magnitudes[0] = 0;

    float total = bands.low + bands.mid_low + bands.mid_high + bands.high;
    if (total > 0) {
        bands.low /= total;
        bands.mid_low /= total;
        bands.mid_high /= total;
        bands.high /= total;
    }

    return bands;
}

float* FFTProcessor::getSpectrum() {
    return _magnitudes;
}

size_t FFTProcessor::getSpectrumSize() {
    return FFT_SAMPLES / 2;
}

float FFTProcessor::getTotalEnergy() {
    float sum = 0;
    for (size_t i = 0; i < FFT_SAMPLES / 2; i++) {
        sum += _magnitudes[i];
    }
    return sum;
}

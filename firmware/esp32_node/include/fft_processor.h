#ifndef FFT_PROCESSOR_H
#define FFT_PROCESSOR_H

#include <Arduino.h>
#include "arduinoFFT.h"

#define FFT_SAMPLES     256
#define FFT_SAMPLING_FREQ 8000

#define BAND_LOW        1
#define BAND_MID_LOW    2
#define BAND_MID_HIGH   3
#define BAND_HIGH       4
#define NUM_BANDS       4

struct SpectralBands {
    float low;          // 31-250 Hz
    float mid_low;      // 250-1000 Hz
    float mid_high;     // 1000-4000 Hz
    float high;         // 4000+ Hz
};

class FFTProcessor {
public:
    FFTProcessor();
    void begin();
    void sampleAudio(uint16_t *rawSamples, size_t count);
    SpectralBands computeBands(uint16_t *rawSamples, size_t count);
    float* getSpectrum();
    size_t getSpectrumSize();
    float getTotalEnergy();

private:
    double _real[FFT_SAMPLES];
    double _imag[FFT_SAMPLES];
    float _magnitudes[FFT_SAMPLES / 2];
    arduinoFFT _fft;
    bool _initialized;
};

#endif

#ifndef SOUND_SENSOR_H
#define SOUND_SENSOR_H

#include <Arduino.h>

class SoundSensor {
public:
    SoundSensor(uint8_t pin);
    void begin();
    float readNoiseDB();          // Returns dB SPL (A-weighted approx)
    float readPeakDB();           // Returns peak dB
    float readBatteryMV();        // Returns battery voltage in mV
    void calibrate();             // Auto-calibrate silent floor

private:
    uint8_t _pin;
    uint8_t _batPin;
    float _floor;
    float rmsBlock(uint16_t samples[], size_t n);
    float dbSPL(float voltage_mV, float sensitivity);
};

#endif

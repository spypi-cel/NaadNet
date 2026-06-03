#include "sound_sensor.h"
#include "config.h"
#include <driver/adc.h>
#include <esp_adc_cal.h>

SoundSensor::SoundSensor(uint8_t pin) : _pin(pin), _batPin(BATTERY_PIN), _floor(SILENT_FLOOR) {}

void SoundSensor::begin() {
    adc1_config_width(ADC_WIDTH_12Bit);
    adc1_config_channel_atten((adc1_channel_t)digitalPinToAnalogChannel(_pin), ADC_ATTEN_DB_11);
    adc1_config_channel_atten((adc1_channel_t)digitalPinToAnalogChannel(_batPin), ADC_ATTEN_DB_11);

    pinMode(BATTERY_ENABLE, OUTPUT);
    digitalWrite(BATTERY_ENABLE, LOW);

    calibrate();
}

void SoundSensor::calibrate() {
    const int calSamples = 100;
    uint16_t samples[calSamples];
    for (int i = 0; i < calSamples; i++) {
        samples[i] = adc1_get_raw((adc1_channel_t)digitalPinToAnalogChannel(_pin));
        delay(10);
    }

    float sum = 0;
    for (int i = 0; i < calSamples; i++) {
        sum += samples[i] * samples[i];
    }
    float rms_raw = sqrt(sum / calSamples);
    float voltage_mV = (rms_raw / ADC_MAX) * V_REF * 1000.0f;
    _floor = voltage_mV + 0.5f;
}

float SoundSensor::rmsBlock(uint16_t samples[], size_t n) {
    float sum = 0;
    for (size_t i = 0; i < n; i++) {
        float centered = samples[i] - (ADC_MAX / 2);
        sum += centered * centered;
    }
    return sqrt(sum / n);
}

float SoundSensor::dbSPL(float voltage_mV, float sensitivity) {
    float pressure_Pa = voltage_mV / (sensitivity * 1000.0f);
    if (pressure_Pa <= 0) return 30.0f;
    float db = 20 * log10(pressure_Pa / 0.00002f);
    return constrain(db, 30.0f, 120.0f);
}

float SoundSensor::readNoiseDB() {
    uint16_t samples[WINDOW_SIZE];
    for (int i = 0; i < WINDOW_SIZE; i++) {
        samples[i] = adc1_get_raw((adc1_channel_t)digitalPinToAnalogChannel(_pin));
        delayMicroseconds(100);
    }

    float rms_adc = rmsBlock(samples, WINDOW_SIZE);
    float voltage_mV = (rms_adc / ADC_MAX) * V_REF * 1000.0f;

    if (voltage_mV < _floor) return 30.0f;

    float signal_mV = voltage_mV - _floor;
    float db = dbSPL(signal_mV, MIC_SENSITIVITY);

    return round(db * 10) / 10;
}

float SoundSensor::readPeakDB() {
    float peak = 0;
    for (int i = 0; i < WINDOW_SIZE; i++) {
        uint16_t raw = adc1_get_raw((adc1_channel_t)digitalPinToAnalogChannel(_pin));
        float centered = abs((float)raw - ADC_MAX / 2);
        if (centered > peak) peak = centered;
        delayMicroseconds(100);
    }

    float voltage_mV = (peak / ADC_MAX) * V_REF * 1000.0f;
    if (voltage_mV < _floor) return 30.0f;
    return dbSPL(voltage_mV - _floor, MIC_SENSITIVITY);
}

float SoundSensor::readBatteryMV() {
    digitalWrite(BATTERY_ENABLE, HIGH);
    delay(5);

    uint32_t raw = 0;
    for (int i = 0; i < 10; i++) {
        raw += adc1_get_raw((adc1_channel_t)digitalPinToAnalogChannel(_batPin));
        delay(2);
    }
    raw /= 10;

    digitalWrite(BATTERY_ENABLE, LOW);

    esp_adc_cal_characteristics_t chars;
    esp_adc_cal_characterize(ADC_UNIT_1, ADC_ATTEN_DB_11, ADC_WIDTH_BIT_12, 1100, &chars);
    uint32_t voltage_mV = esp_adc_cal_raw_to_voltage(raw, &chars);

    return voltage_mV * 2;
}

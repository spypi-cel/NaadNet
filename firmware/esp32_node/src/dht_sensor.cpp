#include "dht_sensor.h"
#include "config.h"

DhtSensor::DhtSensor(uint8_t pin)
    : _pin(pin), _dht(pin, DHT_TYPE), _lastTemp(0), _lastHum(0), _lastRead(0), _initialized(false) {}

void DhtSensor::begin() {
    _dht.begin();
    delay(1000);
    float t = _dht.readTemperature();
    float h = _dht.readHumidity();
    if (!isnan(t) && !isnan(h)) {
        _lastTemp = t;
        _lastHum = h;
        _initialized = true;
        Serial.printf("[DHT11] OK - %.1f C, %.1f %%\n", t, h);
    } else {
        Serial.println("[DHT11] FAIL - check wiring");
    }
}

bool DhtSensor::read(float &temperature, float &humidity) {
    unsigned long now = millis();
    if (now - _lastRead < 2000) {
        temperature = _lastTemp;
        humidity = _lastHum;
        return _initialized;
    }
    _lastRead = now;
    float t = _dht.readTemperature();
    float h = _dht.readHumidity();
    if (!isnan(t) && !isnan(h)) {
        _lastTemp = t;
        _lastHum = h;
        _initialized = true;
    }
    temperature = _lastTemp;
    humidity = _lastHum;
    return _initialized;
}

float DhtSensor::readTemperature() {
    float t, h;
    read(t, h);
    return t;
}

float DhtSensor::readHumidity() {
    float t, h;
    read(t, h);
    return h;
}

bool DhtSensor::isConnected() {
    return _initialized;
}

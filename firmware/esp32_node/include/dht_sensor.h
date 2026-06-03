#ifndef DHT_SENSOR_H
#define DHT_SENSOR_H

#include <Arduino.h>
#include <DHT.h>

class DhtSensor {
public:
    DhtSensor(uint8_t pin);
    void begin();
    bool read(float &temperature, float &humidity);
    float readTemperature();
    float readHumidity();
    bool isConnected();

private:
    uint8_t _pin;
    DHT _dht;
    float _lastTemp;
    float _lastHum;
    unsigned long _lastRead;
    bool _initialized;
};

#endif

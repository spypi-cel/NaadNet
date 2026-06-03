#ifndef MQTT_CLIENT_H
#define MQTT_CLIENT_H

#include <Arduino.h>
#include <PubSubClient.h>
#include <WiFiClient.h>

class MqttClient {
public:
    MqttClient(Client& client);
    void begin();
    bool connect();
    void loop();
    bool publishNoise(float db, float peakDb, float batteryMV);
    bool publishSensorData(float db, float peakDb, float batteryMV, float temperature, float humidity, const char* noiseSource = "", float sourceConfidence = 0);
    bool publishStatus(const char* status);
    bool isConnected() { return _pubSub.connected(); }

private:
    Client& _client;
    PubSubClient _pubSub;
    void callback(char* topic, byte* payload, unsigned int len);
};

#endif

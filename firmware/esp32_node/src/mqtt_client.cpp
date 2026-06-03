#include "mqtt_client.h"
#include "config.h"
#include <ArduinoJson.h>

MqttClient::MqttClient(Client& client) : _client(client), _pubSub(client) {}

void MqttClient::begin() {
    _pubSub.setServer(MQTT_BROKER, MQTT_PORT);
    _pubSub.setCallback([this](char* topic, byte* payload, unsigned int len) {
        this->callback(topic, payload, len);
    });
    connect();
}

bool MqttClient::connect() {
    String willTopic = String(MQTT_TOPIC_PREFIX) + "/" + NODE_ID + "/status";

    if (_pubSub.connect(MQTT_CLIENT_ID, willTopic.c_str(), 1, true, "offline")) {
        Serial.printf("[MQTT] Connected as %s\n", MQTT_CLIENT_ID);

        String subTopic = String(MQTT_TOPIC_PREFIX) + "/" + NODE_ID + "/cmd";
        _pubSub.subscribe(subTopic.c_str());

        publishStatus("online");
        return true;
    }

    Serial.printf("[MQTT] Failed, rc=%d\n", _pubSub.state());
    return false;
}

void MqttClient::loop() {
    if (!_pubSub.connected()) {
        if (connect()) {
            Serial.println("[MQTT] Reconnected");
        }
    }
    _pubSub.loop();
}

bool MqttClient::publishNoise(float db, float peakDb, float batteryMV) {
    StaticJsonDocument<256> doc;
    doc["node_id"] = NODE_ID;
    doc["noise"] = db;
    doc["peak_db"] = peakDb;
    doc["battery"] = (int)round((batteryMV - BAT_ADC_MIN) / (BAT_ADC_MAX - BAT_ADC_MIN) * 100);
    doc["status"] = db > NOISE_THRESHOLD ? "warning" : "online";
    doc["ts"] = millis();

    String topic = String(MQTT_TOPIC_PREFIX) + "/" + NODE_ID + "/noise";
    String payload;
    serializeJson(doc, payload);

    return _pubSub.publish(topic.c_str(), payload.c_str(), true);
}

bool MqttClient::publishSensorData(float db, float peakDb, float batteryMV, float temperature, float humidity, const char* noiseSource, float sourceConfidence) {
    StaticJsonDocument<512> doc;
    doc["node_id"] = NODE_ID;
    doc["noise_db"] = round(db * 10) / 10;
    doc["peak_db"] = round(peakDb * 10) / 10;
    doc["temperature"] = round(temperature * 10) / 10;
    doc["humidity"] = round(humidity * 10) / 10;
    doc["battery"] = (int)round((batteryMV - BAT_ADC_MIN) / (BAT_ADC_MAX - BAT_ADC_MIN) * 100);
    doc["battery_mv"] = (int)batteryMV;
    doc["status"] = db > NOISE_THRESHOLD ? "warning" : "online";
    doc["firmware"] = FIRMWARE_VERSION;
    doc["noise_source"] = noiseSource;
    doc["source_conf"] = round(sourceConfidence * 100) / 100;
    doc["ts"] = millis();

    String topic = String(MQTT_TOPIC_PREFIX) + "/" + NODE_ID + "/sensor";
    String payload;
    serializeJson(doc, payload);

    return _pubSub.publish(topic.c_str(), payload.c_str(), true);
}

bool MqttClient::publishStatus(const char* status) {
    StaticJsonDocument<128> doc;
    doc["node_id"] = NODE_ID;
    doc["status"] = status;
    doc["firmware"] = FIRMWARE_VERSION;

    String topic = String(MQTT_TOPIC_PREFIX) + "/" + NODE_ID + "/status";
    String payload;
    serializeJson(doc, payload);

    return _pubSub.publish(topic.c_str(), payload.c_str(), true);
}

void MqttClient::callback(char* topic, byte* payload, unsigned int len) {
    char buf[256];
    memcpy(buf, payload, min(len, (unsigned int)255));
    buf[min(len, (unsigned int)255)] = 0;

    StaticJsonDocument<128> doc;
    DeserializationError err = deserializeJson(doc, buf);

    if (err) {
        Serial.printf("[MQTT] JSON parse error: %s\n", err.c_str());
        return;
    }

    const char* command = doc["command"] | "";
    if (strcmp(command, "reboot") == 0) {
        Serial.println("[MQTT] Reboot command received");
        ESP.restart();
    } else if (strcmp(command, "calibrate") == 0) {
        Serial.println("[MQTT] Calibrate command received");
    } else if (strcmp(command, "status") == 0) {
        publishStatus("online");
    }
}

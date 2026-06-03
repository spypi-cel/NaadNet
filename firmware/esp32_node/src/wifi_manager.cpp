#include "wifi_manager.h"

WiFiManager::WiFiManager(const char* ssid, const char* password)
    : _ssid(ssid), _password(password) {}

bool WiFiManager::connect(int timeout_ms) {
    Serial.printf("[WiFi] Connecting to %s...\n", _ssid);
    WiFi.mode(WIFI_STA);
    WiFi.begin(_ssid, _password);

    int elapsed = 0;
    while (WiFi.status() != WL_CONNECTED && elapsed < timeout_ms) {
        delay(100);
        elapsed += 100;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("[WiFi] Connected, IP: %s, RSSI: %d dBm\n",
            WiFi.localIP().toString().c_str(), WiFi.RSSI());
        return true;
    }

    Serial.printf("[WiFi] Failed to connect (timeout %dms)\n", timeout_ms);
    return false;
}

void WiFiManager::disconnect() {
    WiFi.disconnect(true);
    WiFi.mode(WIFI_OFF);
}

bool WiFiManager::isConnected() {
    return WiFi.status() == WL_CONNECTED;
}

String WiFiManager::getMAC() {
    return WiFi.macAddress();
}

int WiFiManager::getRSSI() {
    return WiFi.RSSI();
}

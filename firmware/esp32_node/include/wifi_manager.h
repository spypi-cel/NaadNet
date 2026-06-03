#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <Arduino.h>
#include <WiFi.h>

class WiFiManager {
public:
    WiFiManager(const char* ssid, const char* password);
    bool connect(int timeout_ms = 10000);
    void disconnect();
    bool isConnected();
    String getMAC();
    int getRSSI();

private:
    const char* _ssid;
    const char* _password;
};

#endif

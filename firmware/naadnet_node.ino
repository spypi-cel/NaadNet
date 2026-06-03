/*
╔══════════════════════════════════════════════════════════════╗
║                    NaadNet — ESP32 Sensor Node              ║
║  DHT11 (temp/humidity) + MAX9814 (microphone) + AI source  ║
║                   Single-file Arduino sketch                ║
╚══════════════════════════════════════════════════════════════╝

=== HOW TO USE ===
1. Install ESP32 board support in Arduino IDE
2. Install libraries: PubSubClient, ArduinoJson, DHT sensor library, arduinoFFT
3. Edit the "=== NODE CONFIGURATION ===" section below
4. Select board: "ESP32 Dev Module"
5. Upload

=== WIRING ===
MAX9814  →  ESP32
  VDD    →  3.3V
  GND    →  GND
  OUT    →  GPIO34

DHT11    →  ESP32
  VCC    →  3.3V
  GND    →  GND
  DATA   →  GPIO4  (add 10kΩ pull-up to 3.3V)

=== HEARTBEAT ===
When the node boots and connects, it sends a heartbeat via HTTP
to your backend, which marks it "online". If it stops sending,
the backend marks it "offline" after 120 seconds.
*/

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <arduinoFFT.h>

// ============================================================
// === NODE CONFIGURATION — EDIT THESE FOR EACH NODE ==========
// ============================================================

// ── WiFi ─────────────────────────────────────────────────────
#define WIFI_SSID       "YourWiFiSSID"
#define WIFI_PASSWORD   "YourWiFiPassword"

// ── Backend API (your server running main.py) ───────────────
#define API_BASE        "http://192.168.1.50:8000"   // Your backend IP:port

// ── Node Identity (change for each ESP32) ───────────────────
#define NODE_ID         "HTC-01"     // Unique ID  (HTC-01, KKP-02, BNH-03, etc.)
#define NODE_LABEL      "Hitech City" // Display name
#define NODE_LAT        17.3850f     // GPS latitude
#define NODE_LNG        78.4860f     // GPS longitude
#define NODE_THRESHOLD  70           // Noise threshold in dB

// ── Hardware pins ────────────────────────────────────────────
#define MIC_PIN         34           // MAX9814 OUT → GPIO34 (ADC1_CH6)
#define DHT11_PIN       4            // DHT11 DATA → GPIO4

// ── Timing ───────────────────────────────────────────────────
#define READING_INTERVAL_MS  5000    // Read sensors every 5 seconds
#define HEARTBEAT_INTERVAL_S 60      // Send heartbeat every 60 seconds

// ============================================================
// === END OF NODE CONFIGURATION ===============================
// ============================================================

// ── FFT Constants ────────────────────────────────────────────
#define FFT_SAMPLES     256
#define SAMPLING_FREQ   8000

// ── Global objects ───────────────────────────────────────────
DHT dht(DHT11_PIN, DHT11);
arduinoFFT fftEngine;

unsigned long lastReadTime = 0;
unsigned long lastHeartbeatTime = 0;

// ============================================================
// === SETUP ===================================================
// ============================================================
void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.printf("\n=== NaadNet Node: %s (%s) ===\n", NODE_ID, NODE_LABEL);
    Serial.printf("Firmware: v2.4.0 | Location: %.4f, %.4f\n", NODE_LAT, NODE_LNG);

    dht.begin();
    pinMode(MIC_PIN, INPUT);

    connectWiFi();
    sendHeartbeat();
}

// ============================================================
// === LOOP ====================================================
// ============================================================
void loop() {
    unsigned long now = millis();

    if (now - lastReadTime >= READING_INTERVAL_MS) {
        lastReadTime = now;
        takeReading();
    }

    if (now - lastHeartbeatTime >= (unsigned long)HEARTBEAT_INTERVAL_S * 1000) {
        lastHeartbeatTime = now;
        sendHeartbeat();
    }
}

// ============================================================
// === FUNCTIONS ===============================================
// ============================================================

void connectWiFi() {
    Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 40) {
        delay(500);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\n[WiFi] Connected! IP: %s, RSSI: %d dBm\n",
            WiFi.localIP().toString().c_str(), WiFi.RSSI());
    } else {
        Serial.println("\n[WiFi] FAILED — check credentials");
    }
}

// ── Read DHT11 ──────────────────────────────────────────────
bool readDHT(float &temp, float &hum) {
    temp = dht.readTemperature();
    hum = dht.readHumidity();
    if (isnan(temp) || isnan(hum)) {
        Serial.println("[DHT11] Read failed");
        return false;
    }
    return true;
}

// ── Read Microphone (dB SPL) ────────────────────────────────
float readMicDB() {
    const int samples = 50;
    uint16_t buf[samples];

    for (int i = 0; i < samples; i++) {
        buf[i] = analogRead(MIC_PIN);
        delayMicroseconds(100);
    }

    float sum = 0;
    for (int i = 0; i < samples; i++) {
        float centered = (float)buf[i] - 2048.0f;
        sum += centered * centered;
    }
    float rms = sqrt(sum / samples);

    float voltage_mV = (rms / 4095.0f) * 3.3f * 1000.0f;
    if (voltage_mV < 2.0f) return 30.0f;

    float pressure_Pa = voltage_mV / 6.0f;
    float db = 20.0f * log10(pressure_Pa / 0.00002f);
    return constrain(db, 30.0f, 120.0f);
}

// ── FFT Noise Source Classification ─────────────────────────
struct SpectralBands {
    float low, mid_low, mid_high, high;
};

SpectralBands computeBands(uint16_t *raw, size_t count) {
    double real[FFT_SAMPLES];
    double imag[FFT_SAMPLES];

    size_t n = min(count, (size_t)FFT_SAMPLES);
    for (size_t i = 0; i < n; i++) {
        real[i] = (double)((int)raw[i] - 2048);
        imag[i] = 0.0;
    }
    for (size_t i = n; i < FFT_SAMPLES; i++) {
        real[i] = 0.0;
        imag[i] = 0.0;
    }

    fftEngine.windowing(real, FFT_SAMPLES, FFT_WIN_TYP_HAMMING, FFT_FORWARD);
    fftEngine.compute(real, imag, FFT_SAMPLES, FFT_FORWARD);
    fftEngine.complexToMagnitude(real, imag, FFT_SAMPLES);

    float bands[4] = {0, 0, 0, 0}; // low, mid_low, mid_high, high
    float binWidth = (float)SAMPLING_FREQ / FFT_SAMPLES;

    for (int i = 1; i < FFT_SAMPLES / 2; i++) {
        float mag = (float)real[i];
        float freq = i * binWidth;
        if (freq < 250)       bands[0] += mag;
        else if (freq < 1000) bands[1] += mag;
        else if (freq < 4000) bands[2] += mag;
        else                  bands[3] += mag;
    }

    float total = bands[0] + bands[1] + bands[2] + bands[3];
    if (total > 0) {
        for (int i = 0; i < 4; i++) bands[i] /= total;
    }

    return {bands[0], bands[1], bands[2], bands[3]};
}

// Noise source centroids: {low, mid_low, mid_high, high}
const float CENTROIDS[5][4] = {
    {0.25, 0.45, 0.20, 0.10},  // Traffic
    {0.40, 0.35, 0.15, 0.10},  // Construction
    {0.50, 0.25, 0.15, 0.10},  // Industrial
    {0.05, 0.20, 0.50, 0.25},  // People / Crowd
    {0.10, 0.15, 0.30, 0.45},  // Nature / Wind
};

const char* SOURCE_LABELS[5] = {
    "Traffic", "Construction", "Industrial",
    "People / Crowd", "Nature / Wind"
};

const char* classifyNoiseSource(SpectralBands &bands, float totalDb) {
    float feat[4] = {bands.low, bands.mid_low, bands.mid_high, bands.high};

    if (totalDb < 40) return "Nature / Wind";

    int bestIdx = 0;
    float bestDist = 999.0f;

    for (int c = 0; c < 5; c++) {
        float dist = 0;
        for (int i = 0; i < 4; i++) {
            float diff = feat[i] - CENTROIDS[c][i];
            dist += diff * diff;
        }
        if (dist < bestDist) {
            bestDist = dist;
            bestIdx = c;
        }
    }

    return SOURCE_LABELS[bestIdx];
}

// ── Capture FFT sample + classify ───────────────────────────
const char* identifyNoiseSource(float totalDb) {
    uint16_t raw[FFT_SAMPLES];
    for (int i = 0; i < FFT_SAMPLES; i++) {
        raw[i] = analogRead(MIC_PIN);
        delayMicroseconds(40);
    }

    SpectralBands bands = computeBands(raw, FFT_SAMPLES);
    return classifyNoiseSource(bands, totalDb);
}

// ── Send heartbeat to backend ───────────────────────────────
void sendHeartbeat() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[Heartbeat] WiFi not connected");
        connectWiFi();
        if (WiFi.status() != WL_CONNECTED) return;
    }

    float temp = 0, hum = 0;
    readDHT(temp, hum);

    float db = readMicDB();
    const char* source = identifyNoiseSource(db);

    HTTPClient http;
    char url[128];
    snprintf(url, sizeof(url), "%s/nodes/%s/heartbeat", API_BASE, NODE_ID);

    http.begin(url);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<256> doc;
    doc["noise"] = round(db * 10) / 10;
    doc["battery"] = 100;
    doc["firmware"] = "v2.4.0";
    doc["temperature"] = round(temp * 10) / 10;
    doc["humidity"] = round(hum * 10) / 10;

    String body;
    serializeJson(doc, body);

    int code = http.POST(body);
    http.end();

    lastHeartbeatTime = millis();

    Serial.printf("[Heartbeat] %s | %.1f dB | %.1f C | %.0f %% | %s | HTTP %d\n",
        NODE_ID, db, temp, hum, source, code);
}

// ── Take a sensor reading and print to serial ───────────────
void takeReading() {
    float temp = 0, hum = 0;
    readDHT(temp, hum);

    float db = readMicDB();
    const char* source = identifyNoiseSource(db);

    Serial.printf("[%s] %.1f dB | %.1f C | %.0f %% | Source: %s\n",
        NODE_ID, db, temp, hum, source);
}

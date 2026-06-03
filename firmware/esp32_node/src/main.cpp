#include <Arduino.h>
#include <driver/adc.h>
#include "config.h"
#include "wifi_manager.h"
#include "sound_sensor.h"
#include "dht_sensor.h"
#include "fft_processor.h"
#include "edge_ai.h"
#include "mqtt_client.h"

WiFiManager wifi(WIFI_SSID, WIFI_PASSWORD);
SoundSensor mic(MIC_PIN);
DhtSensor dht(DHT11_PIN);
FFTProcessor fft;
EdgeAI edgeAI;
WiFiClient wifiClient;
MqttClient mqtt(wifiClient);

unsigned long lastReading = 0;
unsigned long lastMqttLoop = 0;
int readingInterval = SAMPLE_RATE_MS * WINDOW_SIZE;
unsigned long loopCount = 0;
unsigned long fftCycle = 0;

void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.printf("\n=== NaadNet Node %s ===\n", NODE_ID);
    Serial.printf("Firmware: %s\n", FIRMWARE_VERSION);
    Serial.printf("Location: %s (%.4f, %.4f)\n", NODE_LABEL, NODE_LAT, NODE_LNG);

    mic.begin();
    dht.begin();
    fft.begin();

    if (!wifi.connect(15000)) {
        Serial.println("[Main] WiFi failed, rebooting...");
        delay(1000);
        ESP.restart();
    }
    Serial.printf("[Main] WiFi connected, RSSI: %d dBm\n", wifi.getRSSI());

    mqtt.begin();
}

void loop() {
    unsigned long now = millis();

    if (now - lastMqttLoop > 50) {
        mqtt.loop();
        lastMqttLoop = now;
    }

    if (now - lastReading >= (unsigned long)readingInterval) {
        lastReading = now;
        loopCount++;
        fftCycle++;

        float db = mic.readNoiseDB();
        float peakDb = mic.readPeakDB();
        float batteryMV = mic.readBatteryMV();

        float temperature = 0, humidity = 0;
        dht.read(temperature, humidity);

        const char* noiseSource = "";
        float sourceConf = 0;

#if FFT_ENABLE
        if (fftCycle >= FFT_INTERVAL) {
            fftCycle = 0;
            uint16_t rawBuf[FFT_SAMPLES];
            for (int i = 0; i < FFT_SAMPLES; i++) {
                rawBuf[i] = adc1_get_raw((adc1_channel_t)digitalPinToAnalogChannel(MIC_PIN));
                delayMicroseconds(40);
            }
            SpectralBands bands = fft.computeBands(rawBuf, FFT_SAMPLES);
            ClassificationResult result = edgeAI.classify(bands, db);
            noiseSource = result.label;
            sourceConf = result.confidence;

            Serial.printf("[AI] Source: %s (%.0f%%) | Bands: L=%.2f ML=%.2f MH=%.2f H=%.2f\n",
                noiseSource, sourceConf * 100,
                bands.low, bands.mid_low, bands.mid_high, bands.high);
        }
#endif

        Serial.printf("[%s] #%lu | %.1f dB | %.1f C | %.0f %% | %s | %dmV\n",
            NODE_ID, loopCount, db, temperature, humidity,
            noiseSource[0] ? noiseSource : "---", (int)batteryMV);

        if (mqtt.isConnected()) {
            bool ok = mqtt.publishSensorData(db, peakDb, batteryMV, temperature, humidity, noiseSource, sourceConf);
            if (!ok) {
                Serial.println("[Main] MQTT publish failed");
                mqtt.publishNoise(db, peakDb, batteryMV);
            }
        } else {
            Serial.println("[Main] MQTT not connected, skipping publish");
        }

#if USE_DEEP_SLEEP
        Serial.printf("[Main] Entering deep sleep for %ds\n", SLEEP_INTERVAL_S);
        WiFi.disconnect(true);
        esp_sleep_enable_timer_wakeup(SLEEP_INTERVAL_S * 1000000ULL);
        esp_deep_sleep_start();
#endif
    }
}

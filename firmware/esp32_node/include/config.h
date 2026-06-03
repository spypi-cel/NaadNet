#ifndef CONFIG_H
#define CONFIG_H

// ── WiFi ─────────────────────────────────────────────────────
#define WIFI_SSID       "YourWiFiSSID"
#define WIFI_PASSWORD   "YourWiFiPassword"

// ── MQTT ─────────────────────────────────────────────────────
#define MQTT_BROKER     "mqtt.naadnet.local"   // or IP address
#define MQTT_PORT       1883
#define MQTT_CLIENT_ID  "naadnet-htc-01"
#define MQTT_TOPIC_PREFIX "naadnet"

// ── Node Identity ─────────────────────────────────────────────
#define NODE_ID         "HTC-01"
#define NODE_LABEL      "Hitech City"
#define NODE_LAT        17.3850f
#define NODE_LNG        78.4860f
#define FIRMWARE_VERSION "v2.3.1"
#define NOISE_THRESHOLD  70

// ── DHT11 Temperature & Humidity ─────────────────────────────
#define DHT11_PIN       4               // GPIO4 for DHT11 data pin
#define DHT_TYPE        DHT11           // DHT11 sensor type

// ── Sound Sensor (ADC) ───────────────────────────────────────
#define MIC_PIN         34              // ADC1_CH6 (GPIO34)
#define SAMPLE_RATE_MS  100             // Sample every 100ms
#define ADC_MAX         4095.0f         // 12-bit ADC
#define V_REF           3.3f            // ESP32 reference voltage
#define MIC_SENSITIVITY 0.006f          // V/Pa for MAX9814 (typical)
#define WINDOW_SIZE     50              // Samples for RMS calculation
#define SILENT_FLOOR    1.2f            // ADC noise floor in mV

// ── Deep Sleep ───────────────────────────────────────────────
#define SLEEP_INTERVAL_S 60             // Seconds between readings
#define USE_DEEP_SLEEP   false           // Set true for battery operation

// ── FFT / Noise Source Identification ────────────────────────
#define FFT_ENABLE      true             // Enable FFT-based noise source ID
#define FFT_INTERVAL    5               // Run FFT every N reading cycles

// ── Battery ───────────────────────────────────────────────────
#define BATTERY_PIN     35              // ADC1_CH7 (GPIO35)
#define BATTERY_ENABLE  13              // Enable pin for voltage divider
#define BAT_ADC_MAX     3600.0f         // Max measurable mV (with divider)
#define BAT_ADC_MIN     2500.0f         // Min voltage (shutdown)

#endif

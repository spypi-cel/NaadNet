# NaadNet ESP32 Sensor Node

Firmware for ESP32-based noise + temperature/humidity monitoring nodes.

## Sensors

| Sensor | Parameter | Range | Accuracy |
|--------|-----------|-------|----------|
| MAX9814 | Noise (dB SPL) | 30-120 dB | ±2 dB |
| DHT11   | Temperature | 0-50 °C | ±2 °C |
| DHT11   | Humidity | 20-90% RH | ±5% |

## Wiring

### MAX9814 Microphone
```
MAX9814  →  ESP32
VDD      →  3.3V
GND      →  GND
OUT      →  GPIO34 (ADC1_CH6)
GAIN     →  GND (60dB gain — default)
```

### DHT11 Temperature & Humidity
```
DHT11    →  ESP32
VCC      →  3.3V
GND      →  GND
DATA     →  GPIO4  (pull-up 10kΩ to 3.3V recommended)
```

### Battery Monitor (optional)
```
BAT+     →  Voltage divider → GPIO35 (ADC1_CH7)
BAT-     →  GND
Divider enable → GPIO13
```

## Configuration

Edit `include/config.h`:

```cpp
#define WIFI_SSID       "YourWiFiSSID"
#define WIFI_PASSWORD   "YourWiFiPassword"
#define MQTT_BROKER     "192.168.1.50"     // Backend IP
#define NODE_ID         "HTC-01"
#define NODE_LABEL      "Hitech City"
#define NODE_LAT        17.3850f
#define NODE_LNG        78.4860f
#define DHT11_PIN       4
#define MIC_PIN         34
```

## MQTT Topics

| Topic | Direction | Payload |
|-------|-----------|---------|
| `naadnet/{node_id}/sensor` | Publish | `{"node_id","noise_db","peak_db","temperature","humidity","battery","status","firmware","ts"}` |
| `naadnet/{node_id}/noise`  | Publish | `{"node_id","noise","peak_db","battery","status","ts"}` (fallback) |
| `naadnet/{node_id}/status` | Publish | `{"node_id","status","firmware"}` (LWT + online) |
| `naadnet/{node_id}/cmd`    | Subscribe | `{"command":"reboot"}` or `"calibrate"` or `"status"` |

## Build & Upload

### PlatformIO (recommended)

1. Install [PlatformIO](https://platformio.org/) in VS Code
2. Open the `firmware/esp32_node` folder
3. Edit `include/config.h` with your WiFi/MQTT settings
4. Connect ESP32 via USB
5. Click **Upload** or run:
   ```
   pio run --target upload
   pio device monitor
   ```

### Arduino IDE

1. Install ESP32 board support (https://github.com/espressif/arduino-esp32)
2. Install libraries: PubSubClient, ArduinoJson, DHT sensor library
3. Open `src/main.cpp`
4. Copy all `.cpp` files into the sketch folder and rename `main.cpp` to `.ino`
5. Place `.h` files in same folder
6. Edit `config.h` with your settings
7. Select board: ESP32 Dev Module
8. Upload

## Deep Sleep Mode

For battery-powered operation, set in `config.h`:
```cpp
#define USE_DEEP_SLEEP   true
#define SLEEP_INTERVAL_S 300    // Read every 5 minutes
```

The ESP32 wakes up, reads sensors, publishes via MQTT, then sleeps.

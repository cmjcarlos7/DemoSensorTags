var app = {
  initialize: function() {
    document.addEventListener(
      "deviceready",
      this.onDeviceReady.bind(this),
      false
    );
  },
  onDeviceReady: function() {
    this.receivedEvent("deviceready");
  },

  receivedEvent: function(id) {
    switch (id) {
      case "deviceready":
        console.log("Device Ready to use");
    }
  }
};

// UUIDs of services and characteristics.
var LUXOMETER_SERVICE = "f000aa70-0451-4000-b000-000000000000";
var LUXOMETER_CONFIG = "f000aa72-0451-4000-b000-000000000000";
var LUXOMETER_DATA = "f000aa71-0451-4000-b000-000000000000";
var dev;

$(document).ready(function() {
  app.initialize();
});

function showMessage(text) {
  $(".status-sensor").text(text);
}
function showMessageLuxometer(text) {
  $(".status-sensor-lux").text(text);
}
function showLuxometerValue(text) {
  $("#lux-value").text(text);
}
// Connect Button:
$(".connect-button").click(function(e) {
  e.preventDefault();
  findDevice();
});

// Disconnect Button:
$(".disconnect-button").click(function(e) {
  e.preventDefault();
  //hyper.log(device);
  evothings.ble.close(dev);
  showLuxometerValue("0");
  showMessageLuxometer("Luxometer is OFF");
});

function findDevice() {
  showMessage("Scanning for the TI SensorTag CC2650...");

  // Start scanning. Two callback functions are specified.
  evothings.ble.startScan(onDeviceFound, onScanError, {
    serviceUUIDs: ["0000aa10-0000-1000-8000-00805f9b34fb"]
  });

  // This function is called when a device is detected, here
  // we check if we found the device we are looking for.
  function onDeviceFound(device) {
    dev = device;
    // For debugging, print advertisement data.
    //console.log(JSON.stringify(device.advertisementData));
    //showMessage(JSON.stringify(device.advertisementData));

    // Alternative way to identify the device by advertised service UUID.
    /*
		if (device.advertisementData.kCBAdvDataServiceUUIDs.indexOf(
			'0000aa10-0000-1000-8000-00805f9b34fb') > -1)
		{
			showMessage('Found the TI SensorTag!')
		}
		*/

    if (device.advertisementData.kCBAdvDataLocalName == "CC2650 SensorTag") {
      showMessage("Found the TI SensorTag!");

      // Stop scanning.
      evothings.ble.stopScan();

      // Connect.
      connectToDevice(device);
    }
  }

  // Function called when a scan error occurs.
  function onScanError(error) {
    showMessage("Scan error: " + error);
  }
}

function connectToDevice(device) {
  showMessage("Connecting to device...");

  evothings.ble.connectToDevice(
    device,
    onConnected,
    onDisconnected,
    onConnectError,
    { serviceUUIDs: [LUXOMETER_SERVICE] }
  );

  function onConnected(device) {
    showMessage("Connected");

    // Get Luxometer service and characteristics.
    var service = evothings.ble.getService(device, LUXOMETER_SERVICE);
    var configCharacteristic = evothings.ble.getCharacteristic(
      service,
      LUXOMETER_CONFIG
    );
    var dataCharacteristic = evothings.ble.getCharacteristic(
      service,
      LUXOMETER_DATA
    );

    // Enable notifications for Luxometer.
    enableLuxometerNotifications(
      device,
      configCharacteristic,
      dataCharacteristic
    );
  }

  function onDisconnected(device) {
    showMessage("Device disconnected");
  }

  // Function called when a connect error or disconnect occurs.
  function onConnectError(error) {
    showMessage("Connect error: " + error);
  }
}

// Use notifications to get the luxometer value.
function enableLuxometerNotifications(
  device,
  configCharacteristic,
  dataCharacteristic
) {
  // Turn Luxometer ON.
  evothings.ble.writeCharacteristic(
    device,
    configCharacteristic,
    new Uint8Array([1]),
    onLuxometerActivated,
    onLuxometerActivatedError
  );

  function onLuxometerActivated() {
    showMessageLuxometer("Luxometer is ON");

    // Enable notifications from the Luxometer.
    evothings.ble.enableNotification(
      device,
      dataCharacteristic,
      onLuxometerNotification,
      onLuxometerNotificationError
    );
  }

  function onLuxometerActivatedError(error) {
    showMessageLuxometer("Luxometer activate error: " + error);
  }

  // Called repeatedly until disableNotification is called.
  function onLuxometerNotification(data) {
    var lux = calculateLux(data);
    showLuxometerValue(lux + " lux");
  }

  function onLuxometerNotificationError(error) {
    showMessageLuxometer("Luxometer notification error: " + error);
  }
}

// Calculate the light level from raw sensor data.
// Return light level in lux.
function calculateLux(data) {
  // Get 16 bit value from data buffer in little endian format.
  var value = new DataView(data).getUint16(0, true);

  // Extraction of luxometer value, based on sfloatExp2ToDouble
  // from BLEUtility.m in Texas Instruments TI BLE SensorTag
  // iOS app source code.
  var mantissa = value & 0x0fff;
  var exponent = value >> 12;

  var magnitude = Math.pow(2, exponent);
  var output = mantissa * magnitude;

  var lux = output / 100.0;

  // Return result.
  return lux;
}

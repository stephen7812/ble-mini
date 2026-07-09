package com.heimayi.ble.controller.manager;

import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelUuid;
import android.util.Log;
import android.widget.Toast;

import com.heimayi.ble.controller.utils.BLEUtil;

import java.util.Arrays;
import java.util.Map;

import lombok.Setter;

@SuppressLint("MissingPermission")
public class BluetoothLeManager {
    // 蓝牙基础对象
    private static final String TAG = "PAN1026";
    private static final int MANUFACTURER_ID = 0x00C7;
    private final BluetoothLeAdvertiser advertiser;

    private final BluetoothLeScanner bluetoothLeScanner;

    private Context context;

    private String address;

    @Setter
    private AdvertiseCallback advertiseCallback = new AdvertiseCallback() {
        @Override
        public void onStartSuccess(AdvertiseSettings settingsInEffect) {
            Log.e(TAG, String.format("onStartSuccess: %s", settingsInEffect.toString()));
            advertiser.stopAdvertising(advertiseCallback);
        }

        @Override
        public void onStartFailure(int errorCode) {
            Log.e(TAG, String.format("onStartFailure: %s", errorCode));
        }
    };

    public static class Constants {
        public static final String FILTER_NAME = "ANTS";
        public static final int DEFAULT_KAIDU = 50;
        public static final int DEFAULT_UP_TYPE = 1;
        public static final int CMD_LENGTH = 32;
        public static final int MANUFACTURER_ID = 0x00C7;
        public static final String READ_STATUS_CMD_PAGE1 = "311";
        public static final String READ_STATUS_CMD_PAGE2 = "312A";
        public static final long READ_TIMEOUT = 3000;
        public static final long READ_INTERVAL = 500;
        public static final long CMD_SEND_DELAY = 1000;
    }

    private Handler handler = new Handler();

    public BluetoothLeManager(Context context) {
        this.context = context;
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        advertiser = adapter.getBluetoothLeAdvertiser();
        bluetoothLeScanner = adapter.getBluetoothLeScanner();
    }

    // 发送指令
    public void sendCommand(String deviceAddress, String cmdHex, int channel) {
//        new Handler(Looper.getMainLooper()).post(() -> {
//            Toast.makeText(context, cmdHex, Toast.LENGTH_LONG).show();
//        });
        address = deviceAddress;
        new Thread(() -> {
            try {
                BLEUtil.setAddress(deviceAddress);
                int[] actPayload = BLEUtil.generateData(cmdHex);

                AdvertiseSettings settings = new AdvertiseSettings.Builder()
                        .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                        .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
                        .setConnectable(true)
                        .build();

                AdvertiseData.Builder dataBuilder = new AdvertiseData.Builder();

                // 添加厂商数据
                byte[] manufacturerData = new byte[actPayload.length];
                for (int i = 0; i < actPayload.length; i++) {
                    manufacturerData[i] = (byte) actPayload[i];
                }
                dataBuilder.addManufacturerData(Constants.MANUFACTURER_ID, manufacturerData);
                advertiser.startAdvertising(settings, dataBuilder.build(), advertiseCallback);

            } catch (Exception e) {
                e.printStackTrace();
            }
        }).start();
    }

    public void startScanner(ScanCallback scanCallback) {
        ScanSettings scanSettings = new ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                .setLegacy(true)        // 必须开！PAN1026 只发 legacy 广播
                .setPhy(ScanSettings.PHY_LE_ALL_SUPPORTED)
                .build();
        bluetoothLeScanner.startScan(null, scanSettings, scanCallback);
    }

    public void stopScanner(ScanCallback scanCallback) {
        bluetoothLeScanner.stopScan(scanCallback);
    }

    // 启动广播
    private void startAdvertising(byte[] data) {
        AdvertiseSettings settings = new AdvertiseSettings.Builder()
                .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
                .setConnectable(true)
                .build();
        Log.i("数组长度", String.format("startAdvertising: %s, %s", data.length, Arrays.toString(data)));
        AdvertiseData advertiseData = new AdvertiseData.Builder()
                .addManufacturerData(MANUFACTURER_ID, data)
                .setIncludeDeviceName(false)  // 🔴 必须 false
                .setIncludeTxPowerLevel(false) // 🔴 必须 false
                .build();

        try {
            Map<ParcelUuid, byte[]> serviceData = advertiseData.getServiceData();
            Log.i(TAG, String.format("startAdvertising: %s", serviceData));
            advertiser.startAdvertising(settings, advertiseData, callback);
        } catch (Exception e) {
            Log.e(TAG, e.getMessage(), e);
        }
    }

    // 停止广播
    public void stopAdvertising() {
        try {
            advertiser.stopAdvertising(callback);
        } catch (Exception e) {
            // ignored
        }
    }

    private final AdvertiseCallback callback = new AdvertiseCallback() {
        @Override
        public void onStartSuccess(AdvertiseSettings settings) {
            Log.d(TAG, "PAN1026 指令发送成功");
        }

        @Override
        public void onStartFailure(int errorCode) {
            Log.e(TAG, "广播失败 error:" + errorCode);
        }
    };
}

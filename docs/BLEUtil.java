package com.heimayi.ble.controller.utils;

import android.bluetooth.BluetoothAdapter;
import android.content.Context;
import android.content.SharedPreferences;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public class BLEUtil {

    private static final int BASE_SIZE = 15;
    private static final String PREFS_NAME = "BLE_PREFS";
    private static final String KEY_CHANNEL = "channel";
    private static final String KEY_ADDRESS = "address";
    private static Context appContext;

    public static void init(Context context) {
        appContext = context.getApplicationContext();
    }

    private static SharedPreferences getPrefs() {
        if (appContext == null) {
            throw new IllegalStateException("BLEUtil未初始化，请先调用init()");
        }
        return appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    public static boolean enabled() {
        // 判断蓝牙是否开启
        BluetoothAdapter defaultAdapter = BluetoothAdapter.getDefaultAdapter();
        return Objects.nonNull(defaultAdapter) && defaultAdapter.isEnabled();
    }

    /**
     * 获取存储的通道号
     *
     * @return 通道号，默认37
     */
    public static int getChannel() {
        String channel = getPrefs().getString(KEY_CHANNEL, "37");
        try {
            return Integer.parseInt(channel);
        } catch (NumberFormatException e) {
            return 37;
        }
    }

    /**
     * 设置通道号
     *
     * @param channel 通道号
     */
    public static void setChannel(int channel) {
        getPrefs().edit().putString(KEY_CHANNEL, String.valueOf(channel)).apply();
    }

    /**
     * 获取存储的地址
     *
     * @return 地址字符串
     */
    public static String getAddress() {
        return getPrefs().getString(KEY_ADDRESS, "");
    }

    /**
     * 设置地址
     *
     * @param address 地址字符串
     */
    public static void setAddress(String address) {
        getPrefs().edit().putString(KEY_ADDRESS, address).apply();
    }

    /**
     * 生成1RF1载荷数据
     *
     * @param address        地址数组
     * @param addressLength  地址长度
     * @param rfPayload      RF载荷数组
     * @param rfPayloadWidth 载荷宽度
     * @return 实际载荷数组
     */
    public static int[] get1rf1payload(int[] address, int addressLength,
                                       int[] rfPayload, int rfPayloadWidth) {
        int channel = getChannel();

        int[] whiteningRegBle = new int[7];
        whiteningRegBle[0] = 0;
        int[] whiteningReg297 = new int[7];
        whiteningReg297[0] = 0;

        WhiteningUtil.whiteningInit(channel, whiteningRegBle);
        WhiteningUtil.whiteningInit(0x3F, whiteningReg297);

        int[] blePayload = new int[BASE_SIZE + 3 + addressLength + rfPayloadWidth + 2];

        // Step1: 复制前缀、地址和RF载荷
        blePayload[BASE_SIZE + 0] = 0x71;
        blePayload[BASE_SIZE + 1] = 0x0F;
        blePayload[BASE_SIZE + 2] = 0x55;

        for (int i = 0; i < addressLength; i++) {
            blePayload[BASE_SIZE + 3 + i] = address[addressLength - i - 1];
        }

        for (int i = 0; i < rfPayloadWidth; i++) {
            blePayload[BASE_SIZE + 3 + addressLength + i] = rfPayload[i];
        }

        // Step2: XN297L位反转
        for (int i = 0; i < 3 + addressLength; i++) {
            blePayload[BASE_SIZE + i] = Crc16Util.invert8(blePayload[BASE_SIZE + i]);
        }

        // Step3: 添加CRC16
        int crc = Crc16Util.checkCRC16(address, addressLength, rfPayload, rfPayloadWidth);
        blePayload[BASE_SIZE + 3 + addressLength + rfPayloadWidth + 0] = crc & 0xFF;
        blePayload[BASE_SIZE + 3 + addressLength + rfPayloadWidth + 1] = (crc >> 8) & 0xFF;

        // Step4: XN297L白化
        int[] dataToWhitening = new int[addressLength + rfPayloadWidth + 2];
        System.arraycopy(blePayload, BASE_SIZE + 3, dataToWhitening, 0, dataToWhitening.length);
        int[] wData = WhiteningUtil.whiteningEncode(dataToWhitening, dataToWhitening.length, whiteningReg297);
        System.arraycopy(wData, 0, blePayload, BASE_SIZE + 3, wData.length);

        // Step5: BLE白化
        WhiteningUtil.whiteningEncode(blePayload, BASE_SIZE + 3 + addressLength + rfPayloadWidth + 2, whiteningRegBle);

        // 提取实际载荷
        int[] actPayload = new int[3 + addressLength + rfPayloadWidth + 2];
        System.arraycopy(blePayload, BASE_SIZE, actPayload, 0, actPayload.length);

        return actPayload;
    }

    /**
     * 获取Service UUID列表
     *
     * @param actPayload 实际载荷
     * @return UUID列表
     */
    public static List<String> getServiceUUIDs(int[] actPayload) {
        String payload = ByteUtil.byteToString(actPayload);
        return getServiceUUIDsBySpace(payload);
    }

    /**
     * 根据空格分隔的载荷获取UUID列表
     *
     * @param payload 空格分隔的16进制字符串
     * @return UUID列表
     */
    public static List<String> getServiceUUIDsBySpace(String payload) {
        List<String> uuids = new ArrayList<>();
        uuids.add("00c7");

        if (payload != null && !payload.isEmpty()) {
            String[] payloadArray = payload.split("\\s+");

            // 如果长度为奇数，补"00"
            if (payloadArray.length % 2 != 0) {
                String[] newArray = new String[payloadArray.length + 1];
                System.arraycopy(payloadArray, 0, newArray, 0, payloadArray.length);
                newArray[payloadArray.length] = "00";
                payloadArray = newArray;
            }

            for (int i = 0; i < payloadArray.length; i++) {
                if (payloadArray[i] == null || payloadArray[i].isEmpty()) {
                    continue;
                }
                if (i % 2 != 0) {
                    uuids.add(payloadArray[i] + payloadArray[i - 1]);
                }
            }
        }

        // 补足到17个UUID
        for (int i = uuids.size(); i < 17; i++) {
            String pre = i < 10 ? "0" + i : "" + i;
            String suf = (i + 1) < 10 ? "0" + (i + 1) : "" + (i + 1);
            uuids.add(pre + suf);
        }

        return uuids;
    }

    /**
     * 生成数据(使用存储的地址)
     *
     * @param inputPayload 输入载荷
     * @return 实际载荷数组
     */
    public static int[] generateData(String inputPayload) {
        String rawAddress = getAddress();
        if (rawAddress == null || rawAddress.isEmpty()) {
            throw new IllegalArgumentException("地址不可为空");
        }
        return generateDataWithAddr(rawAddress, inputPayload);
    }

    /**
     * 使用指定地址生成数据
     *
     * @param rawAddress   原始地址字符串
     * @param inputPayload 输入载荷
     * @return 实际载荷数组
     */
    public static int[] generateDataWithAddr(String rawAddress, String inputPayload) {
        if (rawAddress == null || rawAddress.isEmpty()) {
            throw new IllegalArgumentException("地址不可为空");
        }

        rawAddress = rawAddress.replaceAll("\\s+", "").trim().toLowerCase();

        if (rawAddress.length() < 6 || rawAddress.length() > 10) {
            throw new IllegalArgumentException("地址长度必须在6-10之间");
        }

        int[] address = new int[rawAddress.length() / 2];
        for (int i = 0; i < address.length; i++) {
            address[i] = ByteUtil.str2Bytes(rawAddress.substring(i * 2, (i + 1) * 2));
        }

        String rawPayload = inputPayload;
        rawPayload = rawPayload.replaceAll("\\s+", "").toLowerCase();

        if (rawPayload.length() < 2) {
            throw new IllegalArgumentException("载荷至少1字节");
        }

        if (rawPayload.length() % 2 != 0) {
            throw new IllegalArgumentException("载荷长度必须是偶数");
        }

        int[] payload = new int[rawPayload.length() / 2];
        for (int i = 0; i < payload.length; i++) {
            payload[i] = ByteUtil.str2Bytes(rawPayload.substring(i * 2, (i + 1) * 2));
        }

        return get1rf1payload(address, address.length, payload, payload.length);
    }
}
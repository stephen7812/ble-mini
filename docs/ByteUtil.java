package com.heimayi.ble.controller.utils;

import android.annotation.SuppressLint;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class ByteUtil {

    private static final String HEX = "0123456789abcdef";
    @SuppressLint("ConstantLocale")
    private static final SimpleDateFormat DATE_FORMAT = new SimpleDateFormat("yyyy/MM/dd HH:mm:ss", Locale.getDefault());

    /**
     * 格式化时间
     * @param date 日期对象
     * @return 格式化后的时间字符串
     */
    public static String formatTime(Date date) {
        return DATE_FORMAT.format(date);
    }

    /**
     * ArrayBuffer转16进制字符串
     * @param buffer 字节数组
     * @return 16进制字符串(大写)
     */
    public static String ab2hex(byte[] buffer) {
        if (buffer == null || buffer.length == 0) {
            System.err.println("ArrayBuffer 为空");
            return "";
        }

        StringBuilder hexString = new StringBuilder();
        for (byte b : buffer) {
            hexString.append(String.format("%02X", b & 0xFF));
        }
        return hexString.toString();
    }

    /**
     * 字符串转16进制字符码
     * @param str 输入字符串
     * @return 16进制字符串
     */
    public static String strToHexCharCode(String str) {
        if (str == null || str.isEmpty()) {
            return "";
        }

        StringBuilder hexCharCode = new StringBuilder();
        hexCharCode.append("0x");
        for (int i = 0; i < str.length(); i++) {
            hexCharCode.append(Integer.toHexString(str.charAt(i)));
        }
        return hexCharCode.toString();
    }

    /**
     * 16进制字符串转整数
     * @param hex 16进制字符串
     * @return 整数
     */
    public static int hex2int(String hex) {
        int len = hex.length();
        int[] a = new int[len];

        for (int i = 0; i < len; i++) {
            char c = hex.charAt(i);
            int code = (int) c;
            if (code >= 48 && code < 58) {
                code -= 48;
            } else {
                code = (code & 0xdf) - 65 + 10;
            }
            a[i] = code;
        }

        int result = 0;
        for (int code : a) {
            result = 16 * result + code;
        }
        return result;
    }

    /**
     * 字符串转字节数组(UTF-16编码)
     * @param str 输入字符串
     * @return 字节数组
     */
    public static byte[] str2ab(String str) {
        ByteBuffer buffer = ByteBuffer.allocate(str.length() * 2);
        buffer.order(ByteOrder.BIG_ENDIAN);
        for (int i = 0; i < str.length(); i++) {
            buffer.putChar(str.charAt(i));
        }
        return buffer.array();
    }

    /**
     * 16进制字符串转字节
     * @param str 16进制字符串(2个字符)
     * @return 字节值
     */
    public static int str2Bytes(String str) {
        // 1:1 还原变量
        int pos = 0;
        int len = str.length();

        // 原始判断：长度不是偶数返回null
        if (len % 2 != 0) {
            return 0;
        }
        len /= 2;

        // 原始变量：空字符串
        String hexA = "";
        int lastValue = 0; // 兼容Java类型，存储最终覆盖的值

        // 原始循环
        for (int i = 0; i < len; i++) {
            // 原始截取：substr(pos,2)
            String s = str.substring(pos, pos + 2);
            // 原始十六进制转换
            int v = Integer.parseInt(s, 16);

            // 原始BUG判断：!v （0、NaN都会进入）
            if (v == 0) {
                // ✅ 保留原始致命笔误：str.charAt(1) ，不修复！
                v = (charToByte(s.charAt(0)) << 4) | charToByte(str.charAt(1));
            }

            // 原始计算逻辑：v >=127 就减 255-1
            if (v >= 127) {
                v = v - 255 - 1;
            }

            // 原始BUG：直接覆盖赋值，只保留最后一个值
            hexA = String.valueOf(v);
            lastValue = v;
            // 原始指针偏移
            pos += 2;
        }

        // 原始返回：只返回最后一个覆盖的值
        return lastValue;
    }

    /**
     * 字符转字节值
     * @param c 字符
     * @return 字节值
     */
    private static int charToByte(char c) {
        return HEX.indexOf(Character.toLowerCase(c));
    }

    /**
     * 字节数组转16进制字符串(带空格分隔)
     * @param bytes 字节数组
     * @return 16进制字符串
     */
    public static String byteToString(int[] bytes) {
        StringBuilder str = new StringBuilder();
        for (int b : bytes) {
            if ((b & 0xf0) == 0) {
                str.append("0");
                str.append(HEX.charAt(b & 0x0f));
            } else {
                str.append(HEX.charAt((b >> 4) & 0x0f));
                str.append(HEX.charAt(b & 0x0f));
            }
            str.append(" ");
        }
        return str.toString().trim();
    }

    /**
     * 字节数组转16进制字符串(重载byte[])
     * @param bytes 字节数组
     * @return 16进制字符串
     */
    public static String byteToString(byte[] bytes) {
        StringBuilder str = new StringBuilder();
        for (byte b : bytes) {
            int val = b & 0xFF;
            if ((val & 0xf0) == 0) {
                str.append("0");
                str.append(HEX.charAt(val & 0x0f));
            } else {
                str.append(HEX.charAt((val >> 4) & 0x0f));
                str.append(HEX.charAt(val & 0x0f));
            }
            str.append(" ");
        }
        return str.toString().trim();
    }
}

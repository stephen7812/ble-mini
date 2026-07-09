#!/usr/bin/env python3
"""
BLE 广播扫描器 —— 监听 0x00C7 (Panchip) / 'ANTS' 设备
实时显示广播包，尝试按旧阀 Page1 格式解析
"""

import asyncio
import os
from datetime import datetime
from bleak import BleakScanner

TARGET_COMPANY_ID = 0x00C7
TARGET_NAME = 'ANTS'
LOG_FILE = 'scan_ble_log.txt'

samples = []


def parse_temp_le(b0, b1):
    """小端 2 字节温度: (b1<<8 | b0) / 100"""
    raw = (b1 << 8) | b0
    neg = (raw >> 15) & 1
    if neg:
        raw = -(raw & 0x7FFF)
    return round(raw / 100, 1)


def try_parse_page1(data: bytes):
    """尝试按旧阀 Page1 布局解析（16字节：3F + 15字节payload）"""
    if len(data) < 16:
        return None
    buf = list(data)
    fields = {
        '帧头': hex(buf[0]),
        '工作模式': hex(buf[1]),
        '阀门开度': f'{buf[2]}%',
        '设定开度': f'{buf[3]}%',
        '开度上限': f'{buf[4]}%',
        '开度下限': f'{buf[5]}%',
        '采样周期': f'{buf[6] * 10}分',
        '供暖上报': f'{buf[7] * 10}分',
        '非供暖周期': f'{buf[8]}天',
        '进水温度': f'{parse_temp_le(buf[12], buf[13])}℃',
        '回水温度': f'{parse_temp_le(buf[14], buf[15])}℃',
    }
    return fields


def try_parse_01broadcast(data: bytes):
    """尝试解析 01 开头的 27 字节广播"""
    if len(data) != 27 or data[0] != 0x01:
        return None
    buf = list(data)
    # 跳过前 3 字节固定头 (01 09 20)
    p = buf[3:]
    fields = {
        '固定头': ' '.join(f'{b:02X}' for b in buf[:3]),
        '数据长度': f'{len(p)}字节',
        '工作模式?': hex(p[0]) if len(p) > 0 else '-',
        '开度1?': f'{p[1]}%' if len(p) > 1 else '-',
        '开度2?': f'{p[2]}%' if len(p) > 2 else '-',
        '开度上限?': f'{p[3]}%' if len(p) > 3 else '-',
        '开度下限?': f'{p[4]}%' if len(p) > 4 else '-',
    }
    if len(p) >= 13:
        fields['进水温度?'] = f'{parse_temp_le(p[11], p[12])}℃'
    if len(p) >= 15:
        fields['回水温度?'] = f'{parse_temp_le(p[13], p[14])}℃'
    return fields


def detection_callback(device, advertisement_data):
    mfg = advertisement_data.manufacturer_data
    name = advertisement_data.local_name or ''
    rssi = advertisement_data.rssi or 0
    addr = device.address or '?'

    # 筛选条件：公司ID 0x00C7 或 设备名 ANTS
    raw_data = None
    if TARGET_COMPANY_ID in mfg:
        raw_data = mfg[TARGET_COMPANY_ID]
    elif name.strip() == TARGET_NAME and mfg:
        # 取第一个厂商数据
        for cid, d in mfg.items():
            raw_data = d
            break

    if raw_data is None:
        return

    now = datetime.now().strftime('%H:%M:%S.%f')[:-3]
    hex_str = raw_data.hex(' ').upper()
    data_len = len(raw_data)
    first_byte = raw_data[0] if data_len > 0 else 0

    print(f'\n{"─" * 60}')
    print(f'  [{now}]  地址={addr}  RSSI={rssi} dBm')
    print(f'  名称={name or "(无)"}  长度={data_len}B  首字节=0x{first_byte:02X}')
    print(f'  HEX: {hex_str}')
    print(f'  BYTES: {list(raw_data)}')

    # 尝试解析
    if first_byte == 0x3F:
        r = try_parse_page1(raw_data)
        if r:
            print(f'  ▶ Page1 解析:')
            for k, v in r.items():
                print(f'    {k}: {v}')
    elif first_byte == 0x3E:
        print(f'  ▶ Page2 响应(第2页)')
    elif first_byte == 0x01:
        r = try_parse_01broadcast(raw_data)
        if r:
            print(f'  ▶ 01格式尝试:')
            for k, v in r.items():
                print(f'    {k}: {v}')
    else:
        print(f'  ▶ 未知格式 (首字节 0x{first_byte:02X})')

    # 记录样本
    samples.append({
        'time': now,
        'addr': addr,
        'name': name,
        'rssi': rssi,
        'hex': raw_data.hex(),
        'len': data_len,
    })

    # 追加到日志文件
    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(f'[{now}] {addr} RSSI={rssi} {hex_str}\n')


async def main():
    print('=' * 60)
    print('  BLE 广播扫描器 (0x00C7 / ANTS)')
    print('  实时打印 + 保存到 scan_ble_log.txt')
    print('  按 Ctrl+C 停止')
    print('=' * 60)

    # 清空旧日志
    if os.path.exists(LOG_FILE):
        os.remove(LOG_FILE)

    scanner = BleakScanner(detection_callback, scanning_mode="active")
    await scanner.start()

    try:
        while True:
            await asyncio.sleep(1)
    except asyncio.CancelledError:
        pass
    finally:
        await scanner.stop()
        print(f'\n\n扫描结束，共采集 {len(samples)} 个广播包')
        # 打印样本汇总
        if samples:
            print(f'\n样本按首字节分组:')
            by_first = {}
            for s in samples:
                first = s['hex'][:2]
                by_first.setdefault(first, []).append(s)
            for first, group in sorted(by_first.items()):
                print(f'  0x{first}: {len(group)} 个广播')


if __name__ == '__main__':
    asyncio.run(main())

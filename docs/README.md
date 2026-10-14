# Fantech Helios Go XD5 — Technical Documentation & Reverse Engineering Index

Comprehensive technical documentation, protocol specifications, EEPROM memory maps, and WebHID integration guides for the **Fantech Helios Go XD5** wireless gaming mouse.

All specifications in this directory were derived from static disassembly and dynamic tracing of the official vendor driver (`OemDrv.exe`, `InitSetup.dll`, `Cfg.ini`) and USB HID communications with the Areson MCU and PixArt PAW3370 optical sensor.

---

## Documentation Index

| Document | Description | Key Topics |
| :--- | :--- | :--- |
| **[`USER_MANUAL.md`](USER_MANUAL.md)** | Official User Manual Documentation | Package contents, physical button layout, wireless 2.4 GHz & wired Type-C setup, LED switches, battery indicator, and software overview. |
| **[`PROTOCOL_SPECIFICATION.md`](PROTOCOL_SPECIFICATION.md)** | USB HID Protocol Specification | Vendor ID (`0x25A7`), Product IDs (`0xFA7B` / `0xFA7C`), 17-byte fixed framing, Modulo-256 sum-to-`0x55` checksum, dual-layer memory model (SRAM vs SPI Flash), and command opcodes (`0x01`–`0x10`). |
| **[`EEPROM_MEMORY_MAP.md`](EEPROM_MEMORY_MAP.md)** | EEPROM Memory Map & Validation Rules | Byte-level layout across 3 zones: Core Configuration (`0x00..0xB4`), Extended Multimedia Keys (`0x100..0x2FF`), and On-Board Hardware Macro Storage (`0x300..0x1AFF`). |
| **[`FEATURE_MECHANISMS.md`](FEATURE_MECHANISMS.md)** | Feature Mechanisms & Algorithms | PixArt PAW3370 DPI math (50/100 DPI step conversion), 7 Spectrum RGB modes, discrete brightness/speed lookup tables, 104 USB HID scancode matrix, and 5-byte hardware macro player. |
| **[`WEBHID_INTEGRATION_GUIDE.md`](WEBHID_INTEGRATION_GUIDE.md)** | WebHID Integration Guide | Developer guide with production-ready TypeScript blueprints for Chromium browsers: device request filters, primary interface selection, chunked EEPROM reading/writing, and hardware event listeners. |
| **[`OEMDRV_REVERSE_ENGINEERING.md`](OEMDRV_REVERSE_ENGINEERING.md)** | Historical Reverse Engineering Notes | Initial static disassembly reference, thread architecture (`ServiceThread`, worker threads), and internal driver flags (`nFlag` bitmask). |

---

## Architectural Summary

```
                      +-----------------------------+
                      |   WebHID Browser App        |
                      |   (Chromium: Chrome/Edge)   |
                      +-----------------------------+
                                     │
                          Feature Report 0x08 (17B)
                          Input Report 0x08 / 0x09
                                     ▼
                      +-----------------------------+
                      | Areson MCU (VID: 0x25A7)    |
                      | Wired: 0xFA7B, Dongle: 0xFA7C|
                      +-----------------------------+
                                     │
             ┌───────────────────────┴───────────────────────┐
             ▼                                               ▼
+───────────────────────────+                   +───────────────────────────+
| SRAM Shadow EEPROM        |                   | Physical SPI NOR Flash    |
| (Addresses 0x00 .. 0x1AFF)|                   | (Non-volatile chip)       |
| • Fast (<1 ms) updates    |                   | • CMD 0x09 CommitFlash    |
| • CMD 0x07 WriteEEPROM    |                   | • Sector erase (~100 ms)  |
| • Controls live registers |                   | • Retains across power-off|
+───────────────────────────+                   +───────────────────────────+
```

### Essential Hardware Facts
- **VID / PID**: `VID 0x25A7`, `PID 0xFA7B` (Wired), `PID 0xFA7C` (2.4 GHz Dongle).
- **Packet Length**: Exactly 17 bytes (`[0x08, CMD, ...14 bytes payload..., Checksum]`).
- **Checksum Formula**: $\text{buf}[16] = (0x55 - \sum_{i=0}^{15} \text{buf}[i]) \pmod{256}$.
- **SRAM vs Flash**: Live adjustments write to SRAM EEPROM via CMD `0x07` to prevent mouse stutter; CMD `0x09` is reserved for committing to flash storage.

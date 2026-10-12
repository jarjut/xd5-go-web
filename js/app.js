/**
 * Fantech Helios Go XD5 - Main Application Controller
 * Handles UI interactions, profile synchronization, and WebHID transactions.
 */

import { XD5Protocol } from './protocol.js';
import { ProfileManager } from './profiles.js';
import { renderMouseSvg } from './mouse-svg.js';

class HeliosApp {
  constructor() {
    this.proto = new XD5Protocol();
    this.pm = new ProfileManager();

    // Hook protocol events
    this.proto.onLog = (msg, type) => this.log(msg, type);
    this.proto.onBatteryUpdate = (state) => this.updateBatteryUI(state);
    this.proto.onDeviceEvent = (evt) => this.handleDeviceEvent(evt);
  }

  init() {
    if (!navigator.hid) {
      document.getElementById('hidWarning').style.display = 'block';
    }

    // Insert vector mouse SVG
    const wrapper = document.getElementById('mouseVisualContainer');
    if (wrapper) {
      wrapper.innerHTML = `<div class="mouse-led-glow" id="mouseGlow"></div>` + renderMouseSvg() + `<span style="margin-top:16px; font-size:12px; color:var(--text-muted); font-weight:600;">Helios Go XD5 &bull; PAW3370 Ergonomic</span>`;
    }

    this.renderProfileSelector();
    this.loadProfileIntoUI(this.pm.getActiveProfile());

    // USB auto-discovery if already permitted
    if (navigator.hid) {
      navigator.hid.getDevices().then(devices => {
        const match = devices.find(d => d.vendorId === 0x25A7);
        if (match) {
          this.log(`Found previously paired mouse: ${match.productName}. Click "Connect Mouse" to open.`, 'in');
        }
      }).catch(() => {});

      navigator.hid.addEventListener('disconnect', (e) => {
        if (this.proto.device === e.device) {
          this.onDisconnected();
        }
      });
    }

    this.bindMouseSvgButtonHovers();
  }

  log(msg, type = 'out') {
    const box = document.getElementById('consoleBox');
    if (!box) return;
    const ts = new Date().toTimeString().split(' ')[0];
    const span = document.createElement('div');
    span.className = 'console-entry console-' + type;
    span.textContent = `[${ts}] ${msg}`;
    box.appendChild(span);
    box.scrollTop = box.scrollHeight;
  }

  clearConsole() {
    const box = document.getElementById('consoleBox');
    if (box) box.textContent = '';
  }

  switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.target.classList.add('active');
  }

  // Profile Management
  renderProfileSelector() {
    const select = document.getElementById('profileSelect');
    if (!select) return;
    select.innerHTML = '';
    this.pm.profiles.forEach((p, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = p.name;
      if (idx === this.pm.activeIndex) opt.selected = true;
      select.appendChild(opt);
    });

    this.updateProfileTheme();
  }

  updateProfileTheme() {
    const cur = this.pm.getActiveProfile();
    const color = cur.profileColor || "#00e5ff";
    document.documentElement.style.setProperty('--profile-color', color);

    const badge = document.getElementById('profileColorBadge');
    if (badge) badge.style.backgroundColor = color;

    const picker = document.getElementById('profileColorPicker');
    if (picker) picker.value = color;

    const ledStrip = document.getElementById('mouseLedStrip');
    if (ledStrip) ledStrip.setAttribute('fill', color);
  }

  onProfileColorChange(hex) {
    this.pm.setProfileColor(this.pm.activeIndex, hex);
    this.updateProfileTheme();
    this.log(`Updated accent color for "${this.pm.getActiveProfile().name}" to ${hex}`, 'in');
  }

  syncProfileColorToMouse() {
    const cur = this.pm.getActiveProfile();
    const color = cur.profileColor || "#00e5ff";
    cur.lighting.color = color;
    document.getElementById('ledColorPicker').value = color;
    document.getElementById('ledColorHex').value = color;
    this.pm.save();
    this.updateLedPreview();
    this.log(`Synced Mouse RGB LED to profile signature color (${color})!`, 'in');
  }

  async onProfileSelect(idxStr) {
    const idx = parseInt(idxStr, 10);
    if (idx === this.pm.activeIndex) return;
    const p = this.pm.setActiveProfile(idx);
    this.loadProfileIntoUI(p);
    this.log(`Switched to profile: "${p.name}" (ID ${idx}) in web app (Mouse hardware not modified)`, 'in');
  }

  renameProfile() {
    const cur = this.pm.getActiveProfile();
    const newName = prompt('Enter new profile name:', cur.name);
    if (newName && newName.trim()) {
      this.pm.renameProfile(this.pm.activeIndex, newName);
      this.renderProfileSelector();
      this.log(`Renamed profile to "${cur.name}"`, 'in');
    }
  }

  addNewProfile() {
    const name = prompt('Enter name for new profile:', `Profile ${this.pm.profiles.length + 1} (Custom)`);
    if (!name || !name.trim()) return;
    const colors = ["#9d4edd", "#ff007f", "#00f5d4", "#f72585", "#7209b7", "#4cc9f0"];
    const chosenColor = colors[this.pm.profiles.length % colors.length];
    const created = this.pm.addProfile(name.trim(), chosenColor);
    this.renderProfileSelector();
    this.loadProfileIntoUI(created);
    this.log(`Created new profile: "${created.name}"`, 'in');
  }

  deleteCurrentProfile() {
    try {
      const cur = this.pm.getActiveProfile();
      if (confirm(`Are you sure you want to delete profile "${cur.name}"?`)) {
        const next = this.pm.deleteProfile(this.pm.activeIndex);
        this.renderProfileSelector();
        this.loadProfileIntoUI(next);
        this.log(`Deleted profile. Active profile now: "${next.name}"`, 'in');
      }
    } catch (e) {
      alert(e.message);
    }
  }

  resetProfileToFactory() {
    const cur = this.pm.getActiveProfile();
    if (confirm(`Reset profile "${cur.name}" back to factory defaults?`)) {
      const fresh = this.pm.resetProfile(this.pm.activeIndex);
      this.loadProfileIntoUI(fresh);
      this.log(`Reset profile "${cur.name}" to factory defaults.`, 'in');
    }
  }

  exportProfileJson() {
    const cur = this.pm.getActiveProfile();
    const jsonStr = this.pm.exportProfileJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = cur.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    a.href = url;
    a.download = `Fantech_XD5_${safeName}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.log(`Exported profile to Fantech_XD5_${safeName}.json`, 'in');
  }

  importProfileJson(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = this.pm.importProfileJson(e.target.result);
        this.renderProfileSelector();
        this.loadProfileIntoUI(imported);
        this.log(`Imported profile "${imported.name}" successfully!`, 'in');
        alert(`Profile "${imported.name}" imported successfully!`);
      } catch (err) {
        this.log(`Import error: ${err.message}`, 'err');
        alert(`Error importing profile: ${err.message}`);
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  }

  loadProfileIntoUI(p) {
    this.updateProfileTheme();

    // 1. Polling Rate
    this.setPollingRateUI(p.pollingRate);
    // 2. LOD
    this.setLodUI(p.lod);
    // 3. Debounce
    document.getElementById('debounceSlider').value = p.debounce;
    document.getElementById('debounceVal').textContent = `${p.debounce} ms`;
    // 4. Sleep
    document.getElementById('sleepSlider').value = p.sleepMin;
    document.getElementById('sleepVal').textContent = `${p.sleepMin} min`;
    // 5. Toggles
    document.getElementById('chkRipple').checked = !!p.ripple;
    document.getElementById('chkAngleSnap').checked = !!p.angleSnap;
    document.getElementById('chkTurnOffOnMove').checked = !!p.turnOffOnMove;
    // 6. Separate XY
    document.getElementById('chkSeparateXY').checked = !!p.separateXY;
    // 7. DPI Stages
    this.renderDpiStages();
    // 8. Lighting
    document.getElementById('ledEffect').value = p.lighting.mode;
    document.getElementById('ledColorPicker').value = p.lighting.color;
    document.getElementById('ledColorHex').value = p.lighting.color;
    document.getElementById('ledBrightness').value = p.lighting.brightness;
    document.getElementById('ledBrightnessVal').textContent = p.lighting.brightness;
    document.getElementById('ledSpeed').value = p.lighting.speed;
    document.getElementById('ledSpeedVal').textContent = p.lighting.speed;
    this.updateLedPreview();
    // 9. Key Remapping
    for (let k = 1; k <= 6; k++) {
      const el = document.getElementById('key' + k);
      if (el && p.keys['key' + k]) el.value = p.keys['key' + k];
    }
  }

  renderDpiStages() {
    const container = document.getElementById('dpiStagesContainer');
    if (!container) return;
    container.innerHTML = '';
    const p = this.pm.getActiveProfile();

    p.dpiStages.forEach((stage, idx) => {
      const stageNum = idx + 1;
      const isCurrent = p.activeDpiStage === stageNum;
      const row = document.createElement('div');
      row.className = `dpi-stage-row ${isCurrent ? 'current-active' : ''}`;
      row.id = `dpiRow${idx}`;

      row.innerHTML = `
        <input type="radio" name="activeDpi" value="${stageNum}" ${isCurrent ? 'checked' : ''} onchange="app.setActiveDpiStage(${stageNum})">
        <span class="stage-pill" style="background:${stage.color}22; color:${stage.color}; border:1px solid ${stage.color}66;">Stage ${stageNum}</span>
        <div>
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="range" id="dpiSliderX${idx}" min="50" max="19000" step="50" value="${stage.x}" oninput="app.onDpiSliderChange(${idx}, 'x')">
            <input type="number" id="dpiNumX${idx}" class="dpi-val-input" min="50" max="19000" step="50" value="${stage.x}" onchange="app.onDpiNumChange(${idx}, 'x')">
          </div>
          <div id="dpiYWrapper${idx}" style="display:${p.separateXY ? 'flex' : 'none'}; align-items:center; gap:8px; margin-top:6px;">
            <input type="range" id="dpiSliderY${idx}" min="50" max="19000" step="50" value="${stage.y}" oninput="app.onDpiSliderChange(${idx}, 'y')">
            <input type="number" id="dpiNumY${idx}" class="dpi-val-input" min="50" max="19000" step="50" value="${stage.y}" onchange="app.onDpiNumChange(${idx}, 'y')">
          </div>
        </div>
        <input type="color" class="color-picker-box" value="${stage.color}" onchange="app.onStageColorChange(${idx}, this.value)" title="Change stage LED color indicator">
        <label class="switch">
          <input type="checkbox" ${stage.enabled ? 'checked' : ''} onchange="app.toggleStageEnabled(${idx}, this.checked)">
          <span class="slider"></span>
        </label>
        <span style="font-size:11px; color:var(--text-muted);">${stage.enabled ? 'Active' : 'Off'}</span>
      `;
      container.appendChild(row);
    });
  }

  onDpiSliderChange(idx, axis) {
    const p = this.pm.getActiveProfile();
    const slider = document.getElementById(`dpiSlider${axis.toUpperCase()}${idx}`);
    const num = document.getElementById(`dpiNum${axis.toUpperCase()}${idx}`);
    num.value = slider.value;
    p.dpiStages[idx][axis] = parseInt(slider.value, 10);
    if (!p.separateXY) {
      const other = axis === 'x' ? 'y' : 'x';
      p.dpiStages[idx][other] = parseInt(slider.value, 10);
      const otherNum = document.getElementById(`dpiNum${other.toUpperCase()}${idx}`);
      if (otherNum) otherNum.value = slider.value;
    }
    this.pm.save();
  }

  onDpiNumChange(idx, axis) {
    const p = this.pm.getActiveProfile();
    const slider = document.getElementById(`dpiSlider${axis.toUpperCase()}${idx}`);
    const num = document.getElementById(`dpiNum${axis.toUpperCase()}${idx}`);
    let val = parseInt(num.value, 10);
    val = Math.max(50, Math.min(19000, val));
    num.value = val;
    slider.value = val;
    p.dpiStages[idx][axis] = val;
    if (!p.separateXY) {
      const other = axis === 'x' ? 'y' : 'x';
      p.dpiStages[idx][other] = val;
    }
    this.pm.save();
  }

  onStageColorChange(idx, hex) {
    const p = this.pm.getActiveProfile();
    p.dpiStages[idx].color = hex;
    this.pm.save();
    this.renderDpiStages();
  }

  toggleStageEnabled(idx, enabled) {
    const p = this.pm.getActiveProfile();
    p.dpiStages[idx].enabled = enabled;
    this.pm.save();
    this.renderDpiStages();
  }

  toggleSeparateXY() {
    const p = this.pm.getActiveProfile();
    p.separateXY = document.getElementById('chkSeparateXY').checked;
    this.pm.save();
    this.renderDpiStages();
  }

  setActiveDpiStage(stageNum) {
    const p = this.pm.getActiveProfile();
    p.activeDpiStage = stageNum;
    this.pm.save();
    this.renderDpiStages();
  }

  // Lighting
  updateLedPreview() {
    const p = this.pm.getActiveProfile();
    const mode = p.lighting.mode;
    const hex = p.lighting.color;
    const bri = p.lighting.brightness;

    document.getElementById('ledBrightnessVal').textContent = bri;
    document.getElementById('ledSpeedVal').textContent = p.lighting.speed;

    const glow = document.getElementById('mouseGlow');
    const strip = document.getElementById('mouseLedStrip');

    if (mode === 4) { // OFF
      if (glow) glow.style.opacity = '0';
      if (strip) strip.style.opacity = '0.1';
    } else {
      if (glow) {
        glow.style.opacity = (bri / 10 * 0.7).toString();
        glow.style.backgroundColor = hex;
      }
      if (strip) {
        strip.style.opacity = (bri / 10 * 0.95).toString();
        strip.setAttribute('fill', hex);
      }
    }
  }

  onLedEffectChange() {
    const p = this.pm.getActiveProfile();
    p.lighting.mode = parseInt(document.getElementById('ledEffect').value, 10);
    this.pm.save();
    this.updateLedPreview();
  }

  onLedBrightnessChange() {
    const p = this.pm.getActiveProfile();
    p.lighting.brightness = parseInt(document.getElementById('ledBrightness').value, 10);
    this.pm.save();
    this.updateLedPreview();
  }

  onLedSpeedChange() {
    const p = this.pm.getActiveProfile();
    p.lighting.speed = parseInt(document.getElementById('ledSpeed').value, 10);
    this.pm.save();
    this.updateLedPreview();
  }

  updateLedColorFromPicker() {
    const p = this.pm.getActiveProfile();
    const val = document.getElementById('ledColorPicker').value;
    p.lighting.color = val;
    document.getElementById('ledColorHex').value = val;
    this.pm.save();
    this.updateLedPreview();
  }

  updateLedColorFromHex() {
    const p = this.pm.getActiveProfile();
    const val = document.getElementById('ledColorHex').value;
    p.lighting.color = val;
    document.getElementById('ledColorPicker').value = val;
    this.pm.save();
    this.updateLedPreview();
  }

  // Sensor Settings
  setPollingRate(hz) {
    const p = this.pm.getActiveProfile();
    p.pollingRate = hz;
    this.pm.save();
    this.setPollingRateUI(hz);
  }

  setPollingRateUI(hz) {
    [125, 250, 500, 1000].forEach(r => {
      const btn = document.getElementById('poll' + r);
      if (btn) btn.classList.toggle('active', r === hz);
    });
  }

  setLod(mm) {
    const p = this.pm.getActiveProfile();
    p.lod = mm;
    this.pm.save();
    this.setLodUI(mm);
  }

  setLodUI(mm) {
    [1, 2].forEach(l => {
      const btn = document.getElementById('lod' + l);
      if (btn) btn.classList.toggle('active', l === mm);
    });
  }

  onDebounceChange() {
    const p = this.pm.getActiveProfile();
    const v = parseInt(document.getElementById('debounceSlider').value, 10);
    p.debounce = v;
    document.getElementById('debounceVal').textContent = `${v} ms`;
    this.pm.save();
  }

  onSleepChange() {
    const p = this.pm.getActiveProfile();
    const v = parseInt(document.getElementById('sleepSlider').value, 10);
    p.sleepMin = v;
    document.getElementById('sleepVal').textContent = `${v} min`;
    this.pm.save();
  }

  onSensorToggleChange(field, val) {
    const p = this.pm.getActiveProfile();
    p[field] = !!val;
    this.pm.save();
  }

  onKeyRemapChange(keyNum, val) {
    const p = this.pm.getActiveProfile();
    p.keys['key' + keyNum] = val;
    this.pm.save();
  }

  bindMouseSvgButtonHovers() {
    for (let k = 1; k <= 6; k++) {
      const svgEl = document.getElementById('btnSvg' + k);
      const selEl = document.getElementById('key' + k);
      if (svgEl && selEl) {
        svgEl.addEventListener('mouseenter', () => {
          svgEl.style.filter = "brightness(1.5) drop-shadow(0 0 5px var(--accent-cyan))";
          selEl.parentElement.style.borderColor = "var(--accent-cyan)";
        });
        svgEl.addEventListener('mouseleave', () => {
          svgEl.style.filter = "";
          selEl.parentElement.style.borderColor = "";
        });
      }
    }
  }

  // WebHID Connection
  async connectDevice() {
    try {
      const dev = await this.proto.requestAndOpen();
      if (!dev) return;
      this.onConnected();
      // Auto-read mouse state
      await this.readFromMouse();
    } catch (err) {
      this.log(`Connection error: ${err.message}`, 'err');
      alert(`Connection failed: ${err.message}`);
    }
  }

  onConnected() {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    const btn = document.getElementById('btnConnect');

    dot.className = 'status-dot online';
    const isWireless = this.proto.device.productId === 0xFA7C;
    text.textContent = isWireless ? 'Connected (2.4G Wireless)' : 'Connected (Wired)';

    btn.textContent = 'Connected';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-secondary');

    document.getElementById('btnRead').disabled = false;
    document.getElementById('btnApply').disabled = false;
    document.getElementById('batteryBox').style.display = 'flex';
  }

  onDisconnected() {
    this.proto.close();
    document.getElementById('statusDot').className = 'status-dot';
    document.getElementById('statusText').textContent = 'Disconnected';

    const btn = document.getElementById('btnConnect');
    btn.textContent = 'Connect Mouse';
    btn.classList.add('btn-primary');
    btn.classList.remove('btn-secondary');

    document.getElementById('btnRead').disabled = true;
    document.getElementById('btnApply').disabled = true;
    document.getElementById('batteryBox').style.display = 'none';
  }

  updateBatteryUI({ power, charging }) {
    if (power >= 0 && power <= 100) {
      document.getElementById('batteryText').textContent = `${power}%`;
      const bar = document.getElementById('batteryLevelBar');
      bar.style.width = `${power}%`;
      bar.style.backgroundColor = power < 20 ? '#ff5252' : 'var(--success)';
    }
    document.getElementById('chargingBadge').style.display = charging ? 'inline' : 'none';
  }

  handleDeviceEvent(evt) {
    if (evt.type === 'dpi_change') {
      this.log(`Mouse switched physically to DPI Stage ${evt.stage}`, 'in');
      this.setActiveDpiStage(evt.stage);
    }
  }

  // Mouse Hardware Transactions
  async readFromMouse() {
    if (!this.proto.isConnected) return;
    this.log('=== Reading 181-byte EEPROM from Mouse (Read-Only) ===', 'out');
    try {
      const eepromDump = await this.proto.readEEPROM(0x00, 181);
      // Save immutable hardware snapshot backup
      this.pm.createHardwareBackup(eepromDump);
      const restoreBtn = document.getElementById('btnRestoreHw');
      if (restoreBtn) restoreBtn.style.display = 'inline-flex';

      // Check active hardware profile index (byte 0x01)
      const hwIdx = eepromDump[1];
      if (hwIdx >= 0 && hwIdx < this.pm.profiles.length) {
        this.pm.activeIndex = hwIdx;
      }

      const updated = this.pm.deserializeEEPROM(eepromDump, this.pm.getActiveProfile());
      this.renderProfileSelector();
      this.loadProfileIntoUI(updated);
      this.log(`Read active mouse configuration into profile "${updated.name}"! Mouse hardware memory was NOT modified.`, 'in');
    } catch (e) {
      this.log(`Read error: ${e.message}`, 'err');
    }
  }

  restoreOriginalHardwareState() {
    if (!this.pm.hardwareBackupProfile) {
      alert('No original hardware snapshot available.');
      return;
    }
    if (confirm('Restore the original configuration read from the mouse upon connecting?')) {
      const cur = this.pm.getActiveProfile();
      const backupCopy = JSON.parse(JSON.stringify(this.pm.hardwareBackupProfile));
      delete backupCopy.id;
      delete backupCopy.name;
      Object.assign(cur, backupCopy);
      this.pm.save();
      this.loadProfileIntoUI(cur);
      this.log(`Restored original hardware snapshot into profile "${cur.name}".`, 'in');
    }
  }

  async applyToMouse() {
    if (!this.proto.isConnected) return;
    const cur = this.pm.getActiveProfile();

    const confirmed = confirm(`Are you sure you want to write profile "${cur.name}" to the mouse onboard memory?`);
    if (!confirmed) {
      this.log('Write cancelled. Mouse onboard memory was NOT modified.', 'in');
      return;
    }

    this.log(`=== Flashing Profile "${cur.name}" to Mouse Hardware ===`, 'out');

    try {
      const eepromBytes = this.pm.serializeEEPROM(cur);
      await this.proto.writeEEPROM(0x00, eepromBytes);
      await this.proto.commitFlash();
      this.log(`Flash committed successfully! Mouse now running profile "${cur.name}".`, 'in');
      alert(`Settings applied to Fantech Helios Go XD5 successfully!`);
    } catch (e) {
      this.log(`Flash error: ${e.message}`, 'err');
      alert(`Error applying settings: ${e.message}`);
    }
  }

  async sendHandshake() {
    await this.proto.sendHandshake(true);
  }

  async queryBattery() {
    await this.proto.queryBattery();
  }
}

export const app = new HeliosApp();
window.app = app;
window.addEventListener('DOMContentLoaded', () => app.init());

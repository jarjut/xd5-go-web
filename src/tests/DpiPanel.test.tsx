import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DpiPanel } from '../components/panels/DpiPanel';
import { LightingPanel } from '../components/panels/LightingPanel';
import { SettingsProvider } from '../context/SettingsContext';

describe('DpiPanel', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders 7 stages and allows toggling Separate X/Y DPI', () => {
    render(
      <SettingsProvider>
        <DpiPanel />
      </SettingsProvider>
    );

    const toggle = screen.getByLabelText(/Separate X & Y DPI/i);
    expect(toggle).toBeDefined();
    expect((toggle as HTMLInputElement).checked).toBe(false);

    fireEvent.click(toggle);
    expect((toggle as HTMLInputElement).checked).toBe(true);
  });

  it('renders 7 stage rows with stage numbers, swatches, and active stage radio', () => {
    render(
      <SettingsProvider>
        <DpiPanel />
      </SettingsProvider>
    );

    for (let i = 1; i <= 7; i++) {
      expect(screen.getByText(new RegExp(`^Stage ${i}$`, 'i'))).toBeDefined();
      expect(screen.getByLabelText(new RegExp(`Active Stage ${i}`, 'i'))).toBeDefined();
      expect(screen.getByLabelText(new RegExp(`Stage ${i} Color`, 'i'))).toBeDefined();
      expect(screen.getByLabelText(new RegExp(`Set ${i} DPI Stages`, 'i'))).toBeDefined();
    }
  });

  it('allows selecting an active stage via radio', () => {
    render(
      <SettingsProvider>
        <DpiPanel />
      </SettingsProvider>
    );

    const radio3 = screen.getByLabelText(/Active Stage 3/i) as HTMLInputElement;
    fireEvent.click(radio3);
    expect(radio3.checked).toBe(true);
  });

  it('allows configuring DPI Stage count (e.g. 4 stages in cycle)', () => {
    render(
      <SettingsProvider>
        <DpiPanel />
      </SettingsProvider>
    );

    // Select 4 stages in cycle
    const btn4 = screen.getByLabelText(/Set 4 DPI Stages/i);
    fireEvent.click(btn4);
    expect(btn4.getAttribute('aria-pressed')).toBe('true');

    // Stages 1 to 4 should be enabled (active radios enabled)
    for (let i = 1; i <= 4; i++) {
      const radio = screen.getByLabelText(new RegExp(`Active Stage ${i}`, 'i')) as HTMLInputElement;
      expect(radio.disabled).toBe(false);
    }

    // Stages 5 to 7 should be disabled (radios disabled)
    for (let i = 5; i <= 7; i++) {
      const radio = screen.getByLabelText(new RegExp(`Active Stage ${i}`, 'i')) as HTMLInputElement;
      expect(radio.disabled).toBe(true);
    }
  });

  it('updates stage color via color input', () => {
    render(
      <SettingsProvider>
        <DpiPanel />
      </SettingsProvider>
    );

    const colorInput = screen.getByLabelText(/Stage 1 Color/i) as HTMLInputElement;
    fireEvent.change(colorInput, { target: { value: '#123456' } });
    expect(colorInput.value).toBe('#123456');
  });

  it('updates DPI with PAW3370 step rules (50 <= 10K, 100 > 10K)', () => {
    render(
      <SettingsProvider>
        <DpiPanel />
      </SettingsProvider>
    );

    const slider1 = screen.getByLabelText(/^Stage 1 DPI$/i) as HTMLInputElement;
    // Set to 850 (valid 50-step)
    fireEvent.change(slider1, { target: { value: '850' } });
    expect(slider1.value).toBe('850');

    // Set to 10150 -> should snap to 100-step (10100 or 10200)
    fireEvent.change(slider1, { target: { value: '10150' } });
    expect(Number(slider1.value) % 100).toBe(0);

    // Set beyond bounds clamps to 19000
    fireEvent.change(slider1, { target: { value: '25000' } });
    expect(slider1.value).toBe('19000');
  });

  it('handles Separate X & Y DPI controls independently', () => {
    render(
      <SettingsProvider>
        <DpiPanel />
      </SettingsProvider>
    );

    const toggle = screen.getByLabelText(/Separate X & Y DPI/i);
    fireEvent.click(toggle);

    const xSlider = screen.getByLabelText(/^Stage 1 X DPI$/i) as HTMLInputElement;
    const ySlider = screen.getByLabelText(/^Stage 1 Y DPI$/i) as HTMLInputElement;

    fireEvent.change(xSlider, { target: { value: '1200' } });
    fireEvent.change(ySlider, { target: { value: '2400' } });

    expect(xSlider.value).toBe('1200');
    expect(ySlider.value).toBe('2400');
  });

  it('increments and decrements DPI via steppers', () => {
    render(
      <SettingsProvider>
        <DpiPanel />
      </SettingsProvider>
    );

    const numInput = screen.getByLabelText(/Stage 1 DPI Input/i) as HTMLInputElement;
    const initialVal = Number(numInput.value);

    const plusBtn = screen.getByLabelText(/Increase Stage 1 DPI/i);
    fireEvent.click(plusBtn);

    const newVal = Number(numInput.value);
    expect(newVal).toBe(initialVal + 50);

    const minusBtn = screen.getByLabelText(/Decrease Stage 1 DPI/i);
    fireEvent.click(minusBtn);
    expect(Number(numInput.value)).toBe(initialVal);
  });

  it('allows free typing in numeric input without eager snapping and commits on blur', () => {
    render(
      <SettingsProvider>
        <DpiPanel />
      </SettingsProvider>
    );

    const numInput = screen.getByLabelText(/Stage 1 DPI Input/i) as HTMLInputElement;
    fireEvent.focus(numInput);

    // Intermediate typing: typing "1", then "12", then "1200"
    fireEvent.change(numInput, { target: { value: '1' } });
    expect(numInput.value).toBe('1');

    fireEvent.change(numInput, { target: { value: '12' } });
    expect(numInput.value).toBe('12');

    fireEvent.change(numInput, { target: { value: '1200' } });
    expect(numInput.value).toBe('1200');

    // Blur commits the snapped value
    fireEvent.blur(numInput);
    expect(numInput.value).toBe('1200');

    // Slider should also reflect the committed 1200
    const slider1 = screen.getByLabelText(/^Stage 1 DPI$/i) as HTMLInputElement;
    expect(slider1.value).toBe('1200');
  });

  it('commits numeric input on Enter key', () => {
    render(
      <SettingsProvider>
        <DpiPanel />
      </SettingsProvider>
    );

    const numInput = screen.getByLabelText(/Stage 2 DPI Input/i) as HTMLInputElement;
    fireEvent.focus(numInput);
    fireEvent.change(numInput, { target: { value: '3200' } });
    expect(numInput.value).toBe('3200');

    fireEvent.keyDown(numInput, { key: 'Enter', code: 'Enter' });
    expect(numInput.value).toBe('3200');

    const slider2 = screen.getByLabelText(/^Stage 2 DPI$/i) as HTMLInputElement;
    expect(slider2.value).toBe('3200');
  });

  it('clamps and snaps numeric input on blur according to PAW3370 rules', () => {
    render(
      <SettingsProvider>
        <DpiPanel />
      </SettingsProvider>
    );

    const numInput = screen.getByLabelText(/Stage 1 DPI Input/i) as HTMLInputElement;

    // Below min (< 50) snaps to 50
    fireEvent.focus(numInput);
    fireEvent.change(numInput, { target: { value: '20' } });
    fireEvent.blur(numInput);
    expect(numInput.value).toBe('50');

    // Above max (> 19000) snaps to 19000
    fireEvent.focus(numInput);
    fireEvent.change(numInput, { target: { value: '25000' } });
    fireEvent.blur(numInput);
    expect(numInput.value).toBe('19000');

    // High DPI snapping (> 10000) snaps to 100-step (e.g. 10150 -> 10200)
    fireEvent.focus(numInput);
    fireEvent.change(numInput, { target: { value: '10150' } });
    fireEvent.blur(numInput);
    expect(numInput.value).toBe('10200');
  });

  it('sets dynamic slider step attribute based on current value threshold', () => {
    render(
      <SettingsProvider>
        <DpiPanel />
      </SettingsProvider>
    );

    // Stage 1 default is 800 (< 10000) -> step should be 50
    const slider1 = screen.getByLabelText(/^Stage 1 DPI$/i) as HTMLInputElement;
    expect(slider1.step).toBe('50');

    // Stage 7 default is 19000 (>= 10000) -> step should be 100
    const slider7 = screen.getByLabelText(/^Stage 7 DPI$/i) as HTMLInputElement;
    expect(slider7.step).toBe('100');

    // Change stage 1 to 12000 -> step should dynamically update to 100
    fireEvent.change(slider1, { target: { value: '12000' } });
    expect(slider1.step).toBe('100');
  });
});

describe('LightingPanel', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders all 7 LED mode cards and allows selecting them', () => {
    render(
      <SettingsProvider>
        <LightingPanel />
      </SettingsProvider>
    );

    const modes = [
      'Streaming',
      'Breathing',
      'Steady',
      'Neon',
      'Scrolling',
      'Colorful Breathing',
      'OFF',
    ];

    for (const modeName of modes) {
      expect(screen.getByRole('button', { name: new RegExp(`^${modeName}$`, 'i') })).toBeDefined();
    }

    // Switch to Breathing
    const breathingCard = screen.getByRole('button', { name: /^Breathing$/i });
    fireEvent.click(breathingCard);

    // Color picker should now be active/visible
    expect(screen.getByLabelText(/LED Color Picker/i)).toBeDefined();
  });

  it('updates custom LED color and hex input', () => {
    render(
      <SettingsProvider>
        <LightingPanel />
      </SettingsProvider>
    );

    // Switch to Steady mode which supports color
    const steadyCard = screen.getByRole('button', { name: /^Steady$/i });
    fireEvent.click(steadyCard);

    const colorPicker = screen.getByLabelText(/LED Color Picker/i) as HTMLInputElement;
    const hexInput = screen.getByLabelText(/LED Color Hex/i) as HTMLInputElement;

    fireEvent.change(colorPicker, { target: { value: '#ff0055' } });
    expect(hexInput.value.toLowerCase()).toBe('#ff0055');

    fireEvent.change(hexInput, { target: { value: '#00ffcc' } });
    expect(colorPicker.value.toLowerCase()).toBe('#00ffcc');
  });


  it('updates speed and brightness sliders within 1-10 range', () => {
    render(
      <SettingsProvider>
        <LightingPanel />
      </SettingsProvider>
    );

    const speedSlider = screen.getByLabelText(/LED Speed/i) as HTMLInputElement;
    const briSlider = screen.getByLabelText(/LED Brightness/i) as HTMLInputElement;

    fireEvent.change(speedSlider, { target: { value: '8' } });
    expect(speedSlider.value).toBe('8');

    fireEvent.change(briSlider, { target: { value: '3' } });
    expect(briSlider.value).toBe('3');
  });
});

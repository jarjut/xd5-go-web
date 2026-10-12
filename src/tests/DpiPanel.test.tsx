import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DpiPanel } from '../components/panels/DpiPanel';
import { LightingPanel } from '../components/panels/LightingPanel';
import { ProfileProvider } from '../context/ProfileContext';

describe('DpiPanel', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders 7 stages and allows toggling Separate X/Y DPI', () => {
    render(
      <ProfileProvider>
        <DpiPanel />
      </ProfileProvider>
    );

    const toggle = screen.getByLabelText(/Separate X & Y DPI/i);
    expect(toggle).toBeDefined();
    expect((toggle as HTMLInputElement).checked).toBe(false);

    fireEvent.click(toggle);
    expect((toggle as HTMLInputElement).checked).toBe(true);
  });

  it('renders 7 stage rows with stage numbers, swatches, and active stage radio', () => {
    render(
      <ProfileProvider>
        <DpiPanel />
      </ProfileProvider>
    );

    for (let i = 1; i <= 7; i++) {
      expect(screen.getByText(new RegExp(`^Stage ${i}$`, 'i'))).toBeDefined();
      expect(screen.getByLabelText(new RegExp(`Active Stage ${i}`, 'i'))).toBeDefined();
      expect(screen.getByLabelText(new RegExp(`Enable Stage ${i}`, 'i'))).toBeDefined();
      expect(screen.getByLabelText(new RegExp(`Stage ${i} Color`, 'i'))).toBeDefined();
    }
  });

  it('allows selecting an active stage via radio', () => {
    render(
      <ProfileProvider>
        <DpiPanel />
      </ProfileProvider>
    );

    const radio3 = screen.getByLabelText(/Active Stage 3/i) as HTMLInputElement;
    fireEvent.click(radio3);
    expect(radio3.checked).toBe(true);
  });

  it('allows disabling and enabling stages, preventing disabling all stages', () => {
    render(
      <ProfileProvider>
        <DpiPanel />
      </ProfileProvider>
    );

    const enableCheck7 = screen.getByLabelText(/Enable Stage 7/i) as HTMLInputElement;
    expect(enableCheck7.checked).toBe(true);
    fireEvent.click(enableCheck7);
    expect(enableCheck7.checked).toBe(false);

    // Disable stages 2 to 6
    for (let i = 2; i <= 6; i++) {
      const chk = screen.getByLabelText(new RegExp(`Enable Stage ${i}`, 'i')) as HTMLInputElement;
      if (chk.checked) fireEvent.click(chk);
    }

    // Now only Stage 1 is enabled. Trying to disable stage 1 should be prevented or disabled.
    const enableCheck1 = screen.getByLabelText(/Enable Stage 1/i) as HTMLInputElement;
    expect(enableCheck1.disabled).toBe(true);
  });

  it('updates stage color via color input', () => {
    render(
      <ProfileProvider>
        <DpiPanel />
      </ProfileProvider>
    );

    const colorInput = screen.getByLabelText(/Stage 1 Color/i) as HTMLInputElement;
    fireEvent.change(colorInput, { target: { value: '#123456' } });
    expect(colorInput.value).toBe('#123456');
  });

  it('updates DPI with PAW3370 step rules (50 <= 10K, 100 > 10K)', () => {
    render(
      <ProfileProvider>
        <DpiPanel />
      </ProfileProvider>
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
      <ProfileProvider>
        <DpiPanel />
      </ProfileProvider>
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
      <ProfileProvider>
        <DpiPanel />
      </ProfileProvider>
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
});

describe('LightingPanel', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders all 7 LED mode cards and allows selecting them', () => {
    render(
      <ProfileProvider>
        <LightingPanel />
      </ProfileProvider>
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
      <ProfileProvider>
        <LightingPanel />
      </ProfileProvider>
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

  it('matches profile accent color via quick action button', () => {
    render(
      <ProfileProvider>
        <LightingPanel />
      </ProfileProvider>
    );

    // Switch to Steady
    fireEvent.click(screen.getByRole('button', { name: /^Steady$/i }));

    const matchBtn = screen.getByRole('button', { name: /Match Profile Accent/i });
    fireEvent.click(matchBtn);

    const colorPicker = screen.getByLabelText(/LED Color Picker/i) as HTMLInputElement;
    expect(colorPicker.value).toBeTruthy();
  });

  it('updates speed and brightness sliders within 1-10 range', () => {
    render(
      <ProfileProvider>
        <LightingPanel />
      </ProfileProvider>
    );

    const speedSlider = screen.getByLabelText(/LED Speed/i) as HTMLInputElement;
    const briSlider = screen.getByLabelText(/LED Brightness/i) as HTMLInputElement;

    fireEvent.change(speedSlider, { target: { value: '8' } });
    expect(speedSlider.value).toBe('8');

    fireEvent.change(briSlider, { target: { value: '3' } });
    expect(briSlider.value).toBe('3');
  });
});

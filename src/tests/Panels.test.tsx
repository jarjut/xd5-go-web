import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SensorPanel } from '../components/panels/SensorPanel';
import { KeyRemapPanel } from '../components/panels/KeyRemapPanel';
import { DiagnosticsPanel } from '../components/panels/DiagnosticsPanel';
import { ReadySettingsProvider as SettingsProvider } from './ReadySettingsProvider';
import { DeviceProvider } from '../context/DeviceContext';
import { createDefaultSettings } from '../core/settings';
import { SettingsSession } from '../core/settingsSession';

describe('Performance and Remapping Panels', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('SensorPanel', () => {
    it('renders polling rate buttons and debounce slider', () => {
      render(
        <SettingsProvider>
          <SensorPanel />
        </SettingsProvider>
      );

      expect(screen.getByText('1000 Hz')).toBeDefined();
      expect(screen.getByText('500 Hz')).toBeDefined();
      expect(screen.getByText('250 Hz')).toBeDefined();
      expect(screen.getByText('125 Hz')).toBeDefined();
      expect(screen.getByLabelText(/Debounce Time/i)).toBeDefined();
    });

    it('renders LOD options and sleep timer slider', () => {
      render(
        <SettingsProvider>
          <SensorPanel />
        </SettingsProvider>
      );

      expect(screen.getByText(/1\s*mm/i)).toBeDefined();
      expect(screen.getByText(/2\s*mm/i)).toBeDefined();
      expect(screen.getByLabelText(/Auto-Sleep Timer/i)).toBeDefined();
    });

    it('allows changing polling rate and LOD pills', () => {
      render(
        <SettingsProvider>
          <SensorPanel />
        </SettingsProvider>
      );

      const poll500Btn = screen.getByRole('button', { name: /500 Hz/i });
      fireEvent.click(poll500Btn);
      expect(poll500Btn.getAttribute('data-active')).toBe('true');

      const lod2Btn = screen.getByRole('button', { name: /2\s*mm/i });
      fireEvent.click(lod2Btn);
      expect(lod2Btn.getAttribute('data-active')).toBe('true');
    });

    it('allows adjusting debounce and sleep timer sliders', () => {
      render(
        <SettingsProvider>
          <SensorPanel />
        </SettingsProvider>
      );

      const debounceSlider = screen.getByLabelText(/Debounce Time/i) as HTMLInputElement;
      fireEvent.change(debounceSlider, { target: { value: '16' } });
      expect(debounceSlider.value).toBe('16');
      expect(screen.getByText('16 ms')).toBeDefined();

      const sleepSlider = screen.getByLabelText(/Auto-Sleep Timer/i) as HTMLInputElement;
      fireEvent.change(sleepSlider, { target: { value: '5' } });
      expect(sleepSlider.value).toBe('5');
      expect(screen.getByText('5 min')).toBeDefined();
    });

    it('toggles Ripple Control, Angle Snapping, and Turn OFF Light on Moving', () => {
      render(
        <SettingsProvider>
          <SensorPanel />
        </SettingsProvider>
      );

      const rippleToggle = screen.getByLabelText(/Ripple Control/i) as HTMLInputElement;
      expect(rippleToggle.checked).toBe(false);
      fireEvent.click(rippleToggle);
      expect(rippleToggle.checked).toBe(true);

      const angleSnapToggle = screen.getByLabelText(/Angle Snapping/i) as HTMLInputElement;
      expect(angleSnapToggle.checked).toBe(false);
      fireEvent.click(angleSnapToggle);
      expect(angleSnapToggle.checked).toBe(true);

      const turnOffMoveToggle = screen.getByLabelText(/Turn OFF Light on Moving/i) as HTMLInputElement;
      expect(turnOffMoveToggle.checked).toBe(true);
      fireEvent.click(turnOffMoveToggle);
      expect(turnOffMoveToggle.checked).toBe(false);
    });
  });

  describe('KeyRemapPanel', () => {
    it('renders all 6 mouse button remap selectors', () => {
      render(
        <SettingsProvider>
          <KeyRemapPanel focusedButton={null} onHoverButton={() => {}} />
        </SettingsProvider>
      );

      expect(screen.getByText(/1\. Left Click/i)).toBeDefined();
      expect(screen.getByText(/2\. Right Click/i)).toBeDefined();
      expect(screen.getByText(/3\. Middle Button/i)).toBeDefined();
      expect(screen.getByText(/4\. Back Button/i)).toBeDefined();
      expect(screen.getByText(/5\. Forward Button/i)).toBeDefined();
      expect(screen.getByText(/6\. DPI Loop Button/i)).toBeDefined();
    });

    it('renders categorized option groups in key remap selectors', () => {
      render(
        <SettingsProvider>
          <KeyRemapPanel focusedButton={null} onHoverButton={() => {}} />
        </SettingsProvider>
      );

      const key1Select = screen.getByLabelText(/1\. Left Click/i) as HTMLSelectElement;
      expect(key1Select).toBeDefined();

      const optgroups = key1Select.querySelectorAll('optgroup');
      const labels = Array.from(optgroups).map((og) => og.label);
      expect(labels).toContain('Standard Clicks');
      expect(labels).toContain('Navigation');
      expect(labels).toContain('Hardware Loop Functions');
      expect(labels).toContain('Multimedia & Windows');
    });

    it('triggers onHoverButton on mouseEnter and mouseLeave', () => {
      const onHover = vi.fn();
      render(
        <SettingsProvider>
          <KeyRemapPanel focusedButton={null} onHoverButton={onHover} />
        </SettingsProvider>
      );

      const card1 = screen.getByTestId('key-remap-card-1');
      fireEvent.mouseEnter(card1);
      expect(onHover).toHaveBeenCalledWith(1);

      fireEvent.mouseLeave(card1);
      expect(onHover).toHaveBeenCalledWith(null);
    });

    it('highlights focused button card when focusedButton prop is passed', () => {
      render(
        <SettingsProvider>
          <KeyRemapPanel focusedButton={4} onHoverButton={() => {}} />
        </SettingsProvider>
      );

      const card4 = screen.getByTestId('key-remap-card-4');
      expect(card4.getAttribute('data-focused')).toBe('true');

      const card1 = screen.getByTestId('key-remap-card-1');
      expect(card1.getAttribute('data-focused')).toBe('false');
    });


    it('shows warning alert when Left Click is missing from all buttons', () => {
      const noClickSettings = createDefaultSettings();
      noClickSettings.keys = {
        key1: '0x00000201', // Right Click instead
        key2: '0x00000201',
        key3: '0x00000401',
        key4: '0x00000801',
        key5: '0x00001001',
        key6: '0x00000102',
      };

      const session = new SettingsSession({ settings: noClickSettings });

      render(
        <SettingsProvider session={session}>
          <KeyRemapPanel focusedButton={null} onHoverButton={() => {}} />
        </SettingsProvider>
      );

      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText(/At least one button must be configured as "Left Click"/i)).toBeDefined();
    });
  });

  describe('DiagnosticsPanel', () => {


    it('copies log stream to clipboard and cleans up unmount timer safely', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText },
      });

      const { unmount } = render(
        <DeviceProvider>
          <DiagnosticsPanel />
        </DeviceProvider>
      );

      const copyBtn = screen.getByRole('button', { name: /Copy Log/i });
      await act(async () => {
        fireEvent.click(copyBtn);
      });

      expect(writeText).toHaveBeenCalled();
      unmount();
    });
  });
});

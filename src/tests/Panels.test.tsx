import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SensorPanel } from '../components/panels/SensorPanel';
import { KeyRemapPanel } from '../components/panels/KeyRemapPanel';
import { DiagnosticsPanel } from '../components/panels/DiagnosticsPanel';
import { ProfileProvider, ProfileContext } from '../context/ProfileContext';
import { DeviceProvider, DeviceContext } from '../context/DeviceContext';
import { createDefaultProfile } from '../core/profiles';
import type { DeviceContextType } from '../context/DeviceContext';
import type { ProfileContextType } from '../context/ProfileContext';

describe('Performance and Remapping Panels', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('SensorPanel', () => {
    it('renders polling rate buttons and debounce slider', () => {
      render(
        <ProfileProvider>
          <SensorPanel />
        </ProfileProvider>
      );

      expect(screen.getByText('1000 Hz')).toBeDefined();
      expect(screen.getByText('500 Hz')).toBeDefined();
      expect(screen.getByText('250 Hz')).toBeDefined();
      expect(screen.getByText('125 Hz')).toBeDefined();
      expect(screen.getByLabelText(/Debounce Time/i)).toBeDefined();
    });

    it('renders LOD options and sleep timer slider', () => {
      render(
        <ProfileProvider>
          <SensorPanel />
        </ProfileProvider>
      );

      expect(screen.getByText(/1\s*mm/i)).toBeDefined();
      expect(screen.getByText(/2\s*mm/i)).toBeDefined();
      expect(screen.getByLabelText(/Auto-Sleep Timer/i)).toBeDefined();
    });

    it('allows changing polling rate and LOD pills', () => {
      render(
        <ProfileProvider>
          <SensorPanel />
        </ProfileProvider>
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
        <ProfileProvider>
          <SensorPanel />
        </ProfileProvider>
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
        <ProfileProvider>
          <SensorPanel />
        </ProfileProvider>
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
        <ProfileProvider>
          <KeyRemapPanel focusedButton={null} onHoverButton={() => {}} />
        </ProfileProvider>
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
        <ProfileProvider>
          <KeyRemapPanel focusedButton={null} onHoverButton={() => {}} />
        </ProfileProvider>
      );

      const key1Select = screen.getByLabelText(/1\. Left Click/i) as HTMLSelectElement;
      expect(key1Select).toBeDefined();

      const optgroups = key1Select.querySelectorAll('optgroup');
      const labels = Array.from(optgroups).map((og) => og.label);
      expect(labels).toContain('Standard Clicks');
      expect(labels).toContain('Navigation');
      expect(labels).toContain('Hardware Loop Functions');
    });

    it('triggers onHoverButton on mouseEnter and mouseLeave', () => {
      const onHover = vi.fn();
      render(
        <ProfileProvider>
          <KeyRemapPanel focusedButton={null} onHoverButton={onHover} />
        </ProfileProvider>
      );

      const card1 = screen.getByTestId('key-remap-card-1');
      fireEvent.mouseEnter(card1);
      expect(onHover).toHaveBeenCalledWith(1);

      fireEvent.mouseLeave(card1);
      expect(onHover).toHaveBeenCalledWith(null);
    });

    it('highlights focused button card when focusedButton prop is passed', () => {
      render(
        <ProfileProvider>
          <KeyRemapPanel focusedButton={4} onHoverButton={() => {}} />
        </ProfileProvider>
      );

      const card4 = screen.getByTestId('key-remap-card-4');
      expect(card4.getAttribute('data-focused')).toBe('true');

      const card1 = screen.getByTestId('key-remap-card-1');
      expect(card1.getAttribute('data-focused')).toBe('false');
    });

    it('updates key mapping when an option is selected', () => {
      const initialProfile = createDefaultProfile(1, 'Test Profile');
      const updateActiveProfile = vi.fn();

      const mockProfileContext: Partial<ProfileContextType> = {
        profiles: [initialProfile],
        activeProfile: initialProfile,
        activeIndex: 0,
        isDirty: false,
        updateActiveProfile,
      };

      render(
        <ProfileContext.Provider value={mockProfileContext as ProfileContextType}>
          <KeyRemapPanel focusedButton={null} onHoverButton={() => {}} />
        </ProfileContext.Provider>
      );

      const key4Select = screen.getByLabelText(/4\. Back Button/i) as HTMLSelectElement;
      fireEvent.change(key4Select, { target: { value: '0x00000102' } }); // DPI +

      expect(updateActiveProfile).toHaveBeenCalledWith({
        keys: expect.objectContaining({
          key4: '0x00000102',
        }),
      });
    });
  });

  describe('DiagnosticsPanel', () => {
    it('renders directional packet console and hardware specs', () => {
      render(
        <DeviceProvider>
          <DiagnosticsPanel />
        </DeviceProvider>
      );

      expect(screen.getAllByText(/0x25A7/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/0xFA7B/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/0xFA7C/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/0x08/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Ping Handshake \(0x02\)/i)).toBeDefined();
      expect(screen.getByText(/Poll Battery \(0x04\)/i)).toBeDefined();
      expect(screen.getByText(/Clear Log/i)).toBeDefined();
    });

    it('calls sendHandshake, pollBattery, and clearLogs on action button clicks', async () => {
      const sendHandshake = vi.fn().mockResolvedValue(undefined);
      const pollBattery = vi.fn().mockResolvedValue(undefined);
      const clearLogs = vi.fn();

      const mockDeviceContext: Partial<DeviceContextType> = {
        isConnected: true,
        transport: 'wired',
        battery: { power: 90, charging: false },
        logs: [
          {
            id: '1',
            timestamp: '12:00:00',
            message: 'OUT >> [08 02 01 ...]',
            text: 'OUT >> [08 02 01 ...]',
            type: 'out',
          },
          {
            id: '2',
            timestamp: '12:00:01',
            message: 'IN << [08 02 00 ...]',
            text: 'IN << [08 02 00 ...]',
            type: 'in',
          },
          {
            id: '3',
            timestamp: '12:00:02',
            message: 'ERR !! [Checksum error]',
            text: 'ERR !! [Checksum error]',
            type: 'err',
          },
        ],
        sendHandshake,
        pollBattery,
        clearLogs,
      };

      render(
        <DeviceContext.Provider value={mockDeviceContext as DeviceContextType}>
          <DiagnosticsPanel />
        </DeviceContext.Provider>
      );

      // Verify log entries are rendered
      expect(screen.getByText(/OUT >>/i)).toBeDefined();
      expect(screen.getByText(/IN <</i)).toBeDefined();
      expect(screen.getByText(/ERR !!/i)).toBeDefined();

      // Trigger buttons
      const pingBtn = screen.getByRole('button', { name: /Ping Handshake/i });
      await act(async () => {
        fireEvent.click(pingBtn);
      });
      expect(sendHandshake).toHaveBeenCalled();

      const pollBtn = screen.getByRole('button', { name: /Poll Battery/i });
      await act(async () => {
        fireEvent.click(pollBtn);
      });
      expect(pollBattery).toHaveBeenCalled();
      const clearBtn = screen.getByRole('button', { name: /Clear Log/i });
      fireEvent.click(clearBtn);
      expect(clearLogs).toHaveBeenCalled();
    });
  });
});

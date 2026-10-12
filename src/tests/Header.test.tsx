import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from '../components/layout/Header';
import { ProfileBar } from '../components/layout/ProfileBar';
import { XD5Protocol } from '../core/protocol';
import type { HIDDevice } from '../types/protocol';
import { ProfileProvider, ProfileContext, type ProfileContextType } from '../context/ProfileContext';
import { DeviceProvider, DeviceContext, type DeviceContextType } from '../context/DeviceContext';
import type { Profile } from '../types/profile';

describe('Header component', () => {
  it('renders brand and action controls', () => {
    render(
      <DeviceProvider>
        <ProfileProvider>
          <Header />
        </ProfileProvider>
      </DeviceProvider>
    );

    expect(screen.getByText('HELIOS GO XD5')).toBeDefined();
    expect(screen.getByRole('button', { name: /Connect Mouse/i })).toBeDefined();
  });

  it('renders disconnected transport badge and battery placeholder', () => {
    render(
      <DeviceProvider>
        <ProfileProvider>
          <Header />
        </ProfileProvider>
      </DeviceProvider>
    );

    expect(screen.getByText(/DISCONNECTED/i)).toBeDefined();
    expect(screen.getByText(/--%/i)).toBeDefined();
  });

  it('handles connect button click', () => {
    const connectMock = vi.fn();
    const mockDevice: DeviceContextType = {
      isConnected: false,
      device: null,
      transport: 'disconnected',
      battery: null,
      logs: [],
      connect: connectMock,
      disconnect: vi.fn(),
      sendHandshake: vi.fn().mockResolvedValue(undefined),
      pollBattery: vi.fn().mockResolvedValue(undefined),
      applyProfileToHardware: vi.fn().mockResolvedValue(undefined),
      readProfileFromHardware: vi.fn().mockResolvedValue(new Uint8Array(128)),
      isConnecting: false,
      isSyncing: false,
      clearLogs: vi.fn(),
      protocol: {} as unknown as XD5Protocol,
      lastEvent: null,
      subscribeDeviceEvent: vi.fn(() => vi.fn()),
    };

    render(
      <DeviceContext.Provider value={mockDevice}>
        <ProfileProvider>
          <Header />
        </ProfileProvider>
      </DeviceContext.Provider>
    );

    const connectBtn = screen.getByRole('button', { name: /Connect Mouse/i });
    fireEvent.click(connectBtn);
    expect(connectMock).toHaveBeenCalledTimes(1);
  });

  it('renders connected state with battery HUD, Zap charging icon, and Disconnect button', () => {
    const disconnectMock = vi.fn();
    const mockDevice: DeviceContextType = {
      isConnected: true,
      device: { productId: 0x0027, vendorId: 0x258a, productName: 'XD5 Mouse' } as unknown as HIDDevice,
      transport: 'wireless',
      battery: { power: 85, charging: true },
      logs: [],
      connect: vi.fn(),
      disconnect: disconnectMock,
      sendHandshake: vi.fn().mockResolvedValue(undefined),
      pollBattery: vi.fn().mockResolvedValue(undefined),
      applyProfileToHardware: vi.fn().mockResolvedValue(undefined),
      readProfileFromHardware: vi.fn().mockResolvedValue(new Uint8Array(128)),
      isConnecting: false,
      isSyncing: false,
      clearLogs: vi.fn(),
      protocol: {} as unknown as XD5Protocol,
      lastEvent: null,
      subscribeDeviceEvent: vi.fn(() => vi.fn()),
    };

    render(
      <DeviceContext.Provider value={mockDevice}>
        <ProfileProvider>
          <Header />
        </ProfileProvider>
      </DeviceContext.Provider>
    );

    expect(screen.getByText('85%')).toBeDefined();
    expect(screen.getByText(/2\.4G/i)).toBeDefined();
    expect(screen.getByTestId('battery-charging-icon')).toBeDefined();

    const disconnectBtn = screen.getByRole('button', { name: /Disconnect/i });
    expect(disconnectBtn).toBeDefined();
    fireEvent.click(disconnectBtn);
    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });

  it('renders glowing dirty indicator on Apply button and triggers applyToDevice', () => {
    const applyMock = vi.fn();
    const readMock = vi.fn();

    const mockProfileContext: ProfileContextType = {
      profiles: [{ id: 1, name: 'Profile 1', profileColor: '#00e5ff' } as Profile],
      activeProfile: { id: 1, name: 'Profile 1', profileColor: '#00e5ff' } as Profile,
      activeIndex: 0,
      isDirty: true,
      selectProfile: vi.fn(),
      setActiveProfile: vi.fn(),
      updateActiveProfile: vi.fn(),
      addNewProfile: vi.fn(),
      addProfile: vi.fn(),
      renameActiveProfile: vi.fn(),
      renameProfile: vi.fn(),
      deleteActiveProfile: vi.fn(),
      deleteProfile: vi.fn(),
      resetToFactory: vi.fn(),
      resetProfile: vi.fn(),
      exportJson: vi.fn(),
      exportProfileJson: vi.fn(),
      importJson: vi.fn(),
      importProfileJson: vi.fn(),
      applyToDevice: applyMock,
      readFromDevice: readMock,
      markClean: vi.fn(),
    };

    const mockDevice: DeviceContextType = {
      isConnected: true,
      device: { productId: 0x0027, vendorId: 0x258a, productName: 'XD5 Mouse' } as unknown as HIDDevice,
      transport: 'wired',
      battery: { power: 100, charging: false },
      logs: [],
      connect: vi.fn(),
      disconnect: vi.fn(),
      sendHandshake: vi.fn().mockResolvedValue(undefined),
      pollBattery: vi.fn().mockResolvedValue(undefined),
      applyProfileToHardware: vi.fn().mockResolvedValue(undefined),
      readProfileFromHardware: vi.fn().mockResolvedValue(new Uint8Array(128)),
      isConnecting: false,
      isSyncing: false,
      clearLogs: vi.fn(),
      protocol: {} as unknown as XD5Protocol,
      lastEvent: null,
      subscribeDeviceEvent: vi.fn(() => vi.fn()),
    };

    render(
      <DeviceContext.Provider value={mockDevice}>
        <ProfileContext.Provider value={mockProfileContext}>
          <Header />
        </ProfileContext.Provider>
      </DeviceContext.Provider>
    );

    const applyBtn = screen.getByRole('button', { name: /Apply Settings/i });
    expect(applyBtn.getAttribute('data-dirty')).toBe('true');

    fireEvent.click(applyBtn);
    expect(applyMock).toHaveBeenCalledTimes(1);

    const readBtn = screen.getByRole('button', { name: /Read Profile/i });
    fireEvent.click(readBtn);
    expect(readMock).toHaveBeenCalledTimes(1);
  });

  it('renders connecting state correctly', () => {
    const mockDevice: DeviceContextType = {
      isConnected: false,
      device: null,
      transport: 'disconnected',
      battery: null,
      logs: [],
      connect: vi.fn(),
      disconnect: vi.fn(),
      sendHandshake: vi.fn().mockResolvedValue(undefined),
      pollBattery: vi.fn().mockResolvedValue(undefined),
      applyProfileToHardware: vi.fn().mockResolvedValue(undefined),
      readProfileFromHardware: vi.fn().mockResolvedValue(new Uint8Array(128)),
      isConnecting: true,
      isSyncing: false,
      clearLogs: vi.fn(),
      protocol: {} as unknown as XD5Protocol,
      lastEvent: null,
      subscribeDeviceEvent: vi.fn(() => vi.fn()),
    };

    render(
      <DeviceContext.Provider value={mockDevice}>
        <ProfileProvider>
          <Header />
        </ProfileProvider>
      </DeviceContext.Provider>
    );

    expect(screen.getByText(/CONNECTING\.\.\./i)).toBeDefined();
    const connectBtn = screen.getByRole('button', { name: /Connect Mouse/i });
    expect(connectBtn.hasAttribute('disabled')).toBe(true);
  });

  it('renders with showProfileBar=true and renders ProfileBar', () => {
    render(
      <DeviceProvider>
        <ProfileProvider>
          <Header showProfileBar={true} />
        </ProfileProvider>
      </DeviceProvider>
    );

    expect(screen.getByRole('combobox', { name: /Active Profile/i })).toBeDefined();
  });
});

describe('ProfileBar component', () => {
  const dummyProfiles: Profile[] = [
    {
      id: 1,
      name: 'Profile 1',
      profileColor: '#00e5ff',
      pollingRate: 1000,
      lod: 1,
      debounce: 12,
      sleepMin: 10,
      ripple: false,
      angleSnap: false,
      turnOffOnMove: true,
      activeDpiStage: 1,
      separateXY: false,
      dpiStages: [{ enabled: true, x: 800, y: 800, color: '#ff334b' }],
      lighting: { mode: 0, color: '#00e5ff', brightness: 8, speed: 5 },
      keys: {
        key1: 'Left Click',
        key2: 'Right Click',
        key3: 'Middle Click',
        key4: 'Backward',
        key5: 'Forward',
        key6: 'DPI Loop',
      },
    },
    {
      id: 2,
      name: 'Gaming High DPI',
      profileColor: '#ff334b',
      pollingRate: 1000,
      lod: 1,
      debounce: 12,
      sleepMin: 10,
      ripple: false,
      angleSnap: false,
      turnOffOnMove: true,
      activeDpiStage: 1,
      separateXY: false,
      dpiStages: [{ enabled: true, x: 1600, y: 1600, color: '#00e5ff' }],
      lighting: { mode: 1, color: '#ff334b', brightness: 10, speed: 8 },
      keys: {
        key1: 'Left Click',
        key2: 'Right Click',
        key3: 'Middle Click',
        key4: 'Backward',
        key5: 'Forward',
        key6: 'DPI Loop',
      },
    },
  ];

  it('renders profile selector and Lucide action toolbar buttons', () => {
    const mockProfileContext: ProfileContextType = {
      profiles: dummyProfiles,
      activeProfile: dummyProfiles[0],
      activeIndex: 0,
      isDirty: false,
      selectProfile: vi.fn(),
      setActiveProfile: vi.fn(),
      updateActiveProfile: vi.fn(),
      addNewProfile: vi.fn(),
      addProfile: vi.fn(),
      renameActiveProfile: vi.fn(),
      renameProfile: vi.fn(),
      deleteActiveProfile: vi.fn(),
      deleteProfile: vi.fn(),
      resetToFactory: vi.fn(),
      resetProfile: vi.fn(),
      exportJson: vi.fn(),
      exportProfileJson: vi.fn(),
      importJson: vi.fn(),
      importProfileJson: vi.fn(),
      applyToDevice: vi.fn(),
      readFromDevice: vi.fn(),
      markClean: vi.fn(),
    };

    render(
      <ProfileContext.Provider value={mockProfileContext}>
        <ProfileBar />
      </ProfileContext.Provider>
    );

    expect(screen.getByRole('combobox', { name: /Active Profile/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Add Profile/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Rename Profile/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Color Sync/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Reset Profile/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Export Profile/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Import Profile/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Delete Profile/i })).toBeDefined();
  });

  it('handles selecting a profile from dropdown', () => {
    const selectMock = vi.fn();
    const mockProfileContext: ProfileContextType = {
      profiles: dummyProfiles,
      activeProfile: dummyProfiles[0],
      activeIndex: 0,
      isDirty: false,
      selectProfile: selectMock,
      setActiveProfile: selectMock,
      updateActiveProfile: vi.fn(),
      addNewProfile: vi.fn(),
      addProfile: vi.fn(),
      renameActiveProfile: vi.fn(),
      renameProfile: vi.fn(),
      deleteActiveProfile: vi.fn(),
      deleteProfile: vi.fn(),
      resetToFactory: vi.fn(),
      resetProfile: vi.fn(),
      exportJson: vi.fn(),
      exportProfileJson: vi.fn(),
      importJson: vi.fn(),
      importProfileJson: vi.fn(),
      applyToDevice: vi.fn(),
      readFromDevice: vi.fn(),
      markClean: vi.fn(),
    };

    render(
      <ProfileContext.Provider value={mockProfileContext}>
        <ProfileBar />
      </ProfileContext.Provider>
    );

    const select = screen.getByRole('combobox', { name: /Active Profile/i });
    fireEvent.change(select, { target: { value: '1' } });
    expect(selectMock).toHaveBeenCalledWith(1);
  });

  it('updates profile color swatch and --profile-accent custom property', () => {
    const updateMock = vi.fn();
    const mockProfileContext: ProfileContextType = {
      profiles: dummyProfiles,
      activeProfile: dummyProfiles[0],
      activeIndex: 0,
      isDirty: false,
      selectProfile: vi.fn(),
      setActiveProfile: vi.fn(),
      updateActiveProfile: updateMock,
      addNewProfile: vi.fn(),
      addProfile: vi.fn(),
      renameActiveProfile: vi.fn(),
      renameProfile: vi.fn(),
      deleteActiveProfile: vi.fn(),
      deleteProfile: vi.fn(),
      resetToFactory: vi.fn(),
      resetProfile: vi.fn(),
      exportJson: vi.fn(),
      exportProfileJson: vi.fn(),
      importJson: vi.fn(),
      importProfileJson: vi.fn(),
      applyToDevice: vi.fn(),
      readFromDevice: vi.fn(),
      markClean: vi.fn(),
    };

    render(
      <ProfileContext.Provider value={mockProfileContext}>
        <ProfileBar />
      </ProfileContext.Provider>
    );

    const colorInput = screen.getByLabelText(/Signature Color/i);
    fireEvent.change(colorInput, { target: { value: '#ff334b' } });

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        profileColor: '#ff334b',
      })
    );
    expect(document.documentElement.style.getPropertyValue('--profile-accent')).toBe('#ff334b');
  });

  it('triggers toolbar actions: add, rename, reset, delete', () => {
    const addMock = vi.fn();
    const renameMock = vi.fn();
    const resetMock = vi.fn();
    const deleteMock = vi.fn();

    const mockProfileContext: ProfileContextType = {
      profiles: dummyProfiles,
      activeProfile: dummyProfiles[0],
      activeIndex: 0,
      isDirty: false,
      selectProfile: vi.fn(),
      setActiveProfile: vi.fn(),
      updateActiveProfile: vi.fn(),
      addNewProfile: addMock,
      addProfile: addMock,
      renameActiveProfile: renameMock,
      renameProfile: renameMock,
      deleteActiveProfile: deleteMock,
      deleteProfile: deleteMock,
      resetToFactory: resetMock,
      resetProfile: resetMock,
      exportJson: vi.fn(),
      exportProfileJson: vi.fn(),
      importJson: vi.fn(),
      importProfileJson: vi.fn(),
      applyToDevice: vi.fn(),
      readFromDevice: vi.fn(),
      markClean: vi.fn(),
    };

    render(
      <ProfileContext.Provider value={mockProfileContext}>
        <ProfileBar />
      </ProfileContext.Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Add Profile/i }));
    expect(addMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Reset Profile/i }));
    expect(resetMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Delete Profile/i }));
    expect(deleteMock).toHaveBeenCalledTimes(1);
  });

  it('triggers color sync to align lighting with profile accent color', () => {
    const updateMock = vi.fn();
    const mockProfileContext: ProfileContextType = {
      profiles: dummyProfiles,
      activeProfile: dummyProfiles[0],
      activeIndex: 0,
      isDirty: false,
      selectProfile: vi.fn(),
      setActiveProfile: vi.fn(),
      updateActiveProfile: updateMock,
      addNewProfile: vi.fn(),
      addProfile: vi.fn(),
      renameActiveProfile: vi.fn(),
      renameProfile: vi.fn(),
      deleteActiveProfile: vi.fn(),
      deleteProfile: vi.fn(),
      resetToFactory: vi.fn(),
      resetProfile: vi.fn(),
      exportJson: vi.fn(),
      exportProfileJson: vi.fn(),
      importJson: vi.fn(),
      importProfileJson: vi.fn(),
      applyToDevice: vi.fn(),
      readFromDevice: vi.fn(),
      markClean: vi.fn(),
    };

    render(
      <ProfileContext.Provider value={mockProfileContext}>
        <ProfileBar />
      </ProfileContext.Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Color Sync/i }));
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        lighting: expect.objectContaining({ color: '#00e5ff' }),
      })
    );
  });

  it('renames profile using inline form when prompt is not used', () => {
    const renameMock = vi.fn();
    const mockProfileContext: ProfileContextType = {
      profiles: dummyProfiles,
      activeProfile: dummyProfiles[0],
      activeIndex: 0,
      isDirty: false,
      selectProfile: vi.fn(),
      setActiveProfile: vi.fn(),
      updateActiveProfile: vi.fn(),
      addNewProfile: vi.fn(),
      addProfile: vi.fn(),
      renameActiveProfile: renameMock,
      renameProfile: renameMock,
      deleteActiveProfile: vi.fn(),
      deleteProfile: vi.fn(),
      resetToFactory: vi.fn(),
      resetProfile: vi.fn(),
      exportJson: vi.fn(),
      exportProfileJson: vi.fn(),
      importJson: vi.fn(),
      importProfileJson: vi.fn(),
      applyToDevice: vi.fn(),
      readFromDevice: vi.fn(),
      markClean: vi.fn(),
    };

    render(
      <ProfileContext.Provider value={mockProfileContext}>
        <ProfileBar />
      </ProfileContext.Provider>
    );

    // Click rename button to toggle inline form
    fireEvent.click(screen.getByRole('button', { name: /Rename Profile/i }));

    const renameInput = screen.getByLabelText(/Rename Profile Input/i);
    expect(renameInput).toBeDefined();

    fireEvent.change(renameInput, { target: { value: 'Tournament Pro' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirm Rename/i }));

    expect(renameMock).toHaveBeenCalledWith('Tournament Pro');
  });

  it('disables delete button when only 1 profile exists', () => {
    const singleProfile = [dummyProfiles[0]];
    const mockProfileContext: ProfileContextType = {
      profiles: singleProfile,
      activeProfile: singleProfile[0],
      activeIndex: 0,
      isDirty: false,
      selectProfile: vi.fn(),
      setActiveProfile: vi.fn(),
      updateActiveProfile: vi.fn(),
      addNewProfile: vi.fn(),
      addProfile: vi.fn(),
      renameActiveProfile: vi.fn(),
      renameProfile: vi.fn(),
      deleteActiveProfile: vi.fn(),
      deleteProfile: vi.fn(),
      resetToFactory: vi.fn(),
      resetProfile: vi.fn(),
      exportJson: vi.fn(),
      exportProfileJson: vi.fn(),
      importJson: vi.fn(),
      importProfileJson: vi.fn(),
      applyToDevice: vi.fn(),
      readFromDevice: vi.fn(),
      markClean: vi.fn(),
    };

    render(
      <ProfileContext.Provider value={mockProfileContext}>
        <ProfileBar />
      </ProfileContext.Provider>
    );

    const deleteBtn = screen.getByRole('button', { name: /Delete Profile/i });
    expect(deleteBtn.hasAttribute('disabled')).toBe(true);
  });

  it('calls exportJson on export button click', () => {
    const exportMock = vi.fn().mockReturnValue('{"id": 1}');
    const mockProfileContext: ProfileContextType = {
      profiles: dummyProfiles,
      activeProfile: dummyProfiles[0],
      activeIndex: 0,
      isDirty: false,
      selectProfile: vi.fn(),
      setActiveProfile: vi.fn(),
      updateActiveProfile: vi.fn(),
      addNewProfile: vi.fn(),
      addProfile: vi.fn(),
      renameActiveProfile: vi.fn(),
      renameProfile: vi.fn(),
      deleteActiveProfile: vi.fn(),
      deleteProfile: vi.fn(),
      resetToFactory: vi.fn(),
      resetProfile: vi.fn(),
      exportJson: exportMock,
      exportProfileJson: exportMock,
      importJson: vi.fn(),
      importProfileJson: vi.fn(),
      applyToDevice: vi.fn(),
      readFromDevice: vi.fn(),
      markClean: vi.fn(),
    };

    render(
      <ProfileContext.Provider value={mockProfileContext}>
        <ProfileBar />
      </ProfileContext.Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Export Profile/i }));
    expect(exportMock).toHaveBeenCalledWith(0);
  });
});

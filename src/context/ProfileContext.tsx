import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { ProfileManager } from '../core/profiles';
import { DeviceContext } from './DeviceContext';
import type { Profile } from '../types/profile';

export function ensureProfileAliases(profile: Profile): Profile {
  if (!profile) return profile;

  if (profile.debounce === undefined) {
    profile.debounce = profile.debounceTime ?? 12;
  }
  if (profile.sleepMin === undefined) {
    profile.sleepMin = profile.sleepMinutes ?? profile.sleepTimer ?? 10;
  }
  if (!profile.profileColor) {
    profile.profileColor = profile.accentColor ?? '#00e5ff';
  }

  Object.defineProperty(profile, 'debounceTime', {
    get() {
      return this.debounce;
    },
    set(v: number) {
      this.debounce = v;
    },
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(profile, 'sleepMinutes', {
    get() {
      return this.sleepMin;
    },
    set(v: number) {
      this.sleepMin = v;
    },
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(profile, 'sleepTimer', {
    get() {
      return this.sleepMin;
    },
    set(v: number) {
      this.sleepMin = v;
    },
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(profile, 'accentColor', {
    get() {
      return this.profileColor;
    },
    set(v: string) {
      this.profileColor = v;
    },
    enumerable: true,
    configurable: true,
  });

  return profile;
}

export interface ProfileContextType {
  profiles: Profile[];
  activeProfile: Profile;
  activeIndex: number;
  isDirty: boolean;
  selectProfile: (index: number) => void;
  setActiveProfile: (index: number) => void;
  updateActiveProfile: (updates: Partial<Profile>) => void;
  addNewProfile: (name?: string, color?: string) => Profile;
  addProfile: (name?: string, color?: string) => Profile;
  renameActiveProfile: (name: string, index?: number) => void;
  renameProfile: (index: number, name: string) => void;
  deleteActiveProfile: (index?: number) => void;
  deleteProfile: (index: number) => void;
  resetToFactory: (index?: number) => void;
  resetProfile: (index: number) => void;
  exportJson: (index?: number) => string;
  exportProfileJson: (index?: number) => string;
  importJson: (jsonString: string) => Profile;
  importProfileJson: (jsonString: string) => Profile;
  applyToDevice: () => Promise<void>;
  readFromDevice: () => Promise<void>;
  markClean: () => void;
}

export const ProfileContext = createContext<ProfileContextType | null>(null);

export interface ProfileProviderProps {
  children: React.ReactNode;
  manager?: ProfileManager;
}

export const ProfileProvider: React.FC<ProfileProviderProps> = ({
  children,
  manager: customManager,
}) => {
  const device = useContext(DeviceContext);
  const profileManager = useMemo(() => customManager || new ProfileManager(), [customManager]);

  const [profiles, setProfiles] = useState<Profile[]>(() =>
    profileManager.profiles.map(ensureProfileAliases)
  );
  const [activeIndex, setActiveIndex] = useState<number>(() => profileManager.activeIndex);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  const activeProfile = profiles[activeIndex] || profiles[0];

  useEffect(() => {
    if (!device?.subscribeDeviceEvent) return;
    return device.subscribeDeviceEvent((event) => {
      if (event.type === 'dpi_change' && typeof event.stage === 'number') {
        const nextStage = event.stage;
        setProfiles((prev) => {
          const next = [...prev];
          const current = next[activeIndex];
          if (current && current.activeDpiStage !== nextStage) {
            next[activeIndex] = ensureProfileAliases({
              ...current,
              activeDpiStage: nextStage,
            });
            profileManager.profiles = next;
            profileManager.save();
          }
          return next;
        });
      }
    });
  }, [device?.subscribeDeviceEvent, activeIndex, profileManager]);

  const selectProfile = useCallback(
    (index: number) => {
      if (index >= 0 && index < profiles.length) {
        setActiveIndex(index);
        profileManager.setActiveProfile(index);
      }
    },
    [profiles.length, profileManager]
  );

  const updateActiveProfile = useCallback(
    (updates: Partial<Profile>) => {
      setProfiles((prev) => {
        const next = [...prev];
        const current = next[activeIndex];
        if (!current) return prev;

        const mergedLighting = updates.lighting
          ? { ...current.lighting, ...updates.lighting }
          : current.lighting;
        const mergedKeys = updates.keys
          ? { ...current.keys, ...updates.keys }
          : current.keys;

        const updated: Profile = {
          ...current,
          ...updates,
          lighting: mergedLighting,
          keys: mergedKeys,
        };

        if (updates.debounceTime !== undefined && updates.debounce === undefined) {
          updated.debounce = updates.debounceTime;
        } else if (updates.debounce !== undefined && updates.debounceTime === undefined) {
          updated.debounceTime = updates.debounce;
        }
        if (updates.sleepMinutes !== undefined) {
          updated.sleepMin = updates.sleepMinutes;
          updated.sleepTimer = updates.sleepMinutes;
        }
        if (updates.sleepTimer !== undefined) {
          updated.sleepMin = updates.sleepTimer;
          updated.sleepMinutes = updates.sleepTimer;
        }
        if (updates.sleepMin !== undefined) {
          updated.sleepMinutes = updates.sleepMin;
          updated.sleepTimer = updates.sleepMin;
        }
        if (updates.accentColor !== undefined && updates.profileColor === undefined) {
          updated.profileColor = updates.accentColor;
        } else if (updates.profileColor !== undefined && updates.accentColor === undefined) {
          updated.accentColor = updates.profileColor;
        }

        ensureProfileAliases(updated);
        next[activeIndex] = updated;

        profileManager.profiles = next;
        profileManager.save();
        return next;
      });

      setIsDirty(true);
    },
    [activeIndex, profileManager]
  );

  const addNewProfile = useCallback(
    (name?: string, color?: string): Profile => {
      const created = profileManager.addProfile(name, color);
      ensureProfileAliases(created);
      setProfiles([...profileManager.profiles.map(ensureProfileAliases)]);
      setActiveIndex(profileManager.activeIndex);
      setIsDirty(true);
      return created;
    },
    [profileManager]
  );

  const renameActiveProfile = useCallback(
    (name: string, index?: number) => {
      const targetIdx = index ?? activeIndex;
      profileManager.renameProfile(targetIdx, name);
      setProfiles([...profileManager.profiles.map(ensureProfileAliases)]);
      setIsDirty(true);
    },
    [activeIndex, profileManager]
  );

  const deleteActiveProfile = useCallback(
    (index?: number) => {
      const targetIdx = index ?? activeIndex;
      profileManager.deleteProfile(targetIdx);
      setProfiles([...profileManager.profiles.map(ensureProfileAliases)]);
      setActiveIndex(profileManager.activeIndex);
      setIsDirty(true);
    },
    [activeIndex, profileManager]
  );

  const resetToFactory = useCallback(
    (index?: number) => {
      const targetIdx = index ?? activeIndex;
      const reset = profileManager.resetProfile(targetIdx);
      if (reset) {
        ensureProfileAliases(reset);
        setProfiles([...profileManager.profiles.map(ensureProfileAliases)]);
        setIsDirty(true);
      }
    },
    [activeIndex, profileManager]
  );

  const exportJson = useCallback(
    (index?: number): string => {
      return profileManager.exportProfileJson(index ?? activeIndex);
    },
    [activeIndex, profileManager]
  );

  const importJson = useCallback(
    (jsonString: string): Profile => {
      const imported = profileManager.importProfileJson(jsonString);
      ensureProfileAliases(imported);
      setProfiles([...profileManager.profiles.map(ensureProfileAliases)]);
      setActiveIndex(profileManager.activeIndex);
      setIsDirty(true);
      return imported;
    },
    [profileManager]
  );

  const markClean = useCallback(() => {
    setIsDirty(false);
  }, []);

  const applyToDevice = useCallback(async () => {
    if (!device || !device.isConnected) {
      throw new Error('Device is not connected');
    }
    await device.applyProfileToHardware(activeProfile);
    setIsDirty(false);
  }, [device, activeProfile]);

  const readFromDevice = useCallback(async () => {
    if (!device || !device.isConnected) {
      throw new Error('Device is not connected');
    }
    const bytes = await device.readProfileFromHardware();
    const updated = profileManager.deserializeEEPROMToProfile(bytes, { ...activeProfile });
    ensureProfileAliases(updated);
    setProfiles((prev) => {
      const next = [...prev];
      next[activeIndex] = updated;
      profileManager.profiles = next;
      profileManager.save();
      return next;
    });
    setIsDirty(false);
  }, [device, activeProfile, activeIndex, profileManager]);

  const renameProfile = useCallback(
    (index: number, name: string) => renameActiveProfile(name, index),
    [renameActiveProfile]
  );

  const deleteProfile = useCallback(
    (index: number) => deleteActiveProfile(index),
    [deleteActiveProfile]
  );

  const resetProfile = useCallback(
    (index: number) => resetToFactory(index),
    [resetToFactory]
  );

  const value: ProfileContextType = useMemo(
    () => ({
      profiles,
      activeProfile,
      activeIndex,
      isDirty,
      selectProfile,
      setActiveProfile: selectProfile,
      updateActiveProfile,
      addNewProfile,
      addProfile: addNewProfile,
      renameActiveProfile,
      renameProfile,
      deleteActiveProfile,
      deleteProfile,
      resetToFactory,
      resetProfile,
      exportJson,
      exportProfileJson: exportJson,
      importJson,
      importProfileJson: importJson,
      applyToDevice,
      readFromDevice,
      markClean,
    }),
    [
      profiles,
      activeProfile,
      activeIndex,
      isDirty,
      selectProfile,
      updateActiveProfile,
      addNewProfile,
      renameActiveProfile,
      renameProfile,
      deleteActiveProfile,
      deleteProfile,
      resetToFactory,
      resetProfile,
      exportJson,
      importJson,
      applyToDevice,
      readFromDevice,
      markClean,
    ]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};

export function useProfiles(): ProfileContextType {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfiles must be used within a ProfileProvider');
  }
  return context;
}

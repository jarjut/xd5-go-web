# XD5 Mouse Configuration

Configuration of a connected FANTECH Helios Go XD5 mouse and the edits made during its current connection.

## Language

**Mouse settings**:
The configuration controlling the mouse's buttons, DPI stages, lighting, and sensor behavior.
_Avoid_: Profile (when referring to the complete configuration)

**Hardware settings**:
The mouse settings currently reported by the connected mouse.

**Session draft**:
The current mouse settings being edited during a connection, including changes not yet successfully written to the mouse. A session draft is not a backup.

**Pending edits**:
Changes in the session draft that have not yet been successfully written to the mouse.
_Avoid_: Saved changes (before hardware synchronization succeeds)

**Hardware synchronization**:
Reading hardware settings or writing the session draft to the mouse and committing it to its persistent memory.

**Ready**:
The state in which a mouse is connected and its initial hardware settings have been read successfully, allowing configuration.

**Settings backup**:
An explicitly exported configuration that can later be imported into a ready session.

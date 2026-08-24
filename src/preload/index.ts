import { contextBridge, ipcRenderer } from 'electron'
import type { AppEvent, DesktopApi } from '../shared/contracts'

const api: DesktopApi = {
  bootstrap: (agentId) => ipcRenderer.invoke('snapshot:get', agentId),
  agents: {
    create: (input) => ipcRenderer.invoke('agents:create', input),
    update: (id, input) => ipcRenderer.invoke('agents:update', id, input),
    archive: (id) => ipcRenderer.invoke('agents:archive', id)
  },
  chat: {
    send: (agentId, message) => ipcRenderer.invoke('chat:send', agentId, message),
    cancel: (runId) => ipcRenderer.invoke('chat:cancel', runId)
  },
  approvals: {
    resolve: (approvalId, decision) => ipcRenderer.invoke('approvals:resolve', approvalId, decision)
  },
  connectors: {
    refresh: () => ipcRenderer.invoke('connectors:refresh'),
    add: (input) => ipcRenderer.invoke('connectors:add', input),
    setEnabled: (name, enabled) => ipcRenderer.invoke('connectors:setEnabled', name, enabled),
    login: (name) => ipcRenderer.invoke('connectors:login', name)
  },
  skills: {
    refresh: () => ipcRenderer.invoke('skills:refresh'),
    review: (path, status, notes) => ipcRenderer.invoke('skills:review', path, status, notes),
    setEnabled: (path, enabled) => ipcRenderer.invoke('skills:setEnabled', path, enabled)
  },
  routines: {
    create: (input) => ipcRenderer.invoke('routines:create', input),
    update: (id, input) => ipcRenderer.invoke('routines:update', id, input),
    setStatus: (id, status) => ipcRenderer.invoke('routines:setStatus', id, status),
    runNow: (id) => ipcRenderer.invoke('routines:runNow', id)
  },
  notifications: {
    markRead: (id) => ipcRenderer.invoke('notifications:markRead', id),
    markAllRead: () => ipcRenderer.invoke('notifications:markAllRead')
  },
  shortcuts: {
    prepare: (agentId, name, input) => ipcRenderer.invoke('shortcuts:prepare', agentId, name, input)
  },
  gui: {
    refreshPermissions: () => ipcRenderer.invoke('gui:refreshPermissions'),
    requestPermission: (kind) => ipcRenderer.invoke('gui:requestPermission', kind),
    openPermissionSettings: (kind) => ipcRenderer.invoke('gui:openPermissionSettings', kind),
    prepare: (input) => ipcRenderer.invoke('gui:prepare', input),
    pause: (sessionId) => ipcRenderer.invoke('gui:pause', sessionId),
    resume: (sessionId) => ipcRenderer.invoke('gui:resume', sessionId),
    takeover: (sessionId) => ipcRenderer.invoke('gui:takeover', sessionId),
    emergencyStop: () => ipcRenderer.invoke('gui:emergencyStop'),
    resetEmergencyStop: () => ipcRenderer.invoke('gui:resetEmergencyStop'),
    evidenceDataUrl: (evidenceId) => ipcRenderer.invoke('gui:evidenceDataUrl', evidenceId)
  },
  artifacts: {
    create: (input) => ipcRenderer.invoke('artifacts:create', input)
  },
  avatars: {
    choose: () => ipcRenderer.invoke('avatars:choose')
  },
  auth: {
    refresh: () => ipcRenderer.invoke('auth:refresh'),
    signIn: () => ipcRenderer.invoke('auth:signIn'),
    signOut: () => ipcRenderer.invoke('auth:signOut')
  },
  app: {
    openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
    revealPath: (path) => ipcRenderer.invoke('app:revealPath', path)
  },
  events: {
    subscribe: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, value: AppEvent): void => listener(value)
      ipcRenderer.on('splittbot:event', handler)
      return () => ipcRenderer.removeListener('splittbot:event', handler)
    }
  }
}

contextBridge.exposeInMainWorld('splittbot', api)

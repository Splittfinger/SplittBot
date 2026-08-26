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
    chooseImages: () => ipcRenderer.invoke('chat:chooseImages'),
    send: (agentId, message, attachmentIds) => ipcRenderer.invoke('chat:send', agentId, message, attachmentIds),
    cancel: (runId) => ipcRenderer.invoke('chat:cancel', runId)
  },
  approvals: {
    resolve: (approvalId, decision) => ipcRenderer.invoke('approvals:resolve', approvalId, decision),
    ask: (approvalId, question) => ipcRenderer.invoke('approvals:ask', approvalId, question),
    editAndApprove: (approvalId, input) => ipcRenderer.invoke('approvals:editAndApprove', approvalId, input)
  },
  workspaces: {
    create: (input) => ipcRenderer.invoke('workspaces:create', input),
    update: (id, input) => ipcRenderer.invoke('workspaces:update', id, input),
    setStatus: (id, status) => ipcRenderer.invoke('workspaces:setStatus', id, status),
    startTask: (id, prompt) => ipcRenderer.invoke('workspaces:startTask', id, prompt)
  },
  connectors: {
    refresh: () => ipcRenderer.invoke('connectors:refresh'),
    add: (input) => ipcRenderer.invoke('connectors:add', input),
    update: (name, input) => ipcRenderer.invoke('connectors:update', name, input),
    remove: (name) => ipcRenderer.invoke('connectors:remove', name),
    setEnabled: (name, enabled) => ipcRenderer.invoke('connectors:setEnabled', name, enabled),
    login: (name) => ipcRenderer.invoke('connectors:login', name),
    logout: (name) => ipcRenderer.invoke('connectors:logout', name),
    addAccount: (input) => ipcRenderer.invoke('connectors:addAccount', input),
    loginAccount: (id) => ipcRenderer.invoke('connectors:loginAccount', id),
    logoutAccount: (id) => ipcRenderer.invoke('connectors:logoutAccount', id),
    removeAccount: (id) => ipcRenderer.invoke('connectors:removeAccount', id)
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
    runNow: (id) => ipcRenderer.invoke('routines:runNow', id),
    delete: (id) => ipcRenderer.invoke('routines:delete', id)
  },
  notifications: {
    markRead: (id) => ipcRenderer.invoke('notifications:markRead', id),
    markAllRead: () => ipcRenderer.invoke('notifications:markAllRead')
  },
  memories: {
    add: (agentId, content) => ipcRenderer.invoke('memories:add', agentId, content),
    setPolicy: (agentId, input) => ipcRenderer.invoke('memories:setPolicy', agentId, input),
    delete: (id) => ipcRenderer.invoke('memories:delete', id),
    clear: (agentId) => ipcRenderer.invoke('memories:clear', agentId),
    deleteThread: (agentId) => ipcRenderer.invoke('memories:deleteThread', agentId),
    export: (agentId) => ipcRenderer.invoke('memories:export', agentId)
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
  acceptance: {
    refreshPermissions: () => ipcRenderer.invoke('acceptance:refreshPermissions'),
    exerciseIMessage: () => ipcRenderer.invoke('acceptance:exerciseIMessage'),
    exerciseWakeCatchUp: () => ipcRenderer.invoke('acceptance:exerciseWakeCatchUp')
  },
  artifacts: {
    create: (input) => ipcRenderer.invoke('artifacts:create', input),
    export: (id) => ipcRenderer.invoke('artifacts:export', id)
  },
  avatars: {
    choose: () => ipcRenderer.invoke('avatars:choose')
  },
  auth: {
    refresh: () => ipcRenderer.invoke('auth:refresh'),
    signIn: () => ipcRenderer.invoke('auth:signIn'),
    signOut: () => ipcRenderer.invoke('auth:signOut')
  },
  data: {
    createBackup: () => ipcRenderer.invoke('data:createBackup'),
    restoreBackup: () => ipcRenderer.invoke('data:restoreBackup'),
    revealLocalData: () => ipcRenderer.invoke('data:revealLocalData')
  },
  app: {
    openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
    revealPath: (path) => ipcRenderer.invoke('app:revealPath', path),
    getVersion: () => ipcRenderer.invoke('app:getVersion')
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

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  initClient: (config, preResolveDomains) => ipcRenderer.invoke('init-client', config, preResolveDomains),
  dnsResolve: (domain, queryType) => ipcRenderer.invoke('dns-resolve', domain, queryType),
  httpRequest: (url) => ipcRenderer.invoke('http-request', url),
  httpRequestSystemDNS: (url) => ipcRenderer.invoke('http-request-system-dns', url)
});

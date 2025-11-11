const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const https = require('https');
const http = require('http');
const { createHTTPDNSClient } = require('@alicloud-emas/httpdns');

let mainWindow;
let httpdnsClient;
let clientConfig = {};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile('index.html');
}

// 初始化客户端
ipcMain.handle('init-client', async (event, config, preResolveDomains) => {
  try {
    // 关闭旧客户端
    if (httpdnsClient) {
      console.log('🔄 [Init] 关闭旧客户端...');
      await httpdnsClient.close();
      console.log('✅ [Init] 旧客户端已关闭');
    }

    // 创建新客户端
    console.log('🔄 [Init] 创建新客户端...');
    console.log(`   enableCache: ${config.enableCache}`);
    httpdnsClient = createHTTPDNSClient(
      config.accountId,
      config.secretKey,
      {
        enableHTTPS: config.enableHTTPS,
        enableCache: config.enableCache,
        enableExpiredIP: config.enableExpiredIP,
        timeout: config.timeout,
        maxRetries: config.maxRetries,
        logger: console
      }
    );

    // 保存配置
    clientConfig = config;

    // 预解析域名
    if (preResolveDomains && preResolveDomains.length > 0) {
      console.log(`🔄 [Pre-resolve] 开始预解析 ${preResolveDomains.length} 个域名`);
      httpdnsClient.setPreResolveHosts(preResolveDomains);
    }

    console.log('✅ [Init] HTTPDNS 客户端初始化成功');

    return {
      success: true,
      message: '客户端初始化成功'
    };
  } catch (error) {
    console.error('❌ [Init] 初始化失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// DNS解析
ipcMain.handle('dns-resolve', async (event, domain, queryType) => {
  try {
    if (!httpdnsClient) {
      throw new Error('客户端未初始化');
    }

    console.log(`🌐 [DNS Resolve] 解析域名: ${domain}, 查询类型: ${queryType}`);

    const startTime = Date.now();

    // 使用非阻塞接口（推荐）：立即返回缓存或null
    const result = httpdnsClient.getHttpDnsResultForHostSyncNonBlocking(domain, {
      queryType
    });

    const duration = Date.now() - startTime;

    if (result !== null) {
      console.log(`✅ [DNS Resolve] 缓存命中: ${domain}, 耗时: ${duration}ms`);
    } else {
      console.log(`⚠️ [DNS Resolve] 缓存未命中: ${domain}, 后台正在解析`);
    }

    return {
      success: true,
      domain,
      queryType,
      result,
      duration,
      fromCache: result !== null
    };
  } catch (error) {
    console.error(`❌ [DNS Resolve] 解析失败:`, error);
    return {
      success: false,
      error: error.message
    };
  }
});

// 发送HTTP请求
ipcMain.handle('http-request', async (event, url) => {
  console.log(`\n========== 开始新的 HTTP 请求 ==========`);
  console.log(`📡 [HTTP Request] 目标: ${url}`);
  
  try {
    console.log(`\n--- 第1次尝试：使用 HTTPDNS ---`);
    const startTime = Date.now();
    const result = await makeHttpRequest(url, { useHTTPDNS: true });
    const duration = Date.now() - startTime;

    console.log(`✅ [HTTP Request] 第1次成功: 耗时 ${duration}ms, 状态码 ${result.statusCode}`);
    console.log(`========== 请求完成 ==========\n`);

    return {
      success: true,
      ...result,
      duration
    };
  } catch (error) {
    console.error(`❌ [HTTP Request] 第1次失败: ${error.message}`);
    
    // 🔄 单次重试：降级到系统 DNS
    console.log(`\n--- 第2次尝试：降级到系统 DNS ---`);
    
    try {
      const startTime = Date.now();
      const result = await makeHttpRequest(url, { useHTTPDNS: false });
      const duration = Date.now() - startTime;
      
      console.log(`✅ [HTTP Request] 第2次成功: 耗时 ${duration}ms, 状态码 ${result.statusCode}`);
      console.log(`========== 请求完成（重试成功）==========\n`);
      
      return {
        success: true,
        ...result,
        duration,
        retriedWithSystemDNS: true
      };
    } catch (retryError) {
      console.error(`❌ [HTTP Request] 第2次失败: ${retryError.message}`);
      console.log(`========== 请求完成（两次都失败）==========\n`);
      return {
        success: false,
        error: retryError.message
      };
    }
  }
});

// 发送HTTP请求（纯系统 DNS，对照测试）
ipcMain.handle('http-request-system-dns', async (event, url) => {
  try {
    console.log(`📡 [HTTP Request - System DNS] 开始请求: ${url}`);

    const startTime = Date.now();
    const result = await makeHttpRequestSystemDNS(url);
    const duration = Date.now() - startTime;

    console.log(`✅ [HTTP Request - System DNS] 请求成功: ${url}, 耗时: ${duration}ms, 状态码: ${result.statusCode}`);

    return {
      success: true,
      ...result,
      duration
    };
  } catch (error) {
    console.error(`❌ [HTTP Request - System DNS] 请求失败: ${url}, 错误: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
});

// 包装函数：记录 DNS 信息
function customDnsLookupWithInfo(hostname, options, dnsInfo, callback) {
  // 先检查 HTTPDNS 是否有缓存
  const httpdnsResult = httpdnsClient.getHttpDnsResultForHostSyncNonBlocking(hostname);
  const hasHTTPDNSCache = httpdnsResult !== null;
  
  customDnsLookup(hostname, options, (err, address, family) => {
    if (!err && address) {
      // 记录解析到的 IP
      if (Array.isArray(address)) {
        dnsInfo.resolvedIP = address.map(a => a.address).join(', ');
      } else {
        dnsInfo.resolvedIP = address;
      }
      
      // 根据之前的检查结果判断是否使用了 HTTPDNS
      if (hasHTTPDNSCache) {
        dnsInfo.usedHTTPDNS = true;
        dnsInfo.fallbackToLocalDNS = false;
      } else {
        dnsInfo.usedHTTPDNS = false;
        dnsInfo.fallbackToLocalDNS = true;
      }
    }
    
    // 根据 options.all 决定参数个数
    if (options && options.all) {
      callback(err, address);  // 2个参数
    } else {
      callback(err, address, family);  // 3个参数
    }
  });
}

// 自定义DNS lookup函数 - 使用HTTPDNS
function customDnsLookup(hostname, options, callback) {
  // 标准化参数
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  console.log(`🌐 [DNS Lookup] 开始解析: ${hostname}`);
  console.log(`   options.all: ${options && options.all}`);
  console.log(`   options.family: ${options && options.family}`);

  // 使用 HTTPDNS 非阻塞解析
  const result = httpdnsClient.getHttpDnsResultForHostSyncNonBlocking(hostname);
  console.log(`   HTTPDNS result: ${result ? 'has cache' : 'null'}`);

  if (result) {
    const hasIPv4 = result.ipv4 && result.ipv4.length > 0;
    const hasIPv6 = result.ipv6 && result.ipv6.length > 0;

    if (hasIPv4 || hasIPv6) {
      console.log(`✅ [DNS Lookup] 使用 HTTPDNS 缓存`);

      if (options && options.all) {
        // 只返回 IPv4 地址（避免 IPv6 兼容性问题）
        const addresses = hasIPv4 
          ? result.ipv4.map(ip => ({ address: ip, family: 4 }))
          : [];
        const ipList = addresses.map(a => a.address).join(', ');
        console.log(`✅ [DNS Lookup] HTTPDNS 解析成功: ${hostname} -> 返回IPv4 (${addresses.length}个)`);
        console.log(`   IP列表: ${ipList}`);
        callback(null, addresses);  // options.all=true 时只传2个参数
      } else {
        // 优先IPv4，其次IPv6
        if (hasIPv4) {
          console.log(`✅ [DNS Lookup] HTTPDNS 解析成功: ${hostname} -> ${result.ipv4[0]} (IPv4)`);
          callback(null, result.ipv4[0], 4);  // options.all=false 时传3个参数
        } else {
          console.log(`✅ [DNS Lookup] HTTPDNS 解析成功: ${hostname} -> ${result.ipv6[0]} (IPv6)`);
          callback(null, result.ipv6[0], 6);
        }
      }
      return;
    }
  }

  // HTTPDNS 无可用IP，降级到系统 DNS
  console.log(`⚠️ [DNS Lookup] HTTPDNS 无缓存，降级到 Local DNS: ${hostname}`);
  const dns = require('dns');
  dns.lookup(hostname, options, callback);
}

// 发送HTTP请求的辅助函数 - 集成HTTPDNS
function makeHttpRequest(url, options = {}) {
  const useHTTPDNS = options.useHTTPDNS !== false;  // 默认使用 HTTPDNS
  
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;

    // 用于记录 DNS 解析信息
    const dnsInfo = {
      usedHTTPDNS: false,
      fallbackToLocalDNS: false,
      resolvedIP: null
    };

    // 创建使用自定义DNS lookup的Agent
    const Agent = protocol === https ? https.Agent : http.Agent;
    const agent = new Agent({
      lookup: useHTTPDNS 
        ? (hostname, options, callback) => {
            // 包装 customDnsLookup 来记录 DNS 信息
            customDnsLookupWithInfo(hostname, options, dnsInfo, callback);
          }
        : undefined,
      autoSelectFamily: true, // 启用多 IP 自动重试（只返回 IPv4 在 lookup 中处理）
      keepAlive: true,
      maxSockets: 10,
      timeout: 5000
    });

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      agent: agent,  // 使用自定义Agent
      headers: {
        'User-Agent': 'HTTPDNS-Demo/1.0',
        'Host': urlObj.hostname  // 重要：保持原始Host头
      }
    };

    console.log(`📡 [HTTP Request] ${options.method} ${url}`);
    console.log(`   使用 HTTPDNS: ${useHTTPDNS}`);
    console.log(`   Agent 配置:`);
    console.log(`     lookup: ${agent.options.lookup ? 'customDnsLookup' : 'undefined (系统DNS)'}`);
    console.log(`     keepAlive: ${agent.options.keepAlive}`);
    console.log(`     maxSockets: ${agent.options.maxSockets}`);
    console.log(`     timeout: ${agent.options.timeout}`);

    const req = protocol.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`✅ [HTTP Response] ${res.statusCode} ${res.statusMessage}`);

        resolve({
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          headers: res.headers,
          body: data.substring(0, 1000), // 只返回前1000字符
          usedHTTPDNS: dnsInfo.usedHTTPDNS,
          resolvedIP: dnsInfo.resolvedIP,
          fallbackToLocalDNS: dnsInfo.fallbackToLocalDNS
        });
      });
    });

    req.on('error', (error) => {
      console.error(`❌ [HTTP Error] 详细信息:`);
      console.error(`   message: ${error.message}`);
      console.error(`   code: ${error.code}`);
      console.error(`   errno: ${error.errno}`);
      console.error(`   syscall: ${error.syscall}`);
      console.error(`   address: ${error.address}`);
      console.error(`   port: ${error.port}`);
      reject(error);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// 发送HTTP请求的辅助函数 - 纯系统 DNS（对照测试）
function makeHttpRequestSystemDNS(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      // 不设置自定义 Agent，使用默认（系统 DNS）
      headers: {
        'User-Agent': 'HTTPDNS-Demo/1.0',
        'Host': urlObj.hostname
      }
    };

    console.log(`📡 [HTTP Request - System DNS] ${options.method} ${url}`);

    const req = protocol.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`✅ [HTTP Response - System DNS] ${res.statusCode} ${res.statusMessage}`);

        resolve({
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          headers: res.headers,
          body: data.substring(0, 1000),
          usedHTTPDNS: false,
          fallbackToLocalDNS: false,
          resolvedIP: null
        });
      });
    });

    req.on('error', (error) => {
      console.error(`❌ [HTTP Error - System DNS] ${error.message}`);
      reject(error);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', async () => {
  if (httpdnsClient) {
    await httpdnsClient.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

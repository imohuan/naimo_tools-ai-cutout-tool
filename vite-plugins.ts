/**
 * Vite 插件集合
 * 1. preloadBuilderPlugin - 打包 preload.ts
 * 2. manifestCopyPlugin - 复制 manifest.json 到 dist
 * 3. devWatchPlugin - dev 模式下监听文件变化并通知
 * 4. copyFolderPlugin - 构建完成后复制文件夹到剪贴板
 */

import { build, Plugin, ViteDevServer, InlineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { execSync } from 'child_process';
import preloadConfig from './vite.config.preloads';

/**
 * 构建状态管理
 */
interface BuildState {
  isBuilding: boolean;
  buildQueue: Array<(success: boolean) => void>;
}

const buildState: BuildState = {
  isBuilding: false,
  buildQueue: []
};

/**
 * Preload 构建配置（从配置文件导入）
 */
const preloadBuildConfig: InlineConfig = {
  ...preloadConfig,
  configFile: false
};

/**
 * 构建 preload.ts
 */
async function buildPreload(): Promise<boolean> {
  if (buildState.isBuilding) {
    console.log('⏳ Preload 构建进行中，加入队列...');
    return new Promise((resolve) => {
      buildState.buildQueue.push(resolve);
    });
  }

  buildState.isBuilding = true;
  console.log('🔨 开始构建 preload.ts...');

  try {
    await build(preloadBuildConfig);
    console.log('✅ Preload.ts 编译完成!');

    // 处理队列中的请求
    const queue = buildState.buildQueue;
    buildState.buildQueue = [];
    queue.forEach(resolve => resolve(true));

    return true;
  } catch (error) {
    console.error('❌ Preload 构建失败:', error);

    // 清空队列并返回失败
    const queue = buildState.buildQueue;
    buildState.buildQueue = [];
    queue.forEach(resolve => resolve(false));

    return false;
  } finally {
    buildState.isBuilding = false;
  }
}

/**
 * 复制单个文件
 */
function copyFile(source: string, dest: string, description?: string): boolean {
  try {
    if (!existsSync(source)) {
      console.warn(`⚠️  源文件不存在: ${source}`);
      return false;
    }
    copyFileSync(source, dest);
    const fileName = source.split(/[\\/]/).pop();
    console.log(`✅ 已复制: ${fileName}${description ? ` (${description})` : ''}`);
    return true;
  } catch (error) {
    console.error(`❌ 复制失败: ${source}`, error);
    return false;
  }
}

// ===========================================
// 插件 1: Preload 打包插件
// ===========================================
export interface PreloadBuilderPluginOptions {
  /** 是否在启动时自动构建，默认 true */
  buildOnStart?: boolean;
}

/**
 * Vite 插件：Preload 构建器
 * 用于在构建时打包 preload.ts
 */
export function preloadBuilderPlugin(
  options: PreloadBuilderPluginOptions = {}
): Plugin {
  const { buildOnStart = true } = options;

  return {
    name: 'vite-plugin-preload-builder',

    async buildStart() {
      // 在构建开始时打包 preload
      if (buildOnStart) {
        await buildPreload();
      }
    },

    async closeBundle() {
      // 在输出文件后再次构建 preload（确保在最终构建时也执行）
      await buildPreload();
    }
  };
}

// ===========================================
// 插件 2: Manifest 复制插件
// ===========================================
export interface ManifestCopyPluginOptions {
  /** 源文件路径，默认为 ./manifest.json */
  source?: string;
  /** 目标文件路径，默认为 ./dist/manifest.json */
  dest?: string;
}

/**
 * 修改 manifest.json 的 main 字段（开发模式专用）
 */
function modifyManifestForDev(sourcePath: string, destPath: string): void {
  try {
    const destDir = dirname(destPath);
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }
    copyFileSync(sourcePath, destPath);
    console.log('📋 已复制 manifest.json 到 dist 目录');

    const content = readFileSync(destPath, 'utf-8');
    const manifest = JSON.parse(content);
    // 修改 main 字段为开发服务器地址
    manifest.main = 'http://localhost:3000/';
    writeFileSync(destPath, JSON.stringify(manifest, null, 2), 'utf-8');
    console.log('🔧 开发模式：已将 manifest.json 的 main 设置为 http://localhost:3000/');
  } catch (error) {
    console.error('❌ 修改 manifest.json 失败:', error);
  }
}

/**
 * Vite 插件：Manifest 复制器
 * 用于在构建时复制 manifest.json 到 dist 目录
 */
export function manifestCopyPlugin(
  options: ManifestCopyPluginOptions = {}
): Plugin {
  const {
    source = resolve(__dirname, './manifest.json'),
    dest = resolve(__dirname, './dist/manifest.json')
  } = options;

  return {
    name: 'vite-plugin-manifest-copy',

    configureServer(server: ViteDevServer) {
      // 如果是开发模式，复制并修改 manifest.json
      modifyManifestForDev(source, dest);
      server.watcher.add(source);
      server.watcher.on('change', async (_file: string) => {
        modifyManifestForDev(source, dest);
      })
    },

    closeBundle() {
      // 在输出文件后复制 manifest.json
      console.log('📋 复制 manifest.json...');
      copyFile(source, dest, 'manifest.json');
    }
  };
}

// ===========================================
// 插件 3: Dev 监听插件
// ===========================================
export interface DevWatchPluginOptions {
  /** 要监听的文件路径，默认为 src/preload.ts */
  watchPath?: string;
  /** 是否在启动时自动构建，默认 true */
  buildOnStart?: boolean;
}

/**
 * Vite 插件：Dev 模式监听器
 * 用于在开发模式下监听文件变化，自动打包并通知前端
 */
export function devWatchPlugin(
  options: DevWatchPluginOptions = {}
): Plugin {
  const {
    watchPath = resolve(__dirname, './src/preload.ts'),
    buildOnStart = true
  } = options;

  let server: ViteDevServer;

  return {
    name: 'vite-plugin-dev-watch',

    configureServer(_server: ViteDevServer) {
      server = _server;

      // 初始构建
      if (buildOnStart) {
        buildPreload();
      }

      // 监听 preload.ts 文件变化
      server.watcher.add(watchPath);

      server.watcher.on('change', async (file: string) => {
        // 检查是否是 preload.ts
        if (file.includes('preload.ts')) {
          console.log('📝 检测到 preload.ts 变化，通知前端...');

          // 只发送通知，不在这里构建
          // 让前端在 HMR 回调中统一处理构建
          if (server) {
            server.ws.send({
              type: 'custom',
              event: 'preload-changed',
              data: { timestamp: Date.now() }
            });
          }
        }
      });

      // 提供 API 端点供前端主动触发构建
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/__preload_build') {
          console.log('🔨 收到前端请求，开始构建 preload...');
          const success = await buildPreload();

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success, timestamp: Date.now() }));
          return;
        }
        next();
      });
    }
  };
}


// ===========================================
// 插件 4: 复制文件夹到剪贴板插件
// ===========================================
export interface CopyFolderPluginOptions {
  /** 要复制到剪贴板的文件夹路径，默认为 ./dist */
  folderPath?: string;
}

/**
 * Vite 插件：复制文件夹到剪贴板
 * 用于在构建完成后将指定文件夹复制到系统剪贴板（仅支持 Windows）
 */
export function copyFolderPlugin(
  options: CopyFolderPluginOptions = {}
): Plugin {
  const {
    folderPath = resolve(__dirname, './dist'),
  } = options;

  return {
    name: 'vite-plugin-copy-folder',

    buildStart() {
      console.log('📋 准备复制文件夹到剪贴板...');
      copyFolderToClipboard(folderPath);
    }
  };
}
/**
 * 复制文件夹到剪贴板中（仅支持 Windows）
 * 使用 Node.js 内置模块，无需第三方依赖
 */
export function copyFolderToClipboard(folderPath: string): void {
  try {
    // 检查文件夹是否存在
    if (!existsSync(folderPath)) {
      console.error(`❌ 文件夹不存在: ${folderPath}`);
      return;
    }

    // 是否是window
    if (process.platform !== 'win32') {
      console.warn('⚠️  此功能仅支持 Windows 系统');
      return;
    }


    // 转换为绝对路径并规范化路径分隔符
    const absolutePath = resolve(folderPath).replace(/\//g, '\\');

    // 使用 PowerShell 命令将文件夹路径复制到剪贴板
    // 创建一个 StringCollection 对象并设置到剪贴板
    const psScript = `
      Add-Type -AssemblyName System.Windows.Forms;
      $files = New-Object System.Collections.Specialized.StringCollection;
      $files.Add('${absolutePath}');
      [System.Windows.Forms.Clipboard]::SetFileDropList($files);
    `;

    execSync(`powershell -Command "${psScript.replace(/\n/g, ' ')}"`, {
      encoding: 'utf-8',
      windowsHide: true
    });

    console.log(`✅ 已将文件夹复制到剪贴板: ${absolutePath}`);
  } catch (error) {
    console.error('❌ 复制文件夹到剪贴板失败:', error);
  }
}


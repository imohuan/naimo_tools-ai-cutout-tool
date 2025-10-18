/**
 * 插件注册中心
 */

import type { CutoutPlugin, PluginRegistry } from '../typings';
import { deeplabPlugin } from '../plugins/deeplab';
import { selfiePlugin } from '../plugins/selfie';
import { colorPlugin } from '../plugins/color';
import { imglyPlugin } from '../plugins/imgly';

class PluginRegistryImpl implements PluginRegistry {
  plugins: Map<string, CutoutPlugin>;

  constructor() {
    this.plugins = new Map();
  }

  register(plugin: CutoutPlugin): void {
    if (this.plugins.has(plugin.id)) {
      console.warn(`插件 ${plugin.id} 已存在，将被覆盖`);
    }
    this.plugins.set(plugin.id, plugin);
    console.log(`插件 ${plugin.id} (${plugin.name}) 已注册`);
  }

  unregister(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      if (plugin.cleanup) {
        plugin.cleanup();
      }
      this.plugins.delete(pluginId);
      console.log(`插件 ${pluginId} 已注销`);
    }
  }

  get(pluginId: string): CutoutPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  getAll(): CutoutPlugin[] {
    return Array.from(this.plugins.values());
  }
}

// 创建全局插件注册表实例
export const pluginRegistry = new PluginRegistryImpl();

// 注册内置插件
export function registerBuiltinPlugins(): void {
  pluginRegistry.register(deeplabPlugin);
  pluginRegistry.register(selfiePlugin);
  pluginRegistry.register(colorPlugin);
  pluginRegistry.register(imglyPlugin);
  console.log('内置插件注册完成');
}

// 导出便捷函数
export function getPlugin(pluginId: string): CutoutPlugin | undefined {
  return pluginRegistry.get(pluginId);
}

export function getAllPlugins(): CutoutPlugin[] {
  return pluginRegistry.getAll();
}


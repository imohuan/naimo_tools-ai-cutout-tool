/**
 * 类型定义文件
 */

// ============ 基础类型 ============

export interface ImageData {
  id: string;
  original: HTMLImageElement;
  processed: string | null;  // base64字符串
  processedImageData: globalThis.ImageData | null;  // 保存处理后的ImageData用于对比
  file: File;
  name: string;
}

export type AIModel = 'deeplab' | 'selfie';

export interface ProcessOptions {
  mode: 'ai' | 'color';
  aiModel?: AIModel;
  threshold?: number;
  feather?: number;
  morph?: number;
  clean?: number;
  opacity?: number;
  colorTolerance?: number;
  colorFeather?: number;
  colorExpand?: number;
  colorMode?: 'remove' | 'keep';
  pickedColors?: RGB[];
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface CanvasTransform {
  scale: number;
  x: number;
  y: number;
}

export type ImageSegmenter = any;

export interface ImageSegmenters {
  deeplab: ImageSegmenter | null;
  selfie: ImageSegmenter | null;
}

// ============ 插件系统类型 ============

export type ConfigFieldType =
  | 'slider'      // 滑动条
  | 'radio'       // 单选按钮组
  | 'button'      // 按钮
  | 'color-list'  // 颜色列表（用于颜色拾取）
  | 'custom';     // 自定义组件

/**
 * 插件上下文 - 提供给插件使用的功能和状态
 */
export interface PluginContext {
  // 画布相关
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  originalImage: HTMLImageElement;

  // 颜色拾取
  startColorPicking: () => void;
  stopColorPicking: () => void;
  pickedColors: RGB[];
  addPickedColor: (color: RGB) => void;
  removePickedColor: (index: number) => void;
  clearPickedColors: () => void;

  // AI 模型（如果需要）
  imageSegmenter?: ImageSegmenter;

  // 状态更新
  setStatus: (message: string) => void;

  // 工具函数
  yieldToUI: () => Promise<void>;
}

/**
 * 配置项基础接口
 */
interface BaseConfigField {
  key: string;        // 配置项的唯一键
  label: string;      // 显示标签
  description?: string; // 描述文本
}

/**
 * 滑动条配置
 */
export interface SliderConfigField extends BaseConfigField {
  type: 'slider';
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;      // 单位，如 'px', '%'
  format?: (value: number) => string; // 自定义格式化函数
}

/**
 * 单选按钮配置
 */
export interface RadioConfigField extends BaseConfigField {
  type: 'radio';
  options: Array<{
    value: string;
    label: string;
    description?: string;
  }>;
  default: string;
}

/**
 * 按钮配置
 */
export interface ButtonConfigField extends BaseConfigField {
  type: 'button';
  buttonText: string;
  variant?: 'primary' | 'secondary' | 'danger'; // 按钮样式
  icon?: string; // SVG 图标路径
  onClick: (context: PluginContext, config: Record<string, any>) => void | Promise<void>;
}

/**
 * 颜色列表配置
 */
export interface ColorListConfigField extends BaseConfigField {
  type: 'color-list';
  pickButtonText: string;
  clearButtonText: string;
  emptyText: string;
}

/**
 * 自定义组件配置
 */
export interface CustomConfigField extends BaseConfigField {
  type: 'custom';
  component: any; // Vue 组件
  props?: Record<string, any>; // 传递给组件的额外 props
}

/**
 * 联合类型：所有配置项类型
 */
export type ConfigField =
  | SliderConfigField
  | RadioConfigField
  | ButtonConfigField
  | ColorListConfigField
  | CustomConfigField;

/**
 * 插件处理结果
 */
export interface PluginProcessResult {
  success: boolean;
  message?: string;
  imageData?: globalThis.ImageData; // 处理后的图像数据
}

/**
 * 插件配置
 */
export interface CutoutPlugin {
  // 基本信息
  id: string;
  name: string;
  description: string;
  icon?: string; // SVG 图标

  // 配置项
  configFields: ConfigField[];

  // 获取默认配置值
  getDefaultConfig: () => Record<string, any>;

  // 处理函数（第一次调用时会自动加载模型）
  process: (
    context: PluginContext,
    config: Record<string, any>
  ) => Promise<PluginProcessResult>;

  // 清理（可选）
  cleanup?: () => void;
}

/**
 * 插件注册表
 */
export interface PluginRegistry {
  plugins: Map<string, CutoutPlugin>;
  register: (plugin: CutoutPlugin) => void;
  unregister: (pluginId: string) => void;
  get: (pluginId: string) => CutoutPlugin | undefined;
  getAll: () => CutoutPlugin[];
}


/**
 * DeepLab V3 插件 - 通用场景AI抠图
 */

import type { CutoutPlugin, PluginContext, PluginProcessResult, ImageSegmenter } from '../typings';
import { applyGaussianBlur, applyMorphology, applyMedianFilter } from '../utils/image-processing';
import { loadSingleModel } from '../utils/mediapipe';

// 懒加载的模型实例
let cachedSegmenter: ImageSegmenter | null = null;
let isLoading = false;

export const deeplabPlugin: CutoutPlugin = {
  id: 'deeplab',
  name: 'DeepLab V3（通用场景）',
  description: '基于 DeepLab V3 模型的通用场景 AI 抠图，适用于各种物体和人物',

  configFields: [
    {
      type: 'slider',
      key: 'threshold',
      label: '分割阈值',
      description: '控制前景/背景分离的敏感度',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.5,
    },
    {
      type: 'slider',
      key: 'feather',
      label: '边缘羽化',
      description: '使边缘更加柔和自然',
      min: 0,
      max: 10,
      step: 1,
      default: 2,
      unit: 'px',
    },
    {
      type: 'slider',
      key: 'morph',
      label: '边缘调整',
      description: '负值收缩边缘，正值扩展边缘',
      min: -5,
      max: 5,
      step: 1,
      default: 0,
      unit: 'px',
    },
    {
      type: 'slider',
      key: 'clean',
      label: '边缘清洁',
      description: '去除边缘噪点',
      min: 0,
      max: 20,
      step: 1,
      default: 5,
      unit: 'px',
    },
    {
      type: 'slider',
      key: 'opacity',
      label: '边缘透明度',
      description: '调整边缘区域的透明度',
      min: 0,
      max: 100,
      step: 1,
      default: 100,
      unit: '%',
    },
  ],

  getDefaultConfig() {
    return {
      threshold: 0.5,
      feather: 2,
      morph: 0,
      clean: 5,
      opacity: 100,
    };
  },

  async process(context: PluginContext, config: Record<string, any>): Promise<PluginProcessResult> {
    const { canvas, ctx, originalImage, setStatus, yieldToUI } = context;

    // 懒加载模型：第一次执行时才加载
    if (!cachedSegmenter && !isLoading) {
      isLoading = true;
      setStatus('正在加载 DeepLab V3 模型...');
      try {
        cachedSegmenter = await loadSingleModel('deeplab');
        if (!cachedSegmenter) {
          return {
            success: false,
            message: 'DeepLab V3 模型加载失败',
          };
        }
        setStatus('DeepLab V3 模型加载完成');
        await yieldToUI();
      } catch (error: any) {
        isLoading = false;
        return {
          success: false,
          message: `模型加载失败: ${error.message}`,
        };
      } finally {
        isLoading = false;
      }
    }

    // 等待模型加载完成（如果正在加载）
    while (isLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!cachedSegmenter) {
      return {
        success: false,
        message: 'DeepLab V3 模型未加载',
      };
    }

    const imageSegmenter = cachedSegmenter;

    try {
      setStatus('DeepLab V3 正在分析图片...');

      // 创建临时canvas用于AI处理
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d')!;

      const maxSize = 512;
      let width = originalImage.width;
      let height = originalImage.height;

      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }

      tempCanvas.width = width;
      tempCanvas.height = height;
      tempCtx.drawImage(originalImage, 0, 0, width, height);

      // 执行AI分割
      const result = imageSegmenter.segment(tempCanvas);
      await yieldToUI();

      if (!result || !result.categoryMask) {
        return {
          success: false,
          message: 'AI 分割失败，结果无效',
        };
      }

      setStatus('正在应用分割结果...');

      // 绘制原图
      canvas.width = originalImage.width;
      canvas.height = originalImage.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // 获取mask
      const mask = result.categoryMask.getAsUint8Array();
      const maskWidth = result.categoryMask.width;
      const maskHeight = result.categoryMask.height;

      const floatMask = new Float32Array(canvas.width * canvas.height);

      // 映射遮罩（双线性插值）
      for (let y = 0; y < canvas.height; y++) {
        if (y > 0 && y % 100 === 0) {
          await yieldToUI();
        }
        for (let x = 0; x < canvas.width; x++) {
          const maskX = (x / canvas.width) * (maskWidth - 1);
          const maskY = (y / canvas.height) * (maskHeight - 1);

          const x1 = Math.floor(maskX);
          const y1 = Math.floor(maskY);
          const x2 = Math.min(x1 + 1, maskWidth - 1);
          const y2 = Math.min(y1 + 1, maskHeight - 1);

          const fx = maskX - x1;
          const fy = maskY - y1;

          const v1 = mask[y1 * maskWidth + x1];
          const v2 = mask[y1 * maskWidth + x2];
          const v3 = mask[y2 * maskWidth + x1];
          const v4 = mask[y2 * maskWidth + x2];

          const interpolated =
            v1 * (1 - fx) * (1 - fy) +
            v2 * fx * (1 - fy) +
            v3 * (1 - fx) * fy +
            v4 * fx * fy;

          const idx = y * canvas.width + x;
          // DeepLab中人物通常是类别15，或任何非0值表示前景
          floatMask[idx] = (interpolated === 15 || interpolated > 5) ? 1.0 : 0.0;
        }
      }

      await yieldToUI();

      // 应用形态学操作
      if (config.morph !== 0) {
        setStatus('正在调整边缘...');
        applyMorphology(floatMask, canvas.width, canvas.height, config.morph);
        await yieldToUI();
      }

      // 边缘清洁
      if (config.clean > 0) {
        setStatus('正在清洁边缘...');
        applyMedianFilter(floatMask, canvas.width, canvas.height, Math.min(config.clean, 3));
        await yieldToUI();
      }

      // 边缘羽化
      if (config.feather > 0) {
        setStatus('正在羽化边缘...');
        applyGaussianBlur(floatMask, canvas.width, canvas.height, config.feather);
        await yieldToUI();
      }

      // 应用到图像
      setStatus('正在生成最终结果...');
      const pixelsPerChunk = canvas.width * 100;
      for (let i = 0; i < data.length; i += 4) {
        if (i > 0 && (i / 4) % pixelsPerChunk === 0) {
          await yieldToUI();
        }

        const pixelIndex = i / 4;
        let alpha = floatMask[pixelIndex];

        // 应用阈值
        if (alpha < config.threshold) {
          alpha = 0;
        } else {
          alpha = (alpha - config.threshold) / (1 - config.threshold);
        }

        // 应用不透明度
        alpha = Math.min(1, Math.max(0, alpha * (config.opacity / 100)));
        data[i + 3] = Math.round(alpha * 255);
      }

      await yieldToUI();
      ctx.putImageData(imageData, 0, 0);

      const resultImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      return {
        success: true,
        message: 'DeepLab V3 处理完成',
        imageData: resultImageData,
      };
    } catch (error: any) {
      console.error('DeepLab V3 处理失败:', error);
      return {
        success: false,
        message: `处理失败: ${error.message}`,
      };
    }
  },
};


/**
 * 颜色抠图插件 - 基于颜色相似度的抠图
 */

import type { CutoutPlugin, PluginContext, PluginProcessResult } from '../typings';
import { applyGaussianBlur, applyMorphology, colorDistance } from '../utils/image-processing';
import ColorPicker from '../components/ColorPicker.vue';

export const colorPlugin: CutoutPlugin = {
  id: 'color',
  name: '颜色抠图',
  description: '通过拾取颜色并基于颜色相似度进行抠图，适合纯色或渐变背景',

  configFields: [
    {
      type: 'custom',
      key: 'colorPicker',
      label: '颜色拾取器',
      component: ColorPicker,
      props: {
        label: '拾取的颜色',
        description: '点击按钮后，在画布上点击要去除或保留的颜色',
        pickButtonText: '点击画布拾取颜色',
        clearButtonText: '清除所有颜色',
        emptyText: '还未拾取任何颜色',
      },
    },
    {
      type: 'slider',
      key: 'tolerance',
      label: '颜色相似度',
      description: '值越大，去除颜色范围越广',
      min: 0,
      max: 100,
      step: 1,
      default: 30,
    },
    {
      type: 'slider',
      key: 'feather',
      label: '边缘羽化',
      description: '使边缘更加柔和自然',
      min: 0,
      max: 20,
      step: 1,
      default: 2,
      unit: 'px',
    },
    {
      type: 'slider',
      key: 'expand',
      label: '边缘膨胀',
      description: '负值收缩边缘，正值扩展边缘',
      min: -10,
      max: 10,
      step: 1,
      default: 0,
      unit: 'px',
    },
    {
      type: 'radio',
      key: 'mode',
      label: '抠图模式',
      description: '选择移除或保留拾取的颜色',
      options: [
        {
          value: 'remove',
          label: '移除选中颜色',
          description: '将选中的颜色变为透明',
        },
        {
          value: 'keep',
          label: '保留选中颜色',
          description: '只保留选中的颜色，其他变为透明',
        },
      ],
      default: 'remove',
    },
  ],

  getDefaultConfig() {
    return {
      pickedColors: [],
      tolerance: 30,
      feather: 2,
      expand: 0,
      mode: 'remove',
    };
  },

  async process(context: PluginContext, config: Record<string, any>): Promise<PluginProcessResult> {
    const { canvas, ctx, originalImage, pickedColors, setStatus, yieldToUI } = context;

    if (!pickedColors || pickedColors.length === 0) {
      return {
        success: false,
        message: '请先拾取要处理的颜色',
      };
    }

    try {
      setStatus('正在进行颜色抠图...');

      // 绘制原图
      canvas.width = originalImage.width;
      canvas.height = originalImage.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      const mask = new Float32Array(canvas.width * canvas.height);

      // 创建遮罩
      setStatus('正在分析颜色...');
      for (let i = 0; i < data.length; i += 4) {
        if (i > 0 && i % (canvas.width * 100 * 4) === 0) {
          await yieldToUI();
        }

        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const pixelIndex = i / 4;

        let isMatched = false;
        for (const color of pickedColors) {
          const distance = colorDistance(r, g, b, color.r, color.g, color.b);
          if (distance <= config.tolerance) {
            isMatched = true;
            break;
          }
        }

        // 根据模式设置遮罩
        if (config.mode === 'remove') {
          mask[pixelIndex] = isMatched ? 0.0 : 1.0;
        } else {
          mask[pixelIndex] = isMatched ? 1.0 : 0.0;
        }
      }

      await yieldToUI();

      // 应用膨胀/腐蚀
      if (config.expand !== 0) {
        setStatus('正在调整边缘...');
        applyMorphology(mask, canvas.width, canvas.height, config.expand);
        await yieldToUI();
      }

      // 应用羽化
      if (config.feather > 0) {
        setStatus('正在羽化边缘...');
        applyGaussianBlur(mask, canvas.width, canvas.height, config.feather);
        await yieldToUI();
      }

      // 应用遮罩到图像
      setStatus('正在生成最终结果...');
      for (let i = 0; i < data.length; i += 4) {
        if (i > 0 && i % (canvas.width * 100 * 4) === 0) {
          await yieldToUI();
        }

        const pixelIndex = i / 4;
        const alpha = mask[pixelIndex];
        data[i + 3] = Math.round(alpha * 255);
      }

      await yieldToUI();
      ctx.putImageData(imageData, 0, 0);

      const resultImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      return {
        success: true,
        message: '颜色抠图处理完成',
        imageData: resultImageData,
      };
    } catch (error: any) {
      console.error('颜色抠图处理失败:', error);
      return {
        success: false,
        message: `处理失败: ${error.message}`,
      };
    }
  },
};


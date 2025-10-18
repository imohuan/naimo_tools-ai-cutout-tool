/**
 * ImgLy Background Removal 插件 - 基于 ONNX 的高精度抠图
 */

import type { CutoutPlugin, PluginContext, PluginProcessResult } from '../typings';
import { applyGaussianBlur, applyMorphology } from '../utils/image-processing';
import { removeBackground, Config } from '@imgly/background-removal';

export const imglyPlugin: CutoutPlugin = {
  id: 'imgly',
  name: 'ImgLy Background Removal（高精度）',
  description: '基于 ONNX Runtime 的高精度 AI 抠图，支持多种场景，处理效果优秀',

  configFields: [
    {
      type: 'radio',
      key: 'model',
      label: '模型选择',
      description: '选择不同的模型以平衡速度和质量',
      options: [
        {
          value: 'isnet_quint8',
          label: '小型模型（量化）',
          description: '最快速度，约40MB',
        },
        {
          value: 'isnet_fp16',
          label: '中型模型（推荐）',
          description: '平衡速度与质量，约80MB',
        },
        {
          value: 'isnet',
          label: '完整模型',
          description: '最高质量，体积最大',
        },
      ],
      default: 'isnet_fp16',
    },
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
      default: 1,
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
      model: 'isnet_fp16',
      threshold: 0.5,
      feather: 1,
      morph: 0,
      opacity: 100,
    };
  },

  async process(context: PluginContext, config: Record<string, any>): Promise<PluginProcessResult> {
    const { canvas, ctx, originalImage, setStatus, yieldToUI } = context;

    try {
      setStatus('ImgLy 正在分析图片...');
      await yieldToUI();

      // 将 HTMLImageElement 转换为 Blob
      setStatus('正在准备图像数据...');
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = originalImage.width;
      tempCanvas.height = originalImage.height;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.drawImage(originalImage, 0, 0);

      const imageBlob = await new Promise<Blob>((resolve, reject) => {
        tempCanvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('无法转换图像为 Blob'));
        }, 'image/png');
      });
      await yieldToUI();

      // 配置 ImgLy - 不设置 publicPath 使用默认 CDN
      const imglyConfig: Config = {
        debug: true, // 开启调试以查看详细信息
        model: config.model || 'isnet_fp16',
        output: {
          format: 'image/png',
          quality: 1,
        },
        progress: (key, current, total) => {
          const percentage = Math.round((current / total) * 100);
          setStatus(`ImgLy 处理中: ${key} - ${percentage}%`);
        },
      }

      // 使用 ImgLy 移除背景
      setStatus('ImgLy 正在处理...');
      const blob = await removeBackground(imageBlob, imglyConfig);
      await yieldToUI();

      // 将结果转换为 Image
      setStatus('正在应用处理结果...');
      const resultUrl = URL.createObjectURL(blob);
      const resultImage = new Image();

      await new Promise<void>((resolve, reject) => {
        resultImage.onload = () => resolve();
        resultImage.onerror = () => reject(new Error('结果图片加载失败'));
        resultImage.src = resultUrl;
      });

      // 绘制结果到画布
      canvas.width = resultImage.width;
      canvas.height = resultImage.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(resultImage, 0, 0);

      // 清理临时 URL
      URL.revokeObjectURL(resultUrl);

      // 获取图像数据进行后处理
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // 提取 alpha 通道到浮点数组
      const mask = new Float32Array(canvas.width * canvas.height);
      for (let i = 0; i < data.length; i += 4) {
        const pixelIndex = i / 4;
        mask[pixelIndex] = data[i + 3] / 255;
      }

      await yieldToUI();

      // 应用形态学操作
      if (config.morph !== 0) {
        setStatus('正在调整边缘...');
        applyMorphology(mask, canvas.width, canvas.height, config.morph);
        await yieldToUI();
      }

      // 边缘羽化
      if (config.feather > 0) {
        setStatus('正在羽化边缘...');
        applyGaussianBlur(mask, canvas.width, canvas.height, config.feather);
        await yieldToUI();
      }

      // 重新绘制原图并应用处理后的遮罩
      setStatus('正在生成最终结果...');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);

      const finalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const finalData = finalImageData.data;

      const pixelsPerChunk = canvas.width * 100;
      for (let i = 0; i < finalData.length; i += 4) {
        if (i > 0 && (i / 4) % pixelsPerChunk === 0) {
          await yieldToUI();
        }

        const pixelIndex = i / 4;
        let alpha = mask[pixelIndex];

        // 应用阈值
        if (alpha < config.threshold) {
          alpha = 0;
        } else {
          alpha = (alpha - config.threshold) / (1 - config.threshold);
        }

        // 应用不透明度
        alpha = Math.min(1, Math.max(0, alpha * (config.opacity / 100)));
        finalData[i + 3] = Math.round(alpha * 255);
      }

      await yieldToUI();
      ctx.putImageData(finalImageData, 0, 0);

      const resultImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      return {
        success: true,
        message: 'ImgLy 处理完成',
        imageData: resultImageData,
      };
    } catch (error: any) {
      console.error('ImgLy 处理失败:', error);
      return {
        success: false,
        message: `处理失败: ${error.message}`,
      };
    }
  },
};


/**
 * 图像处理工具函数
 */

import type { ProcessOptions, ImageSegmenter } from '../typings';

/**
 * 让出控制权给浏览器，允许UI更新
 */
function yieldToUI(): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, 0);
  });
}

/**
 * 创建高斯核
 */
export function createGaussianKernel(radius: number): number[] {
  const size = radius * 2 + 1;
  const kernel = new Array(size);
  const sigma = radius / 2;
  const twoSigmaSquare = 2 * sigma * sigma;
  let sum = 0;

  for (let i = 0; i < size; i++) {
    const x = i - radius;
    kernel[i] = Math.exp(-(x * x) / twoSigmaSquare);
    sum += kernel[i];
  }

  for (let i = 0; i < size; i++) {
    kernel[i] /= sum;
  }

  return kernel;
}

/**
 * 应用高斯模糊
 */
export function applyGaussianBlur(
  mask: Float32Array,
  width: number,
  height: number,
  radius: number
): void {
  const kernel = createGaussianKernel(radius);
  const kernelSize = kernel.length;
  const halfSize = Math.floor(kernelSize / 2);

  // 水平模糊
  const tempMask = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let weightSum = 0;

      for (let k = 0; k < kernelSize; k++) {
        const sampleX = x + k - halfSize;
        if (sampleX >= 0 && sampleX < width) {
          const idx = y * width + sampleX;
          sum += mask[idx] * kernel[k];
          weightSum += kernel[k];
        }
      }

      tempMask[y * width + x] = sum / weightSum;
    }
  }

  // 垂直模糊
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let weightSum = 0;

      for (let k = 0; k < kernelSize; k++) {
        const sampleY = y + k - halfSize;
        if (sampleY >= 0 && sampleY < height) {
          const idx = sampleY * width + x;
          sum += tempMask[idx] * kernel[k];
          weightSum += kernel[k];
        }
      }

      mask[y * width + x] = sum / weightSum;
    }
  }
}

/**
 * 应用形态学操作
 */
export function applyMorphology(
  mask: Float32Array,
  width: number,
  height: number,
  iterations: number
): void {
  const isErosion = iterations < 0;
  const absIterations = Math.abs(iterations);

  for (let iter = 0; iter < absIterations; iter++) {
    const tempMask = new Float32Array(mask);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;

        const neighbors = [
          tempMask[idx - width - 1], tempMask[idx - width], tempMask[idx - width + 1],
          tempMask[idx - 1], tempMask[idx], tempMask[idx + 1],
          tempMask[idx + width - 1], tempMask[idx + width], tempMask[idx + width + 1]
        ];

        if (isErosion) {
          mask[idx] = Math.min(...neighbors);
        } else {
          mask[idx] = Math.max(...neighbors);
        }
      }
    }
  }
}

/**
 * 应用中值滤波
 */
export function applyMedianFilter(
  mask: Float32Array,
  width: number,
  height: number,
  radius: number
): void {
  const tempMask = new Float32Array(mask);
  const kernelSize = Math.min(radius, 3);

  for (let y = kernelSize; y < height - kernelSize; y++) {
    for (let x = kernelSize; x < width - kernelSize; x++) {
      const neighbors: number[] = [];

      for (let dy = -kernelSize; dy <= kernelSize; dy++) {
        for (let dx = -kernelSize; dx <= kernelSize; dx++) {
          const idx = (y + dy) * width + (x + dx);
          neighbors.push(tempMask[idx]);
        }
      }

      neighbors.sort((a, b) => a - b);
      const median = neighbors[Math.floor(neighbors.length / 2)];

      mask[y * width + x] = median;
    }
  }
}

/**
 * 计算颜色距离
 */
export function colorDistance(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number
): number {
  const rmean = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;

  return Math.sqrt(
    (2 + rmean / 256) * dr * dr +
    4 * dg * dg +
    (2 + (255 - rmean) / 256) * db * db
  );
}

/**
 * AI 抠图处理
 */
export async function processWithAI(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  originalImage: HTMLImageElement,
  imageSegmenter: ImageSegmenter,
  options: ProcessOptions
): Promise<void> {
  if (!imageSegmenter) {
    throw new Error('AI 模型未加载');
  }

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

  const result = imageSegmenter.segment(tempCanvas);
  await applyAISegmentation(canvas, ctx, originalImage, result, options);
}

/**
 * 应用 AI 分割结果
 */
async function applyAISegmentation(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  originalImage: HTMLImageElement,
  result: any,
  options: ProcessOptions
): Promise<void> {
  const { threshold = 0.5, feather = 2, morph = 0, clean = 5, opacity = 100, aiModel = 'deeplab' } = options;

  // 检查结果是否有效
  if (!result) {
    throw new Error('AI 分割结果无效');
  }

  // 绘制原图
  canvas.width = originalImage.width;
  canvas.height = originalImage.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  let mask: Uint8Array | Float32Array;
  let maskWidth: number;
  let maskHeight: number;
  let isConfidenceMask = false;

  // 根据模型类型获取不同的mask
  if (aiModel === 'selfie' && result.confidenceMasks && result.confidenceMasks.length > 0) {
    // Selfie Segmentation 使用 confidenceMasks
    console.log('使用 Selfie Segmentation confidenceMasks');
    const confidenceMask = result.confidenceMasks[0];
    mask = confidenceMask.getAsFloat32Array();
    maskWidth = confidenceMask.width;
    maskHeight = confidenceMask.height;
    isConfidenceMask = true;
  } else if (result.categoryMask) {
    // DeepLab V3 使用 categoryMask
    console.log('使用 DeepLab V3 categoryMask');
    mask = result.categoryMask.getAsUint8Array();
    maskWidth = result.categoryMask.width;
    maskHeight = result.categoryMask.height;
  } else {
    throw new Error('AI 分割结果格式不正确');
  }

  console.log('Mask dimensions:', maskWidth, 'x', maskHeight);
  console.log('Canvas dimensions:', canvas.width, 'x', canvas.height);
  console.log('Mask type:', isConfidenceMask ? 'confidence' : 'category');

  const floatMask = new Float32Array(canvas.width * canvas.height);

  // 找出mask中的最大值和最小值，用于调试
  let maxMaskValue = 0;
  let minMaskValue = isConfidenceMask ? 1 : 255;
  for (let i = 0; i < mask.length; i++) {
    maxMaskValue = Math.max(maxMaskValue, mask[i]);
    minMaskValue = Math.min(minMaskValue, mask[i]);
  }
  console.log('Mask value range:', minMaskValue, '-', maxMaskValue);

  // 让出控制权，允许UI更新
  await yieldToUI();

  // 映射遮罩（双线性插值）
  for (let y = 0; y < canvas.height; y++) {
    // 每处理100行，让出控制权
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

      if (isConfidenceMask) {
        // Confidence mask: 直接使用浮点值 (0-1)
        floatMask[idx] = interpolated;
      } else {
        // Category mask: DeepLab中人物通常是类别15，或任何非0值表示前景
        floatMask[idx] = (interpolated === 15 || interpolated > 5) ? 1.0 : 0.0;
      }
    }
  }

  console.log('Mask mapping completed');
  await yieldToUI();

  // 应用形态学操作
  if (morph !== 0) {
    console.log('Applying morphology...');
    applyMorphology(floatMask, canvas.width, canvas.height, morph);
    await yieldToUI();
  }

  // 边缘清洁
  if (clean > 0) {
    console.log('Applying median filter...');
    applyMedianFilter(floatMask, canvas.width, canvas.height, Math.min(clean, 3));
    await yieldToUI();
  }

  // 边缘羽化
  if (feather > 0) {
    console.log('Applying gaussian blur...');
    applyGaussianBlur(floatMask, canvas.width, canvas.height, feather);
    await yieldToUI();
  }

  // 统计mask值分布，用于调试
  let foregroundPixels = 0;
  let avgMaskValue = 0;
  for (let i = 0; i < floatMask.length; i++) {
    avgMaskValue += floatMask[i];
    if (floatMask[i] > threshold) {
      foregroundPixels++;
    }
  }
  avgMaskValue /= floatMask.length;
  console.log('Average mask value:', avgMaskValue);
  console.log('Foreground pixels:', foregroundPixels, '/', floatMask.length,
    `(${(foregroundPixels / floatMask.length * 100).toFixed(2)}%)`);
  console.log('Threshold:', threshold);

  await yieldToUI();

  // 应用到图像
  console.log('Applying mask to image...');
  const pixelsPerChunk = canvas.width * 100; // 每100行
  for (let i = 0; i < data.length; i += 4) {
    // 每处理一定数量的像素，让出控制权
    if (i > 0 && (i / 4) % pixelsPerChunk === 0) {
      await yieldToUI();
    }

    const pixelIndex = i / 4;
    let alpha = floatMask[pixelIndex];

    // 应用阈值
    if (alpha < threshold) {
      alpha = 0;
    } else {
      alpha = (alpha - threshold) / (1 - threshold);
    }

    // 应用不透明度
    alpha = Math.min(1, Math.max(0, alpha * (opacity / 100)));
    data[i + 3] = Math.round(alpha * 255);
  }

  await yieldToUI();
  ctx.putImageData(imageData, 0, 0);
  console.log('AI segmentation completed successfully');
}

/**
 * 颜色抠图处理
 */
export function processWithColor(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  originalImage: HTMLImageElement,
  options: ProcessOptions
): void {
  const {
    pickedColors = [],
    colorTolerance = 30,
    colorFeather = 2,
    colorExpand = 0,
    colorMode = 'remove'
  } = options;

  if (pickedColors.length === 0) {
    throw new Error('请先拾取要去除的颜色');
  }

  // 绘制原图
  canvas.width = originalImage.width;
  canvas.height = originalImage.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const mask = new Float32Array(canvas.width * canvas.height);

  // 创建遮罩
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const pixelIndex = i / 4;

    let isMatched = false;
    for (const color of pickedColors) {
      const distance = colorDistance(r, g, b, color.r, color.g, color.b);
      if (distance <= colorTolerance) {
        isMatched = true;
        break;
      }
    }

    // 根据模式设置遮罩
    if (colorMode === 'remove') {
      mask[pixelIndex] = isMatched ? 0.0 : 1.0;
    } else {
      mask[pixelIndex] = isMatched ? 1.0 : 0.0;
    }
  }

  // 应用膨胀/腐蚀
  if (colorExpand !== 0) {
    applyMorphology(mask, canvas.width, canvas.height, colorExpand);
  }

  // 应用羽化
  if (colorFeather > 0) {
    applyGaussianBlur(mask, canvas.width, canvas.height, colorFeather);
  }

  // 应用遮罩到图像
  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4;
    const alpha = mask[pixelIndex];
    data[i + 3] = Math.round(alpha * 255);
  }

  ctx.putImageData(imageData, 0, 0);
}


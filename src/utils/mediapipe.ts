/**
 * MediaPipe 初始化和管理
 */

import type { ImageSegmenter, ImageSegmenters, AIModel } from '../typings';

// 模型配置
const MODEL_CONFIGS = {
  deeplab: {
    url: "https://storage.googleapis.com/mediapipe-models/image_segmenter/deeplab_v3/float32/1/deeplab_v3.tflite",
    name: "DeepLab V3",
    description: "通用场景"
  },
  selfie: {
    url: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite",
    name: "Selfie Segmentation",
    description: "人像优化"
  }
};

/**
 * 初始化所有MediaPipe模型
 */
export async function initializeMediaPipe(): Promise<ImageSegmenters> {
  const segmenters: ImageSegmenters = {
    deeplab: null,
    selfie: null
  };

  try {
    // 等待 MediaPipe 库加载
    let retries = 0;
    while (!(window as any).MediaPipeVision && retries < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }

    if (!(window as any).MediaPipeVision) {
      throw new Error('MediaPipe 库加载超时');
    }

    const { FilesetResolver, ImageSegmenter } = (window as any).MediaPipeVision;
    const wasmFileset = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );

    // 加载 DeepLab V3 模型（默认）
    try {
      console.log('正在加载 DeepLab V3 模型...');
      segmenters.deeplab = await ImageSegmenter.createFromOptions(wasmFileset, {
        baseOptions: {
          modelAssetPath: MODEL_CONFIGS.deeplab.url,
          delegate: "GPU"
        },
        outputCategoryMask: true,
        outputConfidenceMasks: false,
        runningMode: "IMAGE"
      });
      console.log('DeepLab V3 模型加载成功');
    } catch (error) {
      console.error('DeepLab V3 模型加载失败:', error);
    }

    // 加载 Selfie Segmentation 模型
    try {
      console.log('正在加载 Selfie Segmentation 模型...');
      segmenters.selfie = await ImageSegmenter.createFromOptions(wasmFileset, {
        baseOptions: {
          modelAssetPath: MODEL_CONFIGS.selfie.url,
          delegate: "GPU"
        },
        outputCategoryMask: false,
        outputConfidenceMasks: true,
        runningMode: "IMAGE"
      });
      console.log('Selfie Segmentation 模型加载成功');
    } catch (error) {
      console.error('Selfie Segmentation 模型加载失败:', error);
    }

    return segmenters;
  } catch (error) {
    console.error('MediaPipe 初始化失败:', error);
    return segmenters;
  }
}

/**
 * 加载单个模型
 */
export async function loadSingleModel(modelType: AIModel): Promise<ImageSegmenter | null> {
  try {
    if (!(window as any).MediaPipeVision) {
      throw new Error('MediaPipe 库未加载');
    }

    const { FilesetResolver, ImageSegmenter } = (window as any).MediaPipeVision;
    const wasmFileset = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );

    const config = MODEL_CONFIGS[modelType];
    console.log(`正在加载 ${config.name} 模型...`);

    const options: any = {
      baseOptions: {
        modelAssetPath: config.url,
        delegate: "GPU"
      },
      runningMode: "IMAGE"
    };

    // DeepLab 使用 categoryMask，Selfie 使用 confidenceMasks
    if (modelType === 'deeplab') {
      options.outputCategoryMask = true;
      options.outputConfidenceMasks = false;
    } else {
      options.outputCategoryMask = false;
      options.outputConfidenceMasks = true;
    }

    const segmenter = await ImageSegmenter.createFromOptions(wasmFileset, options);
    console.log(`${config.name} 模型加载成功`);

    return segmenter;
  } catch (error) {
    console.error(`模型 ${modelType} 加载失败:`, error);
    return null;
  }
}

export { MODEL_CONFIGS };


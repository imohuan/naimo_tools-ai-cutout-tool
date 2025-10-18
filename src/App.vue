<template>
  <div class="flex h-screen overflow-hidden">
    <!-- 左侧图片列表 -->
    <ImageList
      :images="images"
      :current-index="currentImageIndex"
      @add-images="handleAddImages"
      @select="handleSelectImage"
      @remove="handleRemoveImage"
    />

    <!-- 中间画布区域 -->
    <div class="flex-1 flex flex-col relative bg-gray-50">
      <!-- 画布 -->
      <div class="flex-1 relative">
        <Canvas
          ref="canvasComponent"
          :has-image="hasCurrentImage"
          :is-processing="isProcessing || isCompressing"
          :can-download="canDownload"
          :status-text="compressionStatusText || statusText"
          :is-picking-color="isPickingColor"
          @process="handleProcess"
          @reset="handleReset"
          @download="handleDownload"
          @pick-color="handlePickColor"
          @compare="handleCompare"
        />
      </div>

      <!-- 右上角折叠按钮 -->
      <button
        v-if="isRightPanelCollapsed"
        class="absolute top-2 right-2 w-10 h-10 flex items-center justify-center bg-white/95 backdrop-blur-md rounded-lg cursor-pointer transition-all hover:bg-white shadow-lg border border-gray-200 z-20"
        @click="toggleRightPanel"
        title="展开配置面板"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="w-5 h-5 text-gray-600"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <!-- 底部控制栏 -->
      <div
        class="absolute z-[50] bottom-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-xl rounded-md px-4 py-2 flex items-center gap-3 shadow-2xl border border-gray-200"
      >
        <!-- 模型选择 -->
        <ModelSelector
          v-model="currentPluginId"
          :plugins="availablePlugins"
          @update:model-value="handlePluginChange"
        />

        <div class="w-px h-8 bg-gray-300"></div>

        <!-- 缩放控制 -->
        <div class="flex items-center gap-2">
          <button
            class="w-9 h-9 flex items-center justify-center bg-gray-100 rounded-lg cursor-pointer transition-all text-gray-700 text-xl font-medium hover:bg-gray-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            @click="handleZoomOut"
            title="缩小"
          >
            −
          </button>
          <div
            class="text-sm font-semibold text-gray-700 min-w-[60px] text-center"
          >
            {{ Math.round(transform.scale * 100) }}%
          </div>
          <button
            class="w-9 h-9 flex items-center justify-center bg-gray-100 rounded-lg cursor-pointer transition-all text-gray-700 text-xl font-medium hover:bg-gray-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            @click="handleZoomIn"
            title="放大"
          >
            +
          </button>
          <button
            class="w-9 h-9 flex items-center justify-center bg-gray-100 rounded-lg cursor-pointer transition-all text-gray-700 hover:bg-gray-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            @click="handleZoomReset"
            title="重置缩放"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              class="w-4 h-4"
            >
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </button>
        </div>

        <div class="w-px h-8 bg-gray-300"></div>

        <!-- 功能按钮 -->
        <div class="flex gap-2">
          <button
            class="w-9 h-9 flex items-center justify-center bg-blue-600 rounded-lg cursor-pointer transition-all text-white hover:bg-blue-700 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!hasCurrentImage || isProcessing"
            @click="handleProcess"
            :title="isProcessing ? '处理中...' : '开始处理'"
          >
            <svg
              v-if="!isProcessing"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="w-5 h-5"
            >
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            <svg
              v-else
              class="w-5 h-5 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M21 12a9 9 0 11-6.219-8.56"></path>
            </svg>
          </button>
          <button
            class="w-9 h-9 flex items-center justify-center bg-gray-600 rounded-lg cursor-pointer transition-all text-white hover:bg-gray-700 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!hasCurrentImage"
            @click="handleReset"
            title="重置"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="w-5 h-5"
            >
              <path
                d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"
              ></path>
              <path d="M21 3v5h-5"></path>
              <path
                d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"
              ></path>
              <path d="M3 21v-5h5"></path>
            </svg>
          </button>
          <button
            v-if="canDownload"
            class="w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer transition-all text-white hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            :class="
              isComparing
                ? 'bg-purple-700 hover:bg-purple-800'
                : 'bg-purple-600 hover:bg-purple-700'
            "
            @click="handleToggleCompare"
            :title="isComparing ? '退出对比' : '对比原图'"
          >
            <!-- 未激活状态：对比图标（分屏+箭头） -->
            <svg
              v-if="!isComparing"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="w-5 h-5"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="12" y1="3" x2="12" y2="21"></line>
              <path d="M8 10l-2 2 2 2"></path>
              <path d="M16 10l2 2-2 2"></path>
            </svg>
            <!-- 激活状态：正在对比（分屏+实心点） -->
            <svg
              v-else
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="w-5 h-5"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="12" y1="3" x2="12" y2="21" stroke-width="2.5"></line>
              <circle cx="7.5" cy="12" r="1.5" fill="currentColor"></circle>
              <circle cx="16.5" cy="12" r="1.5" fill="currentColor"></circle>
            </svg>
          </button>
          <button
            class="w-9 h-9 flex items-center justify-center bg-orange-600 rounded-lg cursor-pointer transition-all text-white hover:bg-orange-700 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!canDownload"
            @click="handleAddProcessedToList"
            title="添加到列表"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="w-5 h-5"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
              <line x1="12" y1="11" x2="12" y2="17"></line>
              <line x1="9" y1="14" x2="15" y2="14"></line>
            </svg>
          </button>
          <button
            class="w-9 h-9 flex items-center justify-center bg-green-600 rounded-lg cursor-pointer transition-all text-white hover:bg-green-700 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!canDownload"
            @click="handleDownload"
            title="下载图片"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="w-5 h-5"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- 右侧配置面板 -->
    <PluginPanel
      ref="pluginPanelRef"
      :available-plugins="availablePlugins"
      :current-plugin-id="currentPluginId"
      :is-picking-color="isPickingColor"
      :picked-colors="pickedColors"
      :plugin-context="pluginContext"
      :is-collapsed="isRightPanelCollapsed"
      @plugin-change="handlePluginChange"
      @config-change="handleConfigChange"
      @toggle-color-picking="handleToggleColorPicking"
      @remove-color="handleRemoveColor"
      @clear-colors="handleClearColors"
      @button-click="handleButtonClick"
      @toggle-collapse="toggleRightPanel"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue";
import ImageList from "./components/ImageList.vue";
import Canvas from "./components/Canvas.vue";
import PluginPanel from "./components/PluginPanel.vue";
import ModelSelector from "./components/ModelSelector.vue";
import imageCompression from "browser-image-compression";
import type {
  ImageData as ImageDataType,
  Point,
  PluginContext,
  ButtonConfigField,
} from "./typings";
import {
  registerBuiltinPlugins,
  getAllPlugins,
  getPlugin,
} from "./core/registry";
import { yieldToUI } from "./utils/core-utils";

// 注册插件
registerBuiltinPlugins();

// 状态
const images = ref<ImageDataType[]>([]);
const currentImageIndex = ref(-1);
const isProcessing = ref(false);
const lastProcessTime = ref(0); // 用于防抖
const statusText = ref("");
const canDownload = ref(false);
const isPickingColor = ref(false);
const pickedColors = ref<Array<{ r: number; g: number; b: number }>>([]);
const originalCanvasData = ref<globalThis.ImageData | null>(null);
const processedCanvasData = ref<globalThis.ImageData | null>(null);

// 压缩状态
const isCompressing = ref(false);
const compressionProgress = ref(0);
const compressionStatusText = ref("");

// 插件相关
const availablePlugins = ref(getAllPlugins());
const currentPluginId = ref("imgly"); // 默认使用 DeepLab
const pluginConfig = ref<Record<string, any>>({});

// 组件引用
const canvasComponent = ref<InstanceType<typeof Canvas>>();
const pluginPanelRef = ref<InstanceType<typeof PluginPanel>>();

// 缩放状态
const transform = ref({ scale: 1, x: 0, y: 0 });

// 右侧面板折叠状态
const isRightPanelCollapsed = ref(false);

const toggleRightPanel = () => {
  isRightPanelCollapsed.value = !isRightPanelCollapsed.value;
};

// 计算属性
const hasCurrentImage = computed(() => currentImageIndex.value >= 0);

// 创建插件上下文
const pluginContext = computed<PluginContext>(() => {
  const canvas = canvasComponent.value?.canvas;
  const ctx = canvas?.getContext("2d");
  const currentImage = images.value[currentImageIndex.value];

  return {
    canvas: canvas!,
    ctx: ctx!,
    originalImage: currentImage?.original!,
    startColorPicking: () => {
      isPickingColor.value = true;
    },
    stopColorPicking: () => {
      isPickingColor.value = false;
    },
    pickedColors: pickedColors.value,
    addPickedColor: (color) => {
      // 检查颜色是否已存在（去重）
      const isDuplicate = pickedColors.value.some(
        (c) => c.r === color.r && c.g === color.g && c.b === color.b
      );
      if (!isDuplicate) {
        pickedColors.value.push(color);
      }
    },
    removePickedColor: (index) => {
      pickedColors.value.splice(index, 1);
    },
    clearPickedColors: () => {
      pickedColors.value = [];
    },
    setStatus: (message: string) => {
      statusText.value = message;
    },
    yieldToUI: () => new Promise((resolve) => setTimeout(resolve, 0)),
  };
});

// 对比模式状态
const isComparing = ref(false);

// 初始化
onMounted(async () => {
  statusText.value = "就绪";

  // 注册功能触发事件
  if (window.naimo) {
    window.naimo.onEnter(async (params: any) => {
      const { files } = params;

      if (files && files.length > 0) {
        for (const file of files) {
          try {
            const base64 = await (window.naimo.system as any).getLocalImage(
              file.path
            );
            const ext = file.name.split(".").pop()?.toLowerCase();
            const mimeType =
              ext === "jpg" || ext === "jpeg"
                ? "image/jpeg"
                : ext === "png"
                ? "image/png"
                : ext === "webp"
                ? "image/webp"
                : "image/png";
            const imageData = `data:${mimeType};base64,${base64}`;

            const response = await fetch(imageData);
            const blob = await response.blob();
            const imageFile = new File([blob], file.name, { type: mimeType });

            try {
              const { compressedFile } = await compressImage(imageFile);
              const compressedBase64 =
                await imageCompression.getDataUrlFromFile(compressedFile);

              const img = new Image();
              img.onload = () => {
                images.value.push({
                  id: Date.now() + Math.random() + "",
                  original: img,
                  processed: null,
                  processedImageData: null,
                  file: compressedFile,
                  name: file.name,
                });

                if (currentImageIndex.value === -1) {
                  handleSelectImage(images.value.length - 1);
                }
              };
              img.src = compressedBase64;
            } catch (compressionError) {
              console.error("图片压缩失败，使用原图:", compressionError);
              isCompressing.value = false;
              compressionStatusText.value = `图片压缩失败: ${file.name}，使用原图`;

              setTimeout(() => {
                compressionStatusText.value = "";
              }, 1000);

              const img = new Image();
              img.onload = () => {
                images.value.push({
                  id: Date.now() + Math.random() + "",
                  original: img,
                  processed: null,
                  processedImageData: null,
                  file: imageFile,
                  name: file.name,
                });

                if (currentImageIndex.value === -1) {
                  handleSelectImage(images.value.length - 1);
                }
              };
              img.src = imageData;
            }
          } catch (error) {
            console.error("加载图片失败:", error);
            if (window.naimo) {
              window.naimo.log.error("加载图片失败", error);
            }
          }
        }
      }
    });
  }

  // 键盘快捷键
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isPickingColor.value) {
      handleToggleColorPicking();
    }
  });

  // 全局粘贴图片支持
  document.addEventListener("paste", async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          imageFiles.push(file);
        }
      }
    }

    if (imageFiles.length > 0) {
      await handleAddImages(imageFiles);
      statusText.value = `已粘贴 ${imageFiles.length} 张图片`;
      setTimeout(() => {
        if (statusText.value.startsWith("已粘贴")) {
          statusText.value = "";
        }
      }, 2000);
    }
  });
});

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
};

// 压缩图片的辅助函数
const compressImage = async (
  file: File
): Promise<{
  compressedFile: File;
  originalSize: number;
  compressedSize: number;
}> => {
  const originalSize = file.size;

  const compressionOptions = {
    maxSizeMB: 2,
    maxWidthOrHeight: 2048,
    useWebWorker: true,
    fileType: file.type,
    onProgress: (progress: number) => {
      compressionProgress.value = progress;
      compressionStatusText.value = `正在压缩图片: ${file.name} (${Math.round(
        progress
      )}%)`;
    },
  };

  isCompressing.value = true;
  compressionStatusText.value = `准备压缩图片: ${file.name}`;

  try {
    const compressedFile = await imageCompression(file, compressionOptions);
    const compressedSize = compressedFile.size;

    // 显示压缩结果
    const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
    compressionStatusText.value = `压缩完成: ${formatFileSize(
      originalSize
    )} → ${formatFileSize(compressedSize)} (减少 ${ratio}%)`;

    // 延迟1.5秒后清除状态，让用户看到压缩结果
    setTimeout(() => {
      isCompressing.value = false;
      compressionStatusText.value = "";
      compressionProgress.value = 0;
    }, 1500);

    return { compressedFile, originalSize, compressedSize };
  } catch (error) {
    isCompressing.value = false;
    compressionStatusText.value = "";
    compressionProgress.value = 0;
    throw error;
  }
};

// 图片管理
const handleAddImages = async (files: File[]) => {
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;

    try {
      const { compressedFile } = await compressImage(file);

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          images.value.push({
            id: Date.now() + Math.random() + "",
            original: img,
            processed: null,
            processedImageData: null,
            file: compressedFile,
            name: file.name,
          });

          if (currentImageIndex.value === -1) {
            handleSelectImage(images.value.length - 1);
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error("图片压缩失败:", error);
      isCompressing.value = false;
      compressionStatusText.value = `图片压缩失败: ${file.name}，使用原图`;

      if (window.naimo) {
        window.naimo.log.error("图片压缩失败", error);
      }

      // 延迟1秒后清除错误信息
      setTimeout(() => {
        compressionStatusText.value = "";
      }, 1000);

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          images.value.push({
            id: Date.now() + Math.random() + "",
            original: img,
            processed: null,
            processedImageData: null,
            file: file,
            name: file.name,
          });

          if (currentImageIndex.value === -1) {
            handleSelectImage(images.value.length - 1);
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }
};

const handleSelectImage = async (index: number) => {
  currentImageIndex.value = index;
  const imageData = images.value[index];

  if (imageData && canvasComponent.value) {
    const hasProcessed = imageData.processed !== null;

    if (hasProcessed) {
      if (!isComparing.value) {
        handleToggleCompare();
        await nextTick();
      }

      const canvas = canvasComponent.value.canvas;
      const ctx = canvasComponent.value.getContext();

      if (canvas && ctx && imageData.processedImageData) {
        const img = imageData.original;

        canvas.width = img.width;
        canvas.height = img.height;

        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext("2d");
        if (tempCtx) {
          tempCtx.drawImage(img, 0, 0);
          originalCanvasData.value = tempCtx.getImageData(
            0,
            0,
            img.width,
            img.height
          );
        }

        processedCanvasData.value = imageData.processedImageData;

        if (
          (canvasComponent.value as any).setCompareData &&
          originalCanvasData.value
        ) {
          (canvasComponent.value as any).setCompareData(
            originalCanvasData.value,
            imageData.processedImageData
          );
        }

        if (canvasComponent.value.fitToView) {
          canvasComponent.value.fitToView();
        }
      }

      canDownload.value = true;
    } else {
      if (isComparing.value) {
        handleToggleCompare();
        await nextTick();
      }

      displayImage(imageData.original);
      canDownload.value = false;
    }

    statusText.value = `已选择图片 ${index + 1}`;
  }
};

const handleRemoveImage = (index: number) => {
  images.value.splice(index, 1);

  if (currentImageIndex.value === index) {
    if (images.value.length > 0) {
      handleSelectImage(Math.min(index, images.value.length - 1));
    } else {
      currentImageIndex.value = -1;
      canDownload.value = false;
      statusText.value = "";
    }
  } else if (currentImageIndex.value > index) {
    currentImageIndex.value--;
  }
};

// 画布操作
const displayImage = async (img: HTMLImageElement) => {
  if (!canvasComponent.value) return;

  await nextTick();

  const canvas = canvasComponent.value.canvas;
  const ctx = canvasComponent.value.getContext();

  if (!canvas || !ctx) return;

  canvas.width = img.width;
  canvas.height = img.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  if (canvasComponent.value.fitToView) {
    canvasComponent.value.fitToView();
  }
};

// 处理操作
const handleProcess = async () => {
  if (!hasCurrentImage.value || isProcessing.value) return;

  // 防抖：300ms 内只能触发一次
  const now = Date.now();
  if (now - lastProcessTime.value < 300) {
    return;
  }
  lastProcessTime.value = now;

  const imageData = images.value[currentImageIndex.value];
  if (!canvasComponent.value) return;

  // 关闭颜色拾取模式
  if (isPickingColor.value) {
    isPickingColor.value = false;
  }

  isProcessing.value = true;
  statusText.value = "正在处理图片...";

  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 50));

  try {
    const canvas = canvasComponent.value.canvas;
    const ctx = canvasComponent.value.getContext();

    if (!canvas || !ctx) {
      throw new Error("Canvas 初始化失败");
    }

    // 创建原图的ImageData
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = imageData.original.width;
    tempCanvas.height = imageData.original.height;
    const tempCtx = tempCanvas.getContext("2d");
    if (tempCtx) {
      tempCtx.drawImage(imageData.original, 0, 0);
      originalCanvasData.value = tempCtx.getImageData(
        0,
        0,
        tempCanvas.width,
        tempCanvas.height
      );
    }

    // 获取当前插件
    const plugin = getPlugin(currentPluginId.value);
    if (!plugin) {
      throw new Error(`插件 ${currentPluginId.value} 未找到`);
    }

    // 获取当前配置
    const config = pluginPanelRef.value?.config || plugin.getDefaultConfig();

    // 构建插件上下文
    const context: PluginContext = {
      canvas,
      ctx,
      originalImage: imageData.original,
      startColorPicking: () => {
        isPickingColor.value = true;
      },
      stopColorPicking: () => {
        isPickingColor.value = false;
      },
      pickedColors: pickedColors.value,
      addPickedColor: (color) => {
        // 检查颜色是否已存在（去重）
        const isDuplicate = pickedColors.value.some(
          (c) => c.r === color.r && c.g === color.g && c.b === color.b
        );
        if (!isDuplicate) {
          pickedColors.value.push(color);
        }
      },
      removePickedColor: (index) => {
        pickedColors.value.splice(index, 1);
      },
      clearPickedColors: () => {
        pickedColors.value = [];
      },
      setStatus: (message: string) => {
        statusText.value = message;
      },
      yieldToUI,
    };

    // 执行插件处理
    const result = await plugin.process(context, config);

    if (result.success && result.imageData) {
      // 保存处理后的数据
      processedCanvasData.value = result.imageData;
      imageData.processedImageData = result.imageData;
      imageData.processed = canvas.toDataURL("image/png");

      canDownload.value = true;
      statusText.value = result.message || "处理完成";

      // 处理完成后更新对比数据
      if (canvasComponent.value) {
        if (!isComparing.value) {
          handleToggleCompare();
          await nextTick();
        }

        if (
          originalCanvasData.value &&
          processedCanvasData.value &&
          (canvasComponent.value as any).setCompareData
        ) {
          (canvasComponent.value as any).setCompareData(
            originalCanvasData.value,
            processedCanvasData.value
          );
        }
      }
    } else {
      throw new Error(result.message || "处理失败");
    }
  } catch (error: any) {
    console.error("处理失败:", error);
    statusText.value = "处理失败: " + error.message;

    if (window.naimo) {
      window.naimo.log.error("处理失败", error);
    }
  } finally {
    isProcessing.value = false;
  }
};

const handleReset = async () => {
  if (!hasCurrentImage.value) return;

  const imageData = images.value[currentImageIndex.value];
  if (imageData) {
    imageData.processed = null;
    imageData.processedImageData = null;
    processedCanvasData.value = null;
    originalCanvasData.value = null;

    if (isComparing.value) {
      handleToggleCompare();
      await nextTick();
    }

    displayImage(imageData.original);
    canDownload.value = false;
    statusText.value = "已重置当前图片";
  }
};

const handleDownload = () => {
  if (!canvasComponent.value || !processedCanvasData.value) return;

  try {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = processedCanvasData.value.width;
    tempCanvas.height = processedCanvasData.value.height;
    const tempCtx = tempCanvas.getContext("2d");

    if (!tempCtx) {
      statusText.value = "创建临时画布失败";
      return;
    }

    tempCtx.putImageData(processedCanvasData.value, 0, 0);

    tempCanvas.toBlob((blob) => {
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "cutout-" + Date.now() + ".png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      statusText.value = "图片已下载";
    }, "image/png");
  } catch (error) {
    console.error("下载失败:", error);
    statusText.value = "下载失败";
  }
};

// 将处理好的图片添加到列表
const handleAddProcessedToList = async () => {
  if (!processedCanvasData.value) return;

  try {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = processedCanvasData.value.width;
    tempCanvas.height = processedCanvasData.value.height;
    const tempCtx = tempCanvas.getContext("2d");

    if (!tempCtx) {
      statusText.value = "创建临时画布失败";
      return;
    }

    tempCtx.putImageData(processedCanvasData.value, 0, 0);

    // 转换为 Blob
    tempCanvas.toBlob(async (blob) => {
      if (!blob) {
        statusText.value = "生成图片失败";
        return;
      }

      // 获取原图名称，添加后缀
      const currentImage = images.value[currentImageIndex.value];
      const originalName = currentImage?.name || "image.png";
      const nameWithoutExt = originalName.replace(/\.[^/.]+$/, "");
      const newName = `${nameWithoutExt}_processed_${Date.now()}.png`;

      // 创建 File 对象
      const file = new File([blob], newName, { type: "image/png" });

      // 创建 Image 对象
      const dataUrl = tempCanvas.toDataURL("image/png");
      const img = new Image();

      img.onload = async () => {
        // 添加到图片列表
        images.value.push({
          id: Date.now() + Math.random() + "",
          original: img,
          processed: null,
          processedImageData: null,
          file: file,
          name: newName,
        });

        // 自动选择新添加的图片
        await nextTick();
        handleSelectImage(images.value.length - 1);

        statusText.value = "已添加到列表";

        // 延迟清除状态
        setTimeout(() => {
          statusText.value = "";
        }, 1500);
      };

      img.onerror = () => {
        statusText.value = "图片加载失败";
      };

      img.src = dataUrl;
    }, "image/png");
  } catch (error) {
    console.error("添加到列表失败:", error);
    statusText.value = "添加失败";

    if (window.naimo) {
      window.naimo.log.error("添加到列表失败", error);
    }
  }
};

// 颜色拾取
const handleToggleColorPicking = () => {
  isPickingColor.value = !isPickingColor.value;

  if (isPickingColor.value) {
    statusText.value = "点击画布选择要去除的颜色";
  } else {
    statusText.value = "";
  }
};

const handlePickColor = (point: Point) => {
  if (!canvasComponent.value) return;

  const canvas = canvasComponent.value.canvas;
  const ctx = canvasComponent.value.getContext();

  if (!canvas || !ctx) return;

  const imageData = ctx.getImageData(point.x, point.y, 1, 1);
  const [r, g, b] = imageData.data;

  // 检查颜色是否已存在（去重）
  const isDuplicate = pickedColors.value.some(
    (c) => c.r === r && c.g === g && c.b === b
  );

  if (!isDuplicate) {
    pickedColors.value.push({ r, g, b });
    statusText.value = `已拾取颜色: RGB(${r}, ${g}, ${b})`;
  } else {
    statusText.value = `颜色已存在: RGB(${r}, ${g}, ${b})`;
  }
};

const handleRemoveColor = (index: number) => {
  pickedColors.value.splice(index, 1);
};

const handleClearColors = () => {
  pickedColors.value = [];
  if (isPickingColor.value) {
    isPickingColor.value = false;
  }
  statusText.value = "已清除所有颜色";
};

// 对比功能
const handleCompare = async (comparing: boolean) => {
  isComparing.value = comparing;
  await nextTick();

  if (comparing) {
    statusText.value = "对比模式";
  } else {
    const canvas = canvasComponent.value?.canvas;
    const ctx = canvasComponent.value?.getContext();

    if (canvas && ctx && processedCanvasData.value) {
      canvas.width = processedCanvasData.value.width;
      canvas.height = processedCanvasData.value.height;
      ctx.putImageData(processedCanvasData.value, 0, 0);
    }

    statusText.value = "已退出对比模式";
  }
};

const handleToggleCompare = () => {
  if (canvasComponent.value && (canvasComponent.value as any).toggleCompare) {
    (canvasComponent.value as any).toggleCompare();
  }
};

// 插件相关
const handlePluginChange = (pluginId: string) => {
  currentPluginId.value = pluginId;

  // 如果切换到颜色插件之外的插件，退出颜色拾取状态
  if (pluginId !== "color" && isPickingColor.value) {
    isPickingColor.value = false;
  }

  statusText.value = `已切换到: ${getPlugin(pluginId)?.name}`;
};

const handleConfigChange = (key: string, value: any) => {
  pluginConfig.value[key] = value;
};

const handleButtonClick = (field: ButtonConfigField) => {
  if (field.onClick && canvasComponent.value) {
    const canvas = canvasComponent.value.canvas;
    const ctx = canvasComponent.value.getContext();

    if (!canvas || !ctx) return;

    const imageData = images.value[currentImageIndex.value];
    if (!imageData) return;

    const context: PluginContext = {
      canvas,
      ctx,
      originalImage: imageData.original,
      startColorPicking: () => {
        isPickingColor.value = true;
      },
      stopColorPicking: () => {
        isPickingColor.value = false;
      },
      pickedColors: pickedColors.value,
      addPickedColor: (color) => {
        // 检查颜色是否已存在（去重）
        const isDuplicate = pickedColors.value.some(
          (c) => c.r === color.r && c.g === color.g && c.b === color.b
        );
        if (!isDuplicate) {
          pickedColors.value.push(color);
        }
      },
      removePickedColor: (index) => {
        pickedColors.value.splice(index, 1);
      },
      clearPickedColors: () => {
        pickedColors.value = [];
      },
      setStatus: (message: string) => {
        statusText.value = message;
      },
      yieldToUI,
    };

    const config = pluginPanelRef.value?.config || {};
    field.onClick(context, config);
  }
};

// 缩放控制
const handleZoomIn = () => {
  if (canvasComponent.value) {
    const currentScale = (canvasComponent.value as any).transform?.scale || 1;
    (canvasComponent.value as any).transform = {
      ...(canvasComponent.value as any).transform,
      scale: Math.min(currentScale * 1.2, 5),
    };
    updateTransformState();
  }
};

const handleZoomOut = () => {
  if (canvasComponent.value) {
    const currentScale = (canvasComponent.value as any).transform?.scale || 1;
    (canvasComponent.value as any).transform = {
      ...(canvasComponent.value as any).transform,
      scale: Math.max(currentScale / 1.2, 0.1),
    };
    updateTransformState();
  }
};

const handleZoomReset = () => {
  if (canvasComponent.value && canvasComponent.value.fitToView) {
    canvasComponent.value.fitToView();
    updateTransformState();
  }
};

const updateTransformState = () => {
  if (canvasComponent.value) {
    const canvasTransform = (canvasComponent.value as any).transform;
    if (canvasTransform) {
      transform.value = { ...canvasTransform };
    }
  }
};

// 定期同步transform状态
setInterval(updateTransformState, 100);
</script>

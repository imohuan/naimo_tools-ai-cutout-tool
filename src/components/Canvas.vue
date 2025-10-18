<template>
  <div class="w-full h-full bg-gray-50">
    <!-- 画布区域 -->
    <div
      ref="canvasWrapper"
      class="w-full h-full overflow-hidden relative select-none flex items-center justify-center"
      @wheel.prevent="handleWheel"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
      @click="handleCanvasClick"
    >
      <!-- 单一canvas显示容器 -->
      <div
        class="absolute top-1/2 left-1/2 origin-center"
        :style="transformStyle"
      >
        <div
          class="inline-block rounded-lg shadow-md bg-[length:20px_20px] bg-[linear-gradient(45deg,#ccc_25%,transparent_25%),linear-gradient(-45deg,#ccc_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#ccc_75%),linear-gradient(-45deg,transparent_75%,#ccc_75%)] bg-[position:0_0,0_10px,10px_-10px,-10px_0px]"
        >
          <canvas
            ref="canvasRef"
            class="block max-w-full h-auto"
            :class="{
              'cursor-crosshair': isPickingColor && !isSpacePressed,
              'cursor-grab': isPickingColor && isSpacePressed && !isDragging,
              'cursor-grabbing': isDragging,
            }"
          ></canvas>
        </div>
      </div>

      <!-- 拾色模式提示 -->
      <div
        v-if="isPickingColor"
        class="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium z-10 pointer-events-none backdrop-blur shadow-lg"
      >
        {{
          isSpacePressed
            ? "🖐️ 平移模式（松开空格键恢复拾取）"
            : "🎨 拾色模式（按住空格键可平移画布）"
        }}
      </div>

      <!-- 对比模式的分割线和标签 -->
      <template v-if="isComparing">
        <!-- 左侧标签 -->
        <div
          class="absolute top-4 left-4 bg-black/70 text-white px-4 py-2 rounded-md text-sm font-medium z-10 pointer-events-none backdrop-blur"
        >
          原图
        </div>

        <!-- 右侧标签 -->
        <div
          class="absolute top-4 right-4 bg-black/70 text-white px-4 py-2 rounded-md text-sm font-medium z-10 pointer-events-none backdrop-blur"
        >
          处理后
        </div>

        <!-- 分割线 -->
        <div
          class="absolute top-0 bottom-0 w-1 bg-blue-600 cursor-ew-resize z-20 -translate-x-1/2"
          :style="{ left: comparePosition + '%' }"
          @mousedown.stop="handleDividerMouseDown"
        >
          <div
            class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-20 bg-blue-600 rounded-full shadow-[0_4px_12px_rgba(59,130,246,0.4)] flex items-center justify-center before:content-[''] before:absolute before:left-3.5 before:w-0.5 before:h-5 before:bg-white after:content-[''] after:absolute after:right-3.5 after:w-0.5 after:h-5 after:bg-white"
          ></div>
        </div>
      </template>

      <!-- 加载动画 -->
      <div
        v-if="isProcessing"
        class="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-[1000] backdrop-blur"
      >
        <div class="w-20 h-20 mb-4">
          <svg
            viewBox="0 0 50 50"
            class="w-full h-full animate-spin text-blue-600 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]"
          >
            <circle
              cx="25"
              cy="25"
              r="20"
              fill="none"
              stroke="currentColor"
              stroke-width="4"
              stroke-linecap="round"
              class="animate-[dash_1.5s_ease-in-out_infinite]"
              stroke-dasharray="31.4 31.4"
            />
          </svg>
        </div>
        <div
          class="text-white text-base font-medium text-shadow-[0_2px_4px_rgba(0,0,0,0.3)]"
        >
          {{ statusText }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import type { CanvasTransform, Point } from "../typings";

interface Props {
  hasImage: boolean;
  isProcessing: boolean;
  canDownload: boolean;
  statusText: string;
  isPickingColor: boolean;
}

interface Emits {
  (e: "process"): void;
  (e: "reset"): void;
  (e: "download"): void;
  (e: "pick-color", point: Point): void;
  (e: "compare", isComparing: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const canvasRef = ref<HTMLCanvasElement>();
const canvasWrapper = ref<HTMLDivElement>();

// 画布变换状态
const transform = ref<CanvasTransform>({
  scale: 1,
  x: 0,
  y: 0,
});

// 拖拽状态
const isDragging = ref(false);
const dragStart = ref<Point>({ x: 0, y: 0 });
const dragOffset = ref<Point>({ x: 0, y: 0 });

// 空格键状态（用于在拾取颜色时临时启用平移）
const isSpacePressed = ref(false);

// 对比状态（默认关闭）
const isComparing = ref(false);
const comparePosition = ref(50); // 分割线位置百分比
const isDraggingDivider = ref(false);

// 保存原图和处理后的图像数据用于对比
const originalImageData = ref<ImageData | null>(null);
const processedImageData = ref<ImageData | null>(null);

// 计算变换样式
const transformStyle = computed(() => {
  const canvas = canvasRef.value;

  // 底部控制栏高度约 68px (按钮36px + padding16px + bottom16px)
  // 向上偏移一半来视觉居中
  const bottomBarOffset = -34;

  if (!canvas) {
    return {
      transform: `translate(-50%, -50%) translate(${transform.value.x}px, ${
        transform.value.y + bottomBarOffset
      }px) scale(${transform.value.scale})`,
    };
  }

  // 居中显示：先移动到容器中心（translate(-50%, -50%)），然后应用用户的偏移和缩放
  // 减去底部控制栏高度的一半，使画布在视觉上居中
  return {
    transform: `translate(-50%, -50%) translate(${transform.value.x}px, ${
      transform.value.y + bottomBarOffset
    }px) scale(${transform.value.scale})`,
  };
});

// 获取 canvas 上下文
const getContext = (): CanvasRenderingContext2D | null => {
  return (
    canvasRef.value?.getContext("2d", { willReadFrequently: true }) || null
  );
};

// 缩放处理
const handleWheel = (e: WheelEvent) => {
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  const oldScale = transform.value.scale;
  const newScale = Math.min(Math.max(oldScale * delta, 0.1), 5);

  // 以鼠标位置为中心缩放
  const rect = canvasWrapper.value?.getBoundingClientRect();
  if (rect) {
    // 鼠标在容器中的位置
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // 容器中心
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // 鼠标相对于容器中心的偏移
    const offsetX = mouseX - centerX;
    const offsetY = mouseY - centerY;

    // 缩放比例
    const scaleRatio = newScale / oldScale;

    // 保持鼠标位置不变的新平移
    // 公式：新平移 = 鼠标偏移 * (1 - 缩放比例) + 旧平移 * 缩放比例
    transform.value.x =
      offsetX * (1 - scaleRatio) + transform.value.x * scaleRatio;
    transform.value.y =
      offsetY * (1 - scaleRatio) + transform.value.y * scaleRatio;
    transform.value.scale = newScale;

    // 如果在对比模式，重新绘制对比效果
    if (isComparing.value) {
      redrawCompareCanvas();
    }
  }
};

// 拖拽开始
const handleMouseDown = (e: MouseEvent) => {
  // 如果在拾取颜色模式，只有按住空格键才能平移
  if (props.isPickingColor && !isSpacePressed.value) return;

  isDragging.value = true;
  dragStart.value = { x: e.clientX, y: e.clientY };
  dragOffset.value = { x: transform.value.x, y: transform.value.y };

  if (canvasWrapper.value) {
    canvasWrapper.value.style.cursor = "grabbing";
  }
};

// 拖拽移动
const handleMouseMove = (e: MouseEvent) => {
  if (!isDragging.value) return;

  const dx = e.clientX - dragStart.value.x;
  const dy = e.clientY - dragStart.value.y;

  transform.value.x = dragOffset.value.x + dx;
  transform.value.y = dragOffset.value.y + dy;

  // 如果在对比模式，重新绘制对比效果
  if (isComparing.value) {
    redrawCompareCanvas();
  }
};

// 拖拽结束
const handleMouseUp = () => {
  isDragging.value = false;
  if (canvasWrapper.value) {
    if (props.isPickingColor && !isSpacePressed.value) {
      canvasWrapper.value.style.cursor = "crosshair";
    } else {
      canvasWrapper.value.style.cursor = "grab";
    }
  }
};

// 画布点击（颜色拾取）
const handleCanvasClick = (e: MouseEvent) => {
  if (!props.isPickingColor || !canvasRef.value) return;

  // 如果按住空格键，不拾取颜色（此时是平移模式）
  if (isSpacePressed.value) return;

  const rect = canvasRef.value.getBoundingClientRect();
  const x = Math.floor(
    (e.clientX - rect.left) * (canvasRef.value.width / rect.width)
  );
  const y = Math.floor(
    (e.clientY - rect.top) * (canvasRef.value.height / rect.height)
  );

  // 检查点击位置是否在图片范围内
  if (
    x < 0 ||
    x >= canvasRef.value.width ||
    y < 0 ||
    y >= canvasRef.value.height
  ) {
    return;
  }

  emit("pick-color", { x, y });
};

// 分割线拖动
const handleDividerMouseDown = (e: MouseEvent) => {
  e.stopPropagation();
  isDraggingDivider.value = true;
};

// 分割线拖动的全局事件处理
const handleGlobalMouseMove = (e: MouseEvent) => {
  if (isDraggingDivider.value && canvasWrapper.value) {
    const rect = canvasWrapper.value.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    comparePosition.value = Math.max(0, Math.min(100, percentage));

    // 重新绘制canvas以更新对比效果
    redrawCompareCanvas();
  }
};

const handleGlobalMouseUp = () => {
  isDraggingDivider.value = false;
};

// 临时存储原图和处理后的图像对象
const originalImage = ref<HTMLImageElement | null>(null);
const processedImage = ref<HTMLImageElement | null>(null);

// 重新绘制对比canvas
const redrawCompareCanvas = () => {
  if (!isComparing.value || !canvasRef.value || !canvasWrapper.value) return;
  if (!originalImage.value || !processedImage.value) return;

  const canvas = canvasRef.value;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  // 获取视口和canvas的位置信息
  const wrapperRect = canvasWrapper.value.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();

  // 计算分割线在视口中的绝对位置
  const dividerScreenX =
    wrapperRect.left + (wrapperRect.width * comparePosition.value) / 100;

  // 计算分割线相对于canvas显示区域的位置
  const dividerCanvasX = dividerScreenX - canvasRect.left;

  // 将显示位置转换为canvas图片上的实际像素位置
  const splitX = Math.round((dividerCanvasX / canvasRect.width) * width);

  // 清空画布
  ctx.clearRect(0, 0, width, height);

  // 左侧绘制原图（从0到splitX，全高度）
  if (splitX > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, splitX, height);
    ctx.clip();
    ctx.drawImage(originalImage.value, 0, 0, width, height);
    ctx.restore();
  }

  // 右侧绘制处理后的图/抠图（从splitX到width，全高度）
  if (splitX < width) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(splitX, 0, width - splitX, height);
    ctx.clip();
    ctx.drawImage(processedImage.value, 0, 0, width, height);
    ctx.restore();
  }
};

// 键盘事件处理
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.code === "Space" && props.isPickingColor) {
    e.preventDefault(); // 防止空格键触发页面滚动
    if (!isSpacePressed.value) {
      isSpacePressed.value = true;
      if (canvasWrapper.value) {
        canvasWrapper.value.style.cursor = "grab";
      }
    }
  }
};

const handleKeyUp = (e: KeyboardEvent) => {
  if (e.code === "Space" && props.isPickingColor) {
    e.preventDefault();
    isSpacePressed.value = false;
    // 如果没有在拖拽，恢复为拾色器光标
    if (!isDragging.value && canvasWrapper.value) {
      canvasWrapper.value.style.cursor = "crosshair";
    }
  }
};

// 注册全局事件
onMounted(() => {
  document.addEventListener("mousemove", handleGlobalMouseMove);
  document.addEventListener("mouseup", handleGlobalMouseUp);
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("keyup", handleKeyUp);
});

// 清理事件
onUnmounted(() => {
  document.removeEventListener("mousemove", handleGlobalMouseMove);
  document.removeEventListener("mouseup", handleGlobalMouseUp);
  document.removeEventListener("keydown", handleKeyDown);
  document.removeEventListener("keyup", handleKeyUp);
});

// 监听拾色器状态变化
watch(
  () => props.isPickingColor,
  (isPicking) => {
    if (canvasWrapper.value) {
      if (isPicking && !isSpacePressed.value) {
        canvasWrapper.value.style.cursor = "crosshair";
      } else {
        canvasWrapper.value.style.cursor = "grab";
      }
    }
    // 退出拾色模式时重置空格键状态
    if (!isPicking) {
      isSpacePressed.value = false;
    }
  }
);

// 监听transform变化，在对比模式下触发重绘
watch(
  () => transform.value,
  () => {
    if (isComparing.value) {
      redrawCompareCanvas();
    }
  },
  { deep: true }
);

// 暴露toggle compare方法
const toggleCompare = () => {
  isComparing.value = !isComparing.value;
  comparePosition.value = 50;
  emit("compare", isComparing.value);

  // 如果进入对比模式，重新绘制
  if (isComparing.value) {
    redrawCompareCanvas();
  }
};

// 设置对比数据
const setCompareData = (original: ImageData, processed: ImageData) => {
  originalImageData.value = original;
  processedImageData.value = processed;

  // 使用计数器确保两张图片都加载完成后才重绘
  let loadedCount = 0;
  const checkAndRedraw = () => {
    loadedCount++;
    if (loadedCount === 2 && isComparing.value) {
      redrawCompareCanvas();
    }
  };

  // 将ImageData转换为HTMLImageElement供绘制使用
  // 原图
  const tempCanvas1 = document.createElement("canvas");
  tempCanvas1.width = original.width;
  tempCanvas1.height = original.height;
  const tempCtx1 = tempCanvas1.getContext("2d");
  if (tempCtx1) {
    tempCtx1.putImageData(original, 0, 0);
    const img1 = new Image();
    img1.onload = () => {
      originalImage.value = img1;
      checkAndRedraw();
    };
    img1.src = tempCanvas1.toDataURL();
  }

  // 处理后的图（抠图）
  const tempCanvas2 = document.createElement("canvas");
  tempCanvas2.width = processed.width;
  tempCanvas2.height = processed.height;
  const tempCtx2 = tempCanvas2.getContext("2d");
  if (tempCtx2) {
    tempCtx2.putImageData(processed, 0, 0);
    const img2 = new Image();
    img2.onload = () => {
      processedImage.value = img2;
      checkAndRedraw();
    };
    img2.src = tempCanvas2.toDataURL();
  }
};

onMounted(() => {
  if (canvasWrapper.value) {
    canvasWrapper.value.style.cursor = "grab";
  }
});

// 重置视图到适应画布大小
const fitToView = () => {
  if (!canvasWrapper.value || !canvasRef.value) return;

  const canvas = canvasRef.value;
  const wrapper = canvasWrapper.value.getBoundingClientRect();

  // 底部控制栏占用的高度约 68px，在计算可用高度时需要减去
  const bottomBarHeight = 68;
  const availableHeight = wrapper.height - bottomBarHeight;

  // 计算适应容器的缩放比例
  const scaleX = (wrapper.width * 0.9) / canvas.width;
  const scaleY = (availableHeight * 0.9) / canvas.height;
  const scale = Math.min(scaleX, scaleY, 1); // 不放大，只缩小

  // 居中并应用缩放
  transform.value = {
    scale: scale,
    x: 0,
    y: 0,
  };
};

// 暴露 canvas 引用和方法给父组件
defineExpose({
  get canvas() {
    return canvasRef.value;
  },
  getContext,
  fitToView,
  toggleCompare,
  setCompareData,
  get transform() {
    return transform.value;
  },
  set transform(value: CanvasTransform) {
    transform.value = value;
  },
});
</script>

<style scoped>
@keyframes dash {
  0% {
    stroke-dasharray: 1 150;
    stroke-dashoffset: 0;
  }
  50% {
    stroke-dasharray: 90 150;
    stroke-dashoffset: -35;
  }
  100% {
    stroke-dasharray: 90 150;
    stroke-dashoffset: -124;
  }
}

.animate-\[dash_1\.5s_ease-in-out_infinite\] {
  animation: dash 1.5s ease-in-out infinite;
}
</style>

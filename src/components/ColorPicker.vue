<template>
  <div class="flex flex-col gap-2">
    <h3 class="text-sm font-semibold m-0 mb-2 text-gray-700">
      {{ label }}
    </h3>
    <button
      class="w-full px-4 py-2.5 border-none rounded-md text-white text-[13px] font-medium cursor-pointer transition-all duration-200 flex items-center justify-center gap-2"
      :class="
        isPickingColor
          ? 'bg-red-500 hover:bg-red-600'
          : 'bg-blue-600 hover:bg-blue-700'
      "
      @click="handlePickClick"
    >
      <svg
        class="w-4.5 h-4.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
        />
      </svg>
      {{ isPickingColor ? "停止拾取（按ESC）" : pickButtonText || "拾取颜色" }}
    </button>

    <!-- 已拾取的颜色 -->
    <div
      v-if="pickedColors.length > 0"
      ref="colorListRef"
      class="mt-2 flex flex-col gap-2 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100"
    >
      <div
        v-for="(color, index) in pickedColors"
        :key="index"
        class="flex items-center gap-2 p-2 border border-gray-200 rounded-md"
      >
        <div
          class="w-8 h-8 rounded border border-gray-300 flex-shrink-0"
          :style="{
            backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})`,
          }"
        ></div>
        <span class="flex-1 text-xs text-gray-700"
          >RGB({{ color.r }}, {{ color.g }}, {{ color.b }})</span
        >
        <button
          class="w-6 h-6 border-none bg-red-500 text-white rounded-full cursor-pointer text-lg leading-none flex items-center justify-center transition-all duration-200 hover:bg-red-600"
          @click="handleRemoveColor(index)"
        >
          ×
        </button>
      </div>
    </div>
    <p v-else class="text-xs text-gray-500 italic">
      {{ emptyText || "还未拾取任何颜色" }}
    </p>

    <!-- 清除按钮 -->
    <button
      v-if="pickedColors.length > 0"
      class="w-full px-4 py-2 border-none rounded-md bg-gray-600 text-white text-[13px] font-medium cursor-pointer transition-all duration-200 hover:bg-gray-700"
      @click="handleClearClick"
    >
      {{ clearButtonText || "清除所有颜色" }}
    </button>

    <p v-if="description" class="text-xs text-gray-500 m-0">
      {{ description }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import type { PluginContext, RGB } from "../typings";

interface Props {
  label: string;
  description?: string;
  pickButtonText: string;
  clearButtonText: string;
  emptyText: string;
  context: PluginContext;
  config: Record<string, any>;
  pickedColors: RGB[];
  isPickingColor: boolean;
}

const props = defineProps<Props>();
const colorListRef = ref<HTMLDivElement>();

const handlePickClick = () => {
  if (props.isPickingColor) {
    props.context.stopColorPicking();
  } else {
    props.context.startColorPicking();
  }
};

const handleClearClick = () => {
  props.context.clearPickedColors();
};

const handleRemoveColor = (index: number) => {
  props.context.removePickedColor(index);
};

// 监听颜色列表变化，自动滚动到底部
watch(
  () => props.pickedColors.length,
  async () => {
    await nextTick();
    if (colorListRef.value) {
      colorListRef.value.scrollTop = colorListRef.value.scrollHeight;
    }
  }
);
</script>

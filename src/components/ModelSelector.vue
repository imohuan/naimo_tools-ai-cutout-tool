<template>
  <div class="relative" ref="selectorRef">
    <!-- 选中的显示 -->
    <button
      @click="toggleDropdown"
      class="px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-700 cursor-pointer hover:bg-gray-200 transition-all flex items-center gap-2 min-w-[120px]"
    >
      <span class="flex-1 text-left">{{ currentPluginShortName }}</span>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        class="w-4 h-4 transition-transform duration-200"
        :class="{ 'rotate-180': isOpen }"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>

    <!-- 下拉列表 -->
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0 translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-1"
    >
      <div
        v-if="isOpen"
        class="absolute bottom-full mb-2 left-0 min-w-[320px] bg-white backdrop-blur-xl rounded-lg shadow-2xl border border-gray-200 overflow-hidden z-50"
      >
        <div
          class="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100"
        >
          <button
            v-for="plugin in plugins"
            :key="plugin.id"
            @click="selectPlugin(plugin.id)"
            class="w-full px-4 py-3 text-left transition-all hover:bg-gray-100 border-b border-gray-200 last:border-b-0"
            :class="{ 'bg-gray-100': plugin.id === modelValue }"
          >
            <div class="flex items-start gap-3">
              <!-- 选中指示器 -->
              <div class="flex-shrink-0 w-5 h-5 mt-0.5">
                <div
                  v-if="plugin.id === modelValue"
                  class="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    class="w-3 h-3 text-white"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <div
                  v-else
                  class="w-5 h-5 rounded-full border-2 border-gray-400"
                ></div>
              </div>

              <!-- 内容 -->
              <div class="flex-1 min-w-0">
                <div class="text-gray-800 font-medium text-sm mb-1">
                  {{ plugin.name }}
                </div>
                <div class="text-gray-600 text-xs leading-relaxed">
                  {{ plugin.description }}
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import type { CutoutPlugin } from "../typings";

interface Props {
  plugins: CutoutPlugin[];
  modelValue: string;
}

interface Emits {
  (e: "update:modelValue", value: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const isOpen = ref(false);
const selectorRef = ref<HTMLElement>();

// 简化的名称映射
const shortNames: Record<string, string> = {
  deeplab: "DeepLab",
  imgly: "Imgly",
  selfie: "Selfie",
  color: "颜色",
};

const currentPluginShortName = computed(() => {
  const plugin = props.plugins.find((p) => p.id === props.modelValue);
  if (!plugin) return "";
  return shortNames[plugin.id] || plugin.name;
});

const toggleDropdown = () => {
  isOpen.value = !isOpen.value;
};

const selectPlugin = (pluginId: string) => {
  emit("update:modelValue", pluginId);
  isOpen.value = false;
};

// 点击外部关闭下拉
const handleClickOutside = (event: MouseEvent) => {
  if (selectorRef.value && !selectorRef.value.contains(event.target as Node)) {
    isOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});
</script>

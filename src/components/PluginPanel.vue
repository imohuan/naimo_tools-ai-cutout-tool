<template>
  <div
    v-if="!isCollapsed"
    class="h-full flex flex-col w-[350px] bg-white border-l border-gray-200 transition-all duration-300"
  >
    <!-- 折叠按钮和标题 -->
    <div class="flex items-center p-2 border-b border-gray-200 justify-between">
      <span class="text-sm font-medium text-gray-700 ml-2"> 配置面板 </span>
      <button
        class="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg cursor-pointer transition-all hover:bg-gray-200"
        @click="$emit('toggle-collapse')"
        title="折叠"
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
    </div>

    <!-- 配置项 -->
    <div
      class="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100"
    >
      <div v-if="currentPlugin" class="flex flex-col gap-5">
        <template v-for="field in currentPlugin.configFields" :key="field.key">
          <!-- 滑动条 -->
          <div v-if="field.type === 'slider'" class="flex flex-col gap-2">
            <div class="flex justify-between items-center">
              <label class="text-[13px] font-medium text-gray-700">
                {{ field.label }}
              </label>
              <span class="text-[13px] font-semibold text-blue-600">
                {{ formatValue(field, config[field.key]) }}
              </span>
            </div>
            <input
              type="range"
              :min="field.min"
              :max="field.max"
              :step="field.step"
              :value="config[field.key]"
              @input="updateConfig(field.key, $event)"
              class="w-full h-1.5 rounded-full bg-gray-200 outline-none appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-none"
            />
            <p v-if="field.description" class="text-xs text-gray-500 m-0">
              {{ field.description }}
            </p>
          </div>

          <!-- 单选按钮组 -->
          <div v-else-if="field.type === 'radio'" class="flex flex-col gap-2">
            <h3 class="text-sm font-semibold m-0 mb-2 text-gray-700">
              {{ field.label }}
            </h3>
            <div class="flex flex-col gap-2">
              <label
                v-for="option in field.options"
                :key="option.value"
                class="flex items-center gap-2 text-[13px] text-gray-700 cursor-pointer p-2 rounded hover:bg-gray-50"
              >
                <input
                  type="radio"
                  :name="field.key"
                  :value="option.value"
                  :checked="config[field.key] === option.value"
                  @change="updateConfig(field.key, $event)"
                  class="cursor-pointer"
                />
                <div class="flex-1">
                  <div class="font-medium">{{ option.label }}</div>
                  <div v-if="option.description" class="text-xs text-gray-500">
                    {{ option.description }}
                  </div>
                </div>
              </label>
            </div>
            <p v-if="field.description" class="text-xs text-gray-500 m-0 mt-1">
              {{ field.description }}
            </p>
          </div>

          <!-- 按钮 -->
          <div v-else-if="field.type === 'button'" class="flex flex-col gap-2">
            <button
              :class="getButtonClass(field)"
              @click="handleButtonClick(field)"
              class="w-full px-4 py-2.5 border-none rounded-md text-white text-[13px] font-medium cursor-pointer transition-all duration-200 flex items-center justify-center gap-2"
            >
              {{ field.buttonText }}
            </button>
            <p v-if="field.description" class="text-xs text-gray-500 m-0">
              {{ field.description }}
            </p>
          </div>

          <!-- 颜色列表 -->
          <div
            v-else-if="field.type === 'color-list'"
            class="flex flex-col gap-2"
          >
            <h3 class="text-sm font-semibold m-0 mb-2 text-gray-700">
              {{ field.label }}
            </h3>
            <button
              class="w-full px-4 py-2.5 border-none rounded-md text-white text-[13px] font-medium cursor-pointer transition-all duration-200 flex items-center justify-center gap-2"
              :class="
                isPickingColor
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-blue-600 hover:bg-blue-700'
              "
              @click="toggleColorPicking"
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
              {{
                isPickingColor
                  ? "停止拾取（按ESC）"
                  : field.pickButtonText || "拾取颜色"
              }}
            </button>

            <!-- 已拾取的颜色 -->
            <div
              v-if="pickedColors.length > 0"
              class="mt-2 flex flex-col gap-2"
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
                  @click="removeColor(index)"
                >
                  ×
                </button>
              </div>
            </div>
            <p v-else class="text-xs text-gray-500 italic">
              {{ field.emptyText || "还未拾取任何颜色" }}
            </p>

            <!-- 清除按钮 -->
            <button
              v-if="pickedColors.length > 0"
              class="w-full px-4 py-2 border-none rounded-md bg-gray-600 text-white text-[13px] font-medium cursor-pointer transition-all duration-200 hover:bg-gray-700"
              @click="clearColors"
            >
              {{ field.clearButtonText || "清除所有颜色" }}
            </button>

            <p v-if="field.description" class="text-xs text-gray-500 m-0">
              {{ field.description }}
            </p>
          </div>

          <!-- 自定义组件 -->
          <div v-else-if="field.type === 'custom'" class="flex flex-col gap-2">
            <component
              :is="field.component"
              :context="pluginContext"
              :config="config"
              :pickedColors="pickedColors"
              :isPickingColor="isPickingColor"
              v-bind="field.props || {}"
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type {
  CutoutPlugin,
  SliderConfigField,
  ButtonConfigField,
  PluginContext,
} from "../typings";

interface Props {
  availablePlugins: CutoutPlugin[];
  currentPluginId: string;
  isPickingColor: boolean;
  pickedColors: Array<{ r: number; g: number; b: number }>;
  pluginContext: PluginContext;
  isCollapsed: boolean;
}

interface Emits {
  (e: "plugin-change", pluginId: string): void;
  (e: "config-change", key: string, value: any): void;
  (e: "toggle-color-picking"): void;
  (e: "remove-color", index: number): void;
  (e: "clear-colors"): void;
  (e: "button-click", field: ButtonConfigField): void;
  (e: "toggle-collapse"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const selectedPluginId = ref(props.currentPluginId);
const config = ref<Record<string, any>>({});

// 当前插件
const currentPlugin = computed(() => {
  return props.availablePlugins.find((p) => p.id === selectedPluginId.value);
});

// 初始化配置
watch(
  currentPlugin,
  (plugin) => {
    if (plugin) {
      config.value = plugin.getDefaultConfig();
    }
  },
  { immediate: true }
);

// 格式化显示值
const formatValue = (field: SliderConfigField, value: number): string => {
  if (field.format) {
    return field.format(value);
  }
  const formatted = value.toString();
  return field.unit ? `${formatted} ${field.unit}` : formatted;
};

// 获取按钮样式
const getButtonClass = (field: ButtonConfigField): string => {
  const variant = field.variant || "primary";
  const baseClass =
    "w-full px-4 py-2.5 border-none rounded-md text-white text-[13px] font-medium cursor-pointer transition-all duration-200 flex items-center justify-center gap-2";

  switch (variant) {
    case "primary":
      return `${baseClass} bg-blue-600 hover:bg-blue-700`;
    case "secondary":
      return `${baseClass} bg-gray-600 hover:bg-gray-700`;
    case "danger":
      return `${baseClass} bg-red-500 hover:bg-red-600`;
    default:
      return `${baseClass} bg-blue-600 hover:bg-blue-700`;
  }
};

// 更新配置
const updateConfig = (key: string, event: Event) => {
  const target = event.target as HTMLInputElement;
  let value: any;

  if (target.type === "range") {
    value = parseFloat(target.value);
  } else if (target.type === "radio") {
    value = target.value;
  } else {
    value = target.value;
  }

  config.value[key] = value;
  emit("config-change", key, value);
};

// 按钮点击
const handleButtonClick = (field: ButtonConfigField) => {
  emit("button-click", field);
};

// 颜色拾取
const toggleColorPicking = () => {
  emit("toggle-color-picking");
};

const removeColor = (index: number) => {
  emit("remove-color", index);
};

const clearColors = () => {
  emit("clear-colors");
};

// 监听外部的插件ID变化
watch(
  () => props.currentPluginId,
  (newId) => {
    selectedPluginId.value = newId;
  }
);

// 暴露配置给父组件
defineExpose({
  config,
});
</script>

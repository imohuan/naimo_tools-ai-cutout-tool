<template>
  <div
    class="h-full flex flex-col bg-white border-r border-gray-200 transition-all duration-300"
    :class="isCollapsed ? 'w-[60px]' : 'w-[250px]'"
  >
    <!-- 折叠按钮 -->
    <div
      class="flex items-center p-2 border-b border-gray-200"
      :class="isCollapsed ? 'justify-center' : 'justify-between'"
    >
      <span v-if="!isCollapsed" class="text-sm font-medium text-gray-700 ml-2"
        >图片列表</span
      >
      <button
        class="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg cursor-pointer transition-all hover:bg-gray-200"
        @click="toggleCollapse"
        :title="isCollapsed ? '展开' : '折叠'"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="w-5 h-5 text-gray-600 transition-transform duration-300"
          :class="{ 'rotate-180': isCollapsed }"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
    </div>

    <!-- 上传区 -->
    <div v-if="!isCollapsed" class="p-4 border-b border-gray-200">
      <div
        ref="uploadArea"
        class="flex items-center justify-center flex-col border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer transition-all duration-300 hover:border-blue-600 hover:bg-gray-50"
        :class="{ 'border-blue-600 bg-blue-50': isDragOver }"
        @click="handleUploadClick"
        @dragover.prevent="handleDragOver"
        @dragleave.prevent="handleDragLeave"
        @drop.prevent="handleDrop"
      >
        <svg
          class="w-8 h-8 mx-auto text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <p class="mt-1 text-xs text-gray-600">上传图片</p>
        <input
          ref="fileInput"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          class="hidden"
          @change="handleFileChange"
        />
      </div>
    </div>

    <!-- 折叠状态下的上传按钮 -->
    <div v-else class="p-2 border-b border-gray-200">
      <button
        class="w-full aspect-square flex items-center justify-center bg-blue-500 rounded-lg cursor-pointer transition-all hover:bg-blue-600"
        @click="handleUploadClick"
        title="上传图片"
      >
        <svg
          class="w-6 h-6 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 4v16m8-8H4"
          />
        </svg>
      </button>
      <input
        ref="fileInput"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        class="hidden"
        @change="handleFileChange"
      />
    </div>

    <!-- 图片列表 -->
    <div
      class="flex-1 overflow-y-auto flex flex-col scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100"
      :class="isCollapsed ? 'p-2 gap-2' : 'p-4 gap-3'"
    >
      <div
        v-for="(image, index) in images"
        :key="image.id"
        class="image-item relative border-2 border-gray-200 rounded-lg overflow-hidden cursor-pointer transition-all duration-200 group"
        :class="[
          isCollapsed
            ? 'hover:scale-105'
            : 'hover:scale-[1.02] hover:shadow-md',
          {
            'border-blue-600 shadow-[0_0_0_2px_#3b82f6]':
              index === currentIndex,
          },
        ]"
        @click="selectImage(index)"
      >
        <div
          class="w-full bg-contain bg-center bg-no-repeat bg-gray-100"
          :class="isCollapsed ? 'aspect-square' : 'aspect-video'"
          :style="{
            backgroundImage: image.original
              ? `url(${image.original.src})`
              : 'none',
          }"
        ></div>
        <button
          class="remove-btn absolute bg-black/60 border-none rounded-full cursor-pointer flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100 hover:bg-red-600/90"
          :class="
            isCollapsed ? 'top-0.5 right-0.5 w-4 h-4' : 'top-1 right-1 w-6 h-6'
          "
          @click.stop="removeImage(index)"
          title="删除"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            :class="isCollapsed ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'"
            class="text-white"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { ImageData } from "../typings";

interface Props {
  images: ImageData[];
  currentIndex: number;
}

interface Emits {
  (e: "add-images", files: File[]): void;
  (e: "select", index: number): void;
  (e: "remove", index: number): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const uploadArea = ref<HTMLDivElement>();
const fileInput = ref<HTMLInputElement>();
const isDragOver = ref(false);
const isCollapsed = ref(false);

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value;
};

const handleUploadClick = () => {
  fileInput.value?.click();
};

const handleDragOver = () => {
  isDragOver.value = true;
};

const handleDragLeave = () => {
  isDragOver.value = false;
};

const handleDrop = (e: DragEvent) => {
  isDragOver.value = false;
  const files = Array.from(e.dataTransfer?.files || []);
  if (files.length > 0) {
    emit("add-images", files);
  }
};

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const files = Array.from(target.files || []);
  if (files.length > 0) {
    emit("add-images", files);
  }
  target.value = "";
};

const selectImage = (index: number) => {
  emit("select", index);
};

const removeImage = (index: number) => {
  emit("remove", index);
};
</script>

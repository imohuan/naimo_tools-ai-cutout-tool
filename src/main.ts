/// <reference path="../typings/naimo.d.ts" />

import { createApp } from 'vue';
import App from './App.vue';
import './style.css';

// 创建 Vue 应用
const app = createApp(App);
app.mount('#app');

// 记录初始化
if (window.naimo) {
  window.naimo.log.info('AI 抠图工具初始化完成');
}

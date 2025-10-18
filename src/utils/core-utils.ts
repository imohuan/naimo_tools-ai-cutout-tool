/**
 * 核心工具函数
 */

/**
 * 让出控制权给浏览器，允许UI更新
 */
export function yieldToUI(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}



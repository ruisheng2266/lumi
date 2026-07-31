/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Lumi 设计系统（PRD §10.1）
        cream: '#FAF7F2',          // 主背景（暖奶油）
        ink: 'var(--color-text)',            // 主文字：引用 CSS 变量，随主题切换（浅=墨黑/深=浅奶油）
        fog: 'var(--color-text-muted)',      // 辅助文字：同上（浅=雾灰/深=亮雾灰）
        lavender: {
          50: '#F5F1FA',
          100: '#E8DFF4',
          200: '#D4C5E8',
          300: '#C8B6E2',          // 主色（柔薰衣草）
          400: '#A892D0',
          500: '#7A5CA8',          // 加深：文字在白底达 5.3:1（AA）
          600: '#6F58A0',          // 按钮底（白字 5.9:1，深浅主题通用）
        },
        coral: {
          50: '#FCF3F0',
          100: '#F8E0D8',
          200: '#F1C5B7',
          300: '#E8B4A0',          // 主色（暖珊瑚）
          400: '#D8957C',
          500: '#A85F47',          // 加深：图形/大字达 3:1（AA 非文本）
          600: '#A8573F',          // 按钮底（白字 5.1:1）
          700: '#8F4632',          // 按钮 hover
        },
        // 语义色
        success: '#7FA888',
        warning: '#D4A55A',
        danger: '#B05858',         // 加深：白字 4.9:1（AA）
      },
      fontFamily: {
        // zh-CN：苹方/思源黑体；en：Inter/Segoe UI
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          '"Helvetica Neue"',
          'Inter',
          'Segoe UI',
          'sans-serif',
        ],
      },
      borderRadius: {
        // PRD §10.1 圆角分级
        sm: '8px',
        DEFAULT: '12px',
        lg: '16px',
        xl: '24px',
      },
      boxShadow: {
        soft: '0 4px 16px rgba(45, 42, 38, 0.06)',
        card: '0 2px 8px rgba(45, 42, 38, 0.04)',
      },
      fontVariantNumeric: {
        tabular: 'tabular-nums',
      },
    },
  },
  plugins: [],
};
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Lumi 设计系统（PRD §10.1）
        cream: '#FAF7F2',          // 主背景（暖奶油）
        ink: '#2D2A26',            // 主文字（墨黑）
        fog: '#8B8680',            // 辅助文字（雾灰）
        lavender: {
          50: '#F5F1FA',
          100: '#E8DFF4',
          200: '#D4C5E8',
          300: '#C8B6E2',          // 主色（柔薰衣草）
          400: '#A892D0',
          500: '#8E73BF',
          600: '#6F58A0',
        },
        coral: {
          50: '#FCF3F0',
          100: '#F8E0D8',
          200: '#F1C5B7',
          300: '#E8B4A0',          // 主色（暖珊瑚）
          400: '#D8957C',
          500: '#C57759',
        },
        // 语义色
        success: '#7FA888',
        warning: '#D4A55A',
        danger: '#C57070',
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
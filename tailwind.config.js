/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 오행 속성 색상 (리라 스펙 §1-1)
        wood:  '#3D7A3A',
        fire:  '#C0392B',
        earth: '#C07A1A',
        metal: '#8B7536',
        water: '#2563A8',
        // 배경 계열
        'bg-base':    '#0D0B08',
        'bg-card':    '#141210',
        'bg-surface': '#1A1714',
        // 텍스트
        'text-primary':   '#E8E0D0',
        'text-secondary': '#A89880',
        'text-muted':     '#6B5F52',
        'text-accent':    '#E8C84A',
      },
      fontFamily: {
        serif: ['Noto Serif KR', 'serif'],
        sans:  ['Noto Sans KR', 'sans-serif'],
        mono:  ['DM Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

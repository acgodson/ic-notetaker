/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          500: '#667eea',
          600: '#5b21b6',
          700: '#4c1d95',
          900: '#312e81'
        },
        gradient: {
          from: '#667eea',  
          to: '#764ba2'
        }
      },
      animation: {
        'pulse-slow': 'pulse 2s infinite',
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out'
      },
      keyframes: {
        slideIn: {
          'from': { transform: 'translateX(100%)', opacity: '0' },
          'to': { transform: 'translateX(0)', opacity: '1' }
        },
        fadeIn: {
          'from': { opacity: '0' },
          'to': { opacity: '1' }
        }
      }
    },
  },
  plugins: [],
}
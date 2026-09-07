/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Azul-índigo — identidade própria da Calculadora Ótica, separada do
        // verde do AtendimentoLocaPronto/painel financeiro: é um produto à
        // parte, vendido para outras óticas, não uma extensão do mesmo dono.
        marca: {
          DEFAULT: '#4F46E5',
          escuro: '#4338CA',
          claro: '#818CF8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        suave: '0 1px 2px -1px rgb(15 23 42 / 0.06), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
        cartao: '0 1px 2px -1px rgb(15 23 42 / 0.05), 0 8px 20px -6px rgb(15 23 42 / 0.08)',
        flutuante: '0 8px 16px -4px rgb(15 23 42 / 0.12), 0 4px 6px -4px rgb(15 23 42 / 0.08)',
      },
      keyframes: {
        'entra-baixo': {
          from: { opacity: 0, transform: 'translateY(6px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        'entra-cima': {
          from: { opacity: 0, transform: 'translateY(-4px) scale(.98)' },
          to: { opacity: 1, transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'entra-baixo': 'entra-baixo .25s ease-out both',
        'entra-cima': 'entra-cima .15s ease-out both',
      },
    },
  },
  plugins: [],
};

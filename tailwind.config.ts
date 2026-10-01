import 'tailwindcss/plugin';

export default {
    theme: {
      extend: {
        fontFamily: {
          'sans': ['var(--font)']
        },
      },
    },
    content: {
        files: [
            './src/**/*.{html,js,svelte,ts}',
        ],
        transform: {
        }
      },
    variants: {},
    plugins: [
        function ({ addUtilities }) {
      const newUtilities = {
        '.flex-center': {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
      };
      addUtilities(newUtilities);
    },
      ]
      
  }

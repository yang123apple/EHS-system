/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    // 关键修改：从 'tailwindcss' 改为 '@tailwindcss/postcss'
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
};

export default config;
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/components/**/*.{vue,js,ts,jsx,tsx}',
    './app/pages/**/*.{vue,js,ts,jsx,tsx}',
    './app/layouts/**/*.{vue,js,ts}',
    './app/app.*',
    './content/**/*.{md,mdx}'
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

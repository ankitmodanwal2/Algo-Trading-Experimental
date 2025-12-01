/** @type {import('tailwindcss').Config} */
export default {
    // ⬇️ THIS ARRAY IS CRITICAL. IF IT IS WRONG, NO STYLES WILL LOAD. ⬇️
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {},
    },
    plugins: [],
}